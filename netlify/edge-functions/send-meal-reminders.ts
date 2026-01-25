
import { Context } from "@netlify/edge-functions";

// Web Push library for sending notifications
import webpush from "npm:web-push@3.6.7";

export default async function (request: Request, context: Context) {
  // Only accept POST (from scheduled function or admin)
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    // Get environment variables
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_KEY");
    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");

    if (!supabaseUrl || !supabaseKey) {
      return new Response(JSON.stringify({ error: "Missing Supabase config" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!vapidPublicKey || !vapidPrivateKey) {
      return new Response(JSON.stringify({ error: "Missing VAPID keys for push notifications" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Configure web push
    webpush.setVapidDetails(
      'mailto:support@plantbasedbalance.com',
      vapidPublicKey,
      vapidPrivateKey
    );

    const { mealType } = await request.json();

    if (!mealType || !['breakfast', 'lunch', 'dinner'].includes(mealType)) {
      return new Response(JSON.stringify({ error: "Invalid meal type" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Get current time
    const now = new Date();
    const currentTime = now.toTimeString().split(' ')[0]; // HH:MM:SS format

    // Query Supabase for users needing reminders
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/get_users_needing_meal_reminders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({
        p_meal_type: mealType,
        p_current_time: currentTime,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Error fetching users for reminders:", errorText);
      return new Response(JSON.stringify({ error: "Failed to fetch users" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const users = await response.json();
    console.log(`Found ${users.length} users needing ${mealType} reminders`);

    // Send notifications to each user
    const results = [];
    const today = now.toISOString().split('T')[0];

    for (const user of users) {
      try {
        // Prepare notification payload
        const mealEmoji = mealType === 'breakfast' ? '🌅' : mealType === 'lunch' ? '☀️' : '🌙';
        const notification = {
          title: `${mealEmoji} Log Your ${mealType.charAt(0).toUpperCase() + mealType.slice(1)}`,
          body: `Don't forget to track what you had for ${mealType}! Tap to log it now.`,
          icon: './assets/Logo_dots.jpg',
          badge: './assets/Logo_dots.jpg',
          vibrate: [200, 100, 200],
          tag: `meal-reminder-${mealType}`,
          requireInteraction: true,
          data: {
            type: 'meal_reminder',
            mealType: mealType,
            url: './dashboard.html?tab=meals&action=log'
          },
          actions: [
            { action: 'log_photo', title: '📸 Photo' },
            { action: 'log_text', title: '📝 Describe' }
          ]
        };

        // Send push notification
        const pushSubscription = {
          endpoint: user.push_endpoint,
          keys: {
            p256dh: user.push_p256dh,
            auth: user.push_auth,
          }
        };

        await webpush.sendNotification(
          pushSubscription,
          JSON.stringify(notification)
        );

        // Log the reminder
        await fetch(`${supabaseUrl}/rest/v1/meal_reminder_log`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({
            user_id: user.user_id,
            meal_type: mealType,
            reminder_date: today,
          }),
        });

        results.push({ userId: user.user_id, status: 'sent' });
      } catch (pushError) {
        console.error(`Error sending push to user ${user.user_id}:`, pushError);
        results.push({ userId: user.user_id, status: 'failed', error: pushError.message });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      mealType,
      totalUsers: users.length,
      results
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in send-meal-reminders function:", error);
    return new Response(JSON.stringify({
      error: "Internal server error",
      message: error.message
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
