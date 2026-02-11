const webpush = require('web-push');

// Configure web-push with VAPID keys
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_EMAIL = process.env.VAPID_EMAIL || 'mailto:admin@plantbasedbalance.com';

// Supabase config
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://hzapaorxqboevxnumxkv.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

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
            return {
                statusCode: 200,
                body: JSON.stringify({ message: 'No subscriptions found for recipient', sent: 0 })
            };
        }

        // Truncate message for notification display
        const displayText = messageText.length > 120
            ? messageText.substring(0, 120) + '...'
            : messageText;

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
                url: './dashboard.html'
            }
        });

        // Send to all of the recipient's subscriptions
        const results = await Promise.allSettled(
            subscriptions.map(async (sub) => {
                const pushSubscription = {
                    endpoint: sub.endpoint,
                    keys: {
                        p256dh: sub.p256dh,
                        auth: sub.auth
                    }
                };

                try {
                    await webpush.sendNotification(pushSubscription, notificationPayload);
                    return { success: true, endpoint: sub.endpoint };
                } catch (error) {
                    console.error(`Failed to send to ${sub.endpoint}:`, error.statusCode, error.message);

                    // Clean up invalid subscriptions
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
