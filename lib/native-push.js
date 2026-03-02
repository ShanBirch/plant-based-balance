/**
 * Native Push Notification Bridge
 *
 * Uses @capacitor/push-notifications for real native push
 * when running as a Capacitor app. Falls back to the existing
 * Web Push API (VAPID) when running in the browser.
 *
 * Native push uses Firebase Cloud Messaging (Android) and
 * APNs (iOS) — much more reliable than web push.
 *
 * Also handles scheduling local meal timing notifications
 * so the FitGotchi can remind users to eat on schedule.
 */

// Check if we're running inside Capacitor native shell
function isNativeApp() {
  return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
}

/**
 * Initialize native push notifications
 * Call this during app startup — it will no-op on web
 */
async function initNativePush() {
  if (!isNativeApp()) {
    console.log('[NativePush] Not a native app, using web push instead');
    return false;
  }

  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');

    // Check current permission status
    const permStatus = await PushNotifications.checkPermissions();
    console.log('[NativePush] Current permission:', permStatus.receive);

    if (permStatus.receive === 'prompt') {
      // Request permission
      const result = await PushNotifications.requestPermissions();
      if (result.receive !== 'granted') {
        console.log('[NativePush] Permission denied');
        return false;
      }
    } else if (permStatus.receive !== 'granted') {
      console.log('[NativePush] Permission not granted:', permStatus.receive);
      return false;
    }

    // Register for push notifications (gets the device token)
    await PushNotifications.register();

    // Listen for registration success — gives us the FCM/APNs token
    PushNotifications.addListener('registration', (token) => {
      console.log('[NativePush] Device token:', token.value);
      // Save this token to your backend so you can send pushes
      saveNativePushToken(token.value);
    });

    // Listen for registration errors
    PushNotifications.addListener('registrationError', (error) => {
      console.error('[NativePush] Registration error:', error);
    });

    // Listen for incoming push notifications while app is open
    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('[NativePush] Received in foreground:', notification);
      // Show an in-app notification or badge
      handleForegroundNotification(notification);
    });

    // Listen for notification tap (user tapped on a notification)
    PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      console.log('[NativePush] Notification tapped:', action);
      handleNotificationTap(action.notification);
    });

    // Initialize local notifications for meal reminders
    await initLocalNotifications();

    window._nativePushReady = true;
    console.log('[NativePush] Initialized successfully');
    return true;
  } catch (err) {
    console.error('[NativePush] Init failed:', err);
    return false;
  }
}

/**
 * Save the native push token to your Supabase backend
 * This replaces the web push subscription endpoint
 */
async function saveNativePushToken(token) {
  try {
    if (!window.currentUser) {
      console.log('[NativePush] No user logged in, skipping token save');
      return;
    }

    const { supabase } = window;
    if (!supabase) return;

    // Upsert the native push token into push_subscriptions
    // Using the token as a unique identifier (like web push endpoint)
    const { error } = await supabase
      .from('push_subscriptions')
      .upsert({
        user_id: window.currentUser.id,
        endpoint: `native://${token}`,  // Prefix to distinguish from web push
        p256dh: 'native',               // Not used for native push
        auth: token,                     // Store actual token in auth field
        is_admin: false,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id',
      });

    if (error) {
      console.error('[NativePush] Error saving token:', error);
    } else {
      console.log('[NativePush] Token saved to backend');
    }
  } catch (err) {
    console.error('[NativePush] Error saving token:', err);
  }
}

/**
 * Handle notifications received while the app is in the foreground
 */
function handleForegroundNotification(notification) {
  // You can show a toast/banner here instead of a system notification
  // since the user is already in the app
  const data = notification.data || {};

  if (data.type === 'dm_message') {
    // Show in-app DM notification
    if (typeof window.showToast === 'function') {
      window.showToast(`New message from ${data.senderName || 'someone'}`, 'info');
    }
  } else if (data.type === 'meal_reminder') {
    if (typeof window.showToast === 'function') {
      window.showToast(notification.body || 'Time to log your meal!', 'info');
    }
  } else {
    // Generic notification
    if (typeof window.showToast === 'function') {
      window.showToast(notification.body || notification.title || 'New notification', 'info');
    }
  }
}

/**
 * Handle when user taps on a notification
 */
function handleNotificationTap(notification) {
  const data = notification.data || {};

  if (data.type === 'dm_message' && data.conversationId) {
    // Navigate to DM conversation
    if (typeof window.switchAppTab === 'function') {
      window.switchAppTab('social');
    }
  } else if (data.type === 'pending_approval') {
    // Open approval modal
    if (typeof window.switchAppTab === 'function') {
      window.switchAppTab('dashboard');
    }
  } else if (data.type === 'meal_reminder') {
    // Open meal input modal when user taps meal reminder
    if (typeof window.openMealInputModal === 'function') {
      window.openMealInputModal('notification');
      if (data.mealType && typeof window.selectMealType === 'function') {
        window.selectMealType(data.mealType);
      }
    } else if (typeof window.switchAppTab === 'function') {
      window.switchAppTab('dashboard');
    }
  }
}

// ==========================================
// LOCAL NOTIFICATION SCHEDULING
// For scheduling meal timing reminders on-device
// ==========================================

// FitGotchi meal reminder messages - rotating personality messages
const FITGOTCHI_MEAL_MESSAGES = {
  breakfast: [
    { title: 'Good morning! Time for breakfast', body: 'Your FitGotchi is hungry! Eat now and log it within 30 min for +1 bonus XP' },
    { title: 'Rise and fuel up!', body: 'Breakfast time! Log your meal on time for a bonus XP point' },
    { title: 'Your FitGotchi needs breakfast!', body: 'Start your day right - eat and log within 30 min for +1 XP' },
    { title: 'Breakfast o\'clock!', body: 'Your FitGotchi is waiting to see what you eat! +1 XP for on-time logging' },
  ],
  lunch: [
    { title: 'Lunchtime! Your FitGotchi is starving', body: 'Time to refuel! Log your lunch within 30 min for +1 bonus XP' },
    { title: 'Midday fuel-up time!', body: 'Your FitGotchi says it\'s lunch o\'clock. Eat and log for bonus XP!' },
    { title: 'Lunch break!', body: 'Keep your streak going - log your meal within 30 min for +1 XP' },
    { title: 'Your FitGotchi wants lunch!', body: 'Don\'t skip! Eat now and log on time for a bonus XP point' },
  ],
  dinner: [
    { title: 'Dinner time!', body: 'Your FitGotchi is ready to eat! Log within 30 min for +1 bonus XP' },
    { title: 'Evening fuel-up!', body: 'Time for dinner! Your FitGotchi earns bonus XP when you eat on schedule' },
    { title: 'Your FitGotchi wants dinner!', body: 'Last meal of the day - log on time for +1 XP bonus' },
    { title: 'Dinner o\'clock!', body: 'Eat and log within 30 minutes to earn your on-time meal bonus XP!' },
  ]
};

/**
 * Get a random FitGotchi message for a meal type
 */
function getFitGotchiMessage(mealType) {
  const messages = FITGOTCHI_MEAL_MESSAGES[mealType] || FITGOTCHI_MEAL_MESSAGES.breakfast;
  return messages[Math.floor(Math.random() * messages.length)];
}

/**
 * Initialize Capacitor Local Notifications for meal reminders
 */
async function initLocalNotifications() {
  if (!isNativeApp()) return;

  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');

    // Request permission for local notifications
    const permStatus = await LocalNotifications.checkPermissions();
    if (permStatus.display === 'prompt') {
      await LocalNotifications.requestPermissions();
    }

    // Listen for local notification actions (user tapped on a meal reminder)
    LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
      console.log('[MealReminder] Local notification tapped:', action);
      const data = action.notification?.extra || {};
      if (data.type === 'meal_reminder') {
        if (typeof window.openMealInputModal === 'function') {
          window.openMealInputModal('notification');
          if (data.mealType && typeof window.selectMealType === 'function') {
            setTimeout(() => window.selectMealType(data.mealType), 300);
          }
        }
      }
    });

    console.log('[MealReminder] Local notifications initialized');
    return true;
  } catch (err) {
    console.error('[MealReminder] Local notifications init failed:', err);
    return false;
  }
}

/**
 * Schedule meal timing notifications based on user's preferences
 * Called when settings are saved or on app startup
 *
 * @param {Object} settings - Meal reminder settings
 * @param {boolean} settings.reminders_enabled
 * @param {boolean} settings.breakfast_reminder
 * @param {boolean} settings.lunch_reminder
 * @param {boolean} settings.dinner_reminder
 * @param {string} settings.breakfast_time - HH:MM or HH:MM:SS format
 * @param {string} settings.lunch_time
 * @param {string} settings.dinner_time
 */
async function scheduleMealReminders(settings) {
  if (!isNativeApp()) {
    console.log('[MealReminder] Not native app, skipping local scheduling');
    return false;
  }

  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');

    // Cancel all existing meal reminder notifications first
    const pending = await LocalNotifications.getPending();
    const mealNotifIds = pending.notifications
      .filter(n => n.id >= 9001 && n.id <= 9006)
      .map(n => ({ id: n.id }));

    if (mealNotifIds.length > 0) {
      await LocalNotifications.cancel({ notifications: mealNotifIds });
      console.log('[MealReminder] Cancelled', mealNotifIds.length, 'existing meal reminders');
    }

    // If reminders are disabled, we're done
    if (!settings.reminders_enabled) {
      console.log('[MealReminder] Reminders disabled, all cleared');
      return true;
    }

    const notifications = [];

    // Schedule each enabled meal reminder
    const meals = [
      { type: 'breakfast', enabled: settings.breakfast_reminder, time: settings.breakfast_time, id: 9001 },
      { type: 'lunch', enabled: settings.lunch_reminder, time: settings.lunch_time, id: 9003 },
      { type: 'dinner', enabled: settings.dinner_reminder, time: settings.dinner_time, id: 9005 },
    ];

    for (const meal of meals) {
      if (!meal.enabled || !meal.time) continue;

      // Parse time (HH:MM or HH:MM:SS)
      const parts = meal.time.split(':');
      const hour = parseInt(parts[0]);
      const minute = parseInt(parts[1]);

      const msg = getFitGotchiMessage(meal.type);

      // Schedule the notification at meal time (repeats daily)
      notifications.push({
        id: meal.id,
        title: msg.title,
        body: msg.body,
        largeBody: msg.body,
        summaryText: 'Meal Reminder',
        sound: 'default',
        smallIcon: 'ic_stat_notification',
        largeIcon: 'ic_launcher',
        schedule: {
          on: { hour, minute },
          repeats: true,
          allowWhileIdle: true,
        },
        extra: {
          type: 'meal_reminder',
          mealType: meal.type,
        },
        channelId: 'meal-reminders',
        autoCancel: true,
      });
    }

    if (notifications.length > 0) {
      // Create notification channel for Android
      try {
        await LocalNotifications.createChannel({
          id: 'meal-reminders',
          name: 'Meal Reminders',
          description: 'FitGotchi meal timing reminders',
          importance: 4, // HIGH
          visibility: 1, // PUBLIC
          sound: 'default',
          vibration: true,
        });
      } catch (channelErr) {
        // Channel creation may fail on iOS (not needed there)
        console.log('[MealReminder] Channel creation:', channelErr.message);
      }

      await LocalNotifications.schedule({ notifications });
      console.log('[MealReminder] Scheduled', notifications.length, 'meal reminders');
    }

    return true;
  } catch (err) {
    console.error('[MealReminder] Error scheduling reminders:', err);
    return false;
  }
}

// Export to window so dashboard.html can use it
window.NativePush = {
  isNativeApp,
  init: initNativePush,
  scheduleMealReminders,
  getFitGotchiMessage,
  FITGOTCHI_MEAL_MESSAGES,
};
