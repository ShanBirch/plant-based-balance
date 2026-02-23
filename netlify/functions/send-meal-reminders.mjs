import webpush from 'web-push';
import crypto from 'crypto';

// Configure web-push with VAPID keys
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_EMAIL = process.env.VAPID_EMAIL || 'mailto:admin@plantbasedbalance.com';

// Supabase config
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

// FCM V1 config
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
    console.error('[FCM] Config parse error:', e.message);
}

// FitGotchi meal reminder messages
const FITGOTCHI_MESSAGES = {
    breakfast: [
        { title: 'Good morning! Time for breakfast', body: 'Your FitGotchi is hungry! Eat now and log it within 30 min for +1 bonus XP' },
        { title: 'Rise and fuel up!', body: 'Breakfast time! Log your meal on time for a bonus XP point' },
        { title: 'Your FitGotchi needs breakfast!', body: 'Start your day right - eat and log within 30 min for +1 XP' },
        { title: "Breakfast o'clock!", body: 'Your FitGotchi is waiting to see what you eat! +1 XP for on-time logging' },
    ],
    lunch: [
        { title: 'Lunchtime! Your FitGotchi is starving', body: 'Time to refuel! Log your lunch within 30 min for +1 bonus XP' },
        { title: 'Midday fuel-up time!', body: "Your FitGotchi says it's lunch o'clock. Eat and log for bonus XP!" },
        { title: 'Lunch break!', body: 'Keep your streak going - log your meal within 30 min for +1 XP' },
        { title: 'Your FitGotchi wants lunch!', body: "Don't skip! Eat now and log on time for a bonus XP point" },
    ],
    dinner: [
        { title: 'Dinner time!', body: 'Your FitGotchi is ready to eat! Log within 30 min for +1 bonus XP' },
        { title: 'Evening fuel-up!', body: 'Time for dinner! Your FitGotchi earns bonus XP when you eat on schedule' },
        { title: 'Your FitGotchi wants dinner!', body: 'Last meal of the day - log on time for +1 XP bonus' },
        { title: "Dinner o'clock!", body: 'Eat and log within 30 minutes to earn your on-time meal bonus XP!' },
    ]
};

function getRandomMessage(mealType) {
    const messages = FITGOTCHI_MESSAGES[mealType] || FITGOTCHI_MESSAGES.breakfast;
    return messages[Math.floor(Math.random() * messages.length)];
}

async function getFCMAccessToken() {
    if (!FIREBASE_SERVICE_ACCOUNT) return null;
    const sa = FIREBASE_SERVICE_ACCOUNT;
    const now = Math.floor(Date.now() / 1000);
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({
        iss: sa.client_email,
        scope: 'https://www.googleapis.com/auth/firebase.messaging',
        aud: 'https://oauth2.googleapis.com/token',
        iat: now,
        exp: now + 3600
    })).toString('base64url');
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(`${header}.${payload}`);
    const signature = sign.sign(sa.private_key, 'base64url');
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
    if (!FIREBASE_SERVICE_ACCOUNT) {
        console.log('[NativePush] No Firebase config, skipping');
        return false;
    }
    try {
        const accessToken = await getFCMAccessToken();
        if (!accessToken) {
            console.error('[NativePush] Failed to get FCM access token');
            return false;
        }
        const projectId = FIREBASE_SERVICE_ACCOUNT.project_id;
        const stringData = {};
        if (payload.data) {
            Object.keys(payload.data).forEach(k => {
                stringData[k] = String(payload.data[k]);
            });
        }
        const response = await fetch(
            `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: {
                        token,
                        notification: { title: payload.title, body: payload.body },
                        android: {
                            priority: 'high',
                            ttl: '1800s',
                            notification: {
                                channel_id: 'meal-reminders',
                                sound: 'default',
                                click_action: 'FCM_PLUGIN_ACTIVITY'
                            }
                        },
                        data: stringData
                    }
                })
            }
        );
        if (!response.ok) {
            const errorText = await response.text();
            console.error('[NativePush] FCM error:', response.status, errorText);
            return false;
        }
        console.log('[NativePush] FCM send OK');
        return true;
    } catch (err) {
        console.error('[NativePush] FCM send failed:', err.message);
        return false;
    }
}

// Netlify scheduled function — runs every 10 minutes via cron
export default async function(req) {
    console.log('[MealReminders] Scheduled function invoked');

    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
        console.error('Missing VAPID keys');
        return;
    }
    if (!SUPABASE_SERVICE_KEY || !SUPABASE_URL) {
        console.error('Missing Supabase config');
        return;
    }

    webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

    const mealTypes = ['breakfast', 'lunch', 'dinner'];
    let totalSent = 0;
    let totalFailed = 0;

    for (const mealType of mealTypes) {
        try {
            const usersResponse = await fetch(
                `${SUPABASE_URL}/rest/v1/rpc/get_users_needing_meal_reminders`,
                {
                    method: 'POST',
                    headers: {
                        'apikey': SUPABASE_SERVICE_KEY,
                        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ p_meal_type: mealType })
                }
            );

            if (!usersResponse.ok) {
                console.error(`Error fetching ${mealType} users:`, await usersResponse.text());
                continue;
            }

            const users = await usersResponse.json();
            console.log(`Found ${users.length} users needing ${mealType} reminders`);

            for (const user of users) {
                const isNative = user.push_endpoint && user.push_endpoint.startsWith('native://');
                const msg = getRandomMessage(mealType);
                const dataPayload = {
                    type: 'meal_reminder',
                    mealType,
                    url: './dashboard.html?tab=meals&action=log'
                };

                try {
                    let didSend = false;

                    if (isNative) {
                        didSend = await sendNativePush(user.push_auth, {
                            title: msg.title,
                            body: msg.body,
                            data: dataPayload
                        });
                    } else {
                        const pushSubscription = {
                            endpoint: user.push_endpoint,
                            keys: { p256dh: user.push_p256dh, auth: user.push_auth }
                        };
                        await webpush.sendNotification(pushSubscription, JSON.stringify({
                            title: msg.title,
                            body: msg.body,
                            icon: '/assets/Logo_dots.jpg',
                            badge: '/assets/Logo_dots.jpg',
                            vibrate: [200, 100, 200],
                            tag: `meal-reminder-${mealType}`,
                            requireInteraction: true,
                            data: dataPayload,
                            actions: [
                                { action: 'log_photo', title: 'Photo' },
                                { action: 'log_text', title: 'Describe' }
                            ]
                        }));
                        didSend = true;
                    }

                    if (didSend) {
                        const reminderDate = user.user_local_date || new Date().toISOString().split('T')[0];
                        await fetch(`${SUPABASE_URL}/rest/v1/meal_reminder_log`, {
                            method: 'POST',
                            headers: {
                                'apikey': SUPABASE_SERVICE_KEY,
                                'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                user_id: user.user_id,
                                meal_type: mealType,
                                reminder_date: reminderDate
                            })
                        });
                        totalSent++;
                        console.log(`Sent ${mealType} reminder to ${user.user_id.substring(0, 8)}... via ${isNative ? 'FCM' : 'WebPush'}`);
                    } else {
                        totalFailed++;
                    }
                } catch (error) {
                    console.error(`Failed ${mealType} reminder for ${user.user_id}:`, error.message);
                    if (error.statusCode === 410) {
                        await fetch(
                            `${SUPABASE_URL}/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(user.push_endpoint)}`,
                            {
                                method: 'DELETE',
                                headers: {
                                    'apikey': SUPABASE_SERVICE_KEY,
                                    'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
                                }
                            }
                        );
                    }
                    totalFailed++;
                }
            }
        } catch (err) {
            console.error(`Error processing ${mealType}:`, err.message);
        }
    }

    console.log(`[MealReminders] Done. Sent: ${totalSent}, Failed: ${totalFailed}`);
}

export const config = {
    schedule: "*/10 * * * *"
};
