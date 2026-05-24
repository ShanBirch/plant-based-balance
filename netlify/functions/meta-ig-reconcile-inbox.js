/**
 * meta-ig-reconcile-inbox
 *
 * Scheduled Graph inbox recovery for Instagram DMs. This replaces the old
 * ManyChat reconcile backstop by polling recent Instagram Graph conversations
 * and replaying any missed messages through the existing Graph ingestion path.
 */

const {
    SUPABASE_URL,
    SUPABASE_SERVICE_KEY,
    supabaseQuery,
} = require('./_lib/client-context');
const {
    getMetaIgAccountMap,
    resolveMetaIgAccountConfig,
    resolveMetaIgAccessToken,
} = require('./_lib/meta-ig-accounts');
const {
    _internal: instagramWebhookInternal,
} = require('./instagram-webhook');

const GRAPH_BASE = (process.env.META_IG_GRAPH_BASE
    || process.env.INSTAGRAM_GRAPH_BASE
    || 'https://graph.instagram.com').replace(/\/+$/, '');
const API_VERSION = normalizeGraphApiVersion(
    process.env.META_IG_API_VERSION
    || process.env.IG_GRAPH_API_VERSION
    || process.env.INSTAGRAM_GRAPH_API_VERSION
    || process.env.META_GRAPH_API_VERSION
    || 'v25.0'
);
const SYNC_SECRET = process.env.META_IG_SYNC_SECRET
    || process.env.META_IG_WEBHOOK_VERIFY_TOKEN
    || process.env.META_WEBHOOK_VERIFY_TOKEN
    || '';
const LOOKBACK_HOURS = readInt(process.env.META_IG_RECONCILE_LOOKBACK_HOURS, 48, 1, 168);
const CONVERSATION_LIMIT = readInt(process.env.META_IG_RECONCILE_CONVERSATION_LIMIT, 4, 1, 50);
const MESSAGE_LIMIT = readInt(process.env.META_IG_RECONCILE_MESSAGE_LIMIT, 3, 1, 25);
const MAX_MESSAGES_PER_RUN = readInt(process.env.META_IG_RECONCILE_MAX_MESSAGES, 12, 1, 200);
const MAX_PAGES = readInt(process.env.META_IG_RECONCILE_MAX_PAGES, 1, 1, 6);
const MAX_RUNTIME_MS = readInt(process.env.META_IG_RECONCILE_MAX_RUNTIME_MS, 24000, 5000, 55000);

function json(statusCode, body) {
    return {
        statusCode,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    };
}

function readInt(value, fallback, min, max) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(min, Math.min(max, Math.floor(n)));
}

function normalizeGraphApiVersion(value) {
    const raw = String(value || '').trim();
    if (!raw) return 'v25.0';
    return raw.startsWith('v') ? raw : `v${raw}`;
}

function cleanId(value) {
    const raw = String(value || '').trim();
    return raw && !/\{\{[^}]+\}\}/.test(raw) ? raw : '';
}

function parseJsonBody(event = {}) {
    if (!event.body) return {};
    try {
        return JSON.parse(event.body);
    } catch {
        return {};
    }
}

function boolish(value) {
    return ['1', 'true', 'yes', 'on'].includes(String(value || '').trim().toLowerCase());
}

function getHeader(headers = {}, name) {
    const lower = String(name || '').toLowerCase();
    const key = Object.keys(headers || {}).find(k => k.toLowerCase() === lower);
    return key ? headers[key] : '';
}

function isAuthorized(event = {}, body = {}) {
    if (body.next_run) return true;
    if (!SYNC_SECRET) return process.env.CONTEXT === 'dev';
    const provided = String(
        getHeader(event.headers, 'x-meta-ig-sync-secret')
        || getHeader(event.headers, 'x-meta-ig-reconcile-secret')
        || event.queryStringParameters?.secret
        || body.secret
        || ''
    ).trim();
    return provided && provided === SYNC_SECRET;
}

function configuredAccounts() {
    const accounts = new Map();
    Object.values(getMetaIgAccountMap() || {}).forEach(account => {
        if (account?.ownerId) accounts.set(account.ownerId, account);
    });
    [
        process.env.META_IG_USER_ID,
        process.env.INSTAGRAM_GRAPH_ACCOUNT_ID,
        process.env.IG_GRAPH_BUSINESS_ACCOUNT_ID,
        process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID,
    ].forEach(ownerId => {
        const clean = cleanId(ownerId);
        if (clean && !accounts.has(clean)) {
            accounts.set(clean, resolveMetaIgAccountConfig(clean));
        }
    });
    return [...accounts.values()].filter(account => cleanId(account.ownerId));
}

function normalizeEdgeRows(value) {
    if (Array.isArray(value)) return value;
    if (Array.isArray(value?.data)) return value.data;
    return [];
}

async function graphGet(path, params, token) {
    const url = new URL(`${GRAPH_BASE}/${API_VERSION}/${String(path).replace(/^\/+/, '')}`);
    Object.entries(params || {}).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
            url.searchParams.set(key, value);
        }
    });
    url.searchParams.set('access_token', token);
    const response = await fetch(url.toString());
    const text = await response.text();
    let parsed = null;
    try {
        parsed = text ? JSON.parse(text) : null;
    } catch {
        parsed = { raw: text };
    }
    if (!response.ok) {
        const detail = parsed?.error?.message || text || `HTTP ${response.status}`;
        throw new Error(`Graph ${response.status}: ${String(detail).slice(0, 300)}`);
    }
    return parsed;
}

async function fetchConversationPages({ accountId, token, limit, maxPages }) {
    const conversations = [];
    let after = '';
    for (let page = 0; page < maxPages; page += 1) {
        const data = await graphGet(`${accountId}/conversations`, {
            platform: 'instagram',
            fields: 'id,updated_time,participants',
            limit,
            after,
        }, token);
        const rows = normalizeEdgeRows(data);
        conversations.push(...rows);
        after = data?.paging?.cursors?.after || '';
        if (!after || !rows.length) break;
    }
    return conversations;
}

async function fetchConversationMessages({ conversationId, token, limit }) {
    try {
        const detail = await graphGet(conversationId, {
            fields: `id,updated_time,participants,messages.limit(${limit}){id,created_time,from,to,message,attachments}`,
        }, token);
        return normalizeEdgeRows(detail?.messages);
    } catch (err) {
        console.warn('[meta-ig-reconcile-inbox] nested messages lookup failed, retrying edge:', err.message);
    }
    const edge = await graphGet(`${conversationId}/messages`, {
        fields: 'id,created_time,from,to,message,attachments',
        limit,
    }, token);
    return normalizeEdgeRows(edge);
}

function timestampMs(value) {
    const parsed = Date.parse(value || '');
    return Number.isFinite(parsed) ? parsed : Date.now();
}

function personId(value) {
    if (!value) return '';
    if (typeof value === 'string') return cleanId(value);
    return cleanId(value.id || value.igid || value.ig_id);
}

function personUsername(value) {
    if (!value || typeof value !== 'object') return null;
    const raw = String(value.username || value.name || value.ig_username || '').replace(/^@+/, '').trim();
    return raw || null;
}

function toPeople(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    if (Array.isArray(value.data)) return value.data;
    return [value];
}

function firstRecipientId(message = {}, accountId = '') {
    const recipients = toPeople(message.to);
    const nonOwner = recipients.map(personId).find(id => id && id !== accountId);
    return nonOwner || recipients.map(personId).find(Boolean) || accountId;
}

function firstRecipient(message = {}, accountId = '') {
    const recipients = toPeople(message.to);
    return recipients.find(item => personId(item) && personId(item) !== accountId)
        || recipients.find(item => personId(item))
        || { id: accountId };
}

function attachmentUrl(attachment = {}) {
    const payload = attachment.payload || {};
    const candidates = [
        payload.url,
        payload.media_url,
        payload.attachment_url,
        attachment.url,
        attachment.media_url,
        attachment.image_data?.url,
        attachment.video_data?.url,
        attachment.audio_data?.url,
        attachment.file_url,
    ];
    return String(candidates.find(Boolean) || '').trim();
}

function normalizeAttachment(attachment = {}) {
    const type = String(
        attachment.type
        || attachment.mime_type
        || (attachment.image_data ? 'image' : '')
        || (attachment.video_data ? 'video' : '')
        || (attachment.audio_data ? 'audio' : '')
        || 'attachment'
    ).toLowerCase();
    const url = attachmentUrl(attachment);
    return {
        type,
        payload: {
            ...(attachment.payload || {}),
            ...(url ? { url } : {}),
        },
    };
}

function graphMessageToMessagingItem({ accountId, message }) {
    const graphMessageId = cleanId(message.id || message.mid);
    const fromId = personId(message.from);
    const recipient = firstRecipient(message, accountId);
    const recipientId = personId(recipient) || firstRecipientId(message, accountId);
    if (!graphMessageId || !fromId) return null;
    const outbound = fromId === accountId;
    const attachments = normalizeEdgeRows(message.attachments).map(normalizeAttachment);
    const sender = {
        id: fromId,
        ...(personUsername(message.from) ? { username: personUsername(message.from) } : {}),
    };
    const recipientPayload = {
        id: outbound ? recipientId : accountId,
        ...(outbound && personUsername(recipient) ? { username: personUsername(recipient) } : {}),
    };
    return {
        sender,
        recipient: recipientPayload,
        timestamp: timestampMs(message.created_time),
        message: {
            mid: graphMessageId,
            text: String(message.message || message.text || '').trim(),
            ...(attachments.length ? { attachments } : {}),
            ...(outbound ? { is_echo: true } : {}),
        },
    };
}

function buildWebhookPayloadFromMessages({ accountId, messages }) {
    const messaging = messages
        .map(message => graphMessageToMessagingItem({ accountId, message }))
        .filter(Boolean)
        .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    return {
        object: 'instagram',
        entry: messaging.length ? [{ id: accountId, messaging }] : [],
    };
}

function messageIsRecent(message, cutoffMs) {
    const created = timestampMs(message.created_time);
    return created >= cutoffMs;
}

async function reconcileAccount({ account, body, startedAt }) {
    const accountId = cleanId(account.ownerId);
    const lookbackHours = readInt(body.lookback_hours ?? body.lookbackHours, LOOKBACK_HOURS, 1, 168);
    const conversationLimit = readInt(body.conversation_limit ?? body.conversationLimit, CONVERSATION_LIMIT, 1, 50);
    const messageLimit = readInt(body.message_limit ?? body.messageLimit, MESSAGE_LIMIT, 1, 25);
    const maxPages = readInt(body.max_pages ?? body.maxPages, MAX_PAGES, 1, 6);
    const maxMessages = readInt(body.max_messages ?? body.maxMessages, MAX_MESSAGES_PER_RUN, 1, 200);
    const cutoffMs = Date.now() - lookbackHours * 60 * 60 * 1000;
    const dryRun = boolish(body.dry_run ?? body.dryRun);
    const { token } = await resolveMetaIgAccessToken(accountId, supabaseQuery);
    const summary = {
        account_id: accountId,
        bot_account: account.botAccount || null,
        conversations_scanned: 0,
        messages_seen: 0,
        messages_replayed: 0,
        graph: { processed: 0, inserted: 0, drafted: 0, skipped: 0, outboundCleared: 0 },
        dry_run: dryRun,
        error: null,
    };
    if (!token) {
        summary.error = 'instagram_graph_token_missing';
        return summary;
    }

    const conversations = await fetchConversationPages({
        accountId,
        token,
        limit: conversationLimit,
        maxPages,
    });
    const replayMessages = [];
    for (const conversation of conversations) {
        if (Date.now() - startedAt > MAX_RUNTIME_MS) break;
        if (conversation.updated_time && timestampMs(conversation.updated_time) < cutoffMs) continue;
        summary.conversations_scanned += 1;
        const messages = await fetchConversationMessages({
            conversationId: conversation.id,
            token,
            limit: messageLimit,
        });
        const recent = messages.filter(message => messageIsRecent(message, cutoffMs));
        summary.messages_seen += recent.length;
        for (const message of recent) {
            replayMessages.push(message);
            if (replayMessages.length >= maxMessages) break;
        }
        if (replayMessages.length >= maxMessages) break;
    }

    const payload = buildWebhookPayloadFromMessages({
        accountId,
        messages: replayMessages,
    });
    summary.messages_replayed = payload.entry[0]?.messaging?.length || 0;
    if (!summary.messages_replayed || dryRun) return summary;

    const graph = await instagramWebhookInternal.processGraphMessages(payload, new Map());
    summary.graph = {
        processed: graph.processed || 0,
        inserted: graph.inserted || 0,
        drafted: graph.drafted || 0,
        skipped: graph.skipped || 0,
        outboundCleared: graph.outboundCleared || 0,
    };
    return summary;
}

async function reconcile(body = {}) {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
        return { ok: false, error: 'supabase_env_missing', accounts: [] };
    }
    if (!instagramWebhookInternal?.processGraphMessages) {
        return { ok: false, error: 'instagram_webhook_processor_missing', accounts: [] };
    }
    const startedAt = Date.now();
    const accounts = configuredAccounts();
    const summaries = [];
    for (const account of accounts) {
        if (Date.now() - startedAt > MAX_RUNTIME_MS) break;
        try {
            summaries.push(await reconcileAccount({ account, body, startedAt }));
        } catch (err) {
            summaries.push({
                account_id: account.ownerId || null,
                bot_account: account.botAccount || null,
                error: err.message,
            });
        }
    }
    return {
        ok: true,
        accounts: summaries,
        totals: summaries.reduce((acc, row) => {
            acc.conversations_scanned += row.conversations_scanned || 0;
            acc.messages_seen += row.messages_seen || 0;
            acc.messages_replayed += row.messages_replayed || 0;
            acc.inserted += row.graph?.inserted || 0;
            acc.drafted += row.graph?.drafted || 0;
            acc.skipped += row.graph?.skipped || 0;
            acc.outboundCleared += row.graph?.outboundCleared || 0;
            return acc;
        }, {
            conversations_scanned: 0,
            messages_seen: 0,
            messages_replayed: 0,
            inserted: 0,
            drafted: 0,
            skipped: 0,
            outboundCleared: 0,
        }),
    };
}

exports.handler = async (event = {}) => {
    const body = parseJsonBody(event);
    if (!isAuthorized(event, body)) {
        return json(403, { error: 'Unauthorized' });
    }
    const result = await reconcile(body);
    return json(result.ok ? 200 : 500, result);
};

exports._test = {
    configuredAccounts,
    normalizeEdgeRows,
    graphMessageToMessagingItem,
    buildWebhookPayloadFromMessages,
    normalizeAttachment,
    messageIsRecent,
};
