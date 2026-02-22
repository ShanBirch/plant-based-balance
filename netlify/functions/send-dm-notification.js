const webpush = require('web-push');
const crypto = require('crypto');

// Configure web-push with VAPID keys
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_EMAIL = process.env.VAPID_EMAIL || 'mailto:admin@plantbasedbalance.com';

// Supabase config
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://hzapaorxqboevxnumxkv.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

// FCM V1 config — service account JSON stored as an env var string
let FIREBASE_SERVICE_ACCOUNT = null;
try {
    FIREBASE_SERVICE_ACCOUNT = process.env.FIREBASE_SERVICE_ACCOUNT
        ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
        : null;
} catch (parseErr) {
    console.error('[FCM] FIREBASE_SERVICE_ACCOUNT env var is invalid JSON:', parseErr.message);
}
if (!FIREBASE_SERVICE_ACCOUNT) {
    console.warn('[FCM] FIREBASE_SERVICE_ACCOUNT not configured — native Android push notifications will not be sent');
}

/**
 * Get an OAuth2 access token for FCM V1 API using the service account JWT
 */
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

/**
 * Send a push notification to a native device via FCM V1 API
 */
async function sendNativePush(token, payload) {
    if (!FIREBASE_SERVICE_ACCOUNT) {
        console.log('[NativePush] No FIREBASE_SERVICE_ACCOUNT configured, skipping native push');
        return false;
    }

    try {
        const accessToken = await getFCMAccessToken();
        if (!accessToken) {
            console.error('[NativePush] Failed to get FCM access token');
            return false;
        }

        const projectId = FIREBASE_SERVICE_ACCOUNT.project_id;
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
                            notification: {
                                channel_id: 'dm-messages',
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
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
        console.error('Missing VAPID keys');
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Server configuration error: Missing VAPID keys' })
        };
    }

    if (!SUPABASE_SERVICE_KEY) {
        console.error('Missing Supabase service key');
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Server configuration error: Missing Supabase service key' })
        };
    }

    webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

    try {
        const { recipientId, senderName, messageText } = JSON.parse(event.body);

        if (!recipientId || !messageText) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Missing recipientId or messageText' })
            };
        }

        // Fetch push subscriptions for the recipient user
        const subscriptionsResponse = await fetch(
            `${SUPABASE_URL}/rest/v1/push_subscriptions?user_id=eq.${recipientId}&select=*`,
            {
                headers: {
                    'apikey': SUPABASE_SERVICE_KEY,
                    'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        if (!subscriptionsResponse.ok) {
            console.error('Failed to fetch subscriptions:', await subscriptionsResponse.text());
            return {
                statusCode: 500,
                body: JSON.stringify({ error: 'Failed to fetch subscriptions' })
            };
        }

        const subscriptions = await subscriptionsResponse.json();
        console.log(`Found ${subscriptions.length} subscriptions for user ${recipientId}`);

        if (subscriptions.length === 0) {
            console.log(`[DM-Notif] No push subscriptions in DB for user ${recipientId}. The user needs to open the app so their FCM token gets registered.`);
            return {
                statusCode: 200,
                body: JSON.stringify({
                    message: 'No subscriptions found for recipient — device not registered for push',
                    sent: 0,
                    hint: 'User must open app once after deploy to register FCM token'
                })
            };
        }

        // Truncate message for notification display
        const displayText = messageText.length > 120
            ? messageText.substring(0, 120) + '...'
            : messageText;

        // Send to all of the recipient's subscriptions
        const results = await Promise.allSettled(
            subscriptions.map(async (sub) => {
                const isNative = sub.endpoint && sub.endpoint.startsWith('native://');

                try {
                    if (isNative) {
                        // Native app — send via FCM
                        const nativeToken = sub.auth; // Token stored in auth field
                        const sent = await sendNativePush(nativeToken, {
                            title: senderName || 'New Message',
                            body: displayText,
                            data: {
                                type: 'dm_message',
                                senderName: senderName || 'Someone',
                                url: './dashboard.html'
                            }
                        });
                        return { success: sent, endpoint: sub.endpoint };
                    } else {
                        // Web browser — send via Web Push (VAPID)
                        const notificationPayload = JSON.stringify({
                            title: senderName || 'New Message',
                            body: displayText,
                            icon: '/assets/Logo_dots.jpg',
                            badge: '/assets/Logo_dots.jpg',
                            vibrate: [200, 100, 200],
                            tag: 'dm-message-' + Date.now(),
                            requireInteraction: false,
                            data: {
                                type: 'dm_message',
                                senderName: senderName || 'Someone',
                                url: './dashboard.html'
                            }
                        });

                        const pushSubscription = {
                            endpoint: sub.endpoint,
                            keys: {
                                p256dh: sub.p256dh,
                                auth: sub.auth
                            }
                        };

                        await webpush.sendNotification(pushSubscription, notificationPayload);
                        return { success: true, endpoint: sub.endpoint };
                    }
                } catch (error) {
                    console.error(`Failed to send to ${sub.endpoint}:`, error.statusCode || '', error.message);

                    // Clean up invalid subscriptions (410 Gone)
                    if (error.statusCode === 410) {
                        await fetch(
                            `${SUPABASE_URL}/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(sub.endpoint)}`,
                            {
                                method: 'DELETE',
                                headers: {
                                    'apikey': SUPABASE_SERVICE_KEY,
                                    'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
                                }
                            }
                        );
                    }

                    return { success: false, endpoint: sub.endpoint, error: error.message };
                }
            })
        );

        const sent = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
        const failed = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success)).length;

        return {
            statusCode: 200,
            body: JSON.stringify({ message: 'DM notifications sent', sent, failed, total: subscriptions.length })
        };

    } catch (error) {
        console.error('Error sending DM notification:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to send notification', details: error.message })
        };
    }
};
