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

/**
 * Make authenticated request to Garmin API
 */
async function garminRequest(method, url, accessToken, accessTokenSecret) {
  const oauthParams = {
    oauth_consumer_key: GARMIN_CONSUMER_KEY,
    oauth_token: accessToken,
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_nonce: crypto.randomBytes(16).toString('hex'),
    oauth_version: '1.0'
  };

  // Generate signature
  const signature = generateOAuthSignature(method, url, oauthParams, GARMIN_CONSUMER_SECRET, accessTokenSecret);
  oauthParams.oauth_signature = signature;

  // Build authorization header
  const authHeader = 'OAuth ' + Object.keys(oauthParams)
    .map(key => `${key}="${encodeURIComponent(oauthParams[key])}"`)
    .join(', ');

  const response = await fetch(url, {
    method: method,
    headers: {
      'Authorization': authHeader
    }
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Garmin API error: ${error}`);
  }

  return response.json();
}

/**
 * Sync Garmin data for a user
 */
async function syncGarminData(userId, integration, supabase, syncType = 'automatic') {
  // Create sync history record
  const { data: syncRecord } = await supabase
    .from('fitness_sync_history')
    .insert({
      integration_id: integration.id,
      user_id: userId,
      sync_type: syncType,
      data_types: ['activities', 'steps', 'heart_rate', 'sleep', 'calories'],
      status: 'in_progress'
    })
    .select()
    .single();

  try {
    const accessToken = integration.access_token;
    const accessTokenSecret = integration.refresh_token; // Token secret stored in refresh_token field

    // Determine date range to sync
    const today = new Date();
    const startDate = syncType === 'initial' ? new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000) : today;
    const endDate = today;

    const metricsToStore = [];
    let totalRecords = 0;

    // Garmin API endpoints
    const summariesUrl = `https://apis.garmin.com/wellness-api/rest/dailies`;

    // Fetch daily summaries
    const params = new URLSearchParams({
      uploadStartTimeInSeconds: Math.floor(startDate.getTime() / 1000),
      uploadEndTimeInSeconds: Math.floor(endDate.getTime() / 1000)
    });

    const summariesData = await garminRequest('GET', `${summariesUrl}?${params}`, accessToken, accessTokenSecret);

    // Process daily summaries
    if (summariesData && Array.isArray(summariesData)) {
      for (const daily of summariesData) {
        const date = daily.calendarDate; // Format: YYYY-MM-DD

        // Steps
        if (daily.totalSteps !== undefined) {
          metricsToStore.push({
            integration_id: integration.id,
            user_id: userId,
            metric_date: date,
            metric_type: 'steps',
            value_integer: daily.totalSteps,
            unit: 'steps'
          });
          totalRecords++;
        }

        // Calories
        if (daily.activeKilocalories !== undefined) {
          metricsToStore.push({
            integration_id: integration.id,
            user_id: userId,
            metric_date: date,
            metric_type: 'calories',
            value_integer: Math.round(daily.activeKilocalories),
            unit: 'kcal'
          });
          totalRecords++;
        }

        // Distance (meters to km)
        if (daily.totalDistanceMeters !== undefined) {
          metricsToStore.push({
            integration_id: integration.id,
            user_id: userId,
            metric_date: date,
            metric_type: 'distance',
            value_decimal: (daily.totalDistanceMeters / 1000).toFixed(2),
            unit: 'km'
          });
          totalRecords++;
        }

        // Active minutes (moderate + vigorous)
        if (daily.moderateIntensityDurationInSeconds !== undefined && daily.vigorousIntensityDurationInSeconds !== undefined) {
          const activeMinutes = Math.round(
            (daily.moderateIntensityDurationInSeconds + daily.vigorousIntensityDurationInSeconds) / 60
          );
          metricsToStore.push({
            integration_id: integration.id,
            user_id: userId,
            metric_date: date,
            metric_type: 'active_minutes',
            value_integer: activeMinutes,
            unit: 'minutes'
          });
          totalRecords++;
        }

        // Resting heart rate
        if (daily.restingHeartRateInBeatsPerMinute !== undefined) {
          metricsToStore.push({
            integration_id: integration.id,
            user_id: userId,
            metric_date: date,
            metric_type: 'heart_rate_resting',
            value_integer: daily.restingHeartRateInBeatsPerMinute,
            unit: 'bpm'
          });
          totalRecords++;
        }

        // Sleep (seconds to minutes)
        if (daily.sleepingSeconds !== undefined) {
          metricsToStore.push({
            integration_id: integration.id,
            user_id: userId,
            metric_date: date,
            metric_type: 'sleep_minutes',
            value_integer: Math.round(daily.sleepingSeconds / 60),
            unit: 'minutes'
          });
          totalRecords++;
        }

        // Stress level (average)
        if (daily.averageStressLevel !== undefined) {
          metricsToStore.push({
            integration_id: integration.id,
            user_id: userId,
            metric_date: date,
            metric_type: 'stress_level',
            value_integer: daily.averageStressLevel,
            unit: 'level'
          });
          totalRecords++;
        }
      }
    }

    // Bulk insert metrics
    if (metricsToStore.length > 0) {
      const { error: metricsError } = await supabase
        .from('fitness_metrics')
        .upsert(metricsToStore, {
          onConflict: 'integration_id,metric_date,metric_type'
        });

      if (metricsError) {
        throw new Error(`Failed to store metrics: ${metricsError.message}`);
      }
    }

    // Determine actual date range synced
    const dates = summariesData.map(d => d.calendarDate).sort();
    const syncStartDate = dates.length > 0 ? dates[0] : null;
    const syncEndDate = dates.length > 0 ? dates[dates.length - 1] : null;

    // Update sync history as successful
    await supabase
      .from('fitness_sync_history')
      .update({
        status: 'success',
        records_synced: totalRecords,
        sync_start_date: syncStartDate,
        sync_end_date: syncEndDate,
        completed_at: new Date().toISOString()
      })
      .eq('id', syncRecord.id);

    // Update integration last sync time
    await supabase
      .from('fitness_integrations')
      .update({
        last_sync_at: new Date().toISOString(),
        last_error: null
      })
      .eq('id', integration.id);

    return { success: true, recordsSynced: totalRecords };

  } catch (error) {
    // Update sync history as failed
    await supabase
      .from('fitness_sync_history')
      .update({
        status: 'failed',
        error_message: error.message,
        completed_at: new Date().toISOString()
      })
      .eq('id', syncRecord.id);

    // Update integration with error
    await supabase
      .from('fitness_integrations')
      .update({
        last_error: error.message
      })
      .eq('id', integration.id);

    throw error;
  }
}

/**
 * Netlify function handler
 */
exports.handler = async (event) => {
  // Only accept POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { userId, syncType = 'automatic' } = JSON.parse(event.body || '{}');

    if (!userId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing userId' })
      };
    }

    // Get Garmin integration for user
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const { data: integration, error: integrationError } = await supabase
      .from('fitness_integrations')
      .select('*')
      .eq('user_id', userId)
      .eq('provider', 'garmin')
      .eq('is_active', true)
      .single();

    if (integrationError || !integration) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Garmin integration not found' })
      };
    }

    // Perform sync
    const result = await syncGarminData(userId, integration, supabase, syncType);

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: 'Garmin data synced successfully',
        recordsSynced: result.recordsSynced
      })
    };

  } catch (error) {
    console.error('Garmin sync error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Sync failed',
        message: error.message
      })
    };
  }
};
