/**
 * Netlify Edge Function: Delete Account
 * Verifies the caller is authenticated, then hard-deletes their auth user
 * (which cascades to all app data via DB foreign keys / the client-side cleanup).
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
      return new Response(JSON.stringify({ error: 'Server configuration error' }), { status: 500, headers });
    }

    // Verify the caller is authenticated using their JWT
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers });
    }
    const userToken = authHeader.slice(7);

    // Verify the JWT and get the user using the service role client
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: { user }, error: userError } = await adminClient.auth.getUser(userToken);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid or expired token' }), { status: 401, headers });
    }

    const userId = user.id;

    // Delete app data first (best effort — FK cascades may already handle this)
    const tables = [
      'daily_nutrition', 'mood_logs', 'workouts', 'stories', 'coin_transactions',
      'personal_bests', 'fitbit_daily_activity', 'oura_connections', 'fitbit_connections',
      'whoop_connections', 'strava_connections', 'weather_logs', 'user_facts', 'friendships'
    ];

    for (const table of tables) {
      await adminClient.from(table).delete().eq('user_id', userId).throwOnError().catch(() => {});
    }

    // Delete from users table
    await adminClient.from('users').delete().eq('id', userId).throwOnError().catch(() => {});

    // Hard-delete the auth user
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId);

    if (deleteError) {
      console.error('Auth user delete error:', deleteError);
      return new Response(JSON.stringify({ error: 'Failed to delete account', detail: deleteError.message }), { status: 500, headers });
    }

    return new Response(JSON.stringify({ success: true }), { status: 200, headers });

  } catch (err) {
    console.error('delete-account error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers });
  }
};
