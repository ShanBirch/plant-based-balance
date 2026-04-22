const webpush = require('web-push');
const crypto = require('crypto');

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_EMAIL = process.env.VAPID_EMAIL || 'mailto:admin@plantbasedbalance.com';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://hzapaorxqboevxnumxkv.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

let FIREBASE_SERVICE_ACCOUNT = null;
try {
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        FIREBASE_SERVICE_ACCOUNT = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    } else if (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_PROJECT_ID) {
        FIREBASE_SERVICE_ACCOUNT = {
            client_email: process.env.FIREBASE_CLIENT_EMAIL,
            private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
            project_id: process.env.FIREBASE_PROJECT_ID,
        };
    }
} catch (e) {
    console.error('[MealPlanReady][FCM] Config parse error:', e.message);
}

const COMPLETION_MESSAGES = [
    { title: '🥗 Your meal plan is ready!', body: 'Tap to see the week we tailored for you.' },
    { title: '✨ 7 days of meals, served', body: 'Your personalised plan just landed — take a peek.' },
    { title: '🌱 Meal plan complete!', body: 'Monday through Sunday is plated up and waiting.' },
    { title: '💚 Your tailored plan is here', body: 'Open up to see what this week looks like.' },
];
function pickMessage() {
    return COMPLETION_MESSAGES[Math.floor(Math.random() * COMPLETION_MESSAGES.length)];
}

async function getFCMAccessToken() {
    if (!FIREBASE_SERVICE_ACCOUNT) return null;
    const { client_email, private_key } = FIREBASE_SERVICE_ACCOUNT;
    const now = Math.floor(Date.now() / 1000);
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({
        iss: client_email,
        scope: 'https://www.googleapis.com/auth/firebase.messaging',
        aud: 'https://oauth2.googleapis.com/token',
        iat: now,
        exp: now + 3600
    })).toString('base64url');
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(`${header}.${payload}`);
    const signature = sign.sign(private_key, 'base64url');
    const jwt = `${header}.${payload}.${signature}`;
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`
    });
    const tokenData = await tokenResponse.json();
    return tokenData.access_token;
}

async function sendNativePush(token, payload) {
    if (!FIREBASE_SERVICE_ACCOUNT) return { success: false, stale: false };
    try {
        const accessToken = await getFCMAccessToken();
        if (!accessToken) return { success: false, stale: false };
        const projectId = FIREBASE_SERVICE_ACCOUNT.project_id;
        const stringData = Object.fromEntries(
            Object.entries(payload.data || {}).map(([k, v]) => [k, String(v)])
        );
        const response = await fetch(
            `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
            {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: {
                        token,
                        notification: { title: payload.title, body: payload.body },
                        android: {
                            priority: 'high',
                            collapse_key: payload.collapseKey,
                            notification: {
                                channel_id: 'meal-reminders',
                                sound: 'default',
                                click_action: 'FCM_PLUGIN_ACTIVITY',
                                color: '#7BA883',
                                tag: payload.collapseKey,
                            }
                        },
                        data: stringData
                    }
                })
            }
        );
        if (!response.ok) {
            const errorText = await response.text();
            console.error('[MealPlanReady][FCM] error', response.status, errorText);
            const isStale = response.status === 404
                || /"UNREGISTERED"/.test(errorText)
                || /"INVALID_ARGUMENT"/.test(errorText)
                || /"SENDER_ID_MISMATCH"/.test(errorText);
            return { success: false, stale: isStale };
        }
        return { success: true, stale: false };
    } catch (err) {
        console.error('[MealPlanReady][FCM] send failed:', err.message);
        return { success: false, stale: false };
    }
}

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
    }
    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !SUPABASE_SERVICE_KEY) {
        return { statusCode: 500, body: JSON.stringify({ error: 'Server not configured for push' }) };
    }

    webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

    let userId, weekNumber;
    try {
        const body = JSON.parse(event.body || '{}');
        userId = body.userId;
        weekNumber = body.weekNumber || 1;
    } catch (_e) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON body' }) };
    }
    if (!userId) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Missing userId' }) };
    }

    const subsResp = await fetch(
        `${SUPABASE_URL}/rest/v1/push_subscriptions?user_id=eq.${userId}&select=*`,
        { headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` } }
    );
    if (!subsResp.ok) {
        return { statusCode: 500, body: JSON.stringify({ error: 'Failed to load subscriptions' }) };
    }
    const rawSubscriptions = await subsResp.json();

    // Dedup: collapse by endpoint (keep most recent), then by FCM token.
    // If any native sub exists, drop web-push rows (native supersedes PWA on the same device).
    const sortedByRecency = [...rawSubscriptions].sort((a, b) => {
        const ta = Date.parse(a.updated_at || '') || 0;
        const tb = Date.parse(b.updated_at || '') || 0;
        return tb - ta;
    });
    const byEndpoint = new Map();
    for (const sub of sortedByRecency) {
        if (sub.endpoint && !byEndpoint.has(sub.endpoint)) byEndpoint.set(sub.endpoint, sub);
    }
    let deduped = Array.from(byEndpoint.values());
    const seenTokens = new Set();
    deduped = deduped.filter(sub => {
        const isNative = sub.endpoint && sub.endpoint.startsWith('native://');
        if (!isNative) return true;
        const token = sub.auth || sub.endpoint;
        if (seenTokens.has(token)) return false;
        seenTokens.add(token);
        return true;
    });
    if (deduped.some(s => s.endpoint && s.endpoint.startsWith('native://'))) {
        deduped = deduped.filter(s => s.endpoint && s.endpoint.startsWith('native://'));
    }

    if (deduped.length === 0) {
        return { statusCode: 200, body: JSON.stringify({ sent: 0, reason: 'no_subscriptions' }) };
    }

    const msg = pickMessage();
    const collapseKey = `meal-plan-ready-${userId}-${weekNumber}`;
    const data = {
        type: 'meal_plan_ready',
        weekNumber,
        url: './dashboard.html?tab=meals'
    };

    const results = await Promise.allSettled(deduped.map(async (sub) => {
        const isNative = sub.endpoint && sub.endpoint.startsWith('native://');
        try {
            if (isNative) {
                const result = await sendNativePush(sub.auth, {
                    title: msg.title, body: msg.body, collapseKey, data
                });
                if (result.stale) {
                    await fetch(
                        `${SUPABASE_URL}/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(sub.endpoint)}`,
                        { method: 'DELETE', headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` } }
                    ).catch(() => {});
                }
                return result.success;
            }
            await webpush.sendNotification(
                { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
                JSON.stringify({
                    title: msg.title, body: msg.body,
                    icon: '/assets/Logo_dots.jpg', badge: '/assets/Logo_dots.jpg',
                    vibrate: [200, 100, 200],
                    tag: collapseKey,
                    data
                })
            );
            return true;
        } catch (error) {
            if (error.statusCode === 410) {
                await fetch(
                    `${SUPABASE_URL}/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(sub.endpoint)}`,
                    { method: 'DELETE', headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` } }
                ).catch(() => {});
            }
            console.warn('[MealPlanReady] push failed:', error.statusCode || '', error.message);
            return false;
        }
    }));

    const sent = results.filter(r => r.status === 'fulfilled' && r.value === true).length;
    return { statusCode: 200, body: JSON.stringify({ sent, total: deduped.length }) };
};
