const webpush = require('web-push');

// Configure web-push with VAPID keys
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_EMAIL = process.env.VAPID_EMAIL || 'mailto:admin@plantbasedbalance.com';

// Supabase config
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
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
        const { mealType } = JSON.parse(event.body || '{}');

        if (!mealType || !['breakfast', 'lunch', 'dinner'].includes(mealType)) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Invalid meal type. Must be breakfast, lunch, or dinner.' })
            };
        }

        // Get current time
        const now = new Date();
        const currentTime = now.toTimeString().split(' ')[0]; // HH:MM:SS format
        const today = now.toISOString().split('T')[0]; // YYYY-MM-DD format

        // Query Supabase for users needing meal reminders
        // This uses a stored function that checks:
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
            console.error('Error fetching users for reminders:', errorText);
            return {
                statusCode: 500,
                body: JSON.stringify({ error: 'Failed to fetch users needing reminders' })
            };
        }

        const users = await usersResponse.json();
        console.log(`Found ${users.length} users needing ${mealType} reminders`);

        if (users.length === 0) {
            return {
                statusCode: 200,
                body: JSON.stringify({ message: 'No users need reminders right now', sent: 0 })
            };
        }

        // Prepare notification payload
        const mealEmoji = mealType === 'breakfast' ? '🌅' : mealType === 'lunch' ? '☀️' : '🌙';
        const mealCapitalized = mealType.charAt(0).toUpperCase() + mealType.slice(1);

        const notificationPayload = JSON.stringify({
            title: `${mealEmoji} Log Your ${mealCapitalized}`,
            body: `Don't forget to track what you had for ${mealType}! Tap to log it now.`,
            icon: '/assets/Logo_dots.jpg',
            badge: '/assets/Logo_dots.jpg',
            vibrate: [200, 100, 200],
            tag: `meal-reminder-${mealType}`,
            requireInteraction: true,
            data: {
                type: 'meal_reminder',
                mealType: mealType,
                url: './dashboard.html?tab=meals&action=log'
            },
            actions: [
                { action: 'log_photo', title: 'Photo' },
                { action: 'log_text', title: 'Describe' }
            ]
        });

        // Send notifications to each user
        const results = await Promise.allSettled(
            users.map(async (user) => {
                const pushSubscription = {
                    endpoint: user.push_endpoint,
                    keys: {
                        p256dh: user.push_p256dh,
                        auth: user.push_auth
                    }
                };

                try {
                    await webpush.sendNotification(pushSubscription, notificationPayload);

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

                    return { success: true, userId: user.user_id };
                } catch (error) {
                    console.error(`Failed to send reminder to user ${user.user_id}:`, error.message);

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

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: `Meal reminders sent for ${mealType}`,
                sent,
                failed,
                total: users.length
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
