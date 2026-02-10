// track-analytics.js - Edge function for receiving analytics events via sendBeacon
// Used primarily for session_end events that fire during page unload

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export default async (request, context) => {
  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      }
    });
  }

  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const body = await request.json();
    const { event_type, event_data } = body;

    if (!event_type) {
      return new Response(JSON.stringify({ error: 'Missing event_type' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Extract user from Authorization header if present
    const authHeader = request.headers.get('Authorization');
    let userId = null;

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || 'https://hzapaorxqboevxnumxkv.supabase.co';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey);

      // Try to get user from auth header
      if (authHeader) {
        const token = authHeader.replace('Bearer ', '');
        const { data: { user } } = await supabase.auth.getUser(token);
        userId = user?.id;
      }

      // Log to user_activity if we have a user
      if (userId) {
        context.waitUntil(
          supabase.from('user_activity').insert({
            user_id: userId,
            activity_type: event_type,
            activity_data: event_data || {}
          })
        );
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (error) {
    console.error('Track Analytics Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
