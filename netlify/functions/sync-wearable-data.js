/**
 * Scheduled Wearable Data Sync
 *
 * Syncs data for all connected wearable providers:
 * Fitbit, WHOOP, Oura, and Strava
 *
 * Schedule: Every 2 hours (configured in netlify.toml)
 */

const SITE_URL = process.env.URL || 'https://plantbased-balance.org';

exports.handler = async (event) => {
    console.log('Wearable scheduled sync started');

    const providers = [
        { name: 'Fitbit', endpoint: '/api/fitbit/sync-all' },
        { name: 'WHOOP', endpoint: '/api/whoop/sync-all' },
        { name: 'Oura', endpoint: '/api/oura/sync-all' },
        { name: 'Strava', endpoint: '/api/strava/sync-all' },
    ];

    const results = {};

    for (const provider of providers) {
        try {
            const response = await fetch(`${SITE_URL}${provider.endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            });

            const result = await response.json();
            results[provider.name] = result;
            console.log(`${provider.name} sync result:`, result);
        } catch (err) {
            console.error(`${provider.name} sync error:`, err.message);
            results[provider.name] = { error: err.message };
        }
    }

    return {
        statusCode: 200,
        body: JSON.stringify(results),
    };
};
