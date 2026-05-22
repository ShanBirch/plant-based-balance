/**
 * Meta Instagram Graph webhook receiver.
 *
 * Sidecar for direct Meta comment/story context. It stores Shannon-owned IG
 * content context separately from the existing ManyChat DM pipeline so active
 * DM work can continue untouched.
 *
 * Env:
 *   META_IG_WEBHOOK_VERIFY_TOKEN - webhook GET verification token
 *   META_IG_APP_SECRET           - optional x-hub-signature-256 validation
 *   META_IG_ACCESS_TOKEN         - fallback user/page token for media lookups
 *   META_IG_ACCOUNT_MAP_JSON     - optional owner-account map for multi-account IG
 *   META_IG_GRAPH_BASE           - graph host, defaults to graph.instagram.com
 *   META_IG_API_VERSION          - defaults to v24.0
 */

const crypto = require('crypto');
const {
    SUPABASE_URL,
    SUPABASE_SERVICE_KEY,
    supabaseQuery,
} = require('./_lib/client-context');
const {
    normalizeMetaIgWebhookEvents,
    sourceKeyForEvent,
    contentTypeFromProduct,
    analyzeInstagramContent,
    buildFallbackSummary,
    buildContextMessage,
    buildVerifiedStoryContext,
} = require('./_lib/meta-ig-context');
const {
    resolveMetaIgAccountConfig,
    resolveMetaIgAccessToken,
    buildGraphSubscriberId,
    legacyGraphSubscriberIds,
} = require('./_lib/meta-ig-accounts');

const VERIFY_TOKEN = process.env.META_IG_WEBHOOK_VERIFY_TOKEN || process.env.META_WEBHOOK_VERIFY_TOKEN || '';
const APP_SECRET = process.env.META_IG_APP_SECRET || process.env.META_APP_SECRET || '';
const GRAPH_BASE = (process.env.META_IG_GRAPH_BASE || 'https://graph.instagram.com').replace(/\/+$/, '');
const API_VERSION = process.env.META_IG_API_VERSION || 'v24.0';
const SITE_URL = process.env.URL || 'https://plantbased-balance.org';
const AUTO_DRAFT_STORY_REPLIES = /^true$/i.test(process.env.META_IG_AUTO_DRAFT_STORY_REPLIES || '');

function json(statusCode, body) {
    return {
        statusCode,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    };
}

function verifySignature(event) {
    if (!APP_SECRET) return true;
    const provided = String(
        event.headers?.['x-hub-signature-256']
        || event.headers?.['X-Hub-Signature-256']
        || ''
    ).trim();
    if (!provided.startsWith('sha256=')) return false;
    const expected = 'sha256=' + crypto
        .createHmac('sha256', APP_SECRET)
        .update(event.body || '', 'utf8')
        .digest('hex');
    const left = Buffer.from(provided);
    const right = Buffer.from(expected);
    return left.length === right.length && crypto.timingSafeEqual(left, right);
}

async function graphGet(path, params = {}, ownerId = null) {
    const { token } = await resolveMetaIgAccessToken(ownerId, supabaseQuery);
    if (!token) return null;
    const url = new URL(`${GRAPH_BASE}/${API_VERSION}/${String(path).replace(/^\/+/, '')}`);
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

async function fetchMediaForEvent(event) {
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
    return graphGet(id, { fields }, event.ownerId || event.recipientId || null);
}

function buildContentPatch(event, media = {}, existing = null) {
    const storyUrl = event.storyUrl || null;
    const mediaUrl = media.media_url || storyUrl || existing?.media_url || null;
    const mediaType = media.media_type || existing?.media_type || null;
    const productType = media.media_product_type || event.mediaProductType || existing?.media_product_type || null;
    const contentType = contentTypeFromProduct(productType, event.contentType || existing?.content_type || 'unknown');
    const postedAt = media.timestamp || event.timestamp || existing?.posted_at || null;
    const expiresAt = contentType === 'story'
        ? new Date(new Date(postedAt || Date.now()).getTime() + 24 * 60 * 60 * 1000).toISOString()
        : existing?.expires_at || null;
    return {
        source_key: sourceKeyForEvent(event),
        ig_media_id: event.mediaId || media.id || existing?.ig_media_id || null,
        ig_story_id: event.storyId || (contentType === 'story' ? media.id : null) || existing?.ig_story_id || null,
        content_type: contentType,
        media_product_type: productType,
        media_type: mediaType,
        caption: media.caption || existing?.caption || null,
        permalink: media.permalink || existing?.permalink || null,
        media_url: mediaUrl,
        thumbnail_url: media.thumbnail_url || existing?.thumbnail_url || null,
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
    const rows = await supabaseQuery(
        `ig_content_items?select=*&source_key=eq.${encodeURIComponent(sourceKey)}&limit=1`
    );
    return rows[0] || null;
}

async function upsertContentItem(patch) {
    const rows = await supabaseQuery('ig_content_items?on_conflict=source_key', {
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
        media = await fetchMediaForEvent(event) || {};
    } catch (err) {
        graphError = err.message;
        console.warn('[meta-ig-webhook] media lookup failed:', err.message);
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

async function upsertInteraction(event, contentItem) {
    const rows = await supabaseQuery('ig_content_interactions?on_conflict=source_event_id', {
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

async function findDefaultCoachId() {
    const rows = await supabaseQuery(
        `users?select=id,email&email=in.(${[
            'shannonbirch@cocospersonaltraining.com',
            'shannon@plantbased-balance.org',
            'shannon@plantbasedbalance.com',
        ].map(encodeURIComponent).join(',')})&limit=5`
    );
    return rows[0]?.id || null;
}

async function findLinkedUserByIgUsername(username) {
    const clean = String(username || '').replace(/^@+/, '').trim();
    if (!clean) return null;
    try {
        const rows = await supabaseQuery(
            `users?select=id,ig_handle,subscription_status&ig_handle=ilike.${encodeURIComponent(clean)}&limit=1`
        );
        return rows[0] || null;
    } catch {
        return null;
    }
}

function graphMessageIds(event = {}) {
    const messageId = event.messageId || event.eventId || null;
    if (!messageId) return [];
    return [
        event.ownerId ? `ig_graph:${event.ownerId}:${messageId}` : null,
        messageId,
        `ig_graph:${messageId}`,
    ].filter(Boolean);
}

async function findExistingGraphMessage(event) {
    const ids = graphMessageIds(event);
    if (!ids.length) return null;
    const encoded = ids.map(id => encodeURIComponent(id)).join(',');
    const rows = await supabaseQuery(
        `ig_messages?select=id,thread_id,text,source,manychat_message_id,created_at&manychat_message_id=in.(${encoded})&limit=1`
    );
    return rows[0] || null;
}

function graphMessageSourceForEvent(event = {}) {
    return event.type === 'story_reply' ? 'meta_ig_story_reply' : 'meta_ig_message';
}

function storedTextForGraphEvent(event = {}, contentItem = null) {
    if (event.type === 'story_reply') return buildContextMessage(event, contentItem || {});
    return event.text || '';
}

async function saveGraphInboundMessage({ thread, event, text }) {
    const primaryMessageId = graphMessageIds(event)[0] || null;
    const source = graphMessageSourceForEvent(event);
    const existingBeforeInsert = await findExistingGraphMessage(event);
    if (existingBeforeInsert?.id) {
        if (existingBeforeInsert.text !== text || existingBeforeInsert.source === 'manychat') {
            await supabaseQuery(`ig_messages?id=eq.${existingBeforeInsert.id}`, {
                method: 'PATCH',
                body: {
                    text,
                    source: existingBeforeInsert.source === 'manychat' ? source : existingBeforeInsert.source,
                },
                prefer: 'return=minimal',
            });
        }
        return { ...existingBeforeInsert, text, deduped: true };
    }
    try {
        const rows = await supabaseQuery('ig_messages', {
            method: 'POST',
            body: [{
                thread_id: thread.id,
                direction: 'in',
                text,
                manychat_message_id: primaryMessageId,
                source,
            }],
        });
        return rows[0] ? { ...rows[0], deduped: false } : null;
    } catch (err) {
        if (!/23505|duplicate key/i.test(err.message || '')) throw err;
        const existing = await findExistingGraphMessage(event);
        if (!existing?.id) return null;
        if (existing.text !== text || existing.source === 'manychat') {
            await supabaseQuery(`ig_messages?id=eq.${existing.id}`, {
                method: 'PATCH',
                body: {
                    text,
                    source: existing.source === 'manychat' ? source : existing.source,
                },
                prefer: 'return=minimal',
            });
        }
        return { ...existing, text, deduped: true };
    }
}

function threadMatchesGraphOwner(thread, ownerId, botAccount) {
    const customData = thread?.custom_data && typeof thread.custom_data === 'object' ? thread.custom_data : {};
    const storedOwner = customData.owner_ig_user_id || customData.ig_graph_account_id || customData.instagram_graph?.account_id || '';
    const storedBot = customData.bot_account || customData.instagram_graph?.bot_account || '';
    if (storedOwner && ownerId && storedOwner !== ownerId) return false;
    if (storedBot && botAccount && storedBot !== botAccount) return false;
    return true;
}

async function findGraphThread(event, subscriberId, accountConfig) {
    const select = 'id,subscriber_id,coach_id,channel,ig_username,profile_name,lead_stage,linked_user_id,custom_data';
    const exact = await supabaseQuery(
        `ig_threads?select=${select}&subscriber_id=eq.${encodeURIComponent(subscriberId)}&channel=eq.instagram&limit=1`
    );
    if (exact[0]) return exact[0];

    const legacyIds = legacyGraphSubscriberIds(event.fromId);
    if (!legacyIds.length) return null;
    const rows = await supabaseQuery(
        `ig_threads?select=${select}&subscriber_id=in.(${legacyIds.map(encodeURIComponent).join(',')})&channel=eq.instagram&limit=5`
    );
    return rows.find(thread => threadMatchesGraphOwner(thread, event.ownerId, accountConfig.botAccount)) || null;
}

function buildGraphCustomData({ existing = {}, event = {}, contentItem = null, accountConfig = {} }) {
    const previous = existing && typeof existing === 'object' ? existing : {};
    const previousGraph = previous.instagram_graph && typeof previous.instagram_graph === 'object'
        ? previous.instagram_graph
        : {};
    const graphData = {
        ...previousGraph,
        account_id: event.ownerId || previousGraph.account_id || null,
        owner_id: event.ownerId || previousGraph.owner_id || null,
        recipient_id: event.fromId || previousGraph.recipient_id || null,
        ig_graph_user_id: event.fromId || previousGraph.ig_graph_user_id || null,
        sender_id: event.fromId || previousGraph.sender_id || null,
        latest_message_id: event.messageId || previousGraph.latest_message_id || null,
        latest_event_type: event.type || previousGraph.latest_event_type || null,
        bot_account: accountConfig.botAccount || previousGraph.bot_account || null,
    };
    const customData = {
        ...previous,
        source: previous.source || 'meta_ig_webhook',
        bot_account: accountConfig.botAccount || previous.bot_account || null,
        owner_ig_user_id: event.ownerId || previous.owner_ig_user_id || null,
        ig_graph_account_id: event.ownerId || previous.ig_graph_account_id || null,
        ig_graph_user_id: event.fromId || previous.ig_graph_user_id || null,
        delivery_channel: 'instagram_graph',
        instagram_graph: graphData,
        last_meta_ig_event_type: event.type || previous.last_meta_ig_event_type || null,
        last_meta_ig_event_at: event.timestamp || new Date().toISOString(),
    };
    if (event.type === 'story_reply') {
        customData.last_story_content_item_id = contentItem?.id || previous.last_story_content_item_id || null;
        customData.last_story_context = buildVerifiedStoryContext(contentItem || {});
    }
    return customData;
}

async function updateLegacyThreadSubscriberId(thread, subscriberId) {
    if (!thread?.id || !subscriberId || thread.subscriber_id === subscriberId) return thread;
    try {
        await supabaseQuery(`ig_threads?id=eq.${thread.id}`, {
            method: 'PATCH',
            body: { subscriber_id: subscriberId },
            prefer: 'return=minimal',
        });
        return { ...thread, subscriber_id: subscriberId };
    } catch (err) {
        console.warn('[meta-ig-webhook] legacy subscriber id update failed:', err.message);
        return thread;
    }
}

async function upsertGraphThread(event, contentItem) {
    if (!['story_reply', 'message'].includes(event.type) || !event.fromId) return { thread: null, message: null, accountConfig: null };
    const nowIso = new Date().toISOString();
    const accountConfig = resolveMetaIgAccountConfig(event.ownerId || event.recipientId || '');
    const subscriberId = buildGraphSubscriberId(event.ownerId, event.fromId);
    if (!subscriberId) return { thread: null, message: null, accountConfig };
    const username = event.username || null;
    const linkedUser = await findLinkedUserByIgUsername(username);
    const coachId = await findDefaultCoachId();
    const existingThread = await findGraphThread(event, subscriberId, accountConfig);
    const customData = {
        ...buildGraphCustomData({
            existing: existingThread?.custom_data || {},
            event,
            contentItem,
            accountConfig,
        }),
    };
    let thread = existingThread || null;
    if (thread) {
        thread = await updateLegacyThreadSubscriberId(thread, subscriberId);
        await supabaseQuery(`ig_threads?id=eq.${thread.id}`, {
            method: 'PATCH',
            body: {
                last_inbound_at: nowIso,
                ig_username: username || thread.ig_username || null,
                profile_name: username || thread.profile_name || thread.ig_username || null,
                linked_user_id: thread.linked_user_id || linkedUser?.id || null,
                lead_stage: thread.linked_user_id || linkedUser?.id ? 'in_app' : (thread.lead_stage || 'new'),
                custom_data: customData,
            },
            prefer: 'return=minimal',
        });
        thread = { ...thread, custom_data: customData };
    } else {
        const inserted = await supabaseQuery('ig_threads', {
            method: 'POST',
            body: [{
                subscriber_id: subscriberId,
                coach_id: coachId,
                channel: 'instagram',
                ig_username: username,
                profile_name: username,
                lead_stage: linkedUser ? 'in_app' : 'new',
                linked_user_id: linkedUser?.id || null,
                last_inbound_at: nowIso,
                custom_data: customData,
            }],
        });
        thread = inserted[0] || null;
    }
    if (!thread?.id) return { thread, message: null, accountConfig };

    const text = storedTextForGraphEvent(event, contentItem || {});
    const message = text
        ? await saveGraphInboundMessage({ thread, event, text })
        : null;
    return { thread, message, accountConfig };
}

function shouldAutoDraftEvent(event, accountConfig = {}) {
    if (event.type === 'story_reply') {
        return !!(accountConfig.autoDraftStoryReplies || AUTO_DRAFT_STORY_REPLIES);
    }
    if (event.type === 'message') return !!accountConfig.autoDraftMessages;
    return false;
}

async function dispatchDraft(thread, event) {
    if (!thread?.id || !event.messageId || !event.text) return { dispatched: false };
    try {
        const res = await fetch(`${SITE_URL}/.netlify/functions/ig-instant-draft-background`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                threadId: thread.id,
                messageText: event.text || '',
                manychatMessageId: graphMessageIds(event)[0] || event.messageId,
                source: graphMessageSourceForEvent(event),
            }),
        });
        return { dispatched: res.ok, status: res.status };
    } catch (err) {
        console.warn('[meta-ig-webhook] draft dispatch failed:', err.message);
        return { dispatched: false, error: err.message };
    }
}

exports.handler = async (event = {}) => {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
        return json(500, { error: 'Supabase env missing' });
    }

    if (event.httpMethod === 'GET') {
        const qs = event.queryStringParameters || {};
        const mode = qs['hub.mode'];
        const token = qs['hub.verify_token'];
        const challenge = qs['hub.challenge'];
        if (mode === 'subscribe' && token && token === VERIFY_TOKEN) {
            return {
                statusCode: 200,
                headers: { 'Content-Type': 'text/plain' },
                body: challenge || '',
            };
        }
        return json(403, { error: 'Webhook verification failed' });
    }

    if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
    if (!verifySignature(event)) return json(403, { error: 'Invalid signature' });

    let payload = {};
    try {
        payload = JSON.parse(event.body || '{}');
    } catch {
        return json(400, { error: 'Invalid JSON' });
    }

    const events = normalizeMetaIgWebhookEvents(payload);
    const processed = [];
    for (const igEvent of events) {
        try {
            const isContentInteraction = igEvent.type === 'comment' || igEvent.type === 'story_reply';
            const contentItem = isContentInteraction ? await ensureAnalyzedContent(igEvent) : null;
            const interaction = isContentInteraction ? await upsertInteraction(igEvent, contentItem) : null;
            let threadResult = { thread: null, message: null };
            let draft = { dispatched: false };
            if (igEvent.type === 'story_reply' || igEvent.type === 'message') {
                threadResult = await upsertGraphThread(igEvent, contentItem);
                if (threadResult.message) {
                    if (interaction?.id) {
                        await supabaseQuery(`ig_content_interactions?id=eq.${interaction.id}`, {
                            method: 'PATCH',
                            body: {
                                ig_thread_id: threadResult.thread?.id || null,
                                ig_message_id: threadResult.message?.id || null,
                            },
                            prefer: 'return=minimal',
                        });
                    }
                    if (!threadResult.message.deduped && shouldAutoDraftEvent(igEvent, threadResult.accountConfig)) {
                        draft = await dispatchDraft(threadResult.thread, igEvent);
                    }
                }
            }
            processed.push({
                event_id: igEvent.eventId,
                type: igEvent.type,
                owner_ig_user_id: igEvent.ownerId || null,
                from_ig_user_id: igEvent.fromId || null,
                bot_account: threadResult.accountConfig?.botAccount || null,
                content_item_id: contentItem?.id || null,
                interaction_id: interaction?.id || null,
                thread_id: threadResult.thread?.id || null,
                message_id: threadResult.message?.id || null,
                message_deduped: !!threadResult.message?.deduped,
                draft_dispatched: !!draft.dispatched,
            });
        } catch (err) {
            console.error('[meta-ig-webhook] event failed:', err);
            processed.push({ event_id: igEvent.eventId, type: igEvent.type, error: err.message });
        }
    }

    return json(200, { ok: true, received: events.length, processed });
};

exports._test = {
    verifySignature,
    buildContentPatch,
    graphMessageIds,
    graphMessageSourceForEvent,
    storedTextForGraphEvent,
    buildGraphCustomData,
    shouldAutoDraftEvent,
};
