const webpush = require('web-push');
const crypto = require('crypto');
const { normalizeCoachDraftText } = require('./_lib/client-context');
const { loadFirebaseServiceAccount } = require('./_lib/firebase-service-account');

// Configure web-push with VAPID keys
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_EMAIL = process.env.VAPID_EMAIL || 'mailto:admin@plantbasedbalance.com';

// Supabase config
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://hzapaorxqboevxnumxkv.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const BALANCE_ADMIN_EMAIL = 'shannonbirch@cocospersonaltraining.com';

// Firebase service account is loaded lazily so Netlify Lambda env stays below 4KB.

// Rotating accent palette — tints the small-icon area / app-name on Android so
// each push pops with a different colour. Picked at random per send.
const ACCENT_PALETTE = [
    { emoji: '🌱', color: '#7BA883' },
    { emoji: '✨', color: '#FFC83D' },
    { emoji: '🔥', color: '#FF6B35' },
    { emoji: '💪', color: '#9C5BFF' },
    { emoji: '🌟', color: '#00D4AA' },
    { emoji: '💚', color: '#4ECDC4' },
    { emoji: '⚡', color: '#FFD23F' },
    { emoji: '🍎', color: '#FF4757' },
];
function pickAccent() {
    return ACCENT_PALETTE[Math.floor(Math.random() * ACCENT_PALETTE.length)];
}

function getExternalMessageChannel(payload = {}) {
    const rawChannel = String(
        payload.sourceChannel
        || payload.channel
        || payload.delivery_channel
        || payload.deliveryChannel
        || ''
    ).trim().toLowerCase();

    if (rawChannel === 'instagram' || rawChannel === 'messenger' || rawChannel === 'facebook' || rawChannel === 'fb') {
        return rawChannel === 'fb' || rawChannel === 'facebook' ? 'messenger' : rawChannel;
    }

    const channelLabel = String(payload.channelLabel || '').trim().toLowerCase();
    if (/\b(balance\s*)?ig\b|instagram/.test(channelLabel)) return 'instagram';
    if (/\b(balance\s*)?fb\b|facebook|messenger/.test(channelLabel)) return 'messenger';

    const openUrl = String(payload.openUrl || '').trim().toLowerCase();
    if (/instagram\.com/.test(openUrl)) return 'instagram';
    if (/messenger\.com|facebook\.com/.test(openUrl)) return 'messenger';

    return '';
}

function shouldSuppressExternalMessagePush(payload = {}) {
    const externalChannel = getExternalMessageChannel(payload);
    if (!externalChannel) return false;

    const type = payload.type || 'dm_message';
    const messageNotificationTypes = new Set([
        'coach_draft_ready',
        'dm_message',
        'qualifier_advance',
        'auto_sent_confirmation',
    ]);

    return messageNotificationTypes.has(type);
}

const ADMIN_MESSAGE_ALERT_TYPES = new Set([
    'incoming_dm',
    'ig_incoming_dm',
    'fb_incoming_dm',
    'unread_message',
]);

const ADMIN_DIRECT_MESSAGE_TYPES = new Set([
    'dm_message',
    'incoming_dm',
    'ig_incoming_dm',
    'fb_incoming_dm',
]);

const ADMIN_WARNING_NOTIFICATION_TYPES = new Set([
    'dm_context_check',
    'dm_media_warning',
    'media_warning',
]);

const ADMIN_CLIENT_LIFECYCLE_STAGES = new Set([
    'trial',
    'trial_expiring',
    'in_app',
    'paying',
]);

async function supabaseGet(path) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
        headers: {
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
            'Content-Type': 'application/json',
        },
    });
    if (!res.ok) {
        throw new Error(`Supabase ${res.status}: ${await res.text()}`);
    }
    return res.json();
}

async function loadAdminPushContext({ recipientId, alertId }) {
    const context = { isAdmin: false, alert: null };
    if (!recipientId) return context;

    try {
        const rows = await supabaseGet(`users?select=email&id=eq.${encodeURIComponent(recipientId)}&limit=1`);
        const email = String(rows[0]?.email || '').trim().toLowerCase();
        context.isAdmin = email === BALANCE_ADMIN_EMAIL;
    } catch (err) {
        console.warn(`[DM-Notif] admin recipient check failed for ${recipientId}: ${err.message}`);
        return context;
    }

    if (!context.isAdmin || !alertId) return context;

    try {
        const rows = await supabaseGet(
            `coach_alerts?select=id,client_id,alert_type,data&id=eq.${encodeURIComponent(alertId)}&limit=1`
        );
        context.alert = rows[0] || null;
    } catch (err) {
        console.warn(`[DM-Notif] alert lookup failed for admin push ${alertId}: ${err.message}`);
    }

    return context;
}

function normalizeStage(value) {
    return String(value || '').trim().toLowerCase();
}

function getAdminPushStage({ alert, payload = {} }) {
    const data = alert?.data || {};
    return normalizeStage(
        data.lifecycle?.stage
        || data.lifecycle_stage
        || data.lead_stage
        || payload.lifecycleStage
        || payload.lifecycle_stage
        || payload.leadStage
        || payload.lead_stage
    );
}

function getAlertExternalChannel(alert) {
    const data = alert?.data || {};
    if (alert?.alert_type === 'ig_incoming_dm') return 'instagram';
    if (alert?.alert_type === 'fb_incoming_dm') return 'messenger';
    if (data.ig_thread_id || data.subscriber_id || data.ig_username) {
        return data.channel === 'messenger' ? 'messenger' : 'instagram';
    }
    return getExternalMessageChannel(data);
}

function isClientScopedAdminPush({ alert, payload = {} }) {
    if (alert?.client_id) return true;

    const data = alert?.data || {};
    if (data.linked_user_id || data.linked_client_id) return true;

    const stage = getAdminPushStage({ alert, payload });
    if (ADMIN_CLIENT_LIFECYCLE_STAGES.has(stage)) return true;

    const externalChannel = getExternalMessageChannel(payload) || getAlertExternalChannel(alert);
    if (externalChannel) return false;

    return !!(payload.clientId || payload.senderId || payload.senderName)
        && !!String(payload.messageText || payload.clientMessage || '').trim();
}

function isAllowedAdminPhonePush({ type, alert, payload }) {
    if (ADMIN_WARNING_NOTIFICATION_TYPES.has(type)) {
        return isClientScopedAdminPush({ alert, payload });
    }
    if (type === 'coach_draft_ready') {
        if (alert) {
            return ADMIN_MESSAGE_ALERT_TYPES.has(alert.alert_type)
                && isClientScopedAdminPush({ alert, payload });
        }
        return isClientScopedAdminPush({ alert, payload });
    }
    if (ADMIN_DIRECT_MESSAGE_TYPES.has(type)) {
        return isClientScopedAdminPush({ alert, payload });
    }
    return false;
}

/**
 * Get an OAuth2 access token for FCM V1 API using the service account JWT
 */
async function getFCMAccessToken(firebaseServiceAccount) {
    if (!firebaseServiceAccount) return null;

    const { client_email, private_key } = firebaseServiceAccount;
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
/**
 * Return value: { success: bool, stale: bool }
 *   stale === true means FCM rejected the token as UNREGISTERED/INVALID so the
 *   caller should delete the push_subscriptions row. This is separate from
 *   `success` because a transient 5xx/network error is NOT stale — retry later.
 */
async function sendNativePush(token, payload) {
    const firebaseServiceAccount = await loadFirebaseServiceAccount();
    if (!firebaseServiceAccount) {
        console.log('[NativePush] No Firebase service account configured, skipping native push');
        return { success: false, stale: false };
    }

    try {
        console.log('[NativePush] Attempting FCM send to token:', token.substring(0, 20) + '...');
        const accessToken = await getFCMAccessToken(firebaseServiceAccount);
        if (!accessToken) {
            console.error('[NativePush] Failed to get FCM access token');
            return { success: false, stale: false };
        }
        console.log('[NativePush] Got FCM access token OK');

        const projectId = firebaseServiceAccount.project_id;
        // FCM V1 requires all data values to be strings
        const stringData = Object.fromEntries(
            Object.entries(payload.data || {}).map(([k, v]) => [k, String(v)])
        );

        const fcmUrl = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;
        console.log('[NativePush] Sending to:', fcmUrl);

        // For regular DMs / meal reminders we send notification+data so Android
        // auto-displays the lockscreen banner even when the app is killed.
        //
        // For `coach_draft_ready` we MUST send data-only. FCM behaviour: when a
        // message contains BOTH a top-level `notification` block AND `data`,
        // and the app is not in the foreground, Android auto-displays the
        // notification and does NOT call our custom FirebaseMessagingService
        // at all — confirmed from the empty push-diag logs. Stripping
        // `notification` forces every coach-draft push through
        // CoachDraftMessagingService.onMessageReceived, which then builds the
        // rich NotificationCompat + RemoteInput Send action.
        //
        // Safe to flip now that the push-diag MainActivity beacon confirmed
        // only our service is registered for MESSAGING_EVENT
        // (Capacitor's default was successfully removed by tools:node="remove").
        const isCoachDraft = stringData.type === 'coach_draft_ready';
        const channelId = isCoachDraft ? 'coach-drafts' : 'dm-messages';

        // Forward title/body inside `data` so the coach-draft service can read
        // them (data-only messages don't carry a `notification` block).
        stringData.title = payload.title || '';
        stringData.body = payload.body || '';

        const message = {
            token,
            android: { priority: 'high' },
            data: stringData,
        };
        // Stable collapse_key so identical pushes (same alert fired twice) are
        // collapsed by FCM while the device is offline instead of queuing as
        // two separate deliveries.
        if (payload.collapseKey) {
            message.android.collapse_key = payload.collapseKey;
        }
        if (!isCoachDraft) {
            const accent = pickAccent();
            message.notification = { title: payload.title, body: payload.body };
            message.android.notification = {
                channel_id: channelId,
                sound: 'default',
                click_action: 'FCM_PLUGIN_ACTIVITY',
                color: accent.color,
            };
            // `tag` on android.notification tells Android to replace any
            // existing notification with the same tag rather than stacking a
            // new one — defensive dedup at the OS level.
            if (payload.collapseKey) {
                message.android.notification.tag = payload.collapseKey;
            }
        }

        const response = await fetch(fcmUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ message })
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[NativePush] FCM V1 error (status ' + response.status + '):', errorText);
            // FCM V1 reports dead tokens as 404 UNREGISTERED or 400 INVALID_ARGUMENT
            // with errorCode INVALID_ARGUMENT/SENDER_ID_MISMATCH. Legacy FCM used
            // 410 Gone; V1 never returns 410. Detect via the response body.
            const isStale = response.status === 404
                || /\"UNREGISTERED\"/.test(errorText)
                || /\"INVALID_ARGUMENT\"/.test(errorText)
                || /\"SENDER_ID_MISMATCH\"/.test(errorText);
            return { success: false, stale: isStale };
        }

        const responseBody = await response.json();
        console.log('[NativePush] FCM V1 success:', JSON.stringify(responseBody));
        return { success: true, stale: false };
    } catch (err) {
        console.error('[NativePush] FCM send failed:', err.message, err.stack);
        return { success: false, stale: false };
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
        const payload = JSON.parse(event.body);
        const { recipientId, senderName, senderId } = payload;
        // Optional extras: when instant-coach-draft calls us with type='coach_draft_ready'
        // it passes the alertId, clientId/Name, and the drafted reply so the native
        // side can render an inline-reply action. We forward these through the FCM
        // data payload unchanged.
        const type = payload.type || 'dm_message';
        const messageText = type === 'coach_draft_ready'
            ? normalizeCoachDraftText(payload.messageText || '')
            : (payload.messageText || '');
        const alertId = payload.alertId || '';
        const clientId = payload.clientId || senderId || '';
        const clientName = payload.clientName || '';
        const draftText = normalizeCoachDraftText(payload.draftText || '');
        const clientMessage = payload.clientMessage || '';
        const isSimpleReply = payload.isSimpleReply ? '1' : '0';
        const actionRequired = payload.actionRequired === true || payload.actionRequired === '1' || payload.actionRequired === 'true'
            ? '1'
            : '0';
        const actionType = payload.actionType || '';
        const actionLabel = payload.actionLabel || '';
        const actionReason = payload.actionReason || '';
        // Optional channel hint -- e.g. "Balance IG" or "Balance FB" -- shown
        // by the Android service as the notification's subText. Older
        // payloads (in-app DMs) don't pass this through; the service falls
        // back to "From <name>" when empty.
        const channelLabel = payload.channelLabel || '';
        // Optional URL to launch when Shannon taps the Open action. For
        // ManyChat alerts this points at the IG/Messenger inbox so he lands
        // in the native source app; in-app DMs leave this empty and the
        // Android service falls back to opening the Balance dashboard.
        const openUrl = payload.openUrl || '';
        const notificationUrl = payload.url || openUrl || './dashboard.html';
        // Trailing inbound streak — every message the client sent since
        // Shannon's last reply, OLDER → NEWER (excludes the current message
        // which arrives via clientMessage). FCM data values must all be
        // strings, so we JSON-stringify it once here and the native service
        // parses on the other side. Empty array stringifies to "[]".
        const recentInboundJson = JSON.stringify(
            Array.isArray(payload.recentInboundMessages) ? payload.recentInboundMessages : []
        );
        // Lead-qualifier sidecar — flat fields produced by qualifier-engine.js
        // when an inbound DM lands from a cold IG/FB lead in the new/qualifying/
        // invited window. The Android coach-draft service and PWA push fallback
        // can render these as a strategy strip without parsing JSON. All
        // strings so FCM V1 doesn't reject the payload. Empty when the lead
        // is past the funnel (in_app/paying/churned) or qualifier evaluation
        // failed for this alert.
        const qualifierStage = payload.qualifierStage || '';
        const qualifierStageLabel = payload.qualifierStageLabel || '';
        const qualifierStageIndex = payload.qualifierStageIndex || '';
        const qualifierWarmth = payload.qualifierWarmth || '';
        const qualifierWarmthLabel = payload.qualifierWarmthLabel || '';
        const qualifierNextQuestion = payload.qualifierNextQuestion || '';
        const qualifierWhyNow = payload.qualifierWhyNow || '';
        const qualifierIsQuestionMoment = payload.qualifierIsQuestionMoment || '0';
        const qualifierChallengeRoute = payload.qualifierChallengeRoute || '';
        // Lifecycle stage — single coloured dot the Android service renders
        // at the front of the conversation title and the admin dashboard
        // renders next to the client name. Source-of-truth for "is this a
        // lead, a trial, a paying client, or churned" without parsing the
        // qualifier or subscription separately on the device.
        const lifecycleStage = payload.lifecycleStage || '';
        const lifecycleDot = payload.lifecycleDot || '';
        const lifecycleLabel = payload.lifecycleLabel || '';
        const challengeOfferWarning = payload.challengeOfferWarning === true
            || payload.challengeOfferWarning === '1'
            || payload.challengeOfferWarning === 'true';
        const challengeOfferDot = payload.challengeOfferDot || (challengeOfferWarning ? '🟡' : '');
        const challengeOfferLabel = payload.challengeOfferLabel || '';
        const challengeOfferReason = payload.challengeOfferReason || '';

        if (!recipientId || !messageText) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Missing recipientId or messageText' })
            };
        }

        const adminPushContext = await loadAdminPushContext({ recipientId, alertId });
        if (adminPushContext.isAdmin && !isAllowedAdminPhonePush({ type, alert: adminPushContext.alert, payload })) {
            const alertType = adminPushContext.alert?.alert_type || '';
            console.log(`[DM-Notif] Suppressed admin phone push type=${type} alert_type=${alertType || 'none'} recipient=${recipientId}`);
            return {
                statusCode: 200,
                body: JSON.stringify({
                    message: 'Skipped admin phone push by notification whitelist',
                    sent: 0,
                    skipped: true,
                    reason: 'admin_phone_whitelist',
                    type,
                    alert_type: alertType || null,
                })
            };
        }

        if (!adminPushContext.isAdmin && shouldSuppressExternalMessagePush(payload)) {
            const externalChannel = getExternalMessageChannel(payload);
            console.log(`[DM-Notif] Suppressed Balance push for external ${externalChannel || 'social'} message notification type=${type} recipient=${recipientId}`);
            return {
                statusCode: 200,
                body: JSON.stringify({
                    message: 'Skipped external social DM notification',
                    sent: 0,
                    skipped: true,
                    reason: 'external_social_dm',
                    channel: externalChannel || null
                })
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

        const rawSubscriptions = await subscriptionsResponse.json();
        console.log(`Found ${rawSubscriptions.length} raw subscriptions for user ${recipientId}`);
        // Log subscription types for debugging
        rawSubscriptions.forEach((sub, i) => {
            const isNative = sub.endpoint && sub.endpoint.startsWith('native://');
            console.log(`  [${i}] type=${isNative ? 'NATIVE/FCM' : 'WEB_PUSH'} endpoint=${sub.endpoint.substring(0, 40)}... updated=${sub.updated_at || 'n/a'}`);
        });

        // Deduplicate subscriptions so the same device isn't notified twice.
        //
        // Duplicates appear when the push_subscriptions table contains leftover
        // rows for the same user — typical causes:
        //   • An old web-push subscription that was registered before the
        //     native app install, and never cleaned up.
        //   • Multiple native/FCM rows from successive reinstalls or token
        //     rotations that raced the register_push_subscription RPC cleanup.
        // Without dedup, the Promise.allSettled below fires a notification to
        // every row, which stacks as visible duplicates in the shade.
        //
        // Strategy:
        //   1. Collapse rows by endpoint, keeping the most recently updated.
        //   2. For native rows, also collapse by FCM token (the `auth` column)
        //      so two endpoints that wrap the same token only send once.
        //   3. If the user has ANY native subscription, drop every web-push
        //      row: the native app supersedes the PWA on that device, and a
        //      legacy web-push sub nearly always points at the same phone.
        const sortedByRecency = [...rawSubscriptions].sort((a, b) => {
            const ta = Date.parse(a.updated_at || '') || 0;
            const tb = Date.parse(b.updated_at || '') || 0;
            return tb - ta;
        });
        const byEndpoint = new Map();
        for (const sub of sortedByRecency) {
            if (!sub.endpoint) continue;
            if (!byEndpoint.has(sub.endpoint)) byEndpoint.set(sub.endpoint, sub);
        }
        let deduped = Array.from(byEndpoint.values());
        const nativeTokensSeen = new Set();
        deduped = deduped.filter(sub => {
            const isNative = sub.endpoint && sub.endpoint.startsWith('native://');
            if (!isNative) return true;
            const token = sub.auth || sub.endpoint;
            if (nativeTokensSeen.has(token)) return false;
            nativeTokensSeen.add(token);
            return true;
        });
        const hasNative = deduped.some(s => s.endpoint && s.endpoint.startsWith('native://'));
        if (hasNative) {
            deduped = deduped.filter(s => s.endpoint && s.endpoint.startsWith('native://'));
        }
        const subscriptions = deduped;
        if (subscriptions.length !== rawSubscriptions.length) {
            console.log(`[dedup] Collapsed ${rawSubscriptions.length} → ${subscriptions.length} subscriptions for user ${recipientId} (hasNative=${hasNative})`);
        }
        const firebaseServiceAccount = await loadFirebaseServiceAccount();
        console.log('[FCM Config] Firebase configured:', !!firebaseServiceAccount, 'project:', firebaseServiceAccount?.project_id || 'N/A');

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

        // Stable dedup key — if the same alert fires twice (e.g. two backend
        // call sites race, or the function retries) the OS will replace the
        // prior notification instead of stacking a second one.
        //
        // Coach drafts collapse PER CLIENT, not per alert: when the same
        // client double-messages, each insert spawns its own alert + push.
        // Without client-level collapse those pushes stack as two
        // notifications (older one missing the latest priors), so Shannon
        // scans the top one and only sees the most recent message bubble.
        // Collapsing per (coach, client) means the newer push always wins —
        // the visible notification carries every message in the streak as
        // its own bubble plus the draft generated against all of them.
        const isCoachDraft = type === 'coach_draft_ready';
        const collapseKey = isCoachDraft
            ? `coach-draft-${recipientId}-${clientId || senderId || ''}`
            : alertId
                ? `alert-${alertId}`
                : `${type}-${recipientId}-${senderId || ''}`;

        // Send to all of the recipient's subscriptions
        const results = await Promise.allSettled(
            subscriptions.map(async (sub) => {
                const isNative = sub.endpoint && sub.endpoint.startsWith('native://');

                try {
                    if (isNative) {
                        // Native app — send via FCM
                        const nativeToken = sub.auth; // Token stored in auth field
                        const result = await sendNativePush(nativeToken, {
                            title: senderName || 'New Message',
                            body: displayText,
                            collapseKey,
                            data: {
                                type,
                                senderName: senderName || 'Someone',
                                senderId: senderId || '',
                                url: notificationUrl,
                                // Coach-draft extras (empty strings for regular DMs, FCM V1 requires strings)
                                alertId,
                                clientId,
                                clientName,
                                clientMessage,
                                draftText,
                                isSimpleReply,
                                actionRequired,
                                actionType,
                                actionLabel,
                                actionReason,
                                channelLabel,
                                openUrl,
                                recentInboundMessages: recentInboundJson,
                                // Lead-qualifier strip — Android coach-draft service can
                                // render these as a strategy chip above the conversation.
                                qualifierStage,
                                qualifierStageLabel,
                                qualifierStageIndex,
                                qualifierWarmth,
                                qualifierWarmthLabel,
                                qualifierNextQuestion,
                                qualifierWhyNow,
                                qualifierIsQuestionMoment,
                                qualifierChallengeRoute,
                                lifecycleStage,
                                lifecycleDot,
                                lifecycleLabel,
                                challengeOfferWarning: challengeOfferWarning ? '1' : '0',
                                challengeOfferDot,
                                challengeOfferLabel,
                                challengeOfferReason,
                            }
                        });
                        // FCM V1 UNREGISTERED (404) or INVALID_ARGUMENT → delete the stale row
                        // so subsequent pushes don't keep failing against a dead token.
                        if (result.stale) {
                            console.log(`[NativePush] Cleaning up stale token: ${sub.endpoint.slice(0, 60)}…`);
                            await fetch(
                                `${SUPABASE_URL}/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(sub.endpoint)}`,
                                {
                                    method: 'DELETE',
                                    headers: {
                                        'apikey': SUPABASE_SERVICE_KEY,
                                        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
                                    }
                                }
                            ).catch(e => console.warn('[NativePush] Stale-token cleanup failed:', e.message));
                        }
                        return { success: result.success, endpoint: sub.endpoint };
                    } else {
                        // Web browser — send via Web Push (VAPID)
                        const notificationPayload = JSON.stringify({
                            title: senderName || 'New Message',
                            body: displayText,
                            icon: '/assets/Logo_dots.jpg',
                            badge: '/assets/Logo_dots.jpg',
                            vibrate: [200, 100, 200],
                            tag: collapseKey,
                            requireInteraction: false,
                            data: {
                                type,
                                senderName: senderName || 'Someone',
                                senderId: senderId || '',
                                url: notificationUrl,
                                alertId,
                                clientId,
                                clientName,
                                clientMessage,
                                draftText,
                                isSimpleReply,
                                actionRequired,
                                actionType,
                                actionLabel,
                                actionReason,
                                openUrl,
                                recentInboundMessages: recentInboundJson,
                                qualifierStage,
                                qualifierStageLabel,
                                qualifierStageIndex,
                                qualifierWarmth,
                                qualifierWarmthLabel,
                                qualifierNextQuestion,
                                qualifierWhyNow,
                                qualifierIsQuestionMoment,
                                qualifierChallengeRoute,
                                lifecycleStage,
                                lifecycleDot,
                                lifecycleLabel,
                                challengeOfferWarning: challengeOfferWarning ? '1' : '0',
                                challengeOfferDot,
                                challengeOfferLabel,
                                challengeOfferReason,
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

        // Log detailed results for debugging
        results.forEach((r, i) => {
            if (r.status === 'fulfilled') {
                console.log(`  Result[${i}]: success=${r.value.success} endpoint=${r.value.endpoint?.substring(0, 40)}... ${r.value.error || ''}`);
            } else {
                console.log(`  Result[${i}]: REJECTED reason=${r.reason?.message || r.reason}`);
            }
        });

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

module.exports.__test = {
    getExternalMessageChannel,
    getAlertExternalChannel,
    isClientScopedAdminPush,
    isAllowedAdminPhonePush,
    shouldSuppressExternalMessagePush,
};
