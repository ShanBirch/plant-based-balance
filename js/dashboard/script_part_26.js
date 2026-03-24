// --- COACH CHAT ENHANCEMENTS ---

// 1. Office Hours Config (Brisbane Time)
const COACH_CONFIG = {
    timezone: 'Australia/Brisbane',
    startHour: 7,    // 7 AM
    endHour: 20,     // 8 PM
    endMin: 30       // :30
};

function getCoachState() {
    try {
        const now = new Date();
        const bneTimeStr = now.toLocaleString("en-US", {timeZone: COACH_CONFIG.timezone});
        const bneTime = new Date(bneTimeStr);
        
        const totalMins = bneTime.getHours() * 60 + bneTime.getMinutes();
        const startMins = COACH_CONFIG.startHour * 60;
        const endMins = COACH_CONFIG.endHour * 60 + COACH_CONFIG.endMin;
        
        const isOnline = totalMins >= startMins && totalMins < endMins;
        return { isOnline, totalMins };
    } catch(e) {
        return { isOnline: true }; // Fail-safe
    }
}

function updateCoachUI() {
    const { isOnline } = getCoachState();
    const headerStatus = document.getElementById('coach-header-status-text');

    const color = isOnline ? '#22c55e' : '#94a3b8'; // Green vs Slate
    const text = isOnline ? 'Active Now' : 'Offline (Back 7am)';

    if(headerStatus) {
        headerStatus.innerText = text;
        headerStatus.style.color = isOnline ? 'var(--primary)' : '#64748b';
    }

    // Also update the coach modal status
    const modalStatus = document.getElementById('coach-modal-status');
    if (modalStatus) {
        modalStatus.innerText = isOnline ? 'Coach - Active Now' : 'Coach - Offline';
        modalStatus.style.color = isOnline ? 'var(--primary)' : '#64748b';
    }
}

// Coach chat now uses direct messaging - no AI trigger needed

// 3. Daily Greeting
// Daily greeting removed - coach now responds only when user messages
async function checkCoachGreeting() {
    // Function kept for compatibility but no longer sends automated greetings
    return;
}

// 4. Bubble Interaction
function openCoachChat() {
    openCoachChatModal();
}

// 5. Push Notifications - Subscribe ALL users to server push
async function requestNotificationPermission() {
    // On native apps, push notifications are handled by FCM via NativePush.init()
    // Web push subscriptions from a WebView don't deliver when the app is closed
    if (typeof isNativeApp === 'function' && isNativeApp()) {
        console.log('[Push] Native app detected — skipping web push (FCM handles this)');
        return;
    }

    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
        console.log('Push notifications not supported');
        return;
    }

    // Check if permission already granted
    if (Notification.permission === 'granted') {
        // Auto-subscribe to push if permission already granted
        await subscribeUserToPush();
        return;
    }

    // Only request if not already denied
    if (Notification.permission !== 'denied') {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            console.log('Notification permission granted');
            await subscribeUserToPush();
        }
    }
}

// Subscribe user to server push notifications (for receiving DMs, etc.)
async function subscribeUserToPush() {
    try {
        if (!window.currentUser) return;

        const registration = await navigator.serviceWorker.ready;

        // Check if already subscribed
        let subscription = await registration.pushManager.getSubscription();

        if (!subscription) {
            // Subscribe to push
            subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
            });
        }

        // Save subscription to database
        const subscriptionJson = subscription.toJSON();
        const isAdmin = await db.pushSubscriptions.isAdmin();

        await db.pushSubscriptions.subscribe({
            endpoint: subscriptionJson.endpoint,
            keys: {
                p256dh: subscriptionJson.keys.p256dh,
                auth: subscriptionJson.keys.auth
            }
        }, isAdmin);

        console.log('User subscribed to push notifications');
    } catch (error) {
        console.error('Failed to subscribe to push notifications:', error);
    }
}


// Initialize coach UI polling.
// On iOS, defer to pbbInitComplete to reduce memory pressure during DOMContentLoaded.
// Pause when page is hidden to save memory/CPU on iOS.
if (window._pbbIsIOSSafari) {
    window.addEventListener('pbbInitComplete', function() {
        updateCoachUI();
        var _coachPoll = setInterval(updateCoachUI, 2000);
        document.addEventListener('visibilitychange', function() {
            if (document.hidden) { clearInterval(_coachPoll); _coachPoll = 0; }
            else if (!_coachPoll) { updateCoachUI(); _coachPoll = setInterval(updateCoachUI, 2000); }
        });
    }, { once: true });
} else {
    document.addEventListener('DOMContentLoaded', () => {
        updateCoachUI();
        var _coachPoll = setInterval(updateCoachUI, 2000);
        document.addEventListener('visibilitychange', function() {
            if (document.hidden) { clearInterval(_coachPoll); _coachPoll = 0; }
            else if (!_coachPoll) { updateCoachUI(); _coachPoll = setInterval(updateCoachUI, 2000); }
        });
    });
    // Immediate
    updateCoachUI();
}

// 5. Welcome Modal Logic (REMOVED - Using original onboarding-modal instead)
// setTimeout(() => { ... }, 1000);