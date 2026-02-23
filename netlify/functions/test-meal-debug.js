// Minimal test function to debug why send-meal-reminders crashes
exports.handler = async (event) => {
    const results = {
        step: 'start',
        httpMethod: event.httpMethod,
        hasBody: !!event.body,
    };

    // Step 1: Check if web-push loads
    try {
        const webpush = require('web-push');
        results.webpush = 'loaded OK';
    } catch (e) {
        results.webpush = 'FAILED: ' + e.message;
    }

    // Step 2: Check env vars
    results.env = {
        VAPID_PUBLIC_KEY: !!process.env.VAPID_PUBLIC_KEY,
        VAPID_PRIVATE_KEY: !!process.env.VAPID_PRIVATE_KEY,
        SUPABASE_URL: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'NOT SET',
        SUPABASE_SERVICE_KEY: !!(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY),
        FIREBASE_SERVICE_ACCOUNT: !!process.env.FIREBASE_SERVICE_ACCOUNT,
        FIREBASE_CLIENT_EMAIL: !!process.env.FIREBASE_CLIENT_EMAIL,
        FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID || 'NOT SET',
    };

    // Step 3: Try connecting to Supabase
    const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

    if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
        try {
            // Check meal_reminder_preferences
            const prefsRes = await fetch(
                `${SUPABASE_URL}/rest/v1/meal_reminder_preferences?select=user_id,reminders_enabled,breakfast_time,lunch_time,dinner_time,timezone,reminder_delay_minutes`,
                { headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` } }
            );
            results.preferences = prefsRes.ok ? await prefsRes.json() : { error: await prefsRes.text(), status: prefsRes.status };

            // Check push_subscriptions
            const subsRes = await fetch(
                `${SUPABASE_URL}/rest/v1/push_subscriptions?select=user_id,endpoint,updated_at`,
                { headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` } }
            );
            const subs = subsRes.ok ? await subsRes.json() : [];
            results.subscriptions = subs.map(s => ({
                user_id: s.user_id?.substring(0, 8) + '...',
                type: s.endpoint?.startsWith('native://') ? 'NATIVE' : 'WEB',
                updated: s.updated_at,
            }));

            // Run the SQL function for each meal
            results.eligible = {};
            for (const mt of ['breakfast', 'lunch', 'dinner']) {
                const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_users_needing_meal_reminders`, {
                    method: 'POST',
                    headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ p_meal_type: mt })
                });
                if (res.ok) {
                    results.eligible[mt] = await res.json();
                } else {
                    results.eligible[mt] = { error: await res.text(), status: res.status };
                }
            }

            // Check today's log
            const today = new Date().toISOString().split('T')[0];
            const logRes = await fetch(
                `${SUPABASE_URL}/rest/v1/meal_reminder_log?reminder_date=eq.${today}&select=user_id,meal_type,sent_at`,
                { headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` } }
            );
            results.todayLog = logRes.ok ? await logRes.json() : { error: await logRes.text() };

        } catch (e) {
            results.supabaseError = e.message;
        }
    }

    results.serverTimeUTC = new Date().toISOString();

    return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(results, null, 2)
    };
};
