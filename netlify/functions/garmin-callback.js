const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

// Environment configuration
const GARMIN_CONSUMER_KEY = process.env.GARMIN_CONSUMER_KEY;
const GARMIN_CONSUMER_SECRET = process.env.GARMIN_CONSUMER_SECRET;

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://hzapaorxqboevxnumxkv.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

/**
 * Generate OAuth 1.0a signature
 */
function generateOAuthSignature(method, url, params, consumerSecret, tokenSecret = '') {
  // Sort parameters
  const sortedParams = Object.keys(params)
    .sort()
    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
    .join('&');

  // Create signature base string
  const signatureBaseString = [
    method.toUpperCase(),
    encodeURIComponent(url),
    encodeURIComponent(sortedParams)
  ].join('&');

  // Create signing key
  const signingKey = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(tokenSecret)}`;

  // Generate signature
  const signature = crypto
    .createHmac('sha1', signingKey)
    .update(signatureBaseString)
    .digest('base64');

  return signature;
}

exports.handler = async (event) => {
  // Only accept GET requests (OAuth callback)
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { oauth_token, oauth_verifier } = event.queryStringParameters || {};

    // Validate required parameters
    if (!oauth_token || !oauth_verifier) {
      return {
        statusCode: 302,
        headers: {
          'Location': `/settings.html?error=garmin_missing_params`,
          'Cache-Control': 'no-cache'
        },
        body: ''
      };
    }

    // Get temporary token data from Supabase (stored during OAuth initiation)
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const { data: tempToken, error: tempError } = await supabase
      .from('oauth_temp_tokens')
      .select('*')
      .eq('oauth_token', oauth_token)
      .eq('provider', 'garmin')
      .single();

    if (tempError || !tempToken) {
      console.error('Failed to retrieve temp token:', tempError);
      return {
        statusCode: 302,
        headers: {
          'Location': `/settings.html?error=garmin_invalid_token`,
          'Cache-Control': 'no-cache'
        },
        body: ''
      };
    }

    const userId = tempToken.user_id;
    const oauthTokenSecret = tempToken.oauth_token_secret;

    // Exchange for access token
    const accessTokenUrl = 'https://connectapi.garmin.com/oauth-service/oauth/access_token';

    const oauthParams = {
      oauth_consumer_key: GARMIN_CONSUMER_KEY,
      oauth_token: oauth_token,
      oauth_signature_method: 'HMAC-SHA1',
      oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
      oauth_nonce: crypto.randomBytes(16).toString('hex'),
      oauth_version: '1.0',
      oauth_verifier: oauth_verifier
    };

    // Generate signature
    const signature = generateOAuthSignature('POST', accessTokenUrl, oauthParams, GARMIN_CONSUMER_SECRET, oauthTokenSecret);
    oauthParams.oauth_signature = signature;

    // Build authorization header
    const authHeader = 'OAuth ' + Object.keys(oauthParams)
      .map(key => `${key}="${encodeURIComponent(oauthParams[key])}"`)
      .join(', ');

    // Exchange for access token
    const tokenResponse = await fetch(accessTokenUrl, {
      method: 'POST',
      headers: {
        'Authorization': authHeader
      }
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Garmin token exchange failed:', errorText);
      return {
        statusCode: 302,
        headers: {
          'Location': `/settings.html?error=garmin_token_failed`,
          'Cache-Control': 'no-cache'
        },
        body: ''
      };
    }

    const responseText = await tokenResponse.text();
    const tokenData = Object.fromEntries(new URLSearchParams(responseText));
    const { oauth_token: accessToken, oauth_token_secret: accessTokenSecret } = tokenData;

    // Store integration in Supabase
    const { data, error: dbError } = await supabase
      .from('fitness_integrations')
      .upsert({
        user_id: userId,
        provider: 'garmin',
        provider_user_id: accessToken, // Garmin doesn't provide user_id in OAuth, using token as identifier
        access_token: accessToken,
        refresh_token: accessTokenSecret, // Store token secret in refresh_token field
        token_expires_at: null, // Garmin tokens don't expire
        scopes: ['activities', 'sleep', 'heart_rate'],
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
          'Location': `/settings.html?error=garmin_db_error`,
          'Cache-Control': 'no-cache'
        },
        body: ''
      };
    }

    // Clean up temporary token
    await supabase
      .from('oauth_temp_tokens')
      .delete()
      .eq('oauth_token', oauth_token);

    // Trigger initial sync
    try {
      const baseUrl = `https://${event.headers.host}`;
      await fetch(`${baseUrl}/.netlify/functions/garmin-sync`, {
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
        'Location': `/settings.html?success=garmin_connected`,
        'Cache-Control': 'no-cache'
      },
      body: ''
    };

  } catch (error) {
    console.error('Garmin callback error:', error);
    return {
      statusCode: 302,
      headers: {
        'Location': `/settings.html?error=garmin_connection_failed`,
        'Cache-Control': 'no-cache'
      },
      body: ''
    };
  }
};
