/**
 * send-instagram-graph-action
 *
 * Admin-only Graph sender actions for Instagram DMs:
 * - react/unreact to an inbound message
 * - mark the current thread as seen
 *
 * The Messages UI only enables these controls when the ig_messages row has a
 * stored Graph message id and the thread has a Graph recipient id.
 */

const {
    SUPABASE_URL,
    SUPABASE_SERVICE_KEY,
    supabaseQuery,
} = require('./_lib/client-context');

const GRAPH_SUBSCRIBER_PREFIX = 'ig_graph:';
const DM_ALERT_TYPES = new Set(['ig_incoming_dm', 'fb_incoming_dm', 'incoming_dm', 'unread_message']);
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
    || process.env.META_GRAPH_API_VERSION
    || 'v25.0'
);

function json(statusCode, body) {
    return {
        statusCode,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    };
}

function normalizeGraphApiVersion(value) {
    const raw = String(value || '').trim();
    if (!raw) return 'v25.0';
    return raw.startsWith('v') ? raw : `v${raw}`;
}

function safeObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function firstString(candidates = []) {
    return candidates.map(v => String(v || '').trim()).find(Boolean) || '';
}

function cleanGraphMessageId(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    return raw.startsWith(GRAPH_SUBSCRIBER_PREFIX)
        ? raw.slice(GRAPH_SUBSCRIBER_PREFIX.length)
        : raw;
}

function graphMessageIdFromPrefixedId(value) {
    const raw = String(value || '').trim();
    return raw.startsWith(GRAPH_SUBSCRIBER_PREFIX)
        ? raw.slice(GRAPH_SUBSCRIBER_PREFIX.length)
        : '';
}

function isFreshAlertGraphFallback(alert = {}, graph = {}) {
    const alertAt = alert.created_at ? Date.parse(alert.created_at) : 0;
    const graphAt = Date.parse(graph.last_graph_seen_at || graph.last_inbound_at || '');
    if (!alertAt || !graphAt) return false;
    return Math.abs(alertAt - graphAt) <= 5 * 60 * 1000;
}

function resolveThreadGraphRecipientId(thread = {}) {
    const customData = safeObject(thread.custom_data);
    const graph = safeObject(customData.instagram_graph);
    const subscriberId = String(thread.subscriber_id || '');
    return firstString([
        graph.ig_graph_user_id,
        graph.recipient_id,
        customData.ig_graph_user_id,
        subscriberId.startsWith(GRAPH_SUBSCRIBER_PREFIX)
            ? subscriberId.slice(GRAPH_SUBSCRIBER_PREFIX.length)
            : '',
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
        console.warn('[send-instagram-graph-action] token lookup failed:', err.message);
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

async function loadThread(threadId) {
    if (!threadId) return null;
    const rows = await supabaseQuery(
        `ig_threads?select=id,subscriber_id,channel,custom_data&id=eq.${encodeURIComponent(threadId)}&limit=1`
    );
    return rows[0] || null;
}

async function loadMessage(messageId) {
    if (!messageId) return null;
    const rows = await supabaseQuery(
        `ig_messages?select=id,thread_id,direction,text,source,manychat_message_id&id=eq.${encodeURIComponent(messageId)}&limit=1`
    );
    return rows[0] || null;
}

async function loadAlert(alertId) {
    if (!alertId) return null;
    const rows = await supabaseQuery(
        `coach_alerts?select=id,alert_type,created_at,data&id=eq.${encodeURIComponent(alertId)}&limit=1`
    );
    return rows[0] || null;
}

async function postInstagramSenderAction({ accountId, recipientId, action, graphMessageId, reaction }) {
    const accessToken = await getInstagramGraphAccessToken();
    if (!accessToken) throw new Error('INSTAGRAM_GRAPH_ACCESS_TOKEN not configured');
    if (!recipientId) throw new Error('Instagram Graph recipient id missing');

    const body = {
        recipient: { id: recipientId },
        sender_action: action,
    };
    if (action === 'react') {
        body.payload = { message_id: graphMessageId, reaction };
    } else if (action === 'unreact') {
        body.payload = { message_id: graphMessageId };
    }

    const targetAccount = accountId || 'me';
    const url = `https://graph.instagram.com/${INSTAGRAM_GRAPH_API_VERSION}/${encodeURIComponent(targetAccount)}/messages`;
    const res = await fetch(url, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
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

async function patchThreadActionState({ thread, graphMessageId, localMessageId, action, reaction, adminUserId, nowIso }) {
    const customData = safeObject(thread.custom_data);
    const actionData = safeObject(customData.instagram_graph_actions);
    const messages = safeObject(actionData.messages);
    const nextActionData = {
        ...actionData,
        messages: { ...messages },
    };

    if (action === 'mark_seen') {
        nextActionData.last_mark_seen_at = nowIso;
        nextActionData.last_mark_seen_by = adminUserId;
    } else if (graphMessageId) {
        const current = safeObject(messages[graphMessageId]);
        nextActionData.messages[graphMessageId] = {
            ...current,
            local_message_id: localMessageId || current.local_message_id || null,
            reaction: action === 'react' ? reaction : null,
            reacted_at: action === 'react' ? nowIso : null,
            reacted_by: action === 'react' ? adminUserId : null,
            unreacted_at: action === 'unreact' ? nowIso : current.unreacted_at || null,
        };
    }

    const graph = safeObject(customData.instagram_graph);
    const nextCustomData = {
        ...customData,
        instagram_graph: {
            ...graph,
            last_action_at: nowIso,
            ...(action === 'mark_seen' ? { last_mark_seen_at: nowIso } : {}),
        },
        instagram_graph_actions: nextActionData,
    };

    await supabaseQuery(`ig_threads?id=eq.${encodeURIComponent(thread.id)}`, {
        method: 'PATCH',
        body: { custom_data: nextCustomData },
        prefer: 'return=minimal',
    });
    return nextCustomData;
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

    const action = String(body.action || '').trim().toLowerCase();
    if (!['react', 'unreact', 'mark_seen'].includes(action)) {
        return json(400, { error: 'Unsupported Instagram Graph action' });
    }

    let message = null;
    let alert = null;
    let threadId = String(body.threadId || body.igThreadId || '').trim();
    let graphMessageId = '';
    const alertId = String(body.alertId || body.coachAlertId || '').trim();

    if (!threadId && alertId) {
        alert = await loadAlert(alertId);
        if (!alert) return json(404, { error: 'DM alert not found' });
        threadId = String(safeObject(alert.data).ig_thread_id || safeObject(alert.data).thread_id || '').trim();
    }

    if (action !== 'mark_seen' && String(body.messageId || body.igMessageId || '').trim()) {
        message = await loadMessage(String(body.messageId || body.igMessageId || '').trim());
        if (!message) return json(404, { error: 'IG message not found' });
        if (message.direction !== 'in') {
            return json(400, { error: 'Can only react to inbound Instagram messages from the admin dashboard' });
        }
        threadId = message.thread_id;
        graphMessageId = graphMessageIdFromPrefixedId(message.manychat_message_id);
        if (!graphMessageId) {
            return json(409, { error: 'This message does not have a stored Instagram Graph message id' });
        }
    } else if (action !== 'mark_seen') {
        if (!alertId) return json(400, { error: 'Missing messageId or alertId for Instagram reaction' });
        alert = alert || await loadAlert(alertId);
        if (!alert) return json(404, { error: 'DM alert not found' });
        if (!DM_ALERT_TYPES.has(alert.alert_type)) {
            return json(409, { error: 'Can only react from DM alerts' });
        }
        const data = safeObject(alert.data);
        threadId = threadId || String(data.ig_thread_id || data.thread_id || '').trim();
        const graph = safeObject(data.instagram_graph);
        graphMessageId = graphMessageIdFromPrefixedId(data.manychat_message_id)
            || cleanGraphMessageId(data.ig_graph_message_id)
            || (isFreshAlertGraphFallback(alert, graph) ? cleanGraphMessageId(graph.last_graph_message_id) : '');
        if (!graphMessageId) {
            return json(409, { error: 'This DM alert does not have a stored Instagram Graph message id yet' });
        }
    }

    const thread = await loadThread(threadId);
    if (!thread) return json(404, { error: 'IG thread not found' });
    if (thread.channel !== 'instagram') {
        return json(409, { error: 'Graph sender actions are only available for Instagram threads' });
    }

    const recipientId = resolveThreadGraphRecipientId(thread);
    const accountId = resolveThreadGraphAccountId(thread);
    if (!recipientId) {
        return json(409, { error: 'This thread is not linked to an Instagram Graph recipient id yet' });
    }

    const reaction = String(body.reaction || 'love').trim() || 'love';
    let graphResponse;
    try {
        graphResponse = await postInstagramSenderAction({
            accountId,
            recipientId,
            action,
            graphMessageId,
            reaction,
        });
    } catch (err) {
        console.error('[send-instagram-graph-action] action failed:', err);
        return json(502, {
            error: 'Instagram Graph action failed',
            details: err.message || String(err),
        });
    }

    let customData = thread.custom_data || {};
    let statePersisted = true;
    try {
        customData = await patchThreadActionState({
            thread,
            graphMessageId,
            localMessageId: message?.id || null,
            action,
            reaction,
            adminUserId: admin.userId,
            nowIso: new Date().toISOString(),
        });
    } catch (err) {
        statePersisted = false;
        console.warn('[send-instagram-graph-action] action sent but state patch failed:', err.message || err);
    }

    return json(200, {
        ok: true,
        action,
        state_persisted: statePersisted,
        reaction: action === 'react' ? reaction : null,
        graph_message_id: graphMessageId || null,
        thread_id: thread.id,
        graph_response: graphResponse,
        custom_data: customData,
    });
};

exports._test = {
    cleanGraphMessageId,
    resolveThreadGraphRecipientId,
    resolveThreadGraphAccountId,
};
