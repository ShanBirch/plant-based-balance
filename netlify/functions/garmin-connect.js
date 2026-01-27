const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

// Environment configuration
const GARMIN_CONSUMER_KEY = process.env.GARMIN_CONSUMER_KEY;
const GARMIN_CONSUMER_SECRET = process.env.GARMIN_CONSUMER_SECRET;
const GARMIN_REDIRECT_URI = process.env.GARMIN_REDIRECT_URI;

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
  // Only accept GET requests
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { userId } = event.queryStringParameters || {};

    if (!userId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing userId parameter' })
      };
    }

    // Step 1: Get request token from Garmin
    const requestTokenUrl = 'https://connectapi.garmin.com/oauth-service/oauth/request_token';

    const oauthParams = {
      oauth_consumer_key: GARMIN_CONSUMER_KEY,
      oauth_signature_method: 'HMAC-SHA1',
      oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
      oauth_nonce: crypto.randomBytes(16).toString('hex'),
      oauth_version: '1.0',
      oauth_callback: GARMIN_REDIRECT_URI
    };

    // Generate signature
    const signature = generateOAuthSignature('POST', requestTokenUrl, oauthParams, GARMIN_CONSUMER_SECRET);
    oauthParams.oauth_signature = signature;

    // Build authorization header
    const authHeader = 'OAuth ' + Object.keys(oauthParams)
      .map(key => `${key}="${encodeURIComponent(oauthParams[key])}"`)
      .join(', ');

    // Request token from Garmin
    const response = await fetch(requestTokenUrl, {
      method: 'POST',
      headers: {
        'Authorization': authHeader
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Garmin request token failed:', errorText);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Failed to get Garmin request token' })
      };
    }

    const responseText = await response.text();
    const tokenData = Object.fromEntries(new URLSearchParams(responseText));
    const { oauth_token, oauth_token_secret } = tokenData;

    // Store temporary token in database
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    await supabase
      .from('oauth_temp_tokens')
      .insert({
        user_id: userId,
        provider: 'garmin',
        oauth_token: oauth_token,
        oauth_token_secret: oauth_token_secret
      });

    // Step 2: Redirect user to Garmin authorization page
    const authUrl = `https://connect.garmin.com/oauthConfirm?oauth_token=${oauth_token}`;

    return {
      statusCode: 302,
      headers: {
        'Location': authUrl,
        'Cache-Control': 'no-cache'
      },
      body: ''
    };

  } catch (error) {
    console.error('Garmin connect error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to initiate Garmin connection', details: error.message })
    };
  }
};
