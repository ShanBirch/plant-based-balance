/**
 * Netlify Edge Function: Delete Account
 * Uses Supabase Admin REST API directly (no SDK admin methods that may be unavailable in edge runtime).
 */

import type { Context } from "https://edge.netlify.com";

export default async (request: Request, context: Context): Promise<Response> => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (request.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceKey) {
      console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
      return new Response(JSON.stringify({ error: 'Server configuration error' }), { status: 500, headers });
    }

    // Extract and decode JWT to get user ID
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers });
    }
    const token = authHeader.slice(7);

    let userId: string;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      userId = payload.sub;
      if (!userId) throw new Error('No sub');
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 401, headers });
    }

    const apiHeaders = {
      'Authorization': `Bearer ${serviceKey}`,
      'apikey': serviceKey,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal',
    };

    // Delete app data (best effort)
    const tables = [
      'daily_nutrition', 'mood_logs', 'workouts', 'stories', 'coin_transactions',
      'personal_bests', 'fitbit_daily_activity', 'oura_connections', 'fitbit_connections',
      'whoop_connections', 'strava_connections', 'weather_logs', 'user_facts', 'friendships'
    ];
    for (const table of tables) {
      await fetch(`${supabaseUrl}/rest/v1/${table}?user_id=eq.${userId}`, {
        method: 'DELETE', headers: apiHeaders
      }).catch(() => {});
    }
    await fetch(`${supabaseUrl}/rest/v1/users?id=eq.${userId}`, {
      method: 'DELETE', headers: apiHeaders
    }).catch(() => {});

    // Hard-delete the auth user via Admin REST API
    const deleteRes = await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${serviceKey}`,
        'apikey': serviceKey,
      }
    });

    if (!deleteRes.ok) {
      const body = await deleteRes.text();
      console.error('Auth delete failed:', deleteRes.status, body);
      return new Response(JSON.stringify({ error: 'Failed to delete auth user', detail: body }), { status: 500, headers });
    }

    return new Response(JSON.stringify({ success: true }), { status: 200, headers });

  } catch (err) {
    console.error('delete-account error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error', detail: String(err) }), { status: 500, headers });
  }
};
