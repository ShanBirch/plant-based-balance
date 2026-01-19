const { createClient } = require('@supabase/supabase-js');

// Environment configuration
const FITBIT_CLIENT_ID = process.env.FITBIT_CLIENT_ID;
const FITBIT_CLIENT_SECRET = process.env.FITBIT_CLIENT_SECRET;

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://hzapaorxqboevxnumxkv.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

/**
 * Refresh Fitbit access token if expired
 */
async function refreshTokenIfNeeded(integration, supabase) {
  const expiresAt = new Date(integration.token_expires_at);
  const now = new Date();

  // Refresh if token expires in less than 10 minutes
  if (expiresAt.getTime() - now.getTime() < 10 * 60 * 1000) {
    const response = await fetch('https://api.fitbit.com/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${FITBIT_CLIENT_ID}:${FITBIT_CLIENT_SECRET}`).toString('base64')}`
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: integration.refresh_token
      })
    });

    if (!response.ok) {
      throw new Error('Failed to refresh Fitbit token');
    }

    const tokenData = await response.json();
    const newExpiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();

    // Update token in database
    await supabase
      .from('fitness_integrations')
      .update({
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        token_expires_at: newExpiresAt
      })
      .eq('id', integration.id);

    return tokenData.access_token;
  }

  return integration.access_token;
}

/**
 * Fetch data from Fitbit API
 */
async function fetchFitbitData(accessToken, endpoint, date = 'today') {
  const response = await fetch(`https://api.fitbit.com/1/user/-/${endpoint}/date/${date}.json`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Fitbit API error: ${error}`);
  }

  return response.json();
}

/**
 * Sync Fitbit data for a user
 */
async function syncFitbitData(userId, integration, supabase, syncType = 'automatic') {
  // Create sync history record
  const { data: syncRecord } = await supabase
    .from('fitness_sync_history')
    .insert({
      integration_id: integration.id,
      user_id: userId,
      sync_type: syncType,
      data_types: ['steps', 'heart_rate', 'sleep', 'calories', 'distance', 'active_minutes'],
      status: 'in_progress'
    })
    .select()
    .single();

  try {
    // Refresh token if needed
    const accessToken = await refreshTokenIfNeeded(integration, supabase);

    // Determine date range to sync
    const today = new Date().toISOString().split('T')[0];
    const datesToSync = syncType === 'initial' ? getLast30Days() : [today];

    const metricsToStore = [];
    let totalRecords = 0;

    // Sync data for each date
    for (const date of datesToSync) {
      try {
        // Fetch activity summary (steps, calories, distance, active minutes)
        const activityData = await fetchFitbitData(accessToken, 'activities', date);
        const summary = activityData.summary;

        if (summary) {
          // Steps
          if (summary.steps !== undefined) {
            metricsToStore.push({
              integration_id: integration.id,
              user_id: userId,
              metric_date: date,
              metric_type: 'steps',
              value_integer: summary.steps,
              unit: 'steps'
            });
            totalRecords++;
          }

          // Calories
          if (summary.caloriesOut !== undefined) {
            metricsToStore.push({
              integration_id: integration.id,
              user_id: userId,
              metric_date: date,
              metric_type: 'calories',
              value_integer: Math.round(summary.caloriesOut),
              unit: 'kcal'
            });
            totalRecords++;
          }

          // Distance
          if (summary.distances && summary.distances.length > 0) {
            const totalDistance = summary.distances.find(d => d.activity === 'total');
            if (totalDistance) {
              metricsToStore.push({
                integration_id: integration.id,
                user_id: userId,
                metric_date: date,
                metric_type: 'distance',
                value_decimal: totalDistance.distance,
                unit: 'km'
              });
              totalRecords++;
            }
          }

          // Active minutes
          if (summary.fairlyActiveMinutes !== undefined && summary.veryActiveMinutes !== undefined) {
            const activeMinutes = summary.fairlyActiveMinutes + summary.veryActiveMinutes;
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
        }

        // Fetch heart rate data
        try {
          const heartRateData = await fetchFitbitData(accessToken, 'activities/heart', date);
          if (heartRateData['activities-heart'] && heartRateData['activities-heart'].length > 0) {
            const hrData = heartRateData['activities-heart'][0];
            if (hrData.value && hrData.value.restingHeartRate) {
              metricsToStore.push({
                integration_id: integration.id,
                user_id: userId,
                metric_date: date,
                metric_type: 'heart_rate_resting',
                value_integer: hrData.value.restingHeartRate,
                unit: 'bpm'
              });
              totalRecords++;
            }
          }
        } catch (hrError) {
          console.warn(`Heart rate fetch failed for ${date}:`, hrError.message);
        }

        // Fetch sleep data
        try {
          const sleepData = await fetchFitbitData(accessToken, 'sleep', date);
          if (sleepData.summary && sleepData.summary.totalMinutesAsleep !== undefined) {
            metricsToStore.push({
              integration_id: integration.id,
              user_id: userId,
              metric_date: date,
              metric_type: 'sleep_minutes',
              value_integer: sleepData.summary.totalMinutesAsleep,
              unit: 'minutes'
            });
            totalRecords++;
          }
        } catch (sleepError) {
          console.warn(`Sleep fetch failed for ${date}:`, sleepError.message);
        }

        // Rate limiting: wait 100ms between dates to avoid hitting API limits
        if (datesToSync.length > 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }

      } catch (dateError) {
        console.error(`Error syncing data for ${date}:`, dateError);
        // Continue with next date even if one fails
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

    // Update sync history as successful
    await supabase
      .from('fitness_sync_history')
      .update({
        status: 'success',
        records_synced: totalRecords,
        sync_start_date: datesToSync[datesToSync.length - 1],
        sync_end_date: datesToSync[0],
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
 * Get array of last 30 days in YYYY-MM-DD format
 */
function getLast30Days() {
  const dates = [];
  for (let i = 0; i < 30; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    dates.push(date.toISOString().split('T')[0]);
  }
  return dates;
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

    // Get Fitbit integration for user
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const { data: integration, error: integrationError } = await supabase
      .from('fitness_integrations')
      .select('*')
      .eq('user_id', userId)
      .eq('provider', 'fitbit')
      .eq('is_active', true)
      .single();

    if (integrationError || !integration) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Fitbit integration not found' })
      };
    }

    // Perform sync
    const result = await syncFitbitData(userId, integration, supabase, syncType);

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: 'Fitbit data synced successfully',
        recordsSynced: result.recordsSynced
      })
    };

  } catch (error) {
    console.error('Fitbit sync error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Sync failed',
        message: error.message
      })
    };
  }
};
