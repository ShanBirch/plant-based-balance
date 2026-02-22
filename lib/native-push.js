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
 *
 * NOTE: Plugins are accessed via Capacitor.registerPlugin() instead of
 * dynamic imports because the app loads from a remote Netlify URL.
 * Bare module specifiers like '@capacitor/push-notifications' cannot be
 * resolved by the browser without a bundler or import map.
 */

// Check if we're running inside Capacitor native shell
function isNativeApp() {
  return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
}

// ── Plugin access via Capacitor bridge ──────────────────────────────
// Cache plugin references so registerPlugin is only called once each.
var _pushPlugin = null;
var _localPlugin = null;

function getPushNotifications() {
  if (!_pushPlugin) {
    // Try multiple ways to access the PushNotifications plugin
    // Method 1: Capacitor.registerPlugin (standard for remote-loaded apps)
    if (window.Capacitor && window.Capacitor.registerPlugin) {
      try {
        _pushPlugin = window.Capacitor.registerPlugin('PushNotifications');
        console.log('[NativePush] Plugin loaded via registerPlugin:', !!_pushPlugin);
      } catch (e) {
        console.error('[NativePush] registerPlugin failed:', e.message);
      }
    }
    // Method 2: Check if plugin is already on Capacitor.Plugins
    if (!_pushPlugin && window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.PushNotifications) {
      _pushPlugin = window.Capacitor.Plugins.PushNotifications;
      console.log('[NativePush] Plugin loaded via Capacitor.Plugins:', !!_pushPlugin);
    }
    // Debug: log what's available
    if (!_pushPlugin) {
      console.error('[NativePush] Plugin NOT available. Capacitor:', !!window.Capacitor,
        'registerPlugin:', !!(window.Capacitor && window.Capacitor.registerPlugin),
        'Plugins:', !!(window.Capacitor && window.Capacitor.Plugins),
        'Plugins.PushNotifications:', !!(window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.PushNotifications),
        'AvailablePlugins:', window.Capacitor && window.Capacitor.Plugins ? Object.keys(window.Capacitor.Plugins).join(',') : 'none');
    }
  }
  return _pushPlugin;
}

function getLocalNotifications() {
  if (!_localPlugin && window.Capacitor && window.Capacitor.registerPlugin) {
    _localPlugin = window.Capacitor.registerPlugin('LocalNotifications');
  }
  return _localPlugin;
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
    // Unregister any service worker web push subscription that may have been
    // created by the WebView — on native, FCM handles push, not the SW.
    try {
      if ('serviceWorker' in navigator) {
        const swReg = await navigator.serviceWorker.getRegistration();
        if (swReg) {
          const webPushSub = await swReg.pushManager.getSubscription();
          if (webPushSub) {
            await webPushSub.unsubscribe();
            console.log('[NativePush] Unsubscribed stale web push subscription from WebView SW');
          }
        }
      }
    } catch (swErr) {
      console.log('[NativePush] SW cleanup (non-critical):', swErr.message);
    }

    const PushNotifications = getPushNotifications();
    if (!PushNotifications) {
      console.error('[NativePush] PushNotifications plugin not available via Capacitor bridge');
      return false;
    }

    // Check current permission status
    const permStatus = await PushNotifications.checkPermissions();
    console.log('[NativePush] Current permission:', permStatus.receive);

    if (permStatus.receive === 'prompt') {
      const result = await PushNotifications.requestPermissions();
      if (result.receive !== 'granted') {
        console.log('[NativePush] Permission denied');
        return false;
      }
    } else if (permStatus.receive !== 'granted') {
      console.log('[NativePush] Permission not granted:', permStatus.receive);
      return false;
    }

    // Set up ALL listeners BEFORE calling register() so we don't miss events
    const tokenPromise = new Promise((resolve) => {
      let resolved = false;

      PushNotifications.addListener('registration', (token) => {
        console.log('[NativePush] Device token received:', token.value.substring(0, 20) + '...');
        if (!resolved) { resolved = true; resolve(token.value); }
        saveNativePushToken(token.value);
      });

      PushNotifications.addListener('registrationError', (error) => {
        console.error('[NativePush] Registration error:', JSON.stringify(error));
        window._pushTokenStatus = 'registration_error: ' + (error.error || JSON.stringify(error));
        if (!resolved) { resolved = true; resolve(null); }
      });

      // Timeout: if neither fires in 15 seconds, something is wrong
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          console.error('[NativePush] Token registration timed out after 15s');
          window._pushTokenStatus = 'registration_timeout';
          resolve(null);
        }
      }, 15000);
    });

    // Listen for incoming push notifications while app is open
    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('[NativePush] Received in foreground:', notification);
      handleForegroundNotification(notification);
    });

    // Listen for notification tap (user tapped on a notification)
    PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      console.log('[NativePush] Notification tapped:', action);
      handleNotificationTap(action.notification);
    });

    // NOW register for push notifications (triggers the listeners above)
    console.log('[NativePush] Calling register()...');
    await PushNotifications.register();
    console.log('[NativePush] register() completed, waiting for token...');

    // Wait for token or timeout
    const token = await tokenPromise;
    if (!token) {
      console.error('[NativePush] Failed to get FCM token. Status:', window._pushTokenStatus);
    } else {
      console.log('[NativePush] FCM token obtained successfully');
    }

    // Initialize local notifications for meal reminders
    await initLocalNotifications();

    window._nativePushReady = true;
    console.log('[NativePush] Initialized successfully. Token status:', window._pushTokenStatus || 'pending');
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
async function saveNativePushToken(token, _retryCount) {
  var retryCount = _retryCount || 0;
  try {
    console.log('[NativePush] saveNativePushToken called (attempt', retryCount + 1, ') token:', token.substring(0, 20) + '...');
    if (!window.currentUser) {
      // Auth may not be ready yet — retry up to 10 times with increasing delay
      if (retryCount < 10) {
        var delay = (retryCount + 1) * 2000; // 2s, 4s, 6s, ... 20s
        console.log('[NativePush] No user yet, retrying token save in', delay/1000, 's (attempt', retryCount+1, '/10)');
        setTimeout(function() { saveNativePushToken(token, retryCount + 1); }, delay);
        return;
      }
      console.error('[NativePush] No user logged in after 10 retries, giving up token save');
      window._pushTokenStatus = 'save_failed: no_user_after_retries';
      return;
    }

    const supabase = window.supabaseClient;
    if (!supabase) {
      console.error('[NativePush] No supabaseClient available, cannot save token');
      window._pushTokenStatus = 'save_failed: no_supabase_client';
      return;
    }

    console.log('[NativePush] Saving token for user:', window.currentUser.id.substring(0, 8) + '...');

    // Upsert the native push token into push_subscriptions
    // Using the endpoint as a unique identifier (UNIQUE constraint is on endpoint, not user_id)
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
        onConflict: 'endpoint',
      });

    if (error) {
      console.error('[NativePush] Error saving token:', JSON.stringify(error));
      window._pushTokenStatus = 'save_failed: ' + (error.message || JSON.stringify(error));
    } else {
      console.log('[NativePush] ✅ Token saved to backend successfully');
      window._pushTokenStatus = 'saved';

      // Remove any stale web push subscriptions for this user on native —
      // web push from a WebView can't deliver when the app is closed,
      // so only the native:// FCM subscription should remain
      try {
        const { data: allSubs } = await supabase
          .from('push_subscriptions')
          .select('id, endpoint')
          .eq('user_id', window.currentUser.id);
        if (allSubs && allSubs.length > 0) {
          var staleSubs = allSubs.filter(function(s) { return !s.endpoint.startsWith('native://'); });
          if (staleSubs.length > 0) {
            var staleIds = staleSubs.map(function(s) { return s.id; });
            await supabase.from('push_subscriptions').delete().in('id', staleIds);
            console.log('[NativePush] Cleaned up', staleSubs.length, 'stale web push subscription(s)');
          }
        }
      } catch (cleanupErr) {
        console.warn('[NativePush] Stale subscription cleanup error:', cleanupErr);
      }

      // Verify the native token was saved
      try {
        const { data: verify } = await supabase
          .from('push_subscriptions')
          .select('id, endpoint')
          .eq('user_id', window.currentUser.id)
          .eq('endpoint', `native://${token}`);
        if (verify && verify.length > 0) {
          console.log('[NativePush] Token verified in database:', verify[0].endpoint.substring(0, 30) + '...');
          window._pushTokenStatus = 'verified';
        } else {
          console.warn('[NativePush] Token saved but not found on verify');
          window._pushTokenStatus = 'save_ok_but_verify_failed';
        }
      } catch (verifyErr) {
        console.warn('[NativePush] Could not verify token:', verifyErr);
      }
    }
  } catch (err) {
    console.error('[NativePush] Error saving token:', err);
  }
}

/**
 * Handle notifications received while the app is in the foreground.
 *
 * On Android, push notifications that arrive while the app is in the
 * foreground are silently consumed by the Capacitor PushNotifications
 * plugin — they do NOT appear in the notification shade or as a
 * heads-up banner. To make them visible we re-fire the payload as a
 * LocalNotification which goes through the normal Android notification
 * pipeline (heads-up display, badge dot on app icon, notification shade).
 */
async function handleForegroundNotification(notification) {
  const data = notification.data || {};

  // Re-fire ALL foreground notifications as local notifications so they
  // appear in the notification shade and as heads-up banners on Android.
  // This applies to both DMs and meal reminders.
  try {
    const LocalNotifications = getLocalNotifications();
    if (!LocalNotifications) throw new Error('LocalNotifications plugin not available');

    // Use a unique ID based on timestamp so we don't collide with scheduled ones
    const notifId = 8000 + (Date.now() % 1000);

    const isDM = data.type === 'dm_message';
    const channelId = isDM ? 'dm-messages' : 'meal-reminders';
    const summaryText = isDM ? 'Direct Message' : 'Meal Reminder';

    await LocalNotifications.schedule({
      notifications: [{
        id: notifId,
        title: notification.title || (isDM ? 'New Message' : 'Meal Reminder'),
        body: notification.body || (isDM ? 'You have a new message' : 'Time to log your meal!'),
        largeBody: notification.body || '',
        summaryText: summaryText,
        sound: 'default',
        smallIcon: 'ic_stat_notification',
        largeIcon: 'ic_launcher',
        channelId: channelId,
        autoCancel: true,
        extra: {
          type: data.type || 'meal_reminder',
          mealType: data.mealType || '',
          senderName: data.senderName || '',
        },
      }],
    });

    console.log('[NativePush] Foreground notification re-fired as local notification');
  } catch (err) {
    console.error('[NativePush] Error re-firing foreground notification:', err);
    // Fallback to toast if local notification fails
    if (typeof window.showToast === 'function') {
      const msg = data.type === 'dm_message'
        ? `New message from ${data.senderName || 'someone'}`
        : (notification.body || notification.title || 'New notification');
      window.showToast(msg, 'info');
    }
  }

  // For DMs: refresh the conversation if it's open, or show banner + track unread sender
  if (data.type === 'dm_message') {
    const senderId = data.senderId || data.sender_id || null;

    // Check if the DM modal is already open for this sender
    const dmModal = document.getElementById('direct-message-modal');
    const isDMModalVisible = dmModal && (dmModal.style.display === 'flex' || dmModal.style.display === 'block');
    const isDMOpenForSender = isDMModalVisible
        && typeof window.currentDMRecipient !== 'undefined'
        && window.currentDMRecipient
        && senderId
        && window.currentDMRecipient.id === senderId;

    if (isDMOpenForSender && typeof window.loadDirectMessages === 'function') {
      // User is viewing this conversation — just refresh the messages
      window.loadDirectMessages(senderId);
      console.log('[NativePush] Refreshed open DM conversation for sender:', senderId);
    } else {
      // User is NOT viewing this conversation — show banner + mark unread
      if (typeof window.showDMNotificationBanner === 'function') {
        window.showDMNotificationBanner(
          data.senderName || 'New Message',
          '',
          notification.body || 'You have a new message',
          senderId
        );
      }
      // Track this sender as having unread messages
      if (senderId && typeof window.addUnreadSender === 'function') {
        window.addUnreadSender(senderId);
      }
      // Update badge count
      if (typeof window.updateMessageBadges === 'function') {
        window.updateMessageBadges((window._unreadDMCount || 0) + 1);
      }
    }
  }
}

/**
 * Handle when user taps on a notification
 */
function handleNotificationTap(notification) {
  const data = notification.data || {};

  if (data.type === 'dm_message') {
    // Navigate to the DM conversation with the sender
    if (data.senderId && typeof window.openDirectMessage === 'function') {
      window.openDirectMessage(data.senderId, data.senderName || 'Message', '');
    } else if (typeof window.openMessageInbox === 'function') {
      window.openMessageInbox();
    } else if (typeof window.switchAppTab === 'function') {
      window.switchAppTab('social');
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
    const LocalNotifications = getLocalNotifications();
    if (!LocalNotifications) {
      console.error('[MealReminder] LocalNotifications plugin not available via Capacitor bridge');
      return false;
    }

    // Request permission for local notifications
    const permStatus = await LocalNotifications.checkPermissions();
    if (permStatus.display === 'prompt') {
      await LocalNotifications.requestPermissions();
    }

    // Create notification channels on startup so both local and FCM
    // notifications can use them immediately (badge dots and heads-up
    // display require the channel to exist)
    try {
      await LocalNotifications.createChannel({
        id: 'meal-reminders',
        name: 'Meal Reminders',
        description: 'FitGotchi meal timing reminders',
        importance: 5, // MAX — enables heads-up display
        visibility: 1, // PUBLIC
        sound: 'default',
        vibration: true,
      });
      await LocalNotifications.createChannel({
        id: 'dm-messages',
        name: 'Direct Messages',
        description: 'Notifications for new direct messages',
        importance: 5, // MAX — enables heads-up display
        visibility: 1, // PUBLIC
        sound: 'default',
        vibration: true,
      });
      console.log('[NativePush] Notification channels created');
    } catch (channelErr) {
      // Channel creation may fail on iOS (not needed there)
      console.log('[NativePush] Channel creation:', channelErr.message);
    }

    // Listen for local notification actions (user tapped on a notification)
    LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
      console.log('[NativePush] Local notification tapped:', action);
      const data = action.notification?.extra || {};
      if (data.type === 'meal_reminder') {
        if (typeof window.openMealInputModal === 'function') {
          window.openMealInputModal('notification');
          if (data.mealType && typeof window.selectMealType === 'function') {
            setTimeout(() => window.selectMealType(data.mealType), 300);
          }
        }
      } else if (data.type === 'dm_message') {
        // Navigate to social tab for DMs
        if (typeof window.switchAppTab === 'function') {
          window.switchAppTab('social');
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
    const LocalNotifications = getLocalNotifications();
    if (!LocalNotifications) {
      console.error('[MealReminder] LocalNotifications plugin not available');
      return false;
    }

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
      // Ensure notification channel exists (may already be created in init,
      // but createChannel is idempotent on Android — duplicate calls are safe)
      try {
        await LocalNotifications.createChannel({
          id: 'meal-reminders',
          name: 'Meal Reminders',
          description: 'FitGotchi meal timing reminders',
          importance: 5, // MAX — enables heads-up display and badge dot
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

/**
 * Request notification permissions on native app.
 * Returns 'granted', 'denied', or 'prompt' (if user hasn't been asked yet).
 * Uses the NativePermissions Java bridge on Android for reliable permission
 * handling (POST_NOTIFICATIONS on Android 13+), falling back to Capacitor.
 */
async function requestNativeNotificationPermission() {
  if (!isNativeApp()) return 'unsupported';

  try {
    // Prefer the Java bridge — it uses NotificationManagerCompat which is
    // the most reliable way to check Android notification permission state
    if (window.NativePermissions && typeof window.NativePermissions.hasNotificationPermission === 'function') {
      if (window.NativePermissions.hasNotificationPermission()) {
        return 'granted';
      }

      // Request permission via the Java bridge (shows native OS dialog on API 33+)
      const result = await new Promise((resolve) => {
        let resolved = false;
        window._onNativeNotificationPermission = (granted) => {
          if (!resolved) { resolved = true; resolve(granted); }
        };
        window.NativePermissions.requestNotificationPermission();
        // Safety timeout
        setTimeout(() => { if (!resolved) { resolved = true; resolve(false); } }, 30000);
      });
      return result ? 'granted' : 'denied';
    }

    // Fallback: use Capacitor LocalNotifications plugin
    const LocalNotifications = getLocalNotifications();
    if (!LocalNotifications) return 'error';

    let permStatus = await LocalNotifications.checkPermissions();

    if (permStatus.display === 'granted') return 'granted';

    // Trigger the native "Allow Notifications?" dialog
    const permResult = await LocalNotifications.requestPermissions();
    return permResult.display; // 'granted' or 'denied'
  } catch (err) {
    console.error('[NativePush] Error requesting permission:', err);
    return 'error';
  }
}

/**
 * Check current notification permission status without prompting.
 * Returns 'granted', 'denied', or 'prompt'.
 * Uses the NativePermissions Java bridge on Android for reliability.
 */
async function checkNativeNotificationPermission() {
  if (!isNativeApp()) return 'unsupported';

  try {
    // Prefer the Java bridge for accurate Android permission state
    if (window.NativePermissions && typeof window.NativePermissions.hasNotificationPermission === 'function') {
      return window.NativePermissions.hasNotificationPermission() ? 'granted' : 'denied';
    }

    // Fallback: use Capacitor LocalNotifications plugin
    const LocalNotifications = getLocalNotifications();
    if (!LocalNotifications) return 'error';

    const permStatus = await LocalNotifications.checkPermissions();
    return permStatus.display; // 'granted', 'denied', or 'prompt'
  } catch (err) {
    console.error('[NativePush] Error checking permission:', err);
    return 'error';
  }
}

// Export to window so dashboard.html can use it
window.NativePush = {
  isNativeApp,
  init: initNativePush,
  scheduleMealReminders,
  getFitGotchiMessage,
  FITGOTCHI_MEAL_MESSAGES,
  requestPermission: requestNativeNotificationPermission,
  checkPermission: checkNativeNotificationPermission,
};

// Also export the helper so dashboard.html can get LocalNotifications
// without dynamic imports (same bare-specifier issue)
window._getLocalNotificationsPlugin = getLocalNotifications;
