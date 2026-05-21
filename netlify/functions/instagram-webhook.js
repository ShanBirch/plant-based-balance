/**
 * instagram-webhook
 *
 * Direct Meta/Instagram Graph webhook receiver. This sits beside ManyChat:
 * ManyChat can keep handling automation, while this endpoint gives Balance a
 * first-party audit trail for DMs, story replies, comments, mentions, and
 * related IG events that ManyChat may miss or flatten.
 */

const crypto = require('crypto');
const {
    normalizeMetaIgWebhookEvents,
    sourceKeyForEvent,
    contentTypeFromProduct,
    analyzeInstagramContent,
    buildFallbackSummary,
    buildContextMessage,
    extractStoryReplyText,
} = require('./_lib/meta-ig-context');
const {
    normalizeCoachDraftText,
    fireCoachEditAnalysis,
} = require('./_lib/client-context');

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
const GRAPH_ECHO_EDIT_ANALYSIS_BUDGET_MS = 6500;
const GRAPH_ECHO_BALANCE_SEND_WINDOW_MS = 10 * 60 * 1000;
const GRAPH_SUBSCRIBER_PREFIX = 'ig_graph:';
const RECENT_IDENTITY_MATCH_MS = 12 * 60 * 1000;
const RECENT_DUPLICATE_MATCH_MS = 12 * 60 * 1000;
const GRAPH_BASE = (process.env.META_IG_GRAPH_BASE
    || process.env.INSTAGRAM_GRAPH_BASE
    || 'https://graph.instagram.com').replace(/\/+$/, '');
const BALANCE_ADMIN_EMAIL = 'shannonbirch@cocospersonaltraining.com';
const INSTAGRAM_GRAPH_API_VERSION = normalizeGraphApiVersion(
    process.env.META_IG_API_VERSION
    || process.env.IG_GRAPH_API_VERSION
    || process.env.INSTAGRAM_GRAPH_API_VERSION
    || process.env.META_GRAPH_API_VERSION
    || 'v25.0'
);
const INSTAGRAM_GRAPH_ACCESS_TOKEN_ENV = process.env.INSTAGRAM_GRAPH_ACCESS_TOKEN
    || process.env.IG_GRAPH_ACCESS_TOKEN
    || process.env.META_IG_ACCESS_TOKEN
    || process.env.INSTAGRAM_ACCESS_TOKEN
    || '';
let cachedInstagramGraphAccessToken = INSTAGRAM_GRAPH_ACCESS_TOKEN_ENV || '';

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

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
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

async function getInstagramGraphAccessToken() {
    if (cachedInstagramGraphAccessToken) return cachedInstagramGraphAccessToken;
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return '';
    try {
        const rows = await supabase(
            'app_private_secrets?select=value&key=eq.instagram_graph_access_token&limit=1'
        );
        const token = String(rows?.[0]?.value || '').trim();
        if (token) cachedInstagramGraphAccessToken = token;
    } catch (err) {
        console.warn('[instagram-webhook] Supabase IG Graph token lookup failed:', err.message);
    }
    return cachedInstagramGraphAccessToken;
}

function normalizeGraphApiVersion(value) {
    const raw = String(value || '').trim();
    if (!raw) return 'v25.0';
    return raw.startsWith('v') ? raw : `v${raw}`;
}

async function graphGet(path, params = {}) {
    const token = await getInstagramGraphAccessToken();
    if (!token) return null;
    const url = new URL(`${GRAPH_BASE}/${INSTAGRAM_GRAPH_API_VERSION}/${String(path).replace(/^\/+/, '')}`);
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
            url.searchParams.set(key, value);
        }
    });
    url.searchParams.set('access_token', token);
    const res = await fetch(url.toString());
    const text = await res.text();
    if (!res.ok) {
        throw new Error(`Graph ${res.status}: ${text.slice(0, 300)}`);
    }
    return text ? JSON.parse(text) : null;
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

function normalizeComparableText(value) {
    return extractStoryReplyText(value).trim().replace(/\s+/g, ' ').toLowerCase();
}

function cleanIgUsername(value) {
    if (value == null) return null;
    const cleaned = String(value).replace(/^@+/, '').trim();
    if (!cleaned || cleaned.toLowerCase() === 'null' || cleaned.toLowerCase() === 'undefined') return null;
    return cleaned.slice(0, 100);
}

function sameHandle(a, b) {
    const left = cleanIgUsername(a);
    const right = cleanIgUsername(b);
    return !!left && !!right && left.toLowerCase() === right.toLowerCase();
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
    const direction = directionForMessaging(event);

    if (Object.keys(replyStory).length) {
        const storyOwner = direction === 'out' ? 'their' : 'your';
        parts.push(storyUrl
            ? `replied to ${storyOwner} story (story media attached)`
            : `replied to ${storyOwner} story`);
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
        const rows = await supabase(`users?select=id&email=eq.${encodeURIComponent(BALANCE_ADMIN_EMAIL)}&limit=1`);
        return rows[0]?.id || null;
    } catch (err) {
        console.warn('[instagram-webhook] Shannon coach lookup failed:', err.message);
        return null;
    }
}

async function fetchGraphMessageDetails(messageId) {
    if (!messageId) return null;
    try {
        return await graphGet(encodeURIComponent(messageId), { fields: 'id,created_time,from,to,message' });
    } catch (err) {
        console.warn('[instagram-webhook] graph message detail lookup failed:', err.message);
        return null;
    }
}

function participantUsernameFromMessageDetails(details, participantId, direction) {
    const id = String(participantId || '');
    if (!id || !details) return null;
    const from = safeObject(details.from);
    if (direction === 'in' && String(from.id || '') === id) {
        return cleanIgUsername(from.username);
    }

    const to = details.to;
    const recipients = Array.isArray(to?.data)
        ? to.data
        : Array.isArray(to)
            ? to
            : to
                ? [to]
                : [];
    const recipient = recipients.find(item => String(item?.id || '') === id);
    return cleanIgUsername(recipient?.username || (String(from.id || '') === id ? from.username : null));
}

async function fetchMediaForContextEvent(event) {
    const id = event.mediaId || event.storyId;
    if (!id) return {};
    const fields = [
        'id',
        'ig_id',
        'caption',
        'media_type',
        'media_product_type',
        'media_url',
        'thumbnail_url',
        'permalink',
        'timestamp',
        'username',
    ].join(',');
    return graphGet(id, { fields });
}

function buildContentPatch(event, media = {}, existing = null) {
    const storyUrl = event.storyUrl || null;
    const mediaUrl = media?.media_url || storyUrl || existing?.media_url || null;
    const productType = media?.media_product_type || event.mediaProductType || existing?.media_product_type || null;
    const contentType = contentTypeFromProduct(productType, event.contentType || existing?.content_type || 'unknown');
    const postedAt = media?.timestamp || event.timestamp || existing?.posted_at || null;
    const expiresAt = contentType === 'story'
        ? new Date(new Date(postedAt || Date.now()).getTime() + 24 * 60 * 60 * 1000).toISOString()
        : existing?.expires_at || null;
    return {
        source_key: sourceKeyForEvent(event),
        ig_media_id: event.mediaId || (contentType !== 'story' ? media?.id : null) || existing?.ig_media_id || null,
        ig_story_id: event.storyId || (contentType === 'story' ? media?.id : null) || existing?.ig_story_id || null,
        content_type: contentType,
        media_product_type: productType,
        media_type: media?.media_type || existing?.media_type || null,
        caption: media?.caption || existing?.caption || null,
        permalink: media?.permalink || existing?.permalink || null,
        media_url: mediaUrl,
        thumbnail_url: media?.thumbnail_url || existing?.thumbnail_url || null,
        posted_at: postedAt,
        expires_at: expiresAt,
        media_url_expires_at: contentType === 'story'
            ? expiresAt
            : (mediaUrl ? new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString() : existing?.media_url_expires_at || null),
        raw_payload: {
            ...(existing?.raw_payload || {}),
            latest_event: event.raw || event,
            latest_media: media || {},
        },
    };
}

async function loadContentBySourceKey(sourceKey) {
    const rows = await supabase(
        `ig_content_items?select=*&source_key=eq.${encodeURIComponent(sourceKey)}&limit=1`
    );
    return rows[0] || null;
}

async function upsertContentItem(patch) {
    const rows = await supabase('ig_content_items?on_conflict=source_key', {
        method: 'POST',
        body: [patch],
        prefer: 'resolution=merge-duplicates,return=representation',
    });
    return rows[0] || null;
}

async function ensureAnalyzedContent(event) {
    const sourceKey = sourceKeyForEvent(event);
    const existing = await loadContentBySourceKey(sourceKey);
    let media = {};
    let graphError = null;
    try {
        media = await fetchMediaForContextEvent(event) || {};
    } catch (err) {
        graphError = err.message;
        console.warn('[instagram-webhook] content media lookup failed:', err.message);
    }
    let patch = buildContentPatch(event, media, existing);
    const shouldAnalyze = !existing?.analysis_summary || (patch.media_url && patch.media_url !== existing.media_url);
    if (shouldAnalyze) {
        const analysis = patch.media_url || patch.caption
            ? await analyzeInstagramContent(patch)
            : {
                analysis_status: 'skipped',
                analysis_summary: buildFallbackSummary(patch),
                analysis_model: 'none',
                analysis_error: graphError || 'no_media_or_caption',
            };
        patch = { ...patch, ...analysis };
    } else if (graphError && !existing?.analysis_error) {
        patch.analysis_error = graphError.slice(0, 500);
    }
    return upsertContentItem(patch);
}

async function upsertContentInteraction(event, contentItem) {
    const rows = await supabase('ig_content_interactions?on_conflict=source_event_id', {
        method: 'POST',
        body: [{
            source_event_id: event.eventId,
            event_type: event.type,
            content_item_id: contentItem?.id || null,
            comment_id: event.commentId || null,
            message_id: event.messageId || null,
            from_ig_user_id: event.fromId || null,
            from_username: event.username || null,
            text: event.text || null,
            media_product_type: event.mediaProductType || null,
            raw_payload: event.raw || event,
            processed_at: new Date().toISOString(),
        }],
        prefer: 'resolution=merge-duplicates,return=representation',
    });
    return rows[0] || null;
}

function messageTextFromInteractionRow(row, fallbackText = '') {
    const rawPayload = safeObject(row?.raw_payload);
    const rawText = Object.keys(rawPayload).length
        ? messageTextForDraft({
            item: rawPayload,
            value: rawPayload,
        })
        : '';
    return rawText || fallbackText || '';
}

async function refreshLinkedStoryReplyMessages(contentItem) {
    if (!contentItem?.id) return 0;
    if (contentItem.content_type && contentItem.content_type !== 'story') return 0;
    let rows = [];
    try {
        const cutoffIso = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
        rows = await supabase(
            `ig_content_interactions?select=id,event_type,message_id,text,raw_payload,ig_message_id,processed_at` +
            `&content_item_id=eq.${encodeURIComponent(contentItem.id)}` +
            `&event_type=eq.story_reply` +
            `&ig_message_id=not.is.null` +
            `&processed_at=gte.${encodeURIComponent(cutoffIso)}` +
            `&limit=50`
        );
    } catch (err) {
        console.warn('[instagram-webhook] linked story interaction lookup failed:', err.message);
        return 0;
    }

    let refreshed = 0;
    for (const row of rows) {
        const replyEvent = {
            type: 'story_reply',
            direction: 'in',
            text: row.text || '',
            messageId: row.message_id || null,
            raw: row.raw_payload || {},
        };
        const contextText = buildContextMessage(replyEvent, contentItem);
        const rawMessageText = messageTextFromInteractionRow(row, row.text || '');
        const nextText = rawMessageText
            ? `${contextText}\n\nRaw IG message: ${rawMessageText}`
            : contextText;
        try {
            const currentRows = await supabase(
                `ig_messages?select=id,text&id=eq.${encodeURIComponent(row.ig_message_id)}&limit=1`
            );
            const current = currentRows[0] || null;
            if (current && shouldRefreshGraphMessageText(current.text, nextText)) {
                if (await refreshGraphMessageText({ messageId: current.id, text: nextText })) {
                    refreshed++;
                }
            }
        } catch (err) {
            console.warn('[instagram-webhook] linked story message refresh skipped:', err.message);
        }
    }
    return refreshed;
}

function shouldProcessContentContextEvent(event) {
    return !(event?.type === 'story_reply' && event?.direction === 'out');
}

async function processContentInteractions(payload) {
    const events = normalizeMetaIgWebhookEvents(payload);
    const byMessageId = new Map();
    const summary = { processed: 0, comments: 0, storyReplies: 0, outboundStoryRepliesSkipped: 0, failed: 0 };
    for (const event of events) {
        if (!shouldProcessContentContextEvent(event)) {
            summary.outboundStoryRepliesSkipped++;
            continue;
        }
        try {
            const contentItem = await ensureAnalyzedContent(event);
            await upsertContentInteraction(event, contentItem);
            await refreshLinkedStoryReplyMessages(contentItem);
            if (event.messageId && contentItem) {
                byMessageId.set(event.messageId, buildContextMessage(event, contentItem));
            }
            summary.processed++;
            if (event.type === 'comment') summary.comments++;
            if (event.type === 'story_reply') summary.storyReplies++;
        } catch (err) {
            summary.failed++;
            console.warn('[instagram-webhook] content context failed:', {
                eventId: event.eventId || null,
                type: event.type || null,
                error: err.message,
            });
        }
    }
    return { summary, byMessageId };
}

function mergeGraphCustomData(priorCustomData, { participantId, igAccountId, nowIso, messageId, participantUsername }) {
    const base = {
        ...safeObject(priorCustomData),
    };
    delete base.manual_ig_required;
    const priorGraph = safeObject(base.instagram_graph);
    delete priorGraph.manual_ig_required;
    const graphData = {
        ...priorGraph,
        source: 'instagram_graph',
        ig_graph_user_id: participantId,
        ig_account_id: igAccountId || priorGraph.ig_account_id || null,
        ig_username: participantUsername || priorGraph.ig_username || null,
        username: participantUsername || priorGraph.username || null,
        last_graph_message_id: messageId || priorGraph.last_graph_message_id || null,
        last_graph_seen_at: nowIso,
        send_ready: true,
    };
    return {
        ...base,
        instagram_graph: graphData,
    };
}

async function findThreadByGraphParticipantId(participantId, selectColumns) {
    if (!participantId) return null;
    try {
        const rows = await supabase(
            `ig_threads?select=${selectColumns}&channel=eq.instagram&custom_data->instagram_graph->>ig_graph_user_id=eq.${encodeURIComponent(participantId)}&limit=10`
        );
        const namedThread = rows.find(thread => !isGraphSubscriberId(thread.subscriber_id));
        if (namedThread) return namedThread;

        const mergedGraphThread = rows.find(thread => {
            const data = safeObject(thread.custom_data);
            return data.merged_into_ig_thread_id || data.merged_into_thread_id;
        });
        const mergedIntoId = mergedGraphThread
            ? safeObject(mergedGraphThread.custom_data).merged_into_ig_thread_id
                || safeObject(mergedGraphThread.custom_data).merged_into_thread_id
            : null;
        if (mergedIntoId) {
            const targets = await supabase(
                `ig_threads?select=${selectColumns}&id=eq.${encodeURIComponent(mergedIntoId)}&channel=eq.instagram&limit=1`
            );
            if (targets[0]) return targets[0];
        }

        return rows[0] || null;
    } catch (err) {
        console.warn('[instagram-webhook] graph participant thread lookup failed:', err.message);
        return null;
    }
}

function isGraphSubscriberId(subscriberId) {
    return String(subscriberId || '').startsWith(GRAPH_SUBSCRIBER_PREFIX);
}

function mergedIntoThreadId(thread) {
    const data = safeObject(thread?.custom_data);
    return data.merged_into_ig_thread_id || data.merged_into_thread_id || null;
}

async function findThreadById(threadId, selectColumns) {
    if (!threadId) return null;
    try {
        const rows = await supabase(
            `ig_threads?select=${selectColumns}&id=eq.${encodeURIComponent(threadId)}&channel=eq.instagram&limit=1`
        );
        return rows[0] || null;
    } catch (err) {
        console.warn('[instagram-webhook] merged thread lookup failed:', err.message);
        return null;
    }
}

async function markGraphThreadMergedInto({ sourceThread, targetThread, nowIso }) {
    if (!sourceThread?.id || !targetThread?.id || sourceThread.id === targetThread.id) return;
    if (!isGraphSubscriberId(sourceThread.subscriber_id)) return;
    const customData = {
        ...safeObject(sourceThread.custom_data),
        merged_into_thread_id: targetThread.id,
        merged_into_ig_thread_id: targetThread.id,
        merged_at: nowIso,
        merge_reason: 'graph_handle_thread_preferred',
    };
    try {
        await supabase(`ig_threads?id=eq.${encodeURIComponent(sourceThread.id)}`, {
            method: 'PATCH',
            body: { custom_data: customData, updated_at: nowIso },
            prefer: 'return=minimal',
        });
    } catch (err) {
        console.warn('[instagram-webhook] graph merge marker failed:', err.message);
    }
}

async function findThreadByIgHandle(igUsername, selectColumns) {
    const handle = cleanIgUsername(igUsername);
    if (!handle) return null;
    try {
        const rows = await supabase(
            `ig_threads?select=${selectColumns}&channel=eq.instagram&ig_username=ilike.${encodeURIComponent(handle)}&order=last_inbound_at.desc.nullslast&limit=10`
        );
        const matches = rows.filter(thread => sameHandle(thread.ig_username, handle));
        return matches.find(thread => !isGraphSubscriberId(thread.subscriber_id))
            || matches[0]
            || null;
    } catch (err) {
        console.warn('[instagram-webhook] IG handle thread lookup failed:', err.message);
        return null;
    }
}

async function findRecentThreadByText({ messageText, direction, nowIso, selectColumns }) {
    const needle = normalizeComparableText(messageText);
    if (!needle) return null;
    const cutoffIso = new Date(new Date(nowIso).getTime() - RECENT_IDENTITY_MATCH_MS).toISOString();
    let rows = [];
    try {
        rows = await supabase(
            `ig_messages?select=id,thread_id,direction,text,created_at,source,manychat_message_id&direction=eq.${encodeURIComponent(direction)}&created_at=gte.${encodeURIComponent(cutoffIso)}&order=created_at.desc&limit=80`
        );
    } catch (err) {
        console.warn('[instagram-webhook] recent text match lookup failed:', err.message);
        return null;
    }
    const matches = rows.filter(row => normalizeComparableText(row.text) === needle);
    if (!matches.length) return null;
    const ids = [...new Set(matches.map(row => row.thread_id).filter(Boolean))];
    if (!ids.length) return null;
    let threads = [];
    try {
        threads = await supabase(
            `ig_threads?select=${selectColumns}&id=in.(${ids.map(encodeURIComponent).join(',')})&channel=eq.instagram&limit=${ids.length}`
        );
    } catch (err) {
        console.warn('[instagram-webhook] recent text thread lookup failed:', err.message);
        return null;
    }
    const threadById = new Map(threads.map(thread => [thread.id, thread]));
    for (const match of matches) {
        const thread = threadById.get(match.thread_id);
        if (!thread) continue;
        const subscriber = String(thread.subscriber_id || '');
        const source = String(match.source || '');
        if (!subscriber.startsWith(GRAPH_SUBSCRIBER_PREFIX) && source !== 'instagram_graph') {
            return thread;
        }
    }
    return threads[0] || null;
}

function shouldUseGraphUsernameForProfileName(currentProfileName) {
    return !currentProfileName || /^IG user \d+$/i.test(String(currentProfileName).trim());
}

async function upsertGraphThread({ participantId, participantUsername, igAccountId, direction, nowIso, messageId, messageText, defaultCoachId }) {
    const subscriberId = `${GRAPH_SUBSCRIBER_PREFIX}${participantId}`;
    const selectColumns = 'id,subscriber_id,coach_id,channel,profile_name,ig_username,lead_stage,linked_user_id,custom_data,auto_send_enabled';
    const existing = await supabase(
        `ig_threads?select=${selectColumns}&subscriber_id=eq.${encodeURIComponent(subscriberId)}&channel=eq.instagram&limit=1`
    );
    const exactGraphThread = existing[0] || null;
    const mergedThread = await findThreadById(mergedIntoThreadId(exactGraphThread), selectColumns);
    const handleThread = await findThreadByIgHandle(participantUsername, selectColumns);
    const recentTextThread = await findRecentThreadByText({ messageText, direction, nowIso, selectColumns });
    const current = mergedThread
        || (handleThread && (!exactGraphThread || isGraphSubscriberId(exactGraphThread.subscriber_id) || handleThread.id === exactGraphThread.id) ? handleThread : null)
        || (recentTextThread && (!exactGraphThread || isGraphSubscriberId(exactGraphThread.subscriber_id)) ? recentTextThread : null)
        || exactGraphThread
        || await findThreadByGraphParticipantId(participantId, selectColumns)
        || null;
    const priorCustomData = safeObject(current?.custom_data);
    const customData = mergeGraphCustomData(priorCustomData, { participantId, igAccountId, nowIso, messageId, participantUsername });
    if (exactGraphThread?.id && current?.id && exactGraphThread.id !== current.id) {
        customData.instagram_graph = {
            ...safeObject(customData.instagram_graph),
            linked_from_graph_thread_id: exactGraphThread.id,
        };
    }
    if (!current || isGraphSubscriberId(current.subscriber_id)) {
        customData.source = customData.source || 'instagram_graph';
    }

    if (current) {
        const patch = {
            custom_data: customData,
            updated_at: nowIso,
        };
        if (direction === 'out') patch.last_outbound_at = nowIso;
        else patch.last_inbound_at = nowIso;
        if (!current.coach_id && defaultCoachId) patch.coach_id = defaultCoachId;
        if (participantUsername && !current.ig_username) patch.ig_username = participantUsername;
        if (participantUsername && shouldUseGraphUsernameForProfileName(current.profile_name)) {
            patch.profile_name = participantUsername;
        } else if (!current.profile_name) {
            patch.profile_name = `IG user ${participantId.slice(-6)}`;
        }
        await supabase(`ig_threads?id=eq.${encodeURIComponent(current.id)}`, {
            method: 'PATCH',
            body: patch,
            prefer: 'return=minimal',
        });
        await markGraphThreadMergedInto({ sourceThread: exactGraphThread, targetThread: current, nowIso });
        return {
            ...current,
            ...patch,
            coach_id: current.coach_id || defaultCoachId || null,
        };
    }

    const profileName = participantUsername || `IG user ${participantId.slice(-6)}`;
    const inserted = await supabase('ig_threads', {
        method: 'POST',
        body: [{
            subscriber_id: subscriberId,
            coach_id: defaultCoachId || null,
            channel: 'instagram',
            ig_username: participantUsername || null,
            profile_name: profileName,
            custom_data: customData,
            last_inbound_at: direction === 'in' ? nowIso : null,
            last_outbound_at: direction === 'out' ? nowIso : null,
            lead_stage: 'new',
        }],
        prefer: 'return=representation',
    });
    return inserted[0];
}

async function findRecentDuplicateMessage({ threadId, direction, text, nowIso }) {
    if (!threadId || !text) return null;
    const cutoffIso = new Date(new Date(nowIso).getTime() - RECENT_DUPLICATE_MATCH_MS).toISOString();
    try {
        const rows = await supabase(
            `ig_messages?select=id,thread_id,direction,text,source,created_at,manychat_message_id&thread_id=eq.${encodeURIComponent(threadId)}&direction=eq.${encodeURIComponent(direction)}&created_at=gte.${encodeURIComponent(cutoffIso)}&order=created_at.desc&limit=20`
        );
        const needle = normalizeComparableText(text);
        return rows.find(row => normalizeComparableText(row.text) === needle) || null;
    } catch (err) {
        console.warn('[instagram-webhook] duplicate message lookup failed:', err.message);
        return null;
    }
}

function isInboundStoryContextText(text) {
    return /\[IG_STORY_REPLY_CONTEXT\]/i.test(String(text || ''));
}

function shouldRefreshGraphMessageText(existingText, nextText) {
    if (!isInboundStoryContextText(nextText)) return false;
    if (String(existingText || '') === String(nextText || '')) return false;
    const existingReply = normalizeComparableText(existingText);
    const nextReply = normalizeComparableText(nextText);
    return !!existingReply && !!nextReply && existingReply === nextReply;
}

async function refreshGraphMessageText({ messageId, text }) {
    if (!messageId || !text) return false;
    try {
        await supabase(`ig_messages?id=eq.${encodeURIComponent(messageId)}`, {
            method: 'PATCH',
            body: {
                text,
                source: 'instagram_graph',
            },
            prefer: 'return=minimal',
        });
        return true;
    } catch (err) {
        console.warn('[instagram-webhook] graph message context refresh failed:', err.message);
        return false;
    }
}

async function findGraphMessageByDedupeId(dedupeId) {
    if (!dedupeId) return null;
    try {
        const rows = await supabase(
            `ig_messages?select=id,text,source,manychat_message_id&manychat_message_id=eq.${encodeURIComponent(dedupeId)}&limit=1`
        );
        return rows[0] || null;
    } catch (err) {
        console.warn('[instagram-webhook] graph message id lookup failed:', err.message);
        return null;
    }
}

async function insertGraphMessage({ threadId, direction, text, graphMessageId, nowIso }) {
    const dedupeId = graphMessageId
        ? `${GRAPH_SUBSCRIBER_PREFIX}${graphMessageId}`
        : `${GRAPH_SUBSCRIBER_PREFIX}${threadId}:${Date.now()}`;
    const duplicate = await findRecentDuplicateMessage({ threadId, direction, text, nowIso });
    if (duplicate) {
        if (shouldRefreshGraphMessageText(duplicate.text, text)) {
            await refreshGraphMessageText({ messageId: duplicate.id, text });
        }
        return {
            inserted: false,
            deduped: true,
            duplicateReason: 'recent_same_text',
            messageId: duplicate.id || null,
            dedupeId,
        };
    }
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
        if (duplicate) {
            const existing = await findGraphMessageByDedupeId(dedupeId);
            if (existing && shouldRefreshGraphMessageText(existing.text, text)) {
                await refreshGraphMessageText({ messageId: existing.id, text });
                return { inserted: false, deduped: true, duplicateReason: 'refreshed_context_for_dedupe_id', messageId: existing.id || null, dedupeId };
            }
            return { inserted: false, deduped: true, messageId: existing?.id || null, dedupeId };
        }
        throw err;
    }
}

async function linkContentInteractionToGraphMessage({ graphMessageId, threadId, igMessageId, nowIso }) {
    if (!graphMessageId || !threadId) return;
    try {
        const patch = {
            ig_thread_id: threadId,
            processed_at: nowIso || new Date().toISOString(),
        };
        if (igMessageId) patch.ig_message_id = igMessageId;
        await supabase(
            `ig_content_interactions?message_id=eq.${encodeURIComponent(graphMessageId)}`,
            {
                method: 'PATCH',
                body: patch,
                prefer: 'return=minimal',
            }
        );
    } catch (err) {
        console.warn('[instagram-webhook] content interaction thread link failed:', err.message);
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

function relatedThreadIdsForGraphEcho({ thread, threadId }) {
    const ids = new Set();
    if (threadId) ids.add(String(threadId));
    if (thread?.id) ids.add(String(thread.id));
    const data = safeObject(thread?.custom_data);
    const graph = safeObject(data.instagram_graph);
    [
        data.merged_into_ig_thread_id,
        data.merged_into_thread_id,
        graph.linked_from_graph_thread_id,
        graph.linked_from_thread_id,
        graph.graph_manychat_joined_from_thread_id,
    ].forEach(id => {
        if (id) ids.add(String(id));
    });
    return [...ids];
}

async function fetchAlertsForThreadIds({ threadIds, status, nowIso, sinceIso = null }) {
    const rows = [];
    for (const id of threadIds) {
        try {
            const timeFilter = status === 'sent'
                ? `&actioned_at=gte.${encodeURIComponent(sinceIso || nowIso)}`
                : `&created_at=lte.${encodeURIComponent(nowIso)}`;
            const result = await supabase(
                `coach_alerts?select=id,actioned_at,suggested_message,data&data->>ig_thread_id=eq.${encodeURIComponent(id)}&status=eq.${encodeURIComponent(status)}${timeFilter}&alert_type=in.(ig_incoming_dm,fb_incoming_dm)&limit=25`
            );
            rows.push(...result);
        } catch (err) {
            console.warn('[instagram-webhook] related alert lookup failed:', id, err.message);
        }
    }
    const seen = new Set();
    return rows.filter(row => {
        if (!row?.id || seen.has(row.id)) return false;
        seen.add(row.id);
        return true;
    });
}

async function markPendingGraphAlertsSent({ thread, threadId, messageText, nowIso, graphMessageId }) {
    if (!threadId || !messageText) return 0;
    let cleared = 0;
    const analysisJobs = [];
    const sentMessage = normalizeCoachDraftText(messageText).trim();
    let echoMatchesBalanceSend = false;
    try {
        const relatedThreadIds = relatedThreadIdsForGraphEcho({ thread, threadId });
        const nowMsForEcho = new Date(nowIso).getTime();
        const echoSinceIso = new Date((Number.isFinite(nowMsForEcho) ? nowMsForEcho : Date.now()) - GRAPH_ECHO_BALANCE_SEND_WINDOW_MS).toISOString();
        const sentRows = await fetchAlertsForThreadIds({
            threadIds: relatedThreadIds,
            status: 'sent',
            nowIso,
            sinceIso: echoSinceIso,
        });
        echoMatchesBalanceSend = sentRows.some(row => {
            const data = row.data || {};
            if (data.sent_via === 'instagram_graph_echo') return false;
            const graphIds = Array.isArray(data.sent_graph_message_ids) ? data.sent_graph_message_ids : [];
            if (graphMessageId && graphIds.includes(graphMessageId)) return true;
            const priorSent = normalizeCoachDraftText(data.sent_message || '').trim();
            const sentAtMs = new Date(data.sent_at || row.actioned_at || 0).getTime();
            const nowMs = new Date(nowIso).getTime();
            return !!priorSent
                && priorSent === sentMessage
                && Number.isFinite(sentAtMs)
                && Number.isFinite(nowMs)
                && Math.abs(nowMs - sentAtMs) <= GRAPH_ECHO_BALANCE_SEND_WINDOW_MS;
        });
        const rows = await fetchAlertsForThreadIds({
            threadIds: relatedThreadIds,
            status: 'pending',
            nowIso,
        });
        for (const row of rows) {
            const data = row.data || {};
            const draftText = normalizeCoachDraftText(data.draft_text || row.suggested_message || '').trim();
            if (echoMatchesBalanceSend) {
                const mergedData = {
                    ...data,
                    cancel_reason: 'cleared_by_graph_echo_for_balance_send',
                    cleared_by_graph_echo_at: nowIso,
                    cleared_by_graph_echo_message_id: graphMessageId || null,
                    cleared_by_graph_echo_text: sentMessage || messageText,
                    cleared_by_graph_echo_thread_id: threadId,
                };
                await supabase(`coach_alerts?id=eq.${encodeURIComponent(row.id)}`, {
                    method: 'PATCH',
                    body: {
                        status: 'canceled',
                        actioned_at: nowIso,
                        data: mergedData,
                    },
                    prefer: 'return=minimal',
                });
                cleared++;
                continue;
            }
            const wasEdited = !!draftText && !!sentMessage && sentMessage !== draftText;
            const mergedData = {
                ...data,
                draft_text: draftText || data.draft_text || row.suggested_message || null,
                sent_message: sentMessage || messageText,
                was_edited: wasEdited,
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
            if (sentMessage) {
                analysisJobs.push(
                    fireCoachEditAnalysis({
                        alertId: row.id,
                        draftText,
                        sentMessage,
                        source: 'instagram_graph_echo',
                    })
                );
            }
        }
    } catch (err) {
        console.warn('[instagram-webhook] pending alert clear failed:', err.message);
    }
    if (analysisJobs.length > 0) {
        try {
            const timedOut = Symbol('timed_out');
            const result = await Promise.race([
                Promise.allSettled(analysisJobs),
                sleep(GRAPH_ECHO_EDIT_ANALYSIS_BUDGET_MS).then(() => timedOut),
            ]);
            if (result === timedOut) {
                console.warn('[instagram-webhook] graph echo edit analysis exceeded webhook budget');
            }
        } catch (err) {
            console.warn('[instagram-webhook] graph echo edit analysis failed:', err.message);
        }
    }
    return cleared;
}

async function processGraphMessages(payload, contentContextByMessageId = new Map()) {
    const events = messagingEventsFromPayload(payload);
    if (!events.length) return { processed: 0, inserted: 0, drafted: 0, skipped: 0 };

    const defaultCoachId = await findDefaultCoachId();
    const summary = { processed: 0, inserted: 0, drafted: 0, skipped: 0, outboundCleared: 0 };

    for (const item of events) {
        if (!['messages', 'message_echoes'].includes(item.field) && !messageFromMessaging(item).mid) {
            summary.skipped++;
            continue;
        }

        const rawMessageText = messageTextForDraft(item);
        const graphMessageId = messageIdFromMessaging(item);
        const contentContext = graphMessageId ? contentContextByMessageId.get(graphMessageId) : null;
        const messageText = contentContext
            ? `${contentContext}\n\nRaw IG message: ${rawMessageText}`
            : rawMessageText;
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
            const details = await fetchGraphMessageDetails(graphMessageId);
            const participantUsername = participantUsernameFromMessageDetails(details, participantId, direction);
            const thread = await upsertGraphThread({
                participantId,
                participantUsername,
                igAccountId: item.igAccountId,
                direction,
                nowIso,
                messageId: graphMessageId,
                messageText,
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
                nowIso,
            });
            if (contentContext) {
                await linkContentInteractionToGraphMessage({
                    graphMessageId,
                    threadId: thread.id,
                    igMessageId: inserted.messageId || null,
                    nowIso,
                });
            }
            summary.processed++;
            if (!inserted.inserted) {
                summary.skipped++;
                if (direction === 'out') {
                    summary.outboundCleared += await markPendingGraphAlertsSent({
                        thread,
                        threadId: thread.id,
                        messageText,
                        nowIso,
                        graphMessageId,
                    });
                }
                continue;
            }
            summary.inserted++;

            if (direction === 'in') {
                if (await dispatchDraft({ thread, messageText, dedupeId: inserted.dedupeId })) {
                    summary.drafted++;
                }
            } else {
                summary.outboundCleared += await markPendingGraphAlertsSent({
                    thread,
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

exports._test = {
    messageTextForDraft,
    shouldProcessContentContextEvent,
};

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

    let content = {
        summary: { processed: 0, comments: 0, storyReplies: 0, failed: 0 },
        byMessageId: new Map(),
    };
    try {
        content = await processContentInteractions(payload);
    } catch (err) {
        console.warn('[instagram-webhook] content interaction processing failed:', err.message);
    }

    let graph = { processed: 0, inserted: 0, drafted: 0, skipped: 0 };
    try {
        graph = await processGraphMessages(payload, content.byMessageId);
    } catch (err) {
        console.warn('[instagram-webhook] graph processing failed:', err.message);
    }

    return json(200, { ok: true, graph, content: content.summary });
};
