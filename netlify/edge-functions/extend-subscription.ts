/**
 * Netlify Edge Function: Extend Stripe Subscription
 * Adds free days to a user's Stripe subscription when they earn referral rewards
 */

import type { Context } from "https://edge.netlify.com";
import Stripe from 'stripe';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2024-11-20.acacia',
  httpClient: Stripe.createFetchHttpClient(),
});

interface ExtendSubscriptionRequest {
  userId: string;
  daysToAdd: number;
  referralId?: string;
}

export default async (request: Request, context: Context) => {
  // Only allow POST requests
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const body: ExtendSubscriptionRequest = await request.json();
    const { userId, daysToAdd, referralId } = body;

    if (!userId || !daysToAdd) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get user from Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    const userResponse = await fetch(`${supabaseUrl}/rest/v1/users?id=eq.${userId}&select=*`, {
      headers: {
        'apikey': supabaseServiceKey || '',
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json'
      }
    });

    const users = await userResponse.json();
    if (!users || users.length === 0) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const user = users[0];
    const stripeCustomerId = user.stripe_customer_id;

    if (!stripeCustomerId) {
      return new Response(JSON.stringify({ error: 'User has no Stripe customer ID' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get active subscriptions for this customer
    const subscriptions = await stripe.subscriptions.list({
      customer: stripeCustomerId,
      status: 'active',
      limit: 1
    });

    if (subscriptions.data.length === 0) {
      return new Response(JSON.stringify({ error: 'No active subscription found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const subscription = subscriptions.data[0];

    // Calculate new end date (current_period_end + days)
    const currentPeriodEnd = subscription.current_period_end;
    const daysInSeconds = daysToAdd * 24 * 60 * 60;
    const newPeriodEnd = currentPeriodEnd + daysInSeconds;

    // Update the subscription to extend the billing period
    // We do this by setting trial_end to the new period end date
    // This extends the current billing period without charging the customer
    const updatedSubscription = await stripe.subscriptions.update(subscription.id, {
      trial_end: newPeriodEnd,
      proration_behavior: 'none', // Don't create proration invoices
      metadata: {
        ...subscription.metadata,
        referral_rewards: (parseInt(subscription.metadata.referral_rewards || '0') + daysToAdd).toString(),
        last_referral_reward: new Date().toISOString(),
        ...(referralId && { last_referral_id: referralId })
      }
    });

    // Log the extension for analytics
    console.log(`Extended subscription ${subscription.id} for user ${userId} by ${daysToAdd} days`);

    // Update referral record if provided
    if (referralId) {
      await fetch(`${supabaseUrl}/rest/v1/referrals?id=eq.${referralId}`, {
        method: 'PATCH',
        headers: {
          'apikey': supabaseServiceKey || '',
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          reward_granted: true,
          reward_granted_at: new Date().toISOString(),
          status: 'completed'
        })
      });
    }

    return new Response(JSON.stringify({
      success: true,
      subscription_id: subscription.id,
      days_added: daysToAdd,
      new_period_end: newPeriodEnd,
      new_period_end_date: new Date(newPeriodEnd * 1000).toISOString()
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error extending subscription:', error);

    return new Response(JSON.stringify({
      error: 'Failed to extend subscription',
      message: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const config = {
  path: '/api/extend-subscription'
};
