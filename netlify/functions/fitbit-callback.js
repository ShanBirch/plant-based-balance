const { createClient } = require('@supabase/supabase-js');

// Environment configuration
const FITBIT_CLIENT_ID = process.env.FITBIT_CLIENT_ID;
const FITBIT_CLIENT_SECRET = process.env.FITBIT_CLIENT_SECRET;
const FITBIT_REDIRECT_URI = process.env.FITBIT_REDIRECT_URI;

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://hzapaorxqboevxnumxkv.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

exports.handler = async (event) => {
  // Only accept GET requests (OAuth callback)
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { code, state, error: oauthError } = event.queryStringParameters || {};

    // Check for OAuth errors
    if (oauthError) {
      return {
        statusCode: 400,
        headers: {
          'Location': `/settings.html?error=fitbit_${oauthError}`,
          'Cache-Control': 'no-cache'
        },
        body: ''
      };
    }

    // Validate required parameters
    if (!code || !state) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required parameters' })
      };
    }

    // State contains the user ID (passed from OAuth initiation)
    const userId = state;

    // Exchange authorization code for access token
    const tokenResponse = await fetch('https://api.fitbit.com/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${FITBIT_CLIENT_ID}:${FITBIT_CLIENT_SECRET}`).toString('base64')}`
      },
      body: new URLSearchParams({
        code: code,
        grant_type: 'authorization_code',
        redirect_uri: FITBIT_REDIRECT_URI
      })
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Fitbit token exchange failed:', errorText);
      return {
        statusCode: 302,
        headers: {
          'Location': `/settings.html?error=fitbit_token_failed`,
          'Cache-Control': 'no-cache'
        },
        body: ''
      };
    }

    const tokenData = await tokenResponse.json();
    const { access_token, refresh_token, expires_in, user_id, scope } = tokenData;

    // Calculate token expiration
    const expiresAt = new Date(Date.now() + expires_in * 1000).toISOString();

    // Store integration in Supabase
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const { data, error: dbError } = await supabase
      .from('fitness_integrations')
      .upsert({
        user_id: userId,
        provider: 'fitbit',
        provider_user_id: user_id,
        access_token: access_token,
        refresh_token: refresh_token,
        token_expires_at: expiresAt,
        scopes: scope.split(' '),
        is_active: true,
        connected_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,provider'
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
      return {
        statusCode: 302,
        headers: {
          'Location': `/settings.html?error=fitbit_db_error`,
          'Cache-Control': 'no-cache'
        },
        body: ''
      };
    }

    // Trigger initial sync
    try {
      const baseUrl = `https://${event.headers.host}`;
      await fetch(`${baseUrl}/.netlify/functions/fitbit-sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: userId,
          syncType: 'initial'
        })
      });
    } catch (syncError) {
      console.error('Initial sync trigger failed:', syncError);
      // Don't fail the connection if sync fails
    }

    // Redirect to settings page with success message
    return {
      statusCode: 302,
      headers: {
        'Location': `/settings.html?success=fitbit_connected`,
        'Cache-Control': 'no-cache'
      },
      body: ''
    };

  } catch (error) {
    console.error('Fitbit callback error:', error);
    return {
      statusCode: 302,
      headers: {
        'Location': `/settings.html?error=fitbit_connection_failed`,
        'Cache-Control': 'no-cache'
      },
      body: ''
    };
  }
};
