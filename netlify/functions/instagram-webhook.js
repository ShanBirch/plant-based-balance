/**
 * instagram-webhook
 *
 * Direct Meta/Instagram Graph webhook receiver. This sits beside ManyChat:
 * ManyChat can keep handling automation, while this endpoint gives Balance a
 * first-party audit trail for DMs, story replies, comments, mentions, and
 * related IG events that ManyChat may miss or flatten.
 */

const crypto = require('crypto');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const VERIFY_TOKEN = process.env.META_WEBHOOK_VERIFY_TOKEN
    || process.env.IG_GRAPH_WEBHOOK_VERIFY_TOKEN
    || process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN;
const APP_SECRET = process.env.META_APP_SECRET
    || process.env.META_IG_APP_SECRET
    || process.env.INSTAGRAM_APP_SECRET;

const SAFE_AUDIT_HEADERS = [
    'content-type',
    'user-agent',
    'x-forwarded-for',
    'x-nf-client-connection-ip',
];

function json(statusCode, body) {
    return {
        statusCode,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    };
}

function getHeader(headers = {}, name) {
    return headers[name] || headers[name.toLowerCase()] || headers[name.toUpperCase()] || '';
}

function safeAuditHeaders(headers = {}) {
    const out = {};
    SAFE_AUDIT_HEADERS.forEach(name => {
        const value = getHeader(headers, name);
        if (value) out[name] = String(value).slice(0, 500);
    });
    out.has_x_hub_signature_256 = !!getHeader(headers, 'x-hub-signature-256');
    return out;
}

function decodeBody(event) {
    const raw = event.body || '';
    if (!event.isBase64Encoded) return raw;
    return Buffer.from(raw, 'base64').toString('utf8');
}

function timingSafeEqualHex(left, right) {
    if (!left || !right || left.length !== right.length) return false;
    try {
        return crypto.timingSafeEqual(Buffer.from(left, 'hex'), Buffer.from(right, 'hex'));
    } catch {
        return false;
    }
}

function validateSignature({ rawBody, headers }) {
    const signature = String(getHeader(headers, 'x-hub-signature-256') || '').trim();
    if (!APP_SECRET) return { configured: false, valid: null };
    if (!signature.startsWith('sha256=')) return { configured: true, valid: false };
    const expected = crypto
        .createHmac('sha256', APP_SECRET)
        .update(rawBody || '', 'utf8')
        .digest('hex');
    const received = signature.slice('sha256='.length);
    return { configured: true, valid: timingSafeEqualHex(expected, received) };
}

async function supabase(path, options = {}) {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
        throw new Error('SUPABASE_URL / SUPABASE_SERVICE_KEY not configured');
    }
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
        method: options.method || 'GET',
        headers: {
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': options.prefer || 'return=representation',
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Supabase ${options.method || 'GET'} ${path} -> ${res.status} ${text.slice(0, 500)}`);
    }
    const text = await res.text();
    if (!text || !text.trim()) return [];
    try { return JSON.parse(text); } catch { return []; }
}

function eventTypeForMessaging(messaging = {}) {
    if (messaging.message) return 'message';
    if (messaging.postback) return 'messaging_postbacks';
    if (messaging.reaction || messaging.message_reactions) return 'message_reactions';
    if (messaging.read) return 'messaging_seen';
    if (messaging.referral) return 'messaging_referral';
    if (messaging.delivery) return 'message_delivery';
    return 'messaging';
}

function fieldForMessaging(messaging = {}) {
    if (messaging.message) return 'messages';
    if (messaging.postback) return 'messaging_postbacks';
    if (messaging.reaction || messaging.message_reactions) return 'message_reactions';
    if (messaging.read) return 'messaging_seen';
    if (messaging.referral) return 'messaging_referral';
    return 'messages';
}

function extractMessageId(messaging = {}) {
    return messaging.message?.mid
        || messaging.reaction?.mid
        || messaging.message_reactions?.mid
        || messaging.postback?.mid
        || null;
}

function rowsFromPayload(payload, { rawBody, headers, signatureValid }) {
    const objectType = payload?.object ? String(payload.object).slice(0, 80) : null;
    const common = {
        http_method: 'POST',
        status: 'received',
        object_type: objectType,
        signature_valid: signatureValid,
        raw_body: rawBody || '',
        raw_payload: payload || {},
        safe_headers: safeAuditHeaders(headers),
    };
    const rows = [];
    const entries = Array.isArray(payload?.entry) ? payload.entry : [];

    entries.forEach(entry => {
        const igAccountId = entry?.id ? String(entry.id) : null;
        const messagingItems = Array.isArray(entry?.messaging) ? entry.messaging : [];
        messagingItems.forEach(item => {
            rows.push({
                ...common,
                event_type: eventTypeForMessaging(item),
                field: fieldForMessaging(item),
                ig_account_id: igAccountId,
                sender_id: item?.sender?.id ? String(item.sender.id) : null,
                recipient_id: item?.recipient?.id ? String(item.recipient.id) : null,
                message_id: extractMessageId(item),
                event_payload: item || {},
                processed_at: new Date().toISOString(),
            });
        });

        const changes = Array.isArray(entry?.changes) ? entry.changes : [];
        changes.forEach(change => {
            const value = change?.value || {};
            rows.push({
                ...common,
                event_type: change?.field ? String(change.field).slice(0, 120) : 'change',
                field: change?.field ? String(change.field).slice(0, 120) : null,
                ig_account_id: igAccountId,
                sender_id: value?.from?.id ? String(value.from.id) : null,
                recipient_id: null,
                message_id: value?.message_id ? String(value.message_id) : null,
                comment_id: value?.comment_id || value?.id ? String(value.comment_id || value.id) : null,
                media_id: value?.media_id || value?.media?.id ? String(value.media_id || value.media.id) : null,
                event_payload: change || {},
                processed_at: new Date().toISOString(),
            });
        });
    });

    if (!rows.length) {
        rows.push({
            ...common,
            event_type: 'unclassified',
            event_payload: payload || {},
            processed_at: new Date().toISOString(),
        });
    }
    return rows;
}

async function auditPayload(payload, options) {
    const rows = rowsFromPayload(payload, options);
    return supabase('ig_graph_webhook_events', {
        method: 'POST',
        body: rows,
        prefer: 'return=minimal',
    });
}

exports.handler = async (event) => {
    if (event.httpMethod === 'GET') {
        const params = event.queryStringParameters || {};
        const mode = params['hub.mode'];
        const token = params['hub.verify_token'];
        const challenge = params['hub.challenge'];

        if (mode === 'subscribe' && VERIFY_TOKEN && token === VERIFY_TOKEN) {
            return {
                statusCode: 200,
                headers: { 'Content-Type': 'text/plain' },
                body: String(challenge || ''),
            };
        }
        return json(403, { error: 'Webhook verification failed' });
    }

    if (event.httpMethod !== 'POST') {
        return json(405, { error: 'Method not allowed' });
    }

    const rawBody = decodeBody(event);
    const signature = validateSignature({ rawBody, headers: event.headers || {} });
    if (signature.configured && !signature.valid) {
        return json(403, { error: 'Invalid webhook signature' });
    }

    let payload;
    try {
        payload = JSON.parse(rawBody || '{}');
    } catch (err) {
        console.error('[instagram-webhook] invalid JSON:', err.message);
        return json(400, { error: 'Invalid JSON' });
    }

    try {
        await auditPayload(payload, {
            rawBody,
            headers: event.headers || {},
            signatureValid: signature.valid,
        });
    } catch (err) {
        // Still acknowledge Meta so webhook retries do not spam while we fix DB.
        console.warn('[instagram-webhook] audit insert failed:', err.message);
    }

    return json(200, { ok: true });
};
