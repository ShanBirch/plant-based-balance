/**
 * Netlify Edge Function: Redeem Points
 * Converts points to free subscription days via Stripe
 */

import type { Context } from "https://edge.netlify.com";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0?target=denonext&deps=@supabase/functions-js@2.1.5';
import Stripe from 'https://esm.sh/stripe@14.21.0';

const POINTS_FOR_FREE_WEEK = 200;
const FREE_DAYS_PER_REDEMPTION = 7;

interface RedeemRequest {
  userId: string;
}

interface RedeemResult {
  success: boolean;
  pointsRedeemed?: number;
  daysAdded?: number;
  newPointsBalance?: number;
  newSubscriptionEnd?: string;
  error?: string;
  message?: string;
  currentPoints?: number;
  required?: number;
}

export default async (request: Request, context: Context): Promise<Response> => {
  // CORS headers
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  // Handle preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers
    });
  }

  try {
    const body: RedeemRequest = await request.json();
    const { userId } = body;

    if (!userId) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Missing userId'
      }), {
        status: 400,
        headers
      });
    }

    // Initialize clients
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');

    if (!supabaseUrl || !supabaseKey) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Server configuration error'
      }), {
        status: 500,
        headers
      });
    }

    if (!stripeSecretKey) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Payment system unavailable'
      }), {
        status: 500,
        headers
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2024-11-20.acacia',
      httpClient: Stripe.createFetchHttpClient(),
    });

    // Get user's points
    const { data: userPoints, error: pointsError } = await supabase
      .from('user_points')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (pointsError || !userPoints) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Points record not found',
        message: 'Start tracking meals or workouts to earn points!'
      }), {
        status: 404,
        headers
      });
    }

    // Check if user has enough points
    if (userPoints.current_points < POINTS_FOR_FREE_WEEK) {
      const result: RedeemResult = {
        success: false,
        error: 'Insufficient points',
        message: `You need ${POINTS_FOR_FREE_WEEK - userPoints.current_points} more points to redeem a free week.`,
        currentPoints: userPoints.current_points,
        required: POINTS_FOR_FREE_WEEK
      };
      return new Response(JSON.stringify(result), {
        status: 200, // Return 200 so client can handle gracefully
        headers
      });
    }

    // Get user's Stripe customer ID
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('stripe_customer_id, email')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return new Response(JSON.stringify({
        success: false,
        error: 'User not found'
      }), {
        status: 404,
        headers
      });
    }

    if (!user.stripe_customer_id) {
      return new Response(JSON.stringify({
        success: false,
        error: 'No subscription found',
        message: 'You need an active subscription to redeem points for free days.'
      }), {
        status: 200,
        headers
      });
    }

    // Get active subscription from Stripe
    let subscriptions;
    try {
      subscriptions = await stripe.subscriptions.list({
        customer: user.stripe_customer_id,
        status: 'active',
        limit: 1
      });
    } catch (stripeError) {
      console.error('Stripe error fetching subscriptions:', stripeError);
      return new Response(JSON.stringify({
        success: false,
        error: 'Could not verify subscription',
        message: 'Please try again later.'
      }), {
        status: 500,
        headers
      });
    }

    if (subscriptions.data.length === 0) {
      // Also check for trialing subscriptions
      const trialingSubscriptions = await stripe.subscriptions.list({
        customer: user.stripe_customer_id,
        status: 'trialing',
        limit: 1
      });

      if (trialingSubscriptions.data.length === 0) {
        return new Response(JSON.stringify({
          success: false,
          error: 'No active subscription',
          message: 'Points can only be redeemed with an active subscription.'
        }), {
          status: 200,
          headers
        });
      }

      subscriptions = trialingSubscriptions;
    }

    const subscription = subscriptions.data[0];

    // Calculate new end date
    const currentPeriodEnd = subscription.current_period_end || subscription.trial_end || Math.floor(Date.now() / 1000);
    const daysInSeconds = FREE_DAYS_PER_REDEMPTION * 24 * 60 * 60;
    const newPeriodEnd = currentPeriodEnd + daysInSeconds;

    // Update subscription in Stripe
    try {
      await stripe.subscriptions.update(subscription.id, {
        trial_end: newPeriodEnd,
        proration_behavior: 'none',
        metadata: {
          ...subscription.metadata,
          points_redeemed_total: (parseInt(subscription.metadata.points_redeemed_total || '0') + POINTS_FOR_FREE_WEEK).toString(),
          weeks_redeemed_total: (parseInt(subscription.metadata.weeks_redeemed_total || '0') + 1).toString(),
          last_points_redemption: new Date().toISOString()
        }
      });
    } catch (stripeError) {
      console.error('Stripe error updating subscription:', stripeError);
      return new Response(JSON.stringify({
        success: false,
        error: 'Could not extend subscription',
        message: 'Please try again later.'
      }), {
        status: 500,
        headers
      });
    }

    // Deduct points from user
    const newPointsBalance = userPoints.current_points - POINTS_FOR_FREE_WEEK;
    const { error: updateError } = await supabase
      .from('user_points')
      .update({
        current_points: newPointsBalance,
        redeemed_points: userPoints.redeemed_points + POINTS_FOR_FREE_WEEK,
        weeks_redeemed: userPoints.weeks_redeemed + 1,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId);

    if (updateError) {
      console.error('Error updating user points after redemption:', updateError);
      // Points already deducted from Stripe, so we should still report success
      // but log the error for manual reconciliation
    }

    // Log redemption transaction
    await supabase.from('point_transactions').insert({
      user_id: userId,
      transaction_type: 'redeem_week',
      points_amount: -POINTS_FOR_FREE_WEEK,
      reference_type: 'redemption',
      description: `Redeemed ${POINTS_FOR_FREE_WEEK} points for ${FREE_DAYS_PER_REDEMPTION} free days`
    });

    // Update user's free_days_earned in users table
    await supabase
      .from('users')
      .update({
        free_days_earned: (user as any).free_days_earned
          ? (user as any).free_days_earned + FREE_DAYS_PER_REDEMPTION
          : FREE_DAYS_PER_REDEMPTION
      })
      .eq('id', userId);

    const result: RedeemResult = {
      success: true,
      pointsRedeemed: POINTS_FOR_FREE_WEEK,
      daysAdded: FREE_DAYS_PER_REDEMPTION,
      newPointsBalance: newPointsBalance,
      newSubscriptionEnd: new Date(newPeriodEnd * 1000).toISOString()
    };

    console.log(`User ${userId} redeemed ${POINTS_FOR_FREE_WEEK} points for ${FREE_DAYS_PER_REDEMPTION} free days`);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers
    });

  } catch (error) {
    console.error('Error in redeem-points:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to redeem points',
      message: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers
    });
  }
};

export const config = {
  path: '/api/redeem-points'
};
