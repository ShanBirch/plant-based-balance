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
var _fcmPlugin = null;

// Return true when running on iOS native. On iOS we need the Firebase
// Messaging plugin so the token returned to JS is an FCM token (same
// format as Android) — otherwise iOS would hand us a raw APNs token and
// our FCM-only backend would have no way to deliver.
function isIOS() {
  try {
    return !!(window.Capacitor && window.Capacitor.getPlatform && window.Capacitor.getPlatform() === 'ios');
  } catch (_) { return false; }
}

function getFirebaseMessaging() {
  // We rolled our own @capacitor/push-notifications + Firebase bridge as
  // FitGotchiPush because @capacitor-firebase/messaging's SPM-shipped
  // Swift class got dead-stripped and never registered with the bridge.
  // FitGotchiPush is compiled directly into the App target so it registers
  // reliably.
  if (!_fcmPlugin && window.Capacitor && window.Capacitor.registerPlugin) {
    try {
      _fcmPlugin = window.Capacitor.registerPlugin('FitGotchiPush');
      // Only treat it as real if it actually has our methods on it —
      // registerPlugin returns a Proxy stub even for missing plugins, so
      // the truthy check alone isn't enough.
      if (_fcmPlugin && typeof _fcmPlugin.getToken !== 'function') {
        // Proxy stub; fall back to null so callers can detect the missing plugin.
      }
      console.log('[NativePush] FitGotchiPush plugin loaded:', !!_fcmPlugin);
    } catch (e) {
      console.log('[NativePush] FitGotchiPush registerPlugin failed:', e.message);
    }
  }
  return _fcmPlugin;
}

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

    // ── iOS path: use FirebaseMessaging so we get an FCM token ──────
    // (the @capacitor/push-notifications plugin on iOS returns a raw APNs
    // token, which our FCM-only backend can't deliver to).
    if (isIOS()) {
      const FitGotchiPush = getFirebaseMessaging();
      if (FitGotchiPush && typeof FitGotchiPush.getToken === 'function') {
        try {
          let permStatus = await FitGotchiPush.checkPermissions();
          if (permStatus.receive === 'prompt' || permStatus.receive === 'prompt-with-rationale') {
            permStatus = await FitGotchiPush.requestPermissions();
          }
          if (permStatus.receive !== 'granted') {
            console.log('[NativePush] iOS permission not granted:', permStatus.receive);
            return false;
          }

          // Token rotation (rare — device reinstall etc). The native side
          // fires this via MessagingDelegate's didReceiveRegistrationToken.
          FitGotchiPush.addListener('tokenReceived', (event) => {
            if (event && event.token) {
              console.log('[NativePush] iOS FCM token refreshed');
              window._cachedFcmToken = event.token;
              saveNativePushToken(event.token);
            }
          });

          // Kick the APNs → FCM handshake (no-op if already registered).
          try { await FitGotchiPush.register(); } catch (_) {}

          // Ask Firebase for the current FCM token. This waits until
          // AppDelegate has handed the APNs device token to Messaging.
          const { token } = await FitGotchiPush.getToken();
          if (token) {
            console.log('[NativePush] iOS FCM token obtained');
            window._cachedFcmToken = token;
            saveNativePushToken(token);
          } else {
            console.error('[NativePush] iOS getToken returned empty');
            window._pushTokenStatus = 'ios_token_empty';
          }

          await initLocalNotifications();
          registerPushAuthStateListener();
          window._nativePushReady = true;
          return true;
        } catch (iosErr) {
          console.error('[NativePush] iOS FitGotchiPush init failed:', iosErr);
          // fall through to legacy path as a last resort
        }
      } else {
        console.warn('[NativePush] FitGotchiPush plugin missing on iOS — rebuild needed');
      }
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
        // Cache so we can re-save under a different user on logout→login
        // without waiting for FCM to re-issue the token (it won't — tokens
        // are device-stable until app reinstall).
        window._cachedFcmToken = token.value;
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

    // Re-bind the FCM token to whatever user signs in LATER in this session.
    // Fixes the "same phone, multiple admin accounts" case where the token
    // would otherwise stay attached to whichever user was logged in at
    // app-launch time.
    registerPushAuthStateListener();

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

    // Call the register_push_subscription RPC instead of a direct upsert. A
    // direct client upsert with `onConflict: 'endpoint'` silently fails under
    // RLS when the same FCM token was previously saved under a DIFFERENT user
    // (typical case: same phone, multiple admin accounts). The RLS UPDATE
    // policy requires `auth.uid() = user_id` on the EXISTING row, so the
    // takeover is rejected and no new row lands. The RPC runs SECURITY
    // DEFINER — it deletes any orphan row with this endpoint, inserts the
    // current user's row, and cleans up the caller's other stale
    // subscriptions in one atomic call. (Previously saw this manifest as
    // "Found 0 subscriptions for user ..." in the send-dm-notification logs.)
    const endpoint = `native://${token}`;
    const { data: rpcData, error } = await supabase.rpc('register_push_subscription', {
      p_endpoint: endpoint,
      p_token: token,
      p_p256dh: 'native',
    });

    const rpcOk = !error && rpcData && rpcData.ok !== false;
    if (!rpcOk) {
      const errMsg = error
        ? JSON.stringify(error)
        : ((rpcData && rpcData.error) || 'unknown_error');
      console.error('[NativePush] RPC register_push_subscription failed:', errMsg);
      window._pushTokenStatus = 'save_failed: ' + errMsg;
    } else {
      console.log('[NativePush] ✅ Token registered via RPC for user', (rpcData.user_id || '').substring(0, 8));
      window._pushTokenStatus = 'saved';

      // Quick verify that a row now exists for this user. Uses the user's
      // own row-level-readable policy so this doubles as a "did auth land?"
      // sanity check.
      try {
        const { data: verify } = await supabase
          .from('push_subscriptions')
          .select('id, endpoint')
          .eq('user_id', window.currentUser.id)
          .eq('endpoint', endpoint);
        if (verify && verify.length > 0) {
          console.log('[NativePush] Token verified in database:', verify[0].endpoint.substring(0, 30) + '...');
          window._pushTokenStatus = 'verified';
        } else {
          console.warn('[NativePush] RPC returned ok but row not visible via SELECT — RLS read policy or eventual consistency');
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
 * Re-register the cached FCM token under the currently authenticated user.
 *
 * FCM tokens are device-stable — they don't rotate on logout/login. So when
 * the user switches accounts, the `registration` listener in initNativePush
 * does NOT fire again, and the DB keeps pointing the same token at the old
 * user. This function is wired to Supabase's auth state changes (see
 * `registerPushAuthStateListener` below) so the takeover happens the moment
 * a new account signs in, without waiting for a full app cold start.
 */
async function reRegisterCachedFcmToken(reason) {
  if (!isNativeApp()) return;
  const token = window._cachedFcmToken;
  if (!token) {
    console.log('[NativePush] No cached FCM token yet, skipping re-register (' + (reason || '?') + ')');
    return;
  }
  console.log('[NativePush] Re-registering cached FCM token for current user (' + (reason || '?') + ')');
  await saveNativePushToken(token);
}

/**
 * Listen for Supabase auth state changes and re-bind the FCM token to the
 * new user. Call this once during init after `window.supabaseClient` is
 * available — subsequent sign-ins will auto-heal the push_subscriptions row.
 */
function registerPushAuthStateListener() {
  if (!isNativeApp()) return;
  if (window._pushAuthListenerRegistered) return;
  const supabase = window.supabaseClient;
  if (!supabase || !supabase.auth || typeof supabase.auth.onAuthStateChange !== 'function') {
    // Try again shortly — supabaseClient might not be ready yet.
    setTimeout(registerPushAuthStateListener, 2000);
    return;
  }
  supabase.auth.onAuthStateChange((event, session) => {
    // SIGNED_IN fires on both first login AND token refresh; TOKEN_REFRESHED
    // is a no-op for push. Trigger on SIGNED_IN (covers the logout→login case)
    // and USER_UPDATED (covers email/metadata changes that might coincide with
    // an account switch). Skip SIGNED_OUT — no user to bind the token to.
    if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
      reRegisterCachedFcmToken(event);
    }
  });
  window._pushAuthListenerRegistered = true;
  console.log('[NativePush] Auth state listener registered — FCM token will re-bind on account switch');
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
    const isCoachAlert = data.type === 'coach_alert';
    const channelId = isCoachAlert ? 'coach-alerts' : isDM ? 'dm-messages' : 'meal-reminders';
    const summaryText = isCoachAlert ? 'Coach Alert' : isDM ? 'Direct Message' : 'Meal Reminder';

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

  // Coach alerts don't need further foreground handling beyond the local notification
  // (the notification shade banner is enough)

  // Check if this is a battle challenge notification
  if (data.type === 'dm_message') {
    const body = notification.body || '';
    const isBattleChallenge = body.includes('BATTLE CHALLENGE') || body.includes('QUIZ BATTLE');

    if (isBattleChallenge) {
      // Immediately trigger challenge polling so the in-app toast appears
      console.log('[NativePush] Battle challenge received in foreground — triggering challenge check');
      setTimeout(() => {
        if (typeof window.checkForBattleChallenges === 'function') window.checkForBattleChallenges();
        if (typeof window.checkForQuizBattleChallenges === 'function') window.checkForQuizBattleChallenges();
      }, 1000);
      return;
    }

    const senderId = data.senderId || data.sender_id || null;
    const isGameInvite = (notification.body || '').includes('🎮') || (notification.title || '').includes('🎮');

    // Check if the DM modal is already open for this sender
    const dmModal = document.getElementById('direct-message-modal');
    const isDMModalVisible = dmModal && (dmModal.style.display === 'flex' || dmModal.style.display === 'block');
    const isDMOpenForSender = isDMModalVisible
        && typeof window.currentDMRecipient !== 'undefined'
        && window.currentDMRecipient
        && senderId
        && window.currentDMRecipient.id === senderId;

    if (isDMOpenForSender && typeof window.loadDirectMessages === 'function' && !isGameInvite) {
      // User is viewing this conversation — just refresh the messages
      window.loadDirectMessages(senderId);
      console.log('[NativePush] Refreshed open DM conversation for sender:', senderId);
    } else {
      // User is NOT viewing this conversation (or it's a game invite) — show banner + mark unread
      if (typeof window.showDMNotificationBanner === 'function') {
        window.showDMNotificationBanner(
          data.senderName || 'New Message',
          '',
          notification.body || 'You have a new message',
          senderId,
          isGameInvite
        );
      }
      // Track this sender as having unread messages (skip for game invites)
      if (senderId && typeof window.addUnreadSender === 'function' && !isGameInvite) {
        window.addUnreadSender(senderId);
      }
      // Update badge count
      if (typeof window.updateMessageBadges === 'function' && !isGameInvite) {
        window.updateMessageBadges((window._unreadDMCount || 0) + 1);
      }
    }
  }
}

/**
 * Handle when user taps on a notification.
 *
 * When the app is cold-launched from a notification tap, the dashboard
 * scripts may still be loading. We wait until currentUser and the
 * messaging functions are available before navigating.
 */
async function handleNotificationTap(notification) {
  const data = notification.data || {};

  if (data.type === 'coach_alert') {
    // Coach alert — navigate to admin dashboard
    for (var i = 0; i < 20; i++) {
      if (window.currentUser && typeof window.switchAppTab === 'function') break;
      await new Promise(function(r) { setTimeout(r, 250); });
    }
    if (typeof window.switchAppTab === 'function') {
      window.switchAppTab('dashboard');
    }
    setTimeout(function() {
      if (typeof window.openAdminDashboard === 'function') {
        window.openAdminDashboard();
      }
    }, 500);
    return;
  }

  if (data.type === 'dm_message') {
    const isGameInvite = (notification.body || '').includes('🎮') || (notification.title || '').includes('🎮');

    // Wait for dashboard scripts + auth to be ready (up to 5 seconds)
    for (var i = 0; i < 20; i++) {
      if (window.currentUser && typeof window.switchAppTab === 'function') break;
      await new Promise(function(r) { setTimeout(r, 250); });
    }

    // Check if this is a battle challenge notification — trigger challenge check
    // instead of opening the DM conversation
    var notifBody = (notification.body || notification.data?.body || '');
    if (notifBody.includes('BATTLE CHALLENGE') || notifBody.includes('QUIZ BATTLE')) {
      console.log('[NativePush] Battle challenge notification tapped — triggering challenge check');
      // Switch to dashboard tab where battles are shown
      if (typeof window.switchAppTab === 'function') {
        window.switchAppTab('dashboard');
      }
      // Trigger challenge polling after a short delay to let the dashboard load
      setTimeout(function() {
        if (typeof window.checkForBattleChallenges === 'function') window.checkForBattleChallenges();
        if (typeof window.checkForQuizBattleChallenges === 'function') window.checkForQuizBattleChallenges();
      }, 1500);
      return;
    }

    // Regular DM — track unread sender immediately so the inbox shows the dot (skip for game invites)
    if (data.senderId && !isGameInvite) {
      if (typeof window.addUnreadSender === 'function') {
        window.addUnreadSender(data.senderId);
      } else {
        // Functions not loaded yet — persist to localStorage directly
        try {
          var ids = JSON.parse(localStorage.getItem('unread_sender_ids') || '[]');
          if (ids.indexOf(data.senderId) === -1) {
            ids.push(data.senderId);
            localStorage.setItem('unread_sender_ids', JSON.stringify(ids));
          }
        } catch (e) { /* ignore */ }
      }
    }

    // Wait for dashboard scripts + auth to be ready (up to 5 seconds)
    for (var i = 0; i < 20; i++) {
      if (window.currentUser && typeof window.openDirectMessage === 'function') break;
      await new Promise(function(r) { setTimeout(r, 250); });
    }

    if (isGameInvite) {
      // Game invites: Try to open the game directly
      if (data.senderId && typeof window.handleGameMessageClick === 'function') {
        window.handleGameMessageClick(data.senderId);
      } else if (data.senderId && typeof window.openDirectMessage === 'function') {
        window.openDirectMessage(data.senderId, data.senderName || 'Message', '');
      } else if (typeof window.switchAppTab === 'function') {
        // Fallback to feed where the "Active Games" scroller is
        window.switchAppTab('feed');
        setTimeout(() => {
          if (typeof window.loadActiveGames === 'function') window.loadActiveGames();
        }, 300);
      }
      return;
    }

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
// "advance" messages fire 30 min BEFORE meal time as a heads-up
// "ontime" messages fire AT the scheduled meal time
const FITGOTCHI_MEAL_MESSAGES = {
  breakfast: {
    advance: [
      { title: 'Breakfast in 30 minutes!', body: 'Start thinking about what to eat - log on time for +1 bonus XP' },
      { title: 'Heads up - breakfast soon!', body: 'Eat within the next 30 minutes to stay in your time window' },
      { title: 'Almost breakfast time!', body: 'Your FitGotchi is getting hungry - eat soon to earn bonus XP' },
    ],
    ontime: [
      { title: 'Good morning! Time for breakfast', body: 'Your FitGotchi is hungry! Eat now and log it within 30 min for +1 bonus XP' },
      { title: 'Rise and fuel up!', body: 'Breakfast time! Log your meal on time for a bonus XP point' },
      { title: 'Your FitGotchi needs breakfast!', body: 'Start your day right - eat and log within 30 min for +1 XP' },
      { title: 'Breakfast o\'clock!', body: 'Your FitGotchi is waiting to see what you eat! +1 XP for on-time logging' },
    ],
  },
  lunch: {
    advance: [
      { title: 'Lunch in 30 minutes!', body: 'Eat within the next half hour to stay in your time window' },
      { title: 'Heads up - lunch soon!', body: 'Your FitGotchi is getting hungry - eat soon for +1 bonus XP' },
      { title: 'Lunch is coming up!', body: 'Time to plan your meal - eat on schedule for bonus XP' },
    ],
    ontime: [
      { title: 'Lunchtime! Your FitGotchi is starving', body: 'Time to refuel! Log your lunch within 30 min for +1 bonus XP' },
      { title: 'Midday fuel-up time!', body: 'Your FitGotchi says it\'s lunch o\'clock. Eat and log for bonus XP!' },
      { title: 'Lunch break!', body: 'Keep your streak going - log your meal within 30 min for +1 XP' },
      { title: 'Your FitGotchi wants lunch!', body: 'Don\'t skip! Eat now and log on time for a bonus XP point' },
    ],
  },
  dinner: {
    advance: [
      { title: 'Dinner in 30 minutes!', body: 'Eat within the next half hour to stay in your time window' },
      { title: 'Heads up - dinner soon!', body: 'Your FitGotchi is getting hungry - plan your dinner for bonus XP' },
      { title: 'Dinner is coming up!', body: 'Get ready to eat - log on time for +1 bonus XP' },
    ],
    ontime: [
      { title: 'Dinner time!', body: 'Your FitGotchi is ready to eat! Log within 30 min for +1 bonus XP' },
      { title: 'Evening fuel-up!', body: 'Time for dinner! Your FitGotchi earns bonus XP when you eat on schedule' },
      { title: 'Your FitGotchi wants dinner!', body: 'Last meal of the day - log on time for +1 XP bonus' },
      { title: 'Dinner o\'clock!', body: 'Eat and log within 30 minutes to earn your on-time meal bonus XP!' },
    ],
  }
};

/**
 * Get a random FitGotchi message for a meal type
 * @param {string} mealType - 'breakfast', 'lunch', or 'dinner'
 * @param {string} phase - 'advance' (30 min before) or 'ontime' (at meal time)
 */
function getFitGotchiMessage(mealType, phase) {
  const mealMessages = FITGOTCHI_MEAL_MESSAGES[mealType] || FITGOTCHI_MEAL_MESSAGES.breakfast;
  const messages = mealMessages[phase || 'ontime'] || mealMessages.ontime;
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
      await LocalNotifications.createChannel({
        id: 'coach-alerts',
        name: 'Coach Alerts',
        description: 'Client monitoring alerts for coaches',
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
      } else if (data.type === 'coach_alert') {
        // Navigate to admin dashboard
        if (typeof window.switchAppTab === 'function') {
          window.switchAppTab('dashboard');
        }
        setTimeout(function() {
          if (typeof window.openAdminDashboard === 'function') {
            window.openAdminDashboard();
          }
        }, 500);
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
    // IDs: advance warnings use even IDs (9002, 9004, 9006)
    //       at-time reminders use odd IDs (9001, 9003, 9005)
    const meals = [
      { type: 'breakfast', enabled: settings.breakfast_reminder, time: settings.breakfast_time, ontimeId: 9001, advanceId: 9002 },
      { type: 'lunch', enabled: settings.lunch_reminder, time: settings.lunch_time, ontimeId: 9003, advanceId: 9004 },
      { type: 'dinner', enabled: settings.dinner_reminder, time: settings.dinner_time, ontimeId: 9005, advanceId: 9006 },
    ];

    for (const meal of meals) {
      if (!meal.enabled || !meal.time) continue;

      // Parse time (HH:MM or HH:MM:SS)
      const parts = meal.time.split(':');
      const hour = parseInt(parts[0]);
      const minute = parseInt(parts[1]);

      // --- 30-minute advance warning notification ---
      // Calculate time 30 minutes before meal time
      var advMinute = minute - 30;
      var advHour = hour;
      if (advMinute < 0) {
        advMinute += 60;
        advHour -= 1;
        if (advHour < 0) advHour = 23; // wrap around midnight
      }

      const advMsg = getFitGotchiMessage(meal.type, 'advance');
      notifications.push({
        id: meal.advanceId,
        title: advMsg.title,
        body: advMsg.body,
        largeBody: advMsg.body,
        summaryText: 'Meal Reminder',
        sound: 'default',
        smallIcon: 'ic_stat_notification',
        largeIcon: 'ic_launcher',
        schedule: {
          on: { hour: advHour, minute: advMinute },
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

      // --- At-time notification ---
      const msg = getFitGotchiMessage(meal.type, 'ontime');
      notifications.push({
        id: meal.ontimeId,
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

// Show a visible in-app diagnostic banner on iOS so we can see what's happening
// without Safari Web Inspector. Disappears after 8 seconds. Only fires on iOS
// and only when ?pushdebug=1 is in the URL OR localStorage.pushDebug === '1'.
function pushDebugBanner(msg, color) {
  try {
    // Temporarily force-on for iOS push debugging. Revert to opt-in once
    // push registration is confirmed working.
    var enabled = isIOS();
    if (!enabled) return;
    var el = document.createElement('div');
    el.textContent = '[push] ' + msg;
    el.style.cssText = 'position:fixed;top:calc(env(safe-area-inset-top,0px) + 8px);left:8px;right:8px;z-index:999999;background:' + (color || '#333') + ';color:#fff;padding:10px 14px;border-radius:8px;font:13px -apple-system;box-shadow:0 2px 8px rgba(0,0,0,0.3);';
    document.body && document.body.appendChild(el);
    setTimeout(function () { try { el.remove(); } catch (_) {} }, 8000);
  } catch (_) {}
}

// ── Eager iOS push init ──────────────────────────────────────────────
// The dashboard's normal init path only fires AFTER auth completes.
// On iOS we want the notification permission prompt to appear as soon
// as the app launches, independent of login state, so the user sees
// the system dialog even on the login screen.
function _eagerIOSPushInit() {
  if (!isNativeApp()) return;
  if (!isIOS()) return; // Android still uses the existing post-auth init
  if (window._iosEagerPushAttempted) return;
  window._iosEagerPushAttempted = true;

  // Wait a beat for Capacitor plugins to finish registering.
  setTimeout(function () {
    pushDebugBanner('eager init starting', '#0066cc');
    var FitGotchiPush = getFirebaseMessaging();
    if (!FitGotchiPush || typeof FitGotchiPush.getToken !== 'function') {
      pushDebugBanner('FitGotchiPush plugin NOT found — rebuild needed', '#cc0000');
      // Fall back to full init anyway
      try { initNativePush(); } catch (_) {}
      return;
    }
    pushDebugBanner('calling requestPermissions()', '#0066cc');
    FitGotchiPush.requestPermissions()
      .then(function (result) {
        pushDebugBanner('requestPermissions → ' + (result && result.receive), '#009933');
        // Now run the full init (sets up listeners, gets token, saves to DB)
        return initNativePush();
      })
      .catch(function (err) {
        pushDebugBanner('requestPermissions ERROR: ' + (err && err.message || err), '#cc0000');
      });
  }, 1500);
}

// Fire on DOMContentLoaded (or immediately if already loaded)
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _eagerIOSPushInit);
  } else {
    _eagerIOSPushInit();
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
  // Exposed for manual "re-register my push" flows (e.g. a Settings debug button
  // or an admin tool nudging Shannon to re-bind the token after switching accounts).
  reRegisterForCurrentUser: function () { return reRegisterCachedFcmToken('manual'); },
};

// Also export the helper so dashboard.html can get LocalNotifications
// without dynamic imports (same bare-specifier issue)
window._getLocalNotificationsPlugin = getLocalNotifications;
