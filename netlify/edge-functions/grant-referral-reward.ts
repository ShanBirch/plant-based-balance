/**
 * Netlify Edge Function: Grant Referral Reward
 * Grants 1 week of double XP to a user when their referral is completed
 * No stacking - user can only have one active double XP period at a time
 */

import type { Context } from "https://edge.netlify.com";
import { createClient } from '@supabase/supabase-js';

interface GrantRewardRequest {
  userId: string;
  referralId?: string;
}

interface GrantRewardResult {
  success: boolean;
  doubleXpGranted: boolean;
  doubleXpUntil: string | null;
  message: string;
  error?: string;
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
    const body: GrantRewardRequest = await request.json();
    const { userId, referralId } = body;

    if (!userId) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Missing required field: userId'
      }), {
        status: 400,
        headers
      });
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      console.error('Missing Supabase environment variables');
      return new Response(JSON.stringify({ error: 'Server configuration error' }), {
        status: 500,
        headers
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check if user already has active double XP (no stacking)
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, double_xp_until')
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

    // Check if user already has active double XP
    const now = new Date();
    if (user.double_xp_until && new Date(user.double_xp_until) > now) {
      // User already has active double XP - no stacking allowed
      const result: GrantRewardResult = {
        success: true,
        doubleXpGranted: false,
        doubleXpUntil: user.double_xp_until,
        message: 'User already has active double XP - reward saved for when current period expires'
      };

      // Mark referral as completed but note that reward is pending
      if (referralId) {
        const { data: referralData } = await supabase
          .from('referrals')
          .update({
            status: 'completed',
            reward_granted: false, // Not granted yet due to stacking
            updated_at: now.toISOString()
          })
          .eq('id', referralId)
          .select('referrer_user_id, referred_user_id')
          .single();

        // Still auto-add as friends even if double XP can't be granted yet
        if (referralData) {
          await supabase
            .from('friendships')
            .upsert([{
              user_id: referralData.referred_user_id,
              friend_id: referralData.referrer_user_id,
              status: 'accepted'
            }], { onConflict: 'user_id,friend_id' })
            .then(({ error }) => {
              if (error) console.warn('Could not auto-add friend via referral:', error.message);
              else console.log(`Auto-added friendship between referrer ${referralData.referrer_user_id} and referred user ${referralData.referred_user_id}`);
            });
        }
      }

      console.log(`Double XP not granted to user ${userId} - already has active double XP until ${user.double_xp_until}`);

      return new Response(JSON.stringify(result), {
        status: 200,
        headers
      });
    }

    // Grant 1 week (7 days) of double XP
    const doubleXpUntil = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const { error: updateError } = await supabase
      .from('users')
      .update({
        double_xp_until: doubleXpUntil.toISOString()
      })
      .eq('id', userId);

    if (updateError) {
      console.error('Error granting double XP:', updateError);
      throw updateError;
    }

    // Update referral record if provided
    if (referralId) {
      const { data: referralData } = await supabase
        .from('referrals')
        .update({
          reward_granted: true,
          reward_granted_at: now.toISOString(),
          status: 'completed'
        })
        .eq('id', referralId)
        .select('referrer_user_id, referred_user_id')
        .single();

      // Auto-add referrer and referred user as friends (server-side with service role key)
      if (referralData) {
        const { error: friendError } = await supabase
          .from('friendships')
          .upsert([{
            user_id: referralData.referred_user_id,
            friend_id: referralData.referrer_user_id,
            status: 'accepted'
          }], { onConflict: 'user_id,friend_id' });

        if (friendError) {
          console.warn('Could not auto-add friend via referral:', friendError.message);
        } else {
          console.log(`Auto-added friendship between referrer ${referralData.referrer_user_id} and referred user ${referralData.referred_user_id}`);
        }
      }
    }

    // Increment user's referrals_count
    await supabase.rpc('increment_referrals_count', { user_uuid: userId }).catch(() => {
      // Fallback if RPC doesn't exist
      console.log('increment_referrals_count RPC not found, using direct update');
    });

    const result: GrantRewardResult = {
      success: true,
      doubleXpGranted: true,
      doubleXpUntil: doubleXpUntil.toISOString(),
      message: `Double XP granted! Active until ${doubleXpUntil.toLocaleDateString()}`
    };

    console.log(`Granted 1 week double XP to user ${userId} until ${doubleXpUntil.toISOString()}`);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers
    });

  } catch (error) {
    console.error('Error in grant-referral-reward:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to grant referral reward',
      message: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers
    });
  }
};

export const config = {
  path: '/api/grant-referral-reward'
};
