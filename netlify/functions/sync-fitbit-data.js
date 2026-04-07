/**
 * Scheduled Fitbit Data Sync
 *
 * This function runs on a schedule (configured in netlify.toml) to sync
 * Fitbit data for all connected users automatically.
 *
 * Schedule: Every 2 hours during daytime
 */

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const SITE_URL = process.env.URL || 'https://plantbased-balance.org';

exports.handler = async (event) => {
    console.log('Fitbit scheduled sync started');

    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
        console.error('Missing Supabase configuration');
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Server configuration error' }),
        };
    }

    try {
        // Call the edge function that handles the actual sync
        const response = await fetch(`${SITE_URL}/api/fitbit/sync-all`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
        });

        const result = await response.json();
        console.log('Fitbit sync result:', result);

        return {
            statusCode: 200,
            body: JSON.stringify(result),
        };
    } catch (err) {
        console.error('Fitbit scheduled sync error:', err);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Sync failed', details: err.message }),
        };
    }
};
