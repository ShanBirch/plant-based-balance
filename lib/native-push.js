/**
 * Native Push Notification Bridge
 *
 * Uses @capacitor/push-notifications for real native push
 * when running as a Capacitor app. Falls back to the existing
 * Web Push API (VAPID) when running in the browser.
 *
 * Native push uses Firebase Cloud Messaging (Android) and
 * APNs (iOS) — much more reliable than web push.
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
    // Open meal input
    if (typeof window.switchAppTab === 'function') {
      window.switchAppTab('dashboard');
    }
  }
}

// Export to window so dashboard.html can use it
window.NativePush = {
  isNativeApp,
  init: initNativePush,
};
