/**
 * Netlify Edge Function: Delete Account
 * Uses Supabase Admin REST API directly (no SDK admin methods that may be unavailable in edge runtime).
 *
 * Strategy: most user-referencing tables have ON DELETE CASCADE on public.users(id),
 * which itself cascades from auth.users(id). A few FKs lack a cascade clause and
 * therefore block the cascade — null those out first, then let the auth admin
 * delete cascade through everything else.
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

    // Null out FK columns that reference public.users(id) without ON DELETE CASCADE/SET NULL.
    // Without this, the cascade from auth.users -> public.users is blocked by NO ACTION FKs.
    const nullableRefs: Array<{ table: string; column: string }> = [
      { table: 'users', column: 'referred_by_user_id' },
      { table: 'challenges', column: 'winner_id' },
      { table: 'game_matches', column: 'winner_id' },
      { table: 'tamagotchi_battles', column: 'winner_id' },
      { table: 'quiz_battles', column: 'winner_id' },
      { table: 'workout_duels', column: 'winner_id' },
      { table: 'pending_coach_responses', column: 'approved_by' },
    ];
    for (const { table, column } of nullableRefs) {
      const url = `${supabaseUrl}/rest/v1/${table}?${column}=eq.${userId}`;
      const res = await fetch(url, {
        method: 'PATCH',
        headers: apiHeaders,
        body: JSON.stringify({ [column]: null }),
      }).catch((e) => { console.warn(`PATCH ${table}.${column} threw:`, e); return null; });
      if (res && !res.ok) {
        const body = await res.text().catch(() => '');
        console.warn(`PATCH ${table}.${column} failed: ${res.status} ${body}`);
      }
    }

    // Hard-delete the auth user. ON DELETE CASCADE on public.users(id) will cascade
    // through all CASCADE-linked tables (workouts, daily_nutrition, friendships, etc.).
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
