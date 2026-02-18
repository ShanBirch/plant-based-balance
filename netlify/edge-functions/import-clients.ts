/**
 * Netlify Edge Function: Import Clients
 * Creates user accounts for imported clients (from Trainerize, CSV, etc.)
 * Uses Supabase Admin API to invite users via email
 */

import { createClient } from '@supabase/supabase-js';

interface ClientRecord {
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
}

interface ImportRequest {
  clients: ClientRecord[];
  sendInvite: boolean;
  adminUserId: string;
}

export default async (request: Request): Promise<Response> => {
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
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers
    });
  }

  try {
    const body: ImportRequest = await request.json();
    const { clients, sendInvite, adminUserId } = body;

    if (!clients || !Array.isArray(clients) || clients.length === 0) {
      return new Response(JSON.stringify({
        error: 'No clients provided',
        message: 'Please provide an array of client records to import.'
      }), { status: 400, headers });
    }

    if (clients.length > 200) {
      return new Response(JSON.stringify({
        error: 'Too many clients',
        message: 'Maximum 200 clients per import. Please split into smaller batches.'
      }), { status: 400, headers });
    }

    // Initialize Supabase with service role for admin operations
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      return new Response(JSON.stringify({ error: 'Server configuration error' }), {
        status: 500,
        headers
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify the requesting user is an admin
    const { data: adminCheck } = await supabase
      .from('admin_users')
      .select('role')
      .eq('user_id', adminUserId)
      .maybeSingle();

    if (!adminCheck) {
      return new Response(JSON.stringify({ error: 'Unauthorized - admin access required' }), {
        status: 403,
        headers
      });
    }

    // Get existing user emails to avoid duplicates
    const { data: existingUsers } = await supabase
      .from('users')
      .select('email');

    const existingEmails = new Set(
      (existingUsers || []).map((u: { email: string }) => u.email.toLowerCase())
    );

    const results: {
      imported: { email: string; name: string }[];
      skipped: { email: string; reason: string }[];
      failed: { email: string; error: string }[];
    } = {
      imported: [],
      skipped: [],
      failed: []
    };

    for (const client of clients) {
      const email = (client.email || '').trim().toLowerCase();

      // Validate email
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        results.skipped.push({ email: email || '(empty)', reason: 'Invalid email address' });
        continue;
      }

      // Skip duplicates
      if (existingEmails.has(email)) {
        results.skipped.push({ email, reason: 'User already exists' });
        continue;
      }

      try {
        const fullName = [client.firstName, client.lastName].filter(Boolean).join(' ').trim();

        if (sendInvite) {
          // Invite user via email — they'll get a magic link to set their password
          const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
            data: {
              name: fullName || undefined,
              phone: client.phone || undefined,
              imported_from: 'admin_import',
              imported_at: new Date().toISOString()
            },
            redirectTo: `${new URL(request.url).origin}/login.html`
          });

          if (error) {
            results.failed.push({ email, error: error.message });
            continue;
          }

          // The database trigger should create the public.users row,
          // but update it with the name if we have one
          if (data.user && fullName) {
            await supabase
              .from('users')
              .update({ name: fullName })
              .eq('id', data.user.id);
          }
        } else {
          // Create user without sending invite email
          // Generate a random password (user will need to use "forgot password" to log in)
          const tempPassword = crypto.randomUUID() + crypto.randomUUID();

          const { data, error } = await supabase.auth.admin.createUser({
            email,
            password: tempPassword,
            email_confirm: false,
            user_metadata: {
              name: fullName || undefined,
              phone: client.phone || undefined,
              imported_from: 'admin_import',
              imported_at: new Date().toISOString()
            }
          });

          if (error) {
            results.failed.push({ email, error: error.message });
            continue;
          }

          if (data.user && fullName) {
            await supabase
              .from('users')
              .update({ name: fullName })
              .eq('id', data.user.id);
          }
        }

        existingEmails.add(email);
        results.imported.push({ email, name: fullName || email });
      } catch (err) {
        results.failed.push({
          email,
          error: err instanceof Error ? err.message : 'Unknown error'
        });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      summary: {
        total: clients.length,
        imported: results.imported.length,
        skipped: results.skipped.length,
        failed: results.failed.length
      },
      results
    }), { status: 200, headers });

  } catch (err) {
    console.error('Import clients error:', err);
    return new Response(JSON.stringify({
      error: 'Import failed',
      message: err instanceof Error ? err.message : 'Unknown error'
    }), { status: 500, headers });
  }
};
