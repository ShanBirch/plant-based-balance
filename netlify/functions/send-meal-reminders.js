const webpush = require('web-push');
const crypto = require('crypto');

// Configure web-push with VAPID keys
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_EMAIL = process.env.VAPID_EMAIL || 'mailto:admin@plantbasedbalance.com';

// Supabase config
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

// FCM V1 config — supports both a single JSON env var (FIREBASE_SERVICE_ACCOUNT)
// and individual env vars (FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY, FIREBASE_PROJECT_ID)
let FIREBASE_SERVICE_ACCOUNT = null;
try {
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        FIREBASE_SERVICE_ACCOUNT = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    } else if (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_PROJECT_ID) {
        // Build service account object from individual env vars
        FIREBASE_SERVICE_ACCOUNT = {
            client_email: process.env.FIREBASE_CLIENT_EMAIL,
            private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
            project_id: process.env.FIREBASE_PROJECT_ID,
        };
        console.log('[FCM] Built service account from individual env vars (project:', process.env.FIREBASE_PROJECT_ID, ')');
    }
} catch (parseErr) {
    console.error('[FCM] Error parsing Firebase config:', parseErr.message);
}
if (!FIREBASE_SERVICE_ACCOUNT) {
    console.warn('[FCM] Firebase not configured — need FIREBASE_SERVICE_ACCOUNT or FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY + FIREBASE_PROJECT_ID');
}

async function getFCMAccessToken() {
    const { client_email, private_key, project_id } = FIREBASE_SERVICE_ACCOUNT;
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

// FitGotchi meal reminder messages with personality
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

/**
 * Send a push notification to a native device via FCM V1 API
 */
async function sendNativePush(token, payload) {
    if (!FIREBASE_SERVICE_ACCOUNT) {
        console.log('[NativePush] No FIREBASE_SERVICE_ACCOUNT configured, skipping native push');
        return false;
    }

    try {
        console.log('[NativePush] Attempting FCM send to token:', token.substring(0, 20) + '...');
        const accessToken = await getFCMAccessToken();
        if (!accessToken) {
            console.error('[NativePush] Failed to get FCM access token — check FIREBASE_SERVICE_ACCOUNT env var');
            return false;
        }
        console.log('[NativePush] Got FCM access token OK');

        const projectId = FIREBASE_SERVICE_ACCOUNT.project_id;
        // FCM V1 requires all data values to be strings
        const stringData = Object.fromEntries(
            Object.entries(payload.data || {}).map(([k, v]) => [k, String(v)])
        );

        const fcmUrl = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;
        console.log('[NativePush] Sending to:', fcmUrl);

        const response = await fetch(fcmUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: {
                        token,
                        notification: {
                            title: payload.title,
                            body: payload.body
                        },
                        android: {
                            priority: 'high',
                            ttl: '1800s', // 30 minutes (matches XP bonus window)
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
            console.error('[NativePush] FCM V1 error (status ' + response.status + '):', errorText);
            return false;
        }

        const responseBody = await response.json();
        console.log('[NativePush] FCM V1 success:', JSON.stringify(responseBody));
        return true;
    } catch (err) {
        console.error('[NativePush] FCM send failed:', err.message, err.stack);
        return false;
    }
}

exports.handler = async (event) => {
    // Accept POST (manual trigger), GET (manual), and scheduled invocations
    // Netlify scheduled functions may not have httpMethod set
    const isScheduled = !event.body && (!event.httpMethod || event.httpMethod === 'GET');

    if (event.httpMethod && event.httpMethod !== 'POST' && event.httpMethod !== 'GET') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    // Check VAPID keys (needed for web push)
    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
        console.error('Missing VAPID keys');
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Server configuration error: Missing VAPID keys' })
        };
    }

    // Check Supabase service key
    if (!SUPABASE_SERVICE_KEY) {
        console.error('Missing SUPABASE_SERVICE_KEY');
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Server configuration error: Missing Supabase service key' })
        };
    }

    // Configure web-push
    webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

    try {
        // If scheduled (no body), check all meal types
        // If manual POST, use the specified meal type
        let mealTypes;
        if (isScheduled) {
            mealTypes = ['breakfast', 'lunch', 'dinner'];
        } else {
            const parsedBody = JSON.parse(event.body || '{}');
            const { mealType } = parsedBody;
            if (!mealType || !['breakfast', 'lunch', 'dinner'].includes(mealType)) {
                return {
                    statusCode: 400,
                    body: JSON.stringify({ error: 'Invalid meal type. Must be breakfast, lunch, or dinner.' })
                };
            }
            mealTypes = [mealType];
        }

        // The SQL function now uses NOW() AT TIME ZONE per user's stored timezone,
        // so we don't need to pass the current time from JavaScript.

        let totalSent = 0;
        let totalFailed = 0;
        const mealResults = {};

        for (const mealType of mealTypes) {
            // Query Supabase for users needing meal reminders
            // The stored function uses NOW() + each user's timezone to check:
            // - reminders are enabled
            // - it's past their meal time + delay (in their local time)
            // - they haven't logged this meal type today (their local date)
            // - we haven't already sent a reminder today (their local date)
            const usersResponse = await fetch(
                `${SUPABASE_URL}/rest/v1/rpc/get_users_needing_meal_reminders`,
                {
                    method: 'POST',
                    headers: {
                        'apikey': SUPABASE_SERVICE_KEY,
                        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        p_meal_type: mealType
                    })
                }
            );

            if (!usersResponse.ok) {
                const errorText = await usersResponse.text();
                console.error(`Error fetching users for ${mealType} reminders:`, errorText);
                mealResults[mealType] = { sent: 0, failed: 0, error: errorText };
                continue;
            }

            const users = await usersResponse.json();
            console.log(`Found ${users.length} users needing ${mealType} reminders`);
            // Log subscription types for debugging
            users.forEach((u, i) => {
                const isNative = u.push_endpoint && u.push_endpoint.startsWith('native://');
                console.log(`  [${i}] user=${u.user_id?.substring(0, 8)}... type=${isNative ? 'NATIVE/FCM' : 'WEB_PUSH'} endpoint=${(u.push_endpoint || 'null').substring(0, 40)}...`);
            });
            console.log('[FCM Config] Firebase configured:', !!FIREBASE_SERVICE_ACCOUNT, 'project:', FIREBASE_SERVICE_ACCOUNT?.project_id || 'N/A');

            if (users.length === 0) {
                mealResults[mealType] = { sent: 0, failed: 0 };
                continue;
            }

            // Send notifications to each user
            const results = await Promise.allSettled(
                users.map(async (user) => {
                    const isNative = user.push_endpoint && user.push_endpoint.startsWith('native://');
                    const msg = getRandomMessage(mealType);

                    // Notification data payload
                    const dataPayload = {
                        type: 'meal_reminder',
                        mealType: mealType,
                        url: './dashboard.html?tab=meals&action=log'
                    };

                    try {
                        let sent = false;

                        if (isNative) {
                            // Send via FCM for native devices
                            const nativeToken = user.push_auth; // Token stored in auth field
                            sent = await sendNativePush(nativeToken, {
                                title: msg.title,
                                body: msg.body,
                                data: dataPayload
                            });
                        } else {
                            // Send via Web Push for browsers
                            const notificationPayload = JSON.stringify({
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
                            });

                            const pushSubscription = {
                                endpoint: user.push_endpoint,
                                keys: {
                                    p256dh: user.push_p256dh,
                                    auth: user.push_auth
                                }
                            };

                            await webpush.sendNotification(pushSubscription, notificationPayload);
                            sent = true;
                        }

                        if (sent) {
                            // Log the reminder so we don't send duplicates
                            // Use the user's local date (returned by SQL function)
                            // instead of UTC date to avoid date boundary issues
                            const reminderDate = user.user_local_date
                                || new Date().toISOString().split('T')[0];
                            await fetch(
                                `${SUPABASE_URL}/rest/v1/meal_reminder_log`,
                                {
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
                                }
                            );
                        }

                        return { success: sent, userId: user.user_id };
                    } catch (error) {
                        console.error(`Failed to send ${mealType} reminder to user ${user.user_id}:`, error.message);

                        // If subscription is invalid (410 Gone), clean it up
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

                        return { success: false, userId: user.user_id, error: error.message };
                    }
                })
            );

            const sent = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
            const failed = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success)).length;

            mealResults[mealType] = { sent, failed };
            totalSent += sent;
            totalFailed += failed;
        }

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: 'Meal reminders processed',
                totalSent,
                totalFailed,
                mealResults
            })
        };

    } catch (error) {
        console.error('Error sending meal reminders:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to send meal reminders', details: error.message })
        };
    }
};
