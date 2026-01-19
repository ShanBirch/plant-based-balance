// Fitbit OAuth Initiation
// This endpoint generates the Fitbit OAuth URL and redirects the user to Fitbit's authorization page

const FITBIT_CLIENT_ID = process.env.FITBIT_CLIENT_ID;
const FITBIT_REDIRECT_URI = process.env.FITBIT_REDIRECT_URI;

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

    // Fitbit OAuth 2.0 scopes
    const scopes = [
      'activity',
      'heartrate',
      'sleep',
      'weight',
      'profile'
    ].join(' ');

    // Build Fitbit authorization URL
    const authUrl = new URL('https://www.fitbit.com/oauth2/authorize');
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('client_id', FITBIT_CLIENT_ID);
    authUrl.searchParams.set('redirect_uri', FITBIT_REDIRECT_URI);
    authUrl.searchParams.set('scope', scopes);
    authUrl.searchParams.set('state', userId); // Pass user ID as state for callback

    // Redirect to Fitbit
    return {
      statusCode: 302,
      headers: {
        'Location': authUrl.toString(),
        'Cache-Control': 'no-cache'
      },
      body: ''
    };

  } catch (error) {
    console.error('Fitbit connect error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to initiate Fitbit connection' })
    };
  }
};
