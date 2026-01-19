const webpush = require('web-push');

// Configure web-push with VAPID keys
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_EMAIL = process.env.VAPID_EMAIL || 'mailto:admin@plantbasedbalance.com';

// Supabase config - try multiple env var names
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://hzapaorxqboevxnumxkv.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

exports.handler = async (event) => {
    // Only accept POST
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    // Check VAPID keys
    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
        console.error('Missing VAPID keys. VAPID_PUBLIC_KEY:', !!VAPID_PUBLIC_KEY, 'VAPID_PRIVATE_KEY:', !!VAPID_PRIVATE_KEY);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Server configuration error: Missing VAPID keys' })
        };
    }

    // Check Supabase service key
    if (!SUPABASE_SERVICE_KEY) {
        console.error('Missing SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SERVICE_KEY env var');
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Server configuration error: Missing Supabase service key' })
        };
    }

    // Configure web-push
    webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

    try {
        const { title, body, data, targetAdmins } = JSON.parse(event.body);

        if (!title || !body) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Missing title or body' })
            };
        }

        // Fetch admin push subscriptions from Supabase
        const subscriptionsResponse = await fetch(
            `${SUPABASE_URL}/rest/v1/push_subscriptions?is_admin=eq.true&select=*`,
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
        console.log(`Found ${subscriptions.length} admin subscriptions`);

        if (subscriptions.length === 0) {
            return {
                statusCode: 200,
                body: JSON.stringify({ message: 'No admin subscriptions found', sent: 0 })
            };
        }

        // Prepare notification payload
        const notificationPayload = JSON.stringify({
            title,
            body,
            icon: '/assets/coach_shannon.jpg',
            badge: '/assets/logo_optimized.png',
            vibrate: [200, 100, 200],
            tag: 'pending-approval',
            requireInteraction: true,
            data: data || {},
            actions: [
                { action: 'approve', title: 'Approve' },
                { action: 'edit', title: 'Edit' }
            ]
        });

        // Send to all admin subscriptions
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
                    console.error(`Failed to send to ${sub.endpoint}:`, error.message);

                    // If subscription is invalid (410 Gone), delete it
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
            body: JSON.stringify({
                message: `Push notifications sent`,
                sent,
                failed,
                total: subscriptions.length
            })
        };

    } catch (error) {
        console.error('Error sending push notification:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to send notification', details: error.message })
        };
    }
};
