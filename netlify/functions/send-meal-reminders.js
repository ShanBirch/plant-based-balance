const webpush = require('web-push');
const crypto = require('crypto');

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
    var messages = FITGOTCHI_MESSAGES[mealType] || FITGOTCHI_MESSAGES.breakfast;
    return messages[Math.floor(Math.random() * messages.length)];
}

async function getFCMAccessToken() {
    if (!FIREBASE_SERVICE_ACCOUNT) return null;
    var sa = FIREBASE_SERVICE_ACCOUNT;
    var now = Math.floor(Date.now() / 1000);
    var header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
    var payload = Buffer.from(JSON.stringify({
        iss: sa.client_email,
        scope: 'https://www.googleapis.com/auth/firebase.messaging',
        aud: 'https://oauth2.googleapis.com/token',
        iat: now,
        exp: now + 3600
    })).toString('base64url');
    var sign = crypto.createSign('RSA-SHA256');
    sign.update(header + '.' + payload);
    var signature = sign.sign(sa.private_key, 'base64url');
    var jwt = header + '.' + payload + '.' + signature;
    var tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=' + jwt
    });
    var tokenData = await tokenResponse.json();
    return tokenData.access_token;
}

async function sendNativePush(token, payload) {
    if (!FIREBASE_SERVICE_ACCOUNT) {
        console.log('[NativePush] No Firebase config, skipping');
        return false;
    }
    try {
        var accessToken = await getFCMAccessToken();
        if (!accessToken) {
            console.error('[NativePush] Failed to get FCM access token');
            return false;
        }
        var projectId = FIREBASE_SERVICE_ACCOUNT.project_id;
        var stringData = {};
        if (payload.data) {
            Object.keys(payload.data).forEach(function(k) {
                stringData[k] = String(payload.data[k]);
            });
        }
        var response = await fetch(
            'https://fcm.googleapis.com/v1/projects/' + projectId + '/messages:send',
            {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + accessToken,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: {
                        token: token,
                        notification: {
                            title: payload.title,
                            body: payload.body
                        },
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
            var errorText = await response.text();
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

exports.handler = async function(event) {
    try {
        // Check required env
        if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
            return { statusCode: 500, body: JSON.stringify({ error: 'Missing VAPID keys' }) };
        }
        if (!SUPABASE_SERVICE_KEY || !SUPABASE_URL) {
            return { statusCode: 500, body: JSON.stringify({ error: 'Missing Supabase config' }) };
        }

        webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

        // Determine meal types to check
        var mealTypes = ['breakfast', 'lunch', 'dinner'];
        if (event.body) {
            try {
                var parsed = JSON.parse(event.body);
                if (parsed.mealType && ['breakfast', 'lunch', 'dinner'].indexOf(parsed.mealType) !== -1) {
                    mealTypes = [parsed.mealType];
                }
            } catch (e) {
                // Ignore parse errors, just check all meals
            }
        }

        var totalSent = 0;
        var totalFailed = 0;
        var mealResults = {};

        for (var i = 0; i < mealTypes.length; i++) {
            var mealType = mealTypes[i];

            // Query eligible users via SQL function
            var usersResponse = await fetch(
                SUPABASE_URL + '/rest/v1/rpc/get_users_needing_meal_reminders',
                {
                    method: 'POST',
                    headers: {
                        'apikey': SUPABASE_SERVICE_KEY,
                        'Authorization': 'Bearer ' + SUPABASE_SERVICE_KEY,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ p_meal_type: mealType })
                }
            );

            if (!usersResponse.ok) {
                var errText = await usersResponse.text();
                console.error('Error fetching users for ' + mealType + ':', errText);
                mealResults[mealType] = { sent: 0, failed: 0, error: errText };
                continue;
            }

            var users = await usersResponse.json();
            console.log('Found ' + users.length + ' users needing ' + mealType + ' reminders');

            if (users.length === 0) {
                mealResults[mealType] = { sent: 0, failed: 0 };
                continue;
            }

            var sent = 0;
            var failed = 0;

            for (var j = 0; j < users.length; j++) {
                var user = users[j];
                var isNative = user.push_endpoint && user.push_endpoint.indexOf('native://') === 0;
                var msg = getRandomMessage(mealType);
                var dataPayload = {
                    type: 'meal_reminder',
                    mealType: mealType,
                    url: './dashboard.html?tab=meals&action=log'
                };

                try {
                    var didSend = false;

                    if (isNative) {
                        var nativeToken = user.push_auth;
                        didSend = await sendNativePush(nativeToken, {
                            title: msg.title,
                            body: msg.body,
                            data: dataPayload
                        });
                    } else {
                        var notificationPayload = JSON.stringify({
                            title: msg.title,
                            body: msg.body,
                            icon: '/assets/Logo_dots.jpg',
                            badge: '/assets/Logo_dots.jpg',
                            vibrate: [200, 100, 200],
                            tag: 'meal-reminder-' + mealType,
                            requireInteraction: true,
                            data: dataPayload,
                            actions: [
                                { action: 'log_photo', title: 'Photo' },
                                { action: 'log_text', title: 'Describe' }
                            ]
                        });

                        var pushSubscription = {
                            endpoint: user.push_endpoint,
                            keys: {
                                p256dh: user.push_p256dh,
                                auth: user.push_auth
                            }
                        };

                        await webpush.sendNotification(pushSubscription, notificationPayload);
                        didSend = true;
                    }

                    if (didSend) {
                        var reminderDate = user.user_local_date || new Date().toISOString().split('T')[0];
                        await fetch(
                            SUPABASE_URL + '/rest/v1/meal_reminder_log',
                            {
                                method: 'POST',
                                headers: {
                                    'apikey': SUPABASE_SERVICE_KEY,
                                    'Authorization': 'Bearer ' + SUPABASE_SERVICE_KEY,
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify({
                                    user_id: user.user_id,
                                    meal_type: mealType,
                                    reminder_date: reminderDate
                                })
                            }
                        );
                        sent++;
                    } else {
                        failed++;
                    }
                } catch (error) {
                    console.error('Failed to send ' + mealType + ' reminder to ' + user.user_id + ':', error.message);
                    if (error.statusCode === 410) {
                        await fetch(
                            SUPABASE_URL + '/rest/v1/push_subscriptions?endpoint=eq.' + encodeURIComponent(user.push_endpoint),
                            {
                                method: 'DELETE',
                                headers: {
                                    'apikey': SUPABASE_SERVICE_KEY,
                                    'Authorization': 'Bearer ' + SUPABASE_SERVICE_KEY
                                }
                            }
                        );
                    }
                    failed++;
                }
            }

            mealResults[mealType] = { sent: sent, failed: failed };
            totalSent += sent;
            totalFailed += failed;
        }

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: 'Meal reminders processed',
                totalSent: totalSent,
                totalFailed: totalFailed,
                mealResults: mealResults
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
