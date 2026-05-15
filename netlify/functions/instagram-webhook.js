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
const SITE_URL = process.env.URL || 'https://plantbased-balance.org';
const DRAFT_DISPATCH_TIMEOUT_MS = 1200;
const GRAPH_SUBSCRIBER_PREFIX = 'ig_graph:';

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

function truncate(value, max = 500) {
    const s = String(value || '');
    return s.length > max ? s.slice(0, max - 1) + '...' : s;
}

function safeObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function cleanText(value) {
    if (value == null) return '';
    if (Array.isArray(value)) return value.map(cleanText).filter(Boolean).join('\n\n');
    if (typeof value === 'object') {
        return [
            value.text,
            value.message,
            value.body,
            value.caption,
            value.title,
        ].map(cleanText).filter(Boolean).join('\n\n');
    }
    return String(value).trim();
}

function normalizeId(value) {
    const s = String(value || '').trim();
    return s && !/\{\{[^}]+\}\}/.test(s) ? s : '';
}

function cleanUrl(value) {
    const url = String(value || '').trim().replace(/[)\].,!?]+$/g, '');
    return /^https?:\/\//i.test(url) ? url : '';
}

function extractMessageId(messaging = {}) {
    return messaging.message?.mid
        || messaging.reaction?.mid
        || messaging.message_reactions?.mid
        || messaging.postback?.mid
        || null;
}

function messagingEventsFromPayload(payload) {
    const entries = Array.isArray(payload?.entry) ? payload.entry : [];
    const events = [];

    entries.forEach(entry => {
        const igAccountId = normalizeId(entry?.id);
        const messagingItems = Array.isArray(entry?.messaging) ? entry.messaging : [];
        messagingItems.forEach(item => {
            events.push({
                field: fieldForMessaging(item),
                eventType: eventTypeForMessaging(item),
                igAccountId,
                item: item || {},
                value: item || {},
            });
        });

        const changes = Array.isArray(entry?.changes) ? entry.changes : [];
        changes.forEach(change => {
            const value = safeObject(change?.value);
            const field = change?.field ? String(change.field) : fieldForMessaging(value);
            if (![
                'messages',
                'message_echoes',
                'message_reactions',
                'messaging_seen',
                'messaging_postbacks',
                'messaging_referral',
            ].includes(field) && !value.message) {
                return;
            }
            events.push({
                field,
                eventType: field,
                igAccountId,
                item: value,
                value,
            });
        });
    });

    return events;
}

function senderFromMessaging(event) {
    return safeObject(event?.item?.sender || event?.value?.sender || event?.value?.from);
}

function recipientFromMessaging(event) {
    return safeObject(event?.item?.recipient || event?.value?.recipient || event?.value?.to);
}

function messageFromMessaging(event) {
    const nested = safeObject(event?.item?.message || event?.value?.message);
    if (Object.keys(nested).length) return nested;
    const value = safeObject(event?.value);
    if (value.text || value.mid || value.attachments || value.reply_to || value.sticker_id) return value;
    return {};
}

function messageIdFromMessaging(event) {
    const message = messageFromMessaging(event);
    return normalizeId(message.mid || message.id || event?.value?.message_id || extractMessageId(event?.item));
}

function directionForMessaging(event) {
    const message = messageFromMessaging(event);
    const senderId = normalizeId(senderFromMessaging(event).id);
    const recipientId = normalizeId(recipientFromMessaging(event).id);
    const igAccountId = normalizeId(event?.igAccountId);
    if (message.is_echo || message.is_self || event?.field === 'message_echoes') return 'out';
    if (igAccountId && senderId && senderId === igAccountId) return 'out';
    if (igAccountId && recipientId && recipientId === igAccountId) return 'in';
    return 'in';
}

function participantIdForMessaging(event, direction) {
    const senderId = normalizeId(senderFromMessaging(event).id);
    const recipientId = normalizeId(recipientFromMessaging(event).id);
    return direction === 'out' ? recipientId : senderId;
}

function markerForAttachment(type, url) {
    const lower = String(type || '').toLowerCase();
    if (!url) {
        if (lower.includes('audio')) return '[voice note]';
        if (lower.includes('video')) return '[video]';
        if (lower.includes('image') || lower.includes('photo')) return '[photo]';
        if (lower.includes('story')) return '[story mention]';
        return lower ? `[${lower.replace(/_/g, ' ')}]` : '[attachment]';
    }
    if (lower.includes('audio')) return `[AUDIO:${url}]`;
    if (lower.includes('video')) return `[VIDEO:${url}]`;
    if (lower.includes('image') || lower.includes('photo') || lower.includes('story')) return `[PHOTO:${url}]`;
    return `[attachment:${url}]`;
}

function attachmentText(attachment) {
    const payload = safeObject(attachment?.payload);
    const type = String(attachment?.type || payload.type || 'attachment').toLowerCase();
    const url = cleanUrl(payload.url || payload.media_url || payload.attachment_url || attachment?.url);
    if (type === 'story_mention') {
        return url ? `mentioned you in a story ${markerForAttachment('story', url)}` : 'mentioned you in a story';
    }
    if (type === 'share') {
        const postId = payload.ig_post_media_id || payload.media_id || payload.id;
        const shareUrl = cleanUrl(payload.url || payload.link);
        return [postId ? `shared an Instagram post (${postId})` : 'shared an Instagram post', shareUrl || '']
            .filter(Boolean)
            .join(' ');
    }
    return markerForAttachment(type, url);
}

function messageTextForDraft(event) {
    const message = messageFromMessaging(event);
    const parts = [];
    const replyStory = safeObject(message.reply_to?.story);
    const storyUrl = cleanUrl(replyStory.url || replyStory.media_url);

    if (Object.keys(replyStory).length) {
        parts.push(storyUrl ? `replied to your story ${markerForAttachment('story', storyUrl)}` : 'replied to your story');
    }

    const text = cleanText(message.text || message.caption);
    if (text) parts.push(text);

    const quickReply = cleanText(message.quick_reply?.payload || message.quick_reply?.text);
    if (quickReply) parts.push(`quick reply: ${quickReply}`);

    const attachments = Array.isArray(message.attachments) ? message.attachments : [];
    attachments.map(attachmentText).filter(Boolean).forEach(part => parts.push(part));

    if (!parts.length && message.sticker_id) parts.push('[sticker]');
    return parts.join(' ').replace(/\s+/g, ' ').trim();
}

async function findDefaultCoachId() {
    try {
        const rows = await supabase('admin_users?select=user_id&order=created_at.asc&limit=1');
        return rows[0]?.user_id || null;
    } catch (err) {
        console.warn('[instagram-webhook] admin lookup failed:', err.message);
        return null;
    }
}

async function upsertGraphThread({ participantId, igAccountId, direction, nowIso, messageId, defaultCoachId }) {
    const subscriberId = `${GRAPH_SUBSCRIBER_PREFIX}${participantId}`;
    const selectColumns = 'id,subscriber_id,coach_id,channel,profile_name,ig_username,lead_stage,linked_user_id,custom_data,auto_send_enabled';
    const existing = await supabase(
        `ig_threads?select=${selectColumns}&subscriber_id=eq.${encodeURIComponent(subscriberId)}&channel=eq.instagram&limit=1`
    );
    const current = existing[0] || null;
    const priorCustomData = safeObject(current?.custom_data);
    const graphData = {
        ...(safeObject(priorCustomData.instagram_graph)),
        source: 'instagram_graph',
        ig_graph_user_id: participantId,
        ig_account_id: igAccountId || null,
        last_graph_message_id: messageId || null,
        last_graph_seen_at: nowIso,
        manual_ig_required: true,
    };
    const customData = {
        ...priorCustomData,
        source: priorCustomData.source || 'instagram_graph',
        manual_ig_required: true,
        instagram_graph: graphData,
    };

    if (current) {
        const patch = {
            custom_data: customData,
            updated_at: nowIso,
        };
        if (direction === 'out') patch.last_outbound_at = nowIso;
        else patch.last_inbound_at = nowIso;
        if (!current.coach_id && defaultCoachId) patch.coach_id = defaultCoachId;
        if (!current.profile_name) patch.profile_name = `IG user ${participantId.slice(-6)}`;
        await supabase(`ig_threads?id=eq.${encodeURIComponent(current.id)}`, {
            method: 'PATCH',
            body: patch,
            prefer: 'return=minimal',
        });
        return {
            ...current,
            ...patch,
            coach_id: current.coach_id || defaultCoachId || null,
        };
    }

    const inserted = await supabase('ig_threads', {
        method: 'POST',
        body: [{
            subscriber_id: subscriberId,
            coach_id: defaultCoachId || null,
            channel: 'instagram',
            profile_name: `IG user ${participantId.slice(-6)}`,
            custom_data: customData,
            last_inbound_at: direction === 'in' ? nowIso : null,
            last_outbound_at: direction === 'out' ? nowIso : null,
            lead_stage: 'new',
        }],
        prefer: 'return=representation',
    });
    return inserted[0];
}

async function insertGraphMessage({ threadId, direction, text, graphMessageId }) {
    const dedupeId = graphMessageId
        ? `${GRAPH_SUBSCRIBER_PREFIX}${graphMessageId}`
        : `${GRAPH_SUBSCRIBER_PREFIX}${threadId}:${Date.now()}`;
    try {
        const rows = await supabase('ig_messages', {
            method: 'POST',
            body: [{
                thread_id: threadId,
                direction,
                text,
                manychat_message_id: dedupeId,
                source: 'instagram_graph',
            }],
            prefer: 'return=representation',
        });
        return { inserted: true, deduped: false, messageId: rows[0]?.id || null, dedupeId };
    } catch (err) {
        const duplicate = err.sqlstate === '23505' || /23505|duplicate key/i.test(err.message || '');
        if (duplicate) return { inserted: false, deduped: true, dedupeId };
        throw err;
    }
}

async function dispatchDraft({ thread, messageText, dedupeId }) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DRAFT_DISPATCH_TIMEOUT_MS);
    try {
        await fetch(`${SITE_URL}/.netlify/functions/ig-instant-draft-background`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify({
                threadId: thread.id,
                subscriberId: thread.subscriber_id,
                channel: 'instagram',
                messageText,
                manychatMessageId: dedupeId,
                igUsername: thread.ig_username || null,
                profileName: thread.profile_name || null,
                customData: thread.custom_data || {},
            }),
        });
        return true;
    } catch (err) {
        console.warn('[instagram-webhook] draft dispatch failed:', err.message);
        return false;
    } finally {
        clearTimeout(timeout);
    }
}

async function markPendingGraphAlertsSent({ threadId, messageText, nowIso, graphMessageId }) {
    if (!threadId || !messageText) return 0;
    let cleared = 0;
    try {
        const rows = await supabase(
            `coach_alerts?select=id,data&data->>ig_thread_id=eq.${encodeURIComponent(threadId)}&status=eq.pending&alert_type=in.(ig_incoming_dm,fb_incoming_dm)&created_at=lte.${encodeURIComponent(nowIso)}&limit=25`
        );
        for (const row of rows) {
            const mergedData = {
                ...(row.data || {}),
                sent_message: messageText,
                sent_at: nowIso,
                sent_via: 'instagram_graph_echo',
                sent_graph_message_id: graphMessageId || null,
                manual_dm_marked_sent: true,
                manual_dm_history_logged: true,
                cancel_reason: null,
            };
            await supabase(`coach_alerts?id=eq.${encodeURIComponent(row.id)}`, {
                method: 'PATCH',
                body: {
                    status: 'sent',
                    actioned_at: nowIso,
                    data: mergedData,
                },
                prefer: 'return=minimal',
            });
            cleared++;
        }
    } catch (err) {
        console.warn('[instagram-webhook] pending alert clear failed:', err.message);
    }
    return cleared;
}

async function processGraphMessages(payload) {
    const events = messagingEventsFromPayload(payload);
    if (!events.length) return { processed: 0, inserted: 0, drafted: 0, skipped: 0 };

    const defaultCoachId = await findDefaultCoachId();
    const summary = { processed: 0, inserted: 0, drafted: 0, skipped: 0, outboundCleared: 0 };

    for (const item of events) {
        if (!['messages', 'message_echoes'].includes(item.field) && !messageFromMessaging(item).mid) {
            summary.skipped++;
            continue;
        }

        const messageText = messageTextForDraft(item);
        const graphMessageId = messageIdFromMessaging(item);
        if (!messageText) {
            summary.skipped++;
            continue;
        }

        const direction = directionForMessaging(item);
        const participantId = normalizeId(participantIdForMessaging(item, direction));
        if (!participantId) {
            summary.skipped++;
            continue;
        }

        const nowIso = new Date().toISOString();
        try {
            const thread = await upsertGraphThread({
                participantId,
                igAccountId: item.igAccountId,
                direction,
                nowIso,
                messageId: graphMessageId,
                defaultCoachId,
            });
            if (!thread?.id) {
                summary.skipped++;
                continue;
            }
            const inserted = await insertGraphMessage({
                threadId: thread.id,
                direction,
                text: messageText,
                graphMessageId,
            });
            summary.processed++;
            if (!inserted.inserted) {
                summary.skipped++;
                continue;
            }
            summary.inserted++;

            if (direction === 'in') {
                if (await dispatchDraft({ thread, messageText, dedupeId: inserted.dedupeId })) {
                    summary.drafted++;
                }
            } else {
                summary.outboundCleared += await markPendingGraphAlertsSent({
                    threadId: thread.id,
                    messageText,
                    nowIso,
                    graphMessageId,
                });
            }
        } catch (err) {
            console.warn('[instagram-webhook] message mapping failed:', {
                error: err.message,
                graphMessageId: graphMessageId || null,
                participantId: participantId || null,
                preview: truncate(messageText, 120),
            });
            summary.skipped++;
        }
    }

    return summary;
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

    let graph = { processed: 0, inserted: 0, drafted: 0, skipped: 0 };
    try {
        graph = await processGraphMessages(payload);
    } catch (err) {
        console.warn('[instagram-webhook] graph processing failed:', err.message);
    }

    return json(200, { ok: true, graph });
};
