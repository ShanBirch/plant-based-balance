/**
 * send-direct-ig-message
 *
 * Dashboard composer route for Shannon-initiated Instagram/Messenger messages.
 * Uses Instagram Graph first for Instagram threads, falling back to ManyChat
 * only for Messenger or legacy IG threads that have not exposed a Graph
 * recipient yet. Writes every delivered bubble into ig_messages, updates
 * ig_threads.last_outbound_at, and clears any pending DM cards for the thread.
 */

const {
    SUPABASE_URL,
    SUPABASE_SERVICE_KEY,
    supabaseQuery,
    normalizeCoachDraftText,
    splitCoachDraftIntoDmBubbles,
    fireCoachEditAnalysis,
    normalizeLearningReelItems,
    mergeLearningReelContext,
} = require('./_lib/client-context');
const { sendInstagramSeenReceiptForThread } = require('./_lib/instagram-graph-seen');

const MANYCHAT_API_TOKEN = process.env.MANYCHAT_API_TOKEN;
const MANYCHAT_SEND_URL = process.env.MANYCHAT_SEND_URL || 'https://api.manychat.com/fb/sending/sendContent';
const MANYCHAT_MESSAGE_TAG = process.env.MANYCHAT_MESSAGE_TAG || '';
const MANYCHAT_DM_ALERT_TYPES = ['ig_incoming_dm', 'fb_incoming_dm'];
const CHUNK_GAP_MIN_MS = 2600;
const CHUNK_GAP_JITTER_MS = 1400;
const GRAPH_SUBSCRIBER_PREFIX = 'ig_graph:';
const LEGACY_GRAPH_SUBSCRIBER_PREFIX = 'meta_ig:';
const INSTAGRAM_GRAPH_ACCESS_TOKEN_ENV = process.env.INSTAGRAM_GRAPH_ACCESS_TOKEN
    || process.env.IG_GRAPH_ACCESS_TOKEN
    || process.env.META_IG_ACCESS_TOKEN
    || process.env.INSTAGRAM_ACCESS_TOKEN
    || '';
let cachedInstagramGraphAccessToken = INSTAGRAM_GRAPH_ACCESS_TOKEN_ENV || '';
const INSTAGRAM_GRAPH_ACCOUNT_ID = process.env.INSTAGRAM_GRAPH_ACCOUNT_ID
    || process.env.IG_GRAPH_BUSINESS_ACCOUNT_ID
    || process.env.META_IG_USER_ID
    || '';
const INSTAGRAM_GRAPH_API_VERSION = normalizeGraphApiVersion(
    process.env.IG_GRAPH_API_VERSION
    || process.env.INSTAGRAM_GRAPH_API_VERSION
    || process.env.META_IG_API_VERSION
    || process.env.META_GRAPH_API_VERSION
    || 'v25.0'
);
const INSTAGRAM_GRAPH_HUMAN_AGENT_ENABLED = envFlagEnabled(
    process.env.INSTAGRAM_GRAPH_HUMAN_AGENT_ENABLED
    || process.env.IG_GRAPH_HUMAN_AGENT_ENABLED
    || process.env.META_HUMAN_AGENT_ENABLED
);
const HUMAN_AGENT_NOT_APPROVED_MESSAGE = 'Meta Human Agent is still only ready for testing, so API sends after 24 hours must be copied/sent manually in Instagram until the feature is approved.';

function json(statusCode, body) {
    return {
        statusCode,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    };
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function pickChunkGap() {
    return CHUNK_GAP_MIN_MS + Math.floor(Math.random() * CHUNK_GAP_JITTER_MS);
}

function normalizeGraphApiVersion(value) {
    const raw = String(value || '').trim();
    if (!raw) return 'v25.0';
    return raw.startsWith('v') ? raw : `v${raw}`;
}

function envFlagEnabled(value) {
    return ['1', 'true', 'yes', 'on', 'enabled'].includes(String(value || '').trim().toLowerCase());
}

function safeObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function firstString(candidates = []) {
    return candidates.map(v => String(v || '').trim()).find(Boolean) || '';
}

function isGraphSubscriberId(value) {
    const raw = String(value || '');
    return raw.startsWith(GRAPH_SUBSCRIBER_PREFIX) || raw.startsWith(LEGACY_GRAPH_SUBSCRIBER_PREFIX);
}

function graphRecipientFromSubscriberId(value) {
    const raw = String(value || '').trim();
    if (raw.startsWith(GRAPH_SUBSCRIBER_PREFIX)) return raw.slice(GRAPH_SUBSCRIBER_PREFIX.length);
    if (raw.startsWith(LEGACY_GRAPH_SUBSCRIBER_PREFIX)) return raw.slice(LEGACY_GRAPH_SUBSCRIBER_PREFIX.length);
    return '';
}

function resolveThreadGraphRecipientId(thread = {}) {
    const customData = safeObject(thread.custom_data);
    const graph = safeObject(customData.instagram_graph);
    return firstString([
        graph.ig_graph_user_id,
        graph.recipient_id,
        customData.ig_graph_user_id,
        thread.ig_graph_recipient_id,
        graphRecipientFromSubscriberId(thread.subscriber_id),
    ]);
}

function resolveThreadGraphAccountId(thread = {}) {
    const customData = safeObject(thread.custom_data);
    const graph = safeObject(customData.instagram_graph);
    return firstString([
        graph.ig_account_id,
        graph.account_id,
        customData.ig_graph_account_id,
        customData.ig_account_id,
        INSTAGRAM_GRAPH_ACCOUNT_ID,
    ]);
}

function hoursSinceIso(value, nowMs = Date.now()) {
    if (!value) return null;
    const ts = new Date(value).getTime();
    if (!Number.isFinite(ts)) return null;
    return (nowMs - ts) / (60 * 60 * 1000);
}

function isHumanAgentWindow(lastInboundAt, nowMs = Date.now()) {
    const hours = hoursSinceIso(lastInboundAt, nowMs);
    return hours !== null && hours > 24 && hours <= 24 * 7;
}

function resolveGraphMessageTag(thread = {}) {
    if (!isHumanAgentWindow(thread.last_inbound_at)) return '';
    return INSTAGRAM_GRAPH_HUMAN_AGENT_ENABLED ? 'HUMAN_AGENT' : '';
}

function resolveDirectTransport(thread = {}) {
    const channel = thread.channel === 'messenger' ? 'messenger' : 'instagram';
    if (channel === 'instagram') {
        const recipientId = resolveThreadGraphRecipientId(thread);
        const accountId = resolveThreadGraphAccountId(thread);
        if (recipientId) {
            return { ok: true, channel, transport: 'instagram_graph', recipientId, accountId };
        }
        return {
            ok: false,
            channel,
            transport: 'unavailable',
            code: 'graph_recipient_missing',
            error: 'This IG thread has not exposed a Graph recipient ID yet. Wait for their next DM to come through Graph, or send this one in Instagram manually.',
        };
    }

    if (MANYCHAT_API_TOKEN && thread.subscriber_id) {
        return { ok: true, channel, transport: 'manychat', reason: 'messenger_uses_manychat' };
    }
    return {
        ok: false,
        channel,
        transport: 'unavailable',
        code: 'manychat_token_missing',
        error: 'Messenger sends still need ManyChat. MANYCHAT_API_TOKEN is not configured.',
    };
}

function sourceForDelivery(delivery) {
    if (delivery.transport === 'instagram_graph') return 'admin_dashboard_direct_instagram_graph';
    if (delivery.channel === 'messenger') return 'admin_dashboard_direct_messenger';
    return 'admin_dashboard_direct_instagram';
}

function deliveryChannelForTransport(delivery) {
    if (delivery.transport === 'instagram_graph') return 'instagram_graph';
    return delivery.channel;
}

function learningReelPayloadFromBody(body = {}) {
    return body.learningReels
        || body.learning_reels
        || body.learningReel
        || body.learning_reel
        || body.learningReelContext
        || body.learning_reel_context
        || null;
}

function learningReelSourceFromBody(body = {}) {
    return firstString([
        body.learningReelSource,
        body.learning_reel_source,
        body.reelSource,
        body.reel_source,
    ]) || 'send-direct-ig-message';
}

function graphMessageIdFromResponse(response) {
    return response?.message_id || response?.id || null;
}

async function getInstagramGraphAccessToken() {
    if (cachedInstagramGraphAccessToken) return cachedInstagramGraphAccessToken;
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return '';
    try {
        const rows = await supabaseQuery(
            'app_private_secrets?select=value&key=eq.instagram_graph_access_token&limit=1'
        );
        const token = String(rows?.[0]?.value || '').trim();
        if (token) cachedInstagramGraphAccessToken = token;
    } catch (err) {
        console.warn('[send-direct-ig-message] Instagram Graph token lookup failed:', err.message || err);
    }
    return cachedInstagramGraphAccessToken;
}

async function verifyAdminToken(event) {
    const auth = event?.headers?.authorization || event?.headers?.Authorization || '';
    const token = auth.replace(/^Bearer\s+/i, '').trim();
    if (!token) return { ok: false, error: 'missing_admin_token' };
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return { ok: false, error: 'supabase_not_configured' };

    try {
        const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
            headers: {
                apikey: SUPABASE_SERVICE_KEY,
                Authorization: `Bearer ${token}`,
            },
        });
        if (!userRes.ok) return { ok: false, error: 'invalid_admin_token' };
        const user = await userRes.json();
        if (!user?.id) return { ok: false, error: 'invalid_admin_user' };

        const rows = await supabaseQuery(`admin_users?select=user_id&user_id=eq.${encodeURIComponent(user.id)}&limit=1`);
        if (!rows.length) return { ok: false, error: 'not_admin' };
        return { ok: true, userId: user.id };
    } catch (err) {
        return { ok: false, error: err.message || 'admin_check_failed' };
    }
}

async function postToInstagramGraph({ recipientId, accountId, text, tag }) {
    const accessToken = await getInstagramGraphAccessToken();
    if (!accessToken) throw new Error('INSTAGRAM_GRAPH_ACCESS_TOKEN not configured');
    if (!recipientId) throw new Error('Instagram Graph recipient id missing');

    const targetAccount = accountId || 'me';
    const res = await fetch(`https://graph.instagram.com/${INSTAGRAM_GRAPH_API_VERSION}/${encodeURIComponent(targetAccount)}/messages`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            recipient: { id: recipientId },
            message: { text },
            ...(tag ? { tag } : {}),
        }),
    });
    const responseText = await res.text();
    let parsed;
    try { parsed = responseText ? JSON.parse(responseText) : {}; } catch { parsed = { raw: responseText }; }
    if (!res.ok) {
        const detail = parsed?.error?.message || responseText;
        throw new Error(`Instagram Graph ${res.status}: ${String(detail || '').slice(0, 400)}`);
    }
    return parsed;
}

async function postToManyChat({ subscriberId, text, channel }) {
    if (!MANYCHAT_API_TOKEN) throw new Error('MANYCHAT_API_TOKEN not configured');

    const content = {
        messages: [{ type: 'text', text }],
    };
    if (channel === 'instagram') content.type = 'instagram';

    const body = {
        subscriber_id: subscriberId,
        data: {
            version: 'v2',
            content,
        },
    };
    if (MANYCHAT_MESSAGE_TAG) body.message_tag = MANYCHAT_MESSAGE_TAG;

    const res = await fetch(MANYCHAT_SEND_URL, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${MANYCHAT_API_TOKEN}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });
    const responseText = await res.text();
    if (!res.ok) {
        throw new Error(`ManyChat ${res.status}: ${responseText.slice(0, 400)}`);
    }
    try {
        return responseText ? JSON.parse(responseText) : {};
    } catch {
        return { raw: responseText };
    }
}

async function loadPendingThreadAlerts(threadId) {
    if (!threadId) return [];
    try {
        return await supabaseQuery(
            `coach_alerts?select=id,alert_type,status,suggested_message,data,created_at&data->>ig_thread_id=eq.${encodeURIComponent(threadId)}&status=eq.pending&alert_type=in.(${MANYCHAT_DM_ALERT_TYPES.join(',')})&order=created_at.desc&limit=25`
        );
    } catch (err) {
        console.warn('[send-direct-ig-message] pending alert lookup failed:', err.message || err);
        return [];
    }
}

async function clearPendingThreadAlerts({
    pendingAlerts,
    primaryAlert,
    message,
    chunks,
    sentAt,
    source,
    seenReceipt,
    deliveryTransport,
    deliveryChannel,
    sentGraphMessageIds = [],
    sentChunkGapsMs = [],
}) {
    let primaryAlertId = null;
    let siblingAlertsCleared = 0;
    if (!Array.isArray(pendingAlerts) || pendingAlerts.length === 0) {
        return { primaryAlertId, siblingAlertsCleared };
    }

    const primary = primaryAlert || pendingAlerts[0];
    const siblings = pendingAlerts.filter(a => a.id !== primary.id);
    const draftText = normalizeCoachDraftText(primary.data?.draft_text || primary.suggested_message || '').trim();
    const wasEdited = !!draftText && message !== draftText;
    const primaryData = {
        ...(primary.data || {}),
        sent_message: message,
        sent_at: sentAt,
        sent_via: source,
        was_edited: wasEdited,
        chunks_sent: chunks.length,
        chunks_total: chunks.length,
        sent_chunks: chunks,
        sent_split_strategy: chunks.length > 1 ? 'direct_paragraph_safe_v1' : 'single',
        sent_chunk_gaps_ms: sentChunkGapsMs,
        delivery_channel: deliveryChannel,
        delivery_transport: deliveryTransport,
        cleared_by_direct_composer: true,
        instagram_seen_receipt: seenReceipt,
    };
    if (sentGraphMessageIds.length) primaryData.sent_graph_message_ids = sentGraphMessageIds;
    if (!draftText) primaryData.manual_reply_without_draft = true;

    try {
        await supabaseQuery(`coach_alerts?id=eq.${encodeURIComponent(primary.id)}`, {
            method: 'PATCH',
            body: { status: 'sent', actioned_at: sentAt, data: primaryData },
            prefer: 'return=minimal',
        });
        primaryAlertId = primary.id;
        await fireCoachEditAnalysis({
            alertId: primary.id,
            draftText,
            sentMessage: message,
            source,
        });
    } catch (err) {
        console.warn('[send-direct-ig-message] primary alert update failed:', err.message || err);
    }

    for (const sibling of siblings) {
        const siblingData = {
            ...(sibling.data || {}),
            cancel_reason: 'cleared_by_direct_outbound_reply',
            cleared_by_outbound_reply_at: sentAt,
            cleared_by_outbound_reply_source: source,
            cleared_by_primary_alert_id: primaryAlertId,
        };
        try {
            await supabaseQuery(`coach_alerts?id=eq.${encodeURIComponent(sibling.id)}`, {
                method: 'PATCH',
                body: { status: 'canceled', actioned_at: sentAt, data: siblingData },
                prefer: 'return=minimal',
            });
            siblingAlertsCleared++;
        } catch (err) {
            console.warn('[send-direct-ig-message] sibling alert cleanup failed:', err.message || err);
        }
    }

    return { primaryAlertId, siblingAlertsCleared };
}

exports.handler = async (event = {}) => {
    if (event.httpMethod === 'OPTIONS') return json(204, {});
    if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return json(500, { error: 'Supabase env missing' });

    const admin = await verifyAdminToken(event);
    if (!admin.ok) return json(403, { error: admin.error });

    let body = {};
    try {
        body = event.body ? JSON.parse(event.body) : {};
    } catch {
        return json(400, { error: 'Invalid JSON' });
    }

    const threadId = String(body.threadId || body.igThreadId || '').trim();
    const message = normalizeCoachDraftText(body.message || body.replyText || '').trim();
    const learningReelPayload = learningReelPayloadFromBody(body);
    const learningReelSource = learningReelSourceFromBody(body);
    if (!threadId) return json(400, { error: 'Missing threadId' });
    if (!message) return json(400, { error: 'Missing message' });
    if (message.length > 8000) return json(400, { error: 'Message too long (max 8000 chars)' });

    let thread;
    try {
        const rows = await supabaseQuery(
            `ig_threads?select=id,subscriber_id,channel,ig_username,profile_name,linked_user_id,lead_stage,last_inbound_at,last_outbound_at,custom_data&id=eq.${encodeURIComponent(threadId)}&limit=1`
        );
        thread = rows[0] || null;
    } catch (err) {
        console.error('[send-direct-ig-message] thread lookup failed:', err);
        return json(500, { error: 'Thread lookup failed' });
    }
    if (!thread) return json(404, { error: 'IG thread not found' });

    const delivery = resolveDirectTransport(thread);
    if (!delivery.ok) {
        return json(409, {
            error: delivery.error,
            code: delivery.code,
            channel: delivery.channel,
        });
    }
    if (delivery.transport === 'instagram_graph' && isHumanAgentWindow(thread.last_inbound_at) && !INSTAGRAM_GRAPH_HUMAN_AGENT_ENABLED) {
        return json(409, {
            error: HUMAN_AGENT_NOT_APPROVED_MESSAGE,
            code: 'human_agent_not_approved',
            manual_ig_required: true,
        });
    }
    if (delivery.transport === 'manychat' && !thread.subscriber_id) {
        return json(400, { error: 'Thread is missing subscriber_id' });
    }

    const channel = delivery.channel;
    const source = sourceForDelivery(delivery);
    const deliveryChannel = deliveryChannelForTransport(delivery);
    const graphMessageTag = delivery.transport === 'instagram_graph'
        ? resolveGraphMessageTag(thread)
        : '';
    const pendingAlerts = await loadPendingThreadAlerts(thread.id);
    const primaryAlert = pendingAlerts[0] || null;
    const chunks = splitCoachDraftIntoDmBubbles([message]);
    if (!chunks.length) return json(400, { error: 'Message is empty' });

    const seenReceipt = delivery.transport === 'instagram_graph'
        ? await sendInstagramSeenReceiptForThread({
            thread,
            actorId: admin.userId,
            source: `${source}_before_send`,
            sentAtIso: new Date().toISOString(),
            loggerPrefix: 'send-direct-ig-message',
        })
        : { attempted: false, ok: false, reason: 'not_instagram_graph' };

    const sentResults = [];
    const sentChunkGapsMs = [];
    let firstError = null;
    for (let i = 0; i < chunks.length; i++) {
        if (i > 0) {
            const gapMs = pickChunkGap();
            sentChunkGapsMs.push(gapMs);
            await sleep(gapMs);
        }
        try {
            const response = delivery.transport === 'instagram_graph'
                ? await postToInstagramGraph({
                    recipientId: delivery.recipientId,
                    accountId: delivery.accountId,
                    text: chunks[i],
                    tag: graphMessageTag,
                })
                : await postToManyChat({ subscriberId: thread.subscriber_id, text: chunks[i], channel });
            sentResults.push({ ok: true, text: chunks[i], response, transport: delivery.transport });
        } catch (err) {
            firstError = err.message || String(err);
            sentResults.push({ ok: false, text: chunks[i], error: firstError, transport: delivery.transport });
            break;
        }
    }

    const sentChunks = sentResults.filter(r => r.ok);
    const sentAt = new Date().toISOString();
    const messageIds = [];
    const sentGraphMessageIds = delivery.transport === 'instagram_graph'
        ? sentChunks.map(r => graphMessageIdFromResponse(r.response)).filter(Boolean)
        : [];

    for (const result of sentChunks) {
        const graphMessageId = delivery.transport === 'instagram_graph'
            ? graphMessageIdFromResponse(result.response)
            : null;
        try {
            const rows = await supabaseQuery('ig_messages', {
                method: 'POST',
                body: [{
                    thread_id: thread.id,
                    direction: 'out',
                    text: result.text,
                    source,
                    alert_id: primaryAlert?.id || null,
                    manychat_message_id: graphMessageId ? `${GRAPH_SUBSCRIBER_PREFIX}${graphMessageId}` : null,
                }],
            });
            if (rows[0]?.id) messageIds.push(rows[0].id);
        } catch (err) {
            console.warn('[send-direct-ig-message] history insert failed:', err.message || err);
        }
    }

    const sentMessageText = sentChunks.map(r => r.text).join('\n');
    const learningReelItems = normalizeLearningReelItems(learningReelPayload, {
        sentAt,
        sentMessage: sentMessageText,
        source: learningReelSource,
        graphMessageIds: sentGraphMessageIds,
        messageIds,
        platform: 'youtube',
    });

    if (sentChunks.length > 0) {
        try {
            const patch = { last_outbound_at: sentAt };
            if (delivery.transport === 'instagram_graph' || learningReelItems.length > 0) {
                const customData = safeObject(thread.custom_data);
                let nextCustomData = customData;
                if (learningReelItems.length > 0) {
                    nextCustomData = mergeLearningReelContext(nextCustomData, learningReelItems, {
                        sentAt,
                        sentMessage: sentMessageText,
                        source: learningReelSource,
                        graphMessageIds: sentGraphMessageIds,
                        messageIds,
                        platform: 'youtube',
                    });
                }
                if (delivery.transport === 'instagram_graph') {
                    const graph = safeObject(customData.instagram_graph);
                    nextCustomData = {
                        ...nextCustomData,
                        instagram_graph: {
                            ...graph,
                            source: 'instagram_graph',
                            ig_graph_user_id: delivery.recipientId || graph.ig_graph_user_id || null,
                            ig_account_id: delivery.accountId || graph.ig_account_id || null,
                            send_ready: true,
                            last_send_at: sentAt,
                            last_send_source: source,
                            last_send_tag: graphMessageTag || graph.last_send_tag || undefined,
                            last_sent_graph_message_ids: sentGraphMessageIds,
                        },
                    };
                }
                patch.custom_data = nextCustomData;
            }
            await supabaseQuery(`ig_threads?id=eq.${encodeURIComponent(thread.id)}`, {
                method: 'PATCH',
                body: patch,
                prefer: 'return=minimal',
            });
        } catch (err) {
            console.warn('[send-direct-ig-message] thread timestamp update failed:', err.message || err);
        }
    }

    if (firstError) {
        return json(502, {
            error: delivery.transport === 'instagram_graph' ? 'Instagram Graph send failed' : 'ManyChat send failed',
            details: firstError,
            delivery_transport: delivery.transport,
            chunks_sent: sentChunks.length,
            chunks_total: chunks.length,
            history_logged: messageIds.length > 0,
            seen_receipt: seenReceipt,
        });
    }

    const cleanup = await clearPendingThreadAlerts({
        pendingAlerts,
        primaryAlert,
        message,
        chunks,
        sentAt,
        source,
        seenReceipt,
        deliveryTransport: delivery.transport,
        deliveryChannel,
        sentGraphMessageIds,
        sentChunkGapsMs,
    });

    return json(200, {
        ok: true,
        thread_id: thread.id,
        channel,
        delivery_channel: deliveryChannel,
        delivery_transport: delivery.transport,
        chunks_sent: sentChunks.length,
        chunks_total: chunks.length,
        sent_chunks: sentChunks.map(r => r.text),
        sent_graph_message_ids: sentGraphMessageIds,
        message_ids: messageIds,
        history_logged: messageIds.length === sentChunks.length,
        learning_reels_logged: learningReelItems.length,
        seen_receipt: seenReceipt,
        ...cleanup,
    });
};

exports._test = {
    deliveryChannelForTransport,
    graphRecipientFromSubscriberId,
    isGraphSubscriberId,
    isHumanAgentWindow,
    resolveDirectTransport,
    resolveGraphMessageTag,
    resolveThreadGraphAccountId,
    resolveThreadGraphRecipientId,
    learningReelPayloadFromBody,
    learningReelSourceFromBody,
    sourceForDelivery,
};
