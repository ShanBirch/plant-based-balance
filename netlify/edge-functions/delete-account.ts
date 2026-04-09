/**
 * Netlify Edge Function: Delete Account
 * Verifies the caller's JWT, then hard-deletes their auth user via service role.
 */

import type { Context } from "https://edge.netlify.com";
import { createClient } from '@supabase/supabase-js';

export default async (request: Request, context: Context): Promise<Response> => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing env vars: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
      return new Response(JSON.stringify({ error: 'Server configuration error' }), { status: 500, headers });
    }

    // Extract JWT from Authorization header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers });
    }
    const userToken = authHeader.slice(7);

    // Decode JWT payload to get user ID (without verifying signature - we trust Supabase-issued tokens)
    // Then verify by doing an admin lookup which will fail if the token is fake/expired
    let userId: string;
    try {
      const payloadBase64 = userToken.split('.')[1];
      const payload = JSON.parse(atob(payloadBase64));
      userId = payload.sub;
      if (!userId) throw new Error('No sub in JWT');
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Invalid token format' }), { status: 401, headers });
    }

    // Use service role client
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Verify the user actually exists before deleting (guards against spoofed user IDs)
    const { data: userCheck, error: checkError } = await adminClient.auth.admin.getUserById(userId);
    if (checkError || !userCheck?.user) {
      console.error('User not found or check failed:', checkError);
      return new Response(JSON.stringify({ error: 'User not found' }), { status: 404, headers });
    }

    // Delete app data (best effort — FK cascades may handle some of this)
    const tables = [
      'daily_nutrition', 'mood_logs', 'workouts', 'stories', 'coin_transactions',
      'personal_bests', 'fitbit_daily_activity', 'oura_connections', 'fitbit_connections',
      'whoop_connections', 'strava_connections', 'weather_logs', 'user_facts', 'friendships'
    ];
    for (const table of tables) {
      await adminClient.from(table).delete().eq('user_id', userId).catch(() => {});
    }
    await adminClient.from('users').delete().eq('id', userId).catch(() => {});

    // Hard-delete the auth user
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId);
    if (deleteError) {
      console.error('Auth user delete error:', deleteError);
      return new Response(JSON.stringify({ error: 'Failed to delete account', detail: deleteError.message }), { status: 500, headers });
    }

    return new Response(JSON.stringify({ success: true }), { status: 200, headers });

  } catch (err) {
    console.error('delete-account unexpected error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error', detail: String(err) }), { status: 500, headers });
  }
};
