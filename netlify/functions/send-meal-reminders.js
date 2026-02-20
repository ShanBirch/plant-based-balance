const webpush = require('web-push');
const crypto = require('crypto');

// Configure web-push with VAPID keys
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_EMAIL = process.env.VAPID_EMAIL || 'mailto:admin@plantbasedbalance.com';

// Supabase config
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

// FCM V1 config — stored as three individual env vars to stay under AWS Lambda's 4KB env var limit.
// In Netlify: remove FIREBASE_SERVICE_ACCOUNT and add these three instead:
//   FIREBASE_PROJECT_ID   — e.g. "my-project-12345"
//   FIREBASE_CLIENT_EMAIL — e.g. "firebase-adminsdk-xxx@my-project.iam.gserviceaccount.com"
//   FIREBASE_PRIVATE_KEY  — the raw PEM key from the service account JSON (with literal \n)
const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || null;
const FIREBASE_CLIENT_EMAIL = process.env.FIREBASE_CLIENT_EMAIL || null;
const FIREBASE_PRIVATE_KEY = process.env.FIREBASE_PRIVATE_KEY
    ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
    : null;

// Keep legacy JSON fallback so existing deploys don't break mid-migration
const FIREBASE_SERVICE_ACCOUNT = (!FIREBASE_PROJECT_ID && process.env.FIREBASE_SERVICE_ACCOUNT)
    ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
    : null;

function getFirebaseCredentials() {
    if (FIREBASE_PROJECT_ID && FIREBASE_CLIENT_EMAIL && FIREBASE_PRIVATE_KEY) {
        return { project_id: FIREBASE_PROJECT_ID, client_email: FIREBASE_CLIENT_EMAIL, private_key: FIREBASE_PRIVATE_KEY };
    }
    if (FIREBASE_SERVICE_ACCOUNT) {
        return FIREBASE_SERVICE_ACCOUNT;
    }
    return null;
}

async function getFCMAccessToken() {
    const creds = getFirebaseCredentials();
    if (!creds) return null;
    const { client_email, private_key, project_id } = creds;
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
    const creds = getFirebaseCredentials();
    if (!creds) {
        console.log('[NativePush] No Firebase credentials configured, skipping native push');
        return false;
    }

    try {
        const accessToken = await getFCMAccessToken();
        if (!accessToken) {
            console.error('[NativePush] Failed to get FCM access token');
            return false;
        }

        const projectId = creds.project_id;
        // FCM V1 requires all data values to be strings
        const stringData = Object.fromEntries(
            Object.entries(payload.data || {}).map(([k, v]) => [k, String(v)])
        );

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
            console.error('[NativePush] FCM V1 error:', errorText);
            return false;
        }

        return true;
    } catch (err) {
        console.error('[NativePush] FCM send failed:', err.message);
        return false;
    }
}

exports.handler = async (event) => {
    // Accept both POST (manual trigger) and GET (Netlify scheduled function)
    const isScheduled = !event.body;

    if (event.httpMethod !== 'POST' && event.httpMethod !== 'GET') {
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
            const { mealType } = JSON.parse(event.body || '{}');
            if (!mealType || !['breakfast', 'lunch', 'dinner'].includes(mealType)) {
                return {
                    statusCode: 400,
                    body: JSON.stringify({ error: 'Invalid meal type. Must be breakfast, lunch, or dinner.' })
                };
            }
            mealTypes = [mealType];
        }

        // Get current time
        const now = new Date();
        const currentTime = now.toTimeString().split(' ')[0]; // HH:MM:SS format
        const today = now.toISOString().split('T')[0]; // YYYY-MM-DD format

        let totalSent = 0;
        let totalFailed = 0;
        const mealResults = {};

        for (const mealType of mealTypes) {
            // Query Supabase for users needing meal reminders
            // The stored function checks:
            // - reminders are enabled
            // - it's past their meal time + delay
            // - they haven't logged this meal type today
            // - we haven't already sent a reminder today
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
                        p_meal_type: mealType,
                        p_current_time: currentTime
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
                                        reminder_date: today
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
