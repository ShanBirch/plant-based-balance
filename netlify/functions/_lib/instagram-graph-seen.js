const {
    SUPABASE_URL,
    SUPABASE_SERVICE_KEY,
    supabaseQuery,
} = require('./client-context');
const {
    resolveMetaIgAccessToken,
} = require('./meta-ig-accounts');

const GRAPH_SUBSCRIBER_PREFIX = 'ig_graph:';
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

async function getInstagramGraphAccessToken({ accountId = '', loggerPrefix = 'instagram-graph-seen' } = {}) {
    const resolved = await resolveMetaIgAccessToken(accountId, supabaseQuery);
    if (resolved.token) return resolved.token;
    if (cachedInstagramGraphAccessToken) return cachedInstagramGraphAccessToken;
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return '';
    try {
        const rows = await supabaseQuery(
            'app_private_secrets?select=value&key=eq.instagram_graph_access_token&limit=1'
        );
        const token = String(rows?.[0]?.value || '').trim();
        if (token) cachedInstagramGraphAccessToken = token;
    } catch (err) {
        console.warn(`[${loggerPrefix}] Instagram Graph token lookup failed:`, err.message || err);
    }
    return cachedInstagramGraphAccessToken;
}

async function loadThread(threadId) {
    if (!threadId) return null;
    const rows = await supabaseQuery(
        `ig_threads?select=id,subscriber_id,channel,custom_data&id=eq.${encodeURIComponent(threadId)}&limit=1`
    );
    return rows[0] || null;
}

async function postInstagramGraphSeenReceipt({ recipientId, accountId, loggerPrefix }) {
    const accessToken = await getInstagramGraphAccessToken({ accountId, loggerPrefix });
    if (!accessToken) throw new Error('INSTAGRAM_GRAPH_ACCESS_TOKEN not configured');
    if (!recipientId) throw new Error('Instagram Graph recipient id missing');

    const targetAccount = accountId || 'me';
    const url = `https://graph.instagram.com/${INSTAGRAM_GRAPH_API_VERSION}/${encodeURIComponent(targetAccount)}/messages`;
    const res = await fetch(url, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            recipient: { id: recipientId },
            sender_action: 'mark_seen',
        }),
    });
    const responseText = await res.text();
    let parsed;
    try { parsed = responseText ? JSON.parse(responseText) : {}; } catch { parsed = { raw: responseText }; }
    if (!res.ok) {
        const detail = parsed?.error?.message || responseText;
        throw new Error(`Instagram Graph seen receipt ${res.status}: ${String(detail || '').slice(0, 400)}`);
    }
    return parsed;
}

async function patchThreadSeenState({ thread, actorId, source, nowIso }) {
    const customData = safeObject(thread.custom_data);
    const graph = safeObject(customData.instagram_graph);
    const actionData = safeObject(customData.instagram_graph_actions);
    const nextCustomData = {
        ...customData,
        instagram_graph: {
            ...graph,
            last_action_at: nowIso,
            last_mark_seen_at: nowIso,
        },
        instagram_graph_actions: {
            ...actionData,
            last_mark_seen_at: nowIso,
            last_mark_seen_by: actorId || actionData.last_mark_seen_by || 'system',
            last_mark_seen_source: source || actionData.last_mark_seen_source || 'outbound_reply',
        },
    };

    await supabaseQuery(`ig_threads?id=eq.${encodeURIComponent(thread.id)}`, {
        method: 'PATCH',
        body: { custom_data: nextCustomData },
        prefer: 'return=minimal',
    });
    return nextCustomData;
}

async function sendInstagramSeenReceiptForThread({
    threadId,
    thread: providedThread,
    actorId,
    source,
    sentAtIso,
    loggerPrefix = 'instagram-graph-seen',
} = {}) {
    let thread = providedThread || null;
    if (!thread) {
        try {
            thread = await loadThread(threadId);
        } catch (err) {
            console.warn(`[${loggerPrefix}] Instagram seen receipt thread lookup failed:`, err.message || err);
            return { attempted: false, ok: false, reason: 'thread_lookup_failed', error: err.message || String(err) };
        }
    }

    if (!thread) return { attempted: false, ok: false, reason: 'thread_missing' };
    if (thread.channel !== 'instagram') return { attempted: false, ok: false, reason: 'not_instagram' };

    const recipientId = resolveThreadGraphRecipientId(thread);
    if (!recipientId) return { attempted: false, ok: false, reason: 'graph_recipient_missing' };

    const accountId = resolveThreadGraphAccountId(thread);
    const nowIso = sentAtIso || new Date().toISOString();
    try {
        await postInstagramGraphSeenReceipt({ recipientId, accountId, loggerPrefix });
        const result = {
            attempted: true,
            ok: true,
            sent_at: nowIso,
            recipient_id: recipientId,
            account_id: accountId || null,
            state_persisted: true,
        };
        try {
            await patchThreadSeenState({ thread, actorId, source, nowIso });
        } catch (err) {
            result.state_persisted = false;
            result.state_error = err.message || String(err);
            console.warn(`[${loggerPrefix}] Instagram seen receipt state patch failed:`, result.state_error);
        }
        return result;
    } catch (err) {
        console.warn(`[${loggerPrefix}] Instagram seen receipt failed:`, err.message || err);
        return {
            attempted: true,
            ok: false,
            error: err.message || String(err),
            recipient_id: recipientId,
            account_id: accountId || null,
        };
    }
}

module.exports = {
    sendInstagramSeenReceiptForThread,
    _test: {
        firstString,
        normalizeGraphApiVersion,
        resolveThreadGraphRecipientId,
        resolveThreadGraphAccountId,
        safeObject,
    },
};
