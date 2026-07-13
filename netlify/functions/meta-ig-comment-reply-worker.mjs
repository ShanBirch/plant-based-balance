import clientContext from './_lib/client-context.js';
import metaIgContext from './_lib/meta-ig-context.js';
import metaIgAccounts from './_lib/meta-ig-accounts.js';

const {
    SUPABASE_URL,
    SUPABASE_SERVICE_KEY,
    supabaseQuery,
    callGeminiFallback,
    normalizeCoachDraftText,
    truncate,
} = clientContext;
const {
    contentTypeFromProduct,
    buildFallbackSummary,
} = metaIgContext;
const { resolveMetaIgAccessToken, resolveMetaIgAccountConfig } = metaIgAccounts;

const SOURCE = 'meta_ig_comment_reply_worker';
const OUTBOUND_SOURCE = 'instagram_comment_public_reply';
const PRIVATE_OUTBOUND_SOURCE = 'instagram_comment_private_reply';
const DEFAULT_TARGET_HANDLE = 'shan_n_sunny';
const DEFAULT_DELAY_MS = 4 * 60 * 1000;
const DEFAULT_MAX_COMMENT_AGE_HOURS = 6;
const DEFAULT_POLL_INTERVAL_MS = 60 * 1000;
const DEFAULT_MEDIA_LIMIT = 12;
const DEFAULT_COMMENTS_PER_MEDIA = 25;
const DEFAULT_DUE_LIMIT = 20;
const DEFAULT_MAX_REPLIES_PER_RUN = 5;
const DEFAULT_GRAPH_BASE = 'https://graph.instagram.com';
const SEND_STALE_MS = 10 * 60 * 1000;
const RETRY_BACKOFF_MS = 10 * 60 * 1000;
const MAX_SEND_ATTEMPTS = 3;

export const config = {
    schedule: '* * * * *',
};

function getEnv(name) {
    const netlifyValue = globalThis.Netlify?.env?.get?.(name);
    if (netlifyValue != null && netlifyValue !== '') return String(netlifyValue);
    return typeof process !== 'undefined' ? String(process.env?.[name] || '') : '';
}

function json(status, body) {
    return new Response(JSON.stringify(body), {
        status,
        headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store',
        },
    });
}

function cleanString(value, max = 500) {
    return String(value || '').trim().slice(0, max);
}

function normalizeHandle(value) {
    return cleanString(value, 120).replace(/^@+/, '').toLowerCase();
}

function boolish(value, fallback = false) {
    const raw = String(value ?? '').trim().toLowerCase();
    if (!raw) return fallback;
    if (['1', 'true', 'yes', 'y', 'on', 'enabled'].includes(raw)) return true;
    if (['0', 'false', 'no', 'n', 'off', 'disabled'].includes(raw)) return false;
    return fallback;
}

function intEnv(name, fallback, min, max) {
    const n = Number(getEnv(name));
    if (!Number.isFinite(n)) return fallback;
    return Math.max(min, Math.min(max, Math.floor(n)));
}

function normalizeGraphApiVersion(value) {
    const raw = cleanString(value, 40);
    if (!raw) return 'v25.0';
    return raw.startsWith('v') ? raw : `v${raw}`;
}

function graphBase() {
    return (getEnv('META_IG_GRAPH_BASE') || getEnv('INSTAGRAM_GRAPH_BASE') || DEFAULT_GRAPH_BASE).replace(/\/+$/, '');
}

function graphApiVersion() {
    return normalizeGraphApiVersion(
        getEnv('META_IG_API_VERSION')
        || getEnv('IG_GRAPH_API_VERSION')
        || getEnv('INSTAGRAM_GRAPH_API_VERSION')
        || getEnv('META_GRAPH_API_VERSION')
        || 'v25.0'
    );
}

function targetHandles() {
    const raw = getEnv('META_IG_COMMENT_REPLY_TARGET_HANDLES')
        || getEnv('META_IG_COMMENT_REPLY_TARGET_HANDLE')
        || DEFAULT_TARGET_HANDLE;
    return new Set(raw.split(/[,\s]+/).map(normalizeHandle).filter(Boolean));
}

function configuredAccountIds() {
    return [
        getEnv('META_IG_USER_ID'),
        getEnv('INSTAGRAM_GRAPH_ACCOUNT_ID'),
        getEnv('IG_GRAPH_BUSINESS_ACCOUNT_ID'),
        getEnv('INSTAGRAM_BUSINESS_ACCOUNT_ID'),
    ]
        .map(value => cleanString(value, 120))
        .filter(Boolean)
        .filter((value, index, list) => list.indexOf(value) === index);
}

function replyMode() {
    return cleanString(getEnv('META_IG_COMMENT_REPLY_MODE') || 'public', 20).toLowerCase() === 'private'
        ? 'private'
        : 'public';
}

function replySourceForMode(mode = replyMode()) {
    return mode === 'private' ? PRIVATE_OUTBOUND_SOURCE : OUTBOUND_SOURCE;
}

function configuredDelayMs() {
    return intEnv('META_IG_COMMENT_REPLY_DELAY_MS', DEFAULT_DELAY_MS, 60 * 1000, 30 * 60 * 1000);
}

function configuredMaxAgeMs() {
    const hours = intEnv('META_IG_COMMENT_REPLY_MAX_AGE_HOURS', DEFAULT_MAX_COMMENT_AGE_HOURS, 1, 72);
    return hours * 60 * 60 * 1000;
}

function configuredPollIntervalMs() {
    return intEnv('META_IG_COMMENT_REPLY_POLL_INTERVAL_MS', DEFAULT_POLL_INTERVAL_MS, 60 * 1000, 60 * 60 * 1000);
}

function shouldPollNow(nowMs = Date.now(), intervalMs = configuredPollIntervalMs()) {
    const intervalMinutes = Math.max(1, Math.round(intervalMs / (60 * 1000)));
    const currentMinute = Math.floor(nowMs / (60 * 1000));
    return currentMinute % intervalMinutes === 0;
}

function safeObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function timestampMs(value) {
    const parsed = Date.parse(value || '');
    return Number.isFinite(parsed) ? parsed : 0;
}

function commentTimestampMs(interaction = {}) {
    const raw = safeObject(interaction.raw_payload);
    const latest = safeObject(raw.latest_comment);
    return timestampMs(latest.timestamp || latest.created_time || interaction.received_at || interaction.created_at);
}

function replyState(interaction = {}) {
    return safeObject(safeObject(interaction.raw_payload).comment_reply);
}

function isTerminalReplyState(state = {}) {
    return ['sent', 'skipped', 'already_replied', 'blocked'].includes(cleanString(state.status, 40));
}

function isActiveSendState(state = {}, nowMs = Date.now()) {
    if (!['sending', 'claimed'].includes(cleanString(state.status, 40))) return false;
    const atMs = timestampMs(state.updated_at || state.claimed_at || state.attempted_at);
    return atMs && nowMs - atMs < SEND_STALE_MS;
}

function shouldRetryState(state = {}, nowMs = Date.now()) {
    const status = cleanString(state.status, 40);
    if (!status) return true;
    if (isTerminalReplyState(state)) return false;
    if (isActiveSendState(state, nowMs)) return false;
    if (status !== 'failed') return true;
    const attempts = Number(state.attempts || 0);
    if (attempts >= MAX_SEND_ATTEMPTS) return false;
    const lastAttemptMs = timestampMs(state.last_attempt_at || state.updated_at);
    return !lastAttemptMs || nowMs - lastAttemptMs >= RETRY_BACKOFF_MS;
}

function commentIsDue(interaction = {}, nowMs = Date.now(), delayMs = configuredDelayMs(), maxAgeMs = configuredMaxAgeMs()) {
    const commentMs = commentTimestampMs(interaction);
    if (!commentMs) return { due: false, reason: 'missing_comment_timestamp' };
    if (nowMs - commentMs > maxAgeMs) return { due: false, stale: true, reason: 'stale_comment' };
    const dueAtMs = commentMs + delayMs;
    return {
        due: nowMs >= dueAtMs,
        reason: nowMs >= dueAtMs ? 'due' : 'waiting_delay',
        due_at: new Date(dueAtMs).toISOString(),
    };
}

function mostlyEmojiOrPunctuation(text = '') {
    const stripped = cleanString(text, 500)
        .replace(/[a-z0-9]/gi, '')
        .replace(/\s+/g, '');
    const alnum = cleanString(text, 500).match(/[a-z0-9]/gi) || [];
    return alnum.length === 0 && stripped.length > 0;
}

function looksLikeSpam(text = '') {
    const value = cleanString(text, 1000).toLowerCase();
    if (!value) return true;
    if (/https?:\/\/|www\.|bit\.ly|link in bio|dm me|promote it|send it on|collab|crypto|forex|investment/i.test(value)) return true;
    if ((value.match(/@/g) || []).length >= 2) return true;
    if ((value.match(/#/g) || []).length >= 4) return true;
    return false;
}

function shouldSkipComment({ interaction = {}, content = {}, accountConfig = {}, handles = targetHandles() } = {}) {
    const text = cleanString(interaction.text || safeObject(interaction.raw_payload).latest_comment?.text || '', 1000);
    const commenter = normalizeHandle(interaction.from_username || safeObject(interaction.raw_payload).latest_comment?.username || '');
    const contentHandle = contentAccountHandle(content, accountConfig, handles);
    if (!text) return { skip: true, reason: 'empty_comment' };
    if (commenter && (commenter === contentHandle || commenter === normalizeHandle(accountConfig.botAccount))) {
        return { skip: true, reason: 'own_comment' };
    }
    if (looksLikeSpam(text)) return { skip: true, reason: 'spam_or_promo' };
    return { skip: false, reason: 'ok' };
}

function contentRaw(content = {}) {
    return safeObject(content.raw_payload);
}

function contentAccountId(content = {}) {
    const raw = contentRaw(content);
    const latestEvent = safeObject(raw.latest_event);
    const latestValue = safeObject(latestEvent.value);
    const latestMedia = safeObject(raw.latest_media);
    return cleanString(
        raw.owner_ig_user_id
        || raw.ig_graph_account_id
        || latestValue.owner?.id
        || latestValue.recipient?.id
        || latestEvent.owner_id
        || latestMedia.owner?.id
        || getEnv('META_IG_USER_ID')
        || getEnv('INSTAGRAM_GRAPH_ACCOUNT_ID')
        || getEnv('IG_GRAPH_BUSINESS_ACCOUNT_ID')
        || getEnv('INSTAGRAM_BUSINESS_ACCOUNT_ID'),
        120
    );
}

function contentAccountHandle(content = {}, accountConfig = {}, handles = targetHandles()) {
    const raw = contentRaw(content);
    const latestMedia = safeObject(raw.latest_media);
    const handle = normalizeHandle(
        latestMedia.username
        || raw.username
        || raw.account_handle
        || accountConfig.botAccount
        || getEnv('META_IG_BOT_ACCOUNT')
        || getEnv('IG_BOT_ACCOUNT')
    );
    if (handle) return handle;
    return handles.values().next().value || DEFAULT_TARGET_HANDLE;
}

function contentMatchesTarget(content = {}, accountConfig = {}, handles = targetHandles()) {
    const handle = contentAccountHandle(content, accountConfig, handles);
    return handles.size === 0 || handles.has(handle);
}

function parseJsonMaybe(text = '') {
    const raw = cleanString(text, 4000);
    if (!raw) return null;
    try {
        return JSON.parse(raw);
    } catch {
        const start = raw.indexOf('{');
        const end = raw.lastIndexOf('}');
        if (start >= 0 && end > start) {
            try {
                return JSON.parse(raw.slice(start, end + 1));
            } catch {
                return null;
            }
        }
    }
    return null;
}

function sanitizePublicReply(text = '', max = 220) {
    let value = normalizeCoachDraftText(text || '')
        .replace(/^```(?:json|text)?/i, '')
        .replace(/```$/i, '')
        .replace(/^(?:reply|message|comment)\s*:\s*/i, '')
        .replace(/^["'`]+|["'`]+$/g, '')
        .replace(/https?:\/\/\S+/gi, '')
        .replace(/#[A-Za-z0-9_]+/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    if (!value) return '';
    const hadDmClaim = /\b(?:dm'?d|dmed|dmd|sent)\s+(?:it\s+)?(?:you|ya|u)\b|\bcheck\s+(?:your\s+)?dms?\b/i.test(value);
    if (hadDmClaim) {
        value = value
            .replace(/\b(?:dm'?d|dmed|dmd)\s+(?:it\s+)?(?:you|ya|u)\b/ig, 'got you')
            .replace(/\bsent\s+(?:it\s+)?(?:you|ya|u)\b/ig, 'got you')
            .replace(/\bcheck\s+(?:your\s+)?dms?\b/ig, '')
            .replace(/\s+/g, ' ')
            .trim();
    }
    value = value
        .replace(/[^\x00-\x7F]+/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    if (hadDmClaim) {
        value = value
            .replace(/^[\s,;:.-]+|[\s,;:.-]+$/g, '')
            .replace(/\bgot you\b(?:[\s,;:.-]+\bgot you\b)+/ig, 'got you')
            .replace(/\s+/g, ' ')
            .trim();
    }
    value = value.replace(/^@\S+\s+/, '').trim();
    if (value.length <= max) return value;
    const clipped = value.slice(0, max + 1);
    const sentence = clipped.match(/^(.{40,220}?[.!?])(?:\s|$)/);
    if (sentence?.[1] && sentence[1].length >= 40) return sentence[1].trim();
    return clipped.slice(0, max).replace(/\s+\S*$/, '').replace(/[,\s]+$/, '').trim();
}

function parseReplyDecision(rawText = '') {
    const parsed = parseJsonMaybe(rawText);
    if (parsed) {
        const action = cleanString(parsed.action || parsed.decision || 'reply', 20).toLowerCase();
        const reply = sanitizePublicReply(parsed.reply || parsed.message || parsed.text || '');
        const reason = cleanString(parsed.reason || '', 240);
        if (action === 'skip' || action === 'hold') return { action: 'skip', reply: '', reason: reason || action };
        if (!reply) return { action: 'skip', reply: '', reason: reason || 'empty_reply' };
        return { action: 'reply', reply, reason };
    }
    const reply = sanitizePublicReply(rawText);
    return reply ? { action: 'reply', reply, reason: 'plain_text' } : { action: 'skip', reply: '', reason: 'empty_reply' };
}

function buildCommentReplyPrompt({ interaction = {}, content = {}, accountHandle = DEFAULT_TARGET_HANDLE } = {}) {
    const raw = safeObject(interaction.raw_payload);
    const commentText = cleanString(interaction.text || safeObject(raw.latest_comment).text || '', 1000);
    const username = cleanString(interaction.from_username || safeObject(raw.latest_comment).username || 'someone', 120);
    const summary = cleanString(content.analysis_reply_context || content.analysis_summary || '', 900);
    const visibleText = cleanString(content.analysis_visible_text || '', 900);
    const caption = cleanString(content.caption || safeObject(contentRaw(content).latest_media).caption || '', 1200);
    const contentType = cleanString(content.content_type || 'post', 40);
    return `You are writing one public Instagram comment reply as Shannon from @${accountHandle}.

Return JSON only:
{"action":"reply","reply":"short public reply","reason":"brief reason"}
or:
{"action":"skip","reply":"","reason":"brief reason"}

Rules:
- Reply to genuine engagement, including emoji-only comments. Skip spam, promo, tags-only, hostile bait, medical claims needing nuance, or anything that would be weird to automate.
- For emoji-only comments, use the post context and write a tiny natural reaction. Never use a fixed acknowledgement for every comment.
- Keep it very chill: usually 2-12 words, never a paragraph.
- Sound like Shannon: casual, grounded, Australian, not corporate, not hypey.
- No greeting, no hashtags, no links, no emojis, no sales pitch, no "AI", no "coach bot".
- Do not say "DM'd you", "DMed you", "sent it", or "check your DMs" in public mode because this worker is replying publicly.
- Do not invent facts about the commenter.
- If it is a compliment, keep it simple: "appreciate you", "thanks heaps", "exactly", "glad it landed", or similar.
- If it looks like a reel CTA keyword/request, keep the public reply to a quiet acknowledgement like "got you" or "easy, got you".
- Ask a question only if it is genuinely useful and easy to answer.

Post type: ${contentType}
Post summary: ${summary || '(not available)'}
Visible text: ${visibleText || '(not available)'}
Caption: ${caption || '(not available)'}
Commenter: ${username}
Comment: ${commentText}`;
}

async function graphGet(path, params = {}, token) {
    const url = new URL(`${graphBase()}/${graphApiVersion()}/${String(path).replace(/^\/+/, '')}`);
    Object.entries(params || {}).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, value);
    });
    const response = await fetch(url.toString(), {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    const text = await response.text();
    let parsed = null;
    try { parsed = text ? JSON.parse(text) : null; } catch { parsed = { raw: text }; }
    if (!response.ok) {
        const detail = parsed?.error?.message || text || `HTTP ${response.status}`;
        throw new Error(`Graph ${response.status}: ${String(detail).slice(0, 300)}`);
    }
    return parsed;
}

async function graphPost(path, body = {}, token) {
    const response = await fetch(`${graphBase()}/${graphApiVersion()}/${String(path).replace(/^\/+/, '')}`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });
    const text = await response.text();
    let parsed = null;
    try { parsed = text ? JSON.parse(text) : {}; } catch { parsed = { raw: text }; }
    if (!response.ok) {
        const detail = parsed?.error?.message || text || `HTTP ${response.status}`;
        throw new Error(`Graph ${response.status}: ${String(detail).slice(0, 400)}`);
    }
    return parsed;
}

function normalizeEdgeRows(value) {
    if (Array.isArray(value)) return value;
    if (Array.isArray(value?.data)) return value.data;
    return [];
}

function buildGraphCommentReplyPath(commentId, mode = replyMode()) {
    const cleanId = cleanString(commentId, 160);
    return mode === 'private'
        ? `${encodeURIComponent(cleanId)}/private_replies`
        : `${encodeURIComponent(cleanId)}/replies`;
}

async function postCommentReply({ commentId, text, token, mode = replyMode() }) {
    return graphPost(buildGraphCommentReplyPath(commentId, mode), { message: text }, token);
}

async function fetchExistingReplies({ commentId, token }) {
    const data = await graphGet(`${encodeURIComponent(commentId)}/replies`, {
        fields: 'id,text,username,from,timestamp',
        limit: 25,
    }, token);
    return normalizeEdgeRows(data);
}

function replyLooksOwned(reply = {}, accountConfig = {}, accountId = '') {
    const username = normalizeHandle(reply.username || reply.from?.username || '');
    const bot = normalizeHandle(accountConfig.botAccount || getEnv('META_IG_BOT_ACCOUNT') || getEnv('IG_BOT_ACCOUNT'));
    const fromId = cleanString(reply.from?.id || '', 120);
    return (bot && username === bot) || (accountId && fromId === accountId);
}

async function hasExistingOwnerReply({ commentId, token, accountConfig, accountId }) {
    try {
        const replies = await fetchExistingReplies({ commentId, token });
        return replies.some(reply => replyLooksOwned(reply, accountConfig, accountId));
    } catch (error) {
        console.warn('[meta-ig-comment-reply-worker] existing replies lookup failed:', error.message);
        return false;
    }
}

async function loadRecentContentItems(limit = DEFAULT_MEDIA_LIMIT) {
    return supabaseQuery(
        `ig_content_items?select=id,source_key,ig_media_id,content_type,media_product_type,caption,analysis_summary,analysis_visible_text,analysis_reply_context,raw_payload,posted_at,created_at` +
        `&ig_media_id=not.is.null&order=posted_at.desc.nullslast,created_at.desc&limit=${limit}`
    );
}

async function loadContentBySourceKey(sourceKey) {
    if (!sourceKey) return null;
    const rows = await supabaseQuery(
        `ig_content_items?select=id,source_key,ig_media_id,content_type,media_product_type,caption,analysis_summary,analysis_visible_text,analysis_reply_context,raw_payload,posted_at,created_at&source_key=eq.${encodeURIComponent(sourceKey)}&limit=1`
    );
    return rows[0] || null;
}

async function loadContentItem(id) {
    if (!id) return null;
    const rows = await supabaseQuery(
        `ig_content_items?select=id,source_key,ig_media_id,content_type,media_product_type,caption,analysis_summary,analysis_visible_text,analysis_reply_context,raw_payload,posted_at,created_at&id=eq.${encodeURIComponent(id)}&limit=1`
    );
    return rows[0] || null;
}

async function fetchMediaComments({ mediaId, token, limit = DEFAULT_COMMENTS_PER_MEDIA }) {
    const data = await graphGet(`${encodeURIComponent(mediaId)}/comments`, {
        fields: 'id,text,timestamp,username,from,like_count',
        limit,
    }, token);
    return normalizeEdgeRows(data);
}

async function fetchAccountProfile({ accountId, token }) {
    return graphGet(accountId, { fields: 'id,username,account_type' }, token);
}

async function fetchAccountMedia({ accountId, token, limit = DEFAULT_MEDIA_LIMIT }) {
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
        'comments_count',
        'like_count',
    ].join(',');
    const data = await graphGet(`${accountId}/media`, { fields, limit }, token);
    return normalizeEdgeRows(data);
}

function rowFromGraphMedia({ media = {}, accountId = '', accountHandle = '' } = {}) {
    const productType = media.media_product_type || media.media_type || null;
    const contentType = contentTypeFromProduct(productType, 'post');
    const postedAt = media.timestamp || null;
    const row = {
        source_key: `ig_media:${media.id}`,
        ig_media_id: cleanString(media.id, 160),
        content_type: contentType,
        media_product_type: productType,
        media_type: media.media_type || null,
        caption: media.caption || null,
        permalink: media.permalink || null,
        media_url: media.media_url || null,
        thumbnail_url: media.thumbnail_url || null,
        posted_at: postedAt,
        media_url_expires_at: media.media_url ? new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString() : null,
    };
    return {
        ...row,
        raw_payload: {
            latest_media: media,
            latest_counts: {
                comments_count: Number(media.comments_count || 0),
                like_count: Number(media.like_count || 0),
            },
            latest_graph_synced_at: new Date().toISOString(),
            owner_ig_user_id: accountId || null,
            target_account: accountHandle || null,
            media_discovery_source: SOURCE,
        },
    };
}

async function upsertDiscoveredMedia({ media, accountId, accountHandle }) {
    if (!media?.id) return { saved: false };
    const row = rowFromGraphMedia({ media, accountId, accountHandle });
    const existing = await loadContentBySourceKey(row.source_key);
    const body = {
        ...row,
        raw_payload: {
            ...safeObject(existing?.raw_payload),
            ...safeObject(row.raw_payload),
        },
    };
    if (!existing?.analysis_summary) {
        body.analysis_status = existing?.analysis_status || 'skipped';
        body.analysis_summary = buildFallbackSummary(body);
        body.analysis_model = existing?.analysis_model || 'none';
    }
    const rows = await supabaseQuery('ig_content_items?on_conflict=source_key', {
        method: 'POST',
        body: [body],
        prefer: 'resolution=merge-duplicates,return=representation',
    });
    return { saved: !!rows[0], inserted: !existing, id: rows[0]?.id || existing?.id || null };
}

async function discoverRecentMedia() {
    const handles = targetHandles();
    const accountIds = configuredAccountIds();
    const limit = intEnv('META_IG_COMMENT_REPLY_MEDIA_LIMIT', DEFAULT_MEDIA_LIMIT, 1, 50);
    const summary = { accounts_seen: accountIds.length, accounts_scanned: 0, media_seen: 0, media_saved: 0, errors: [] };

    for (const accountId of accountIds) {
        const accountConfig = resolveMetaIgAccountConfig(accountId);
        const { token } = await resolveMetaIgAccessToken(accountId, supabaseQuery);
        if (!token) {
            summary.errors.push({ account_id: accountId, error: 'instagram_graph_token_missing' });
            continue;
        }
        try {
            const profile = await fetchAccountProfile({ accountId, token }).catch(() => null);
            const accountHandle = normalizeHandle(profile?.username || accountConfig.botAccount || '');
            if (handles.size && accountHandle && !handles.has(accountHandle)) continue;
            const mediaRows = await fetchAccountMedia({ accountId, token, limit });
            summary.accounts_scanned += 1;
            summary.media_seen += mediaRows.length;
            for (const media of mediaRows) {
                const saved = await upsertDiscoveredMedia({
                    media: {
                        ...media,
                        username: media.username || accountHandle || undefined,
                    },
                    accountId,
                    accountHandle,
                });
                if (saved.saved) summary.media_saved += 1;
            }
        } catch (error) {
            summary.errors.push({ account_id: accountId, error: error.message });
        }
    }

    return summary;
}

function sourceEventIdForComment(comment = {}) {
    const id = cleanString(comment.id || comment.comment_id, 160);
    return id ? `comment:${id}` : '';
}

async function loadInteractionBySourceEventId(sourceEventId) {
    const rows = await supabaseQuery(
        `ig_content_interactions?select=id,source_event_id,event_type,content_item_id,comment_id,message_id,from_ig_user_id,from_username,text,media_product_type,raw_payload,received_at,processed_at,created_at&source_event_id=eq.${encodeURIComponent(sourceEventId)}&limit=1`
    );
    return rows[0] || null;
}

function commentUsername(comment = {}) {
    return cleanString(comment.username || comment.from?.username || '', 120);
}

async function persistPolledComment({ comment, content, accountId, accountHandle }) {
    const sourceEventId = sourceEventIdForComment(comment);
    if (!sourceEventId) return { inserted: false, skipped: true };
    const existing = await loadInteractionBySourceEventId(sourceEventId);
    const nowIso = new Date().toISOString();
    const baseRaw = {
        ...safeObject(existing?.raw_payload),
        latest_comment: comment,
        poll_synced_at: nowIso,
        poll_source: SOURCE,
        owner_ig_user_id: accountId || null,
        target_account: accountHandle || null,
        media_id: content.ig_media_id || null,
    };
    const row = {
        event_type: 'comment',
        content_item_id: content.id || null,
        comment_id: cleanString(comment.id, 160) || null,
        from_ig_user_id: cleanString(comment.from?.id, 160) || null,
        from_username: commentUsername(comment) || null,
        text: cleanString(comment.text, 2000) || null,
        media_product_type: content.media_product_type || null,
        raw_payload: baseRaw,
        processed_at: nowIso,
    };

    if (existing?.id) {
        await supabaseQuery(`ig_content_interactions?id=eq.${encodeURIComponent(existing.id)}`, {
            method: 'PATCH',
            body: row,
            prefer: 'return=minimal',
        });
        return { inserted: false, updated: true };
    }

    await supabaseQuery('ig_content_interactions', {
        method: 'POST',
        body: [{ ...row, source_event_id: sourceEventId }],
        prefer: 'return=minimal',
    });
    return { inserted: true, updated: false };
}

async function pollRecentComments() {
    const limit = intEnv('META_IG_COMMENT_REPLY_MEDIA_LIMIT', DEFAULT_MEDIA_LIMIT, 1, 50);
    const commentsLimit = intEnv('META_IG_COMMENT_REPLY_COMMENTS_PER_MEDIA', DEFAULT_COMMENTS_PER_MEDIA, 1, 100);
    const handles = targetHandles();
    const discovery = await discoverRecentMedia().catch(error => ({
        accounts_seen: 0,
        accounts_scanned: 0,
        media_seen: 0,
        media_saved: 0,
        errors: [{ error: error.message }],
    }));
    const mediaRows = await loadRecentContentItems(limit);
    const summary = { discovery, media_seen: mediaRows.length, media_scanned: 0, comments_seen: 0, comments_inserted: 0, comments_updated: 0, errors: [] };

    for (const content of mediaRows) {
        const accountId = contentAccountId(content);
        const accountConfig = resolveMetaIgAccountConfig(accountId);
        if (!contentMatchesTarget(content, accountConfig, handles)) continue;
        const { token } = await resolveMetaIgAccessToken(accountId, supabaseQuery);
        if (!token) {
            summary.errors.push({ media_id: content.ig_media_id, error: 'instagram_graph_token_missing' });
            continue;
        }
        try {
            const comments = await fetchMediaComments({ mediaId: content.ig_media_id, token, limit: commentsLimit });
            summary.media_scanned += 1;
            summary.comments_seen += comments.length;
            const accountHandle = contentAccountHandle(content, accountConfig, handles);
            for (const comment of comments) {
                const result = await persistPolledComment({ comment, content, accountId, accountHandle });
                if (result.inserted) summary.comments_inserted += 1;
                if (result.updated) summary.comments_updated += 1;
            }
        } catch (error) {
            console.warn('[meta-ig-comment-reply-worker] comment poll failed:', error.message);
            summary.errors.push({ media_id: content.ig_media_id, error: error.message });
        }
    }
    return summary;
}

async function loadDueCommentInteractions(nowMs = Date.now()) {
    const delayMs = configuredDelayMs();
    const maxAgeMs = configuredMaxAgeMs();
    const dueCutoff = new Date(nowMs - delayMs).toISOString();
    const freshCutoff = new Date(nowMs - maxAgeMs).toISOString();
    const limit = intEnv('META_IG_COMMENT_REPLY_DUE_LIMIT', DEFAULT_DUE_LIMIT, 1, 100);
    return supabaseQuery(
        `ig_content_interactions?select=id,source_event_id,event_type,content_item_id,comment_id,message_id,from_ig_user_id,from_username,text,media_product_type,raw_payload,received_at,processed_at,created_at` +
        `&event_type=eq.comment&comment_id=not.is.null&received_at=lte.${encodeURIComponent(dueCutoff)}&received_at=gte.${encodeURIComponent(freshCutoff)}` +
        `&order=received_at.asc&limit=${limit}`
    );
}

async function patchReplyState(interaction, statePatch) {
    const raw = safeObject(interaction.raw_payload);
    const nextRaw = {
        ...raw,
        comment_reply: {
            ...safeObject(raw.comment_reply),
            ...statePatch,
            updated_at: new Date().toISOString(),
            source: SOURCE,
        },
    };
    await supabaseQuery(`ig_content_interactions?id=eq.${encodeURIComponent(interaction.id)}`, {
        method: 'PATCH',
        body: { raw_payload: nextRaw },
        prefer: 'return=minimal',
    });
}

async function draftCommentReply({ interaction, content, accountHandle }) {
    const prompt = buildCommentReplyPrompt({ interaction, content, accountHandle });
    const raw = await callGeminiFallback(
        [{ role: 'user', parts: [{ text: prompt }] }],
        { maxOutputTokens: 260, temperature: 0.45 }
    );
    return parseReplyDecision(raw);
}

async function processOneDueComment({ interaction, content, nowMs = Date.now(), dryRun = false }) {
    const state = replyState(interaction);
    if (!shouldRetryState(state, nowMs)) return { sent: false, skipped: true, reason: `state_${state.status || 'unknown'}` };

    const due = commentIsDue(interaction, nowMs);
    if (!due.due) {
        if (due.stale && !state.status) {
            await patchReplyState(interaction, { status: 'skipped', reason: due.reason, skipped_at: new Date(nowMs).toISOString() });
        }
        return { sent: false, skipped: true, reason: due.reason };
    }

    const accountId = contentAccountId(content);
    const accountConfig = resolveMetaIgAccountConfig(accountId);
    const handles = targetHandles();
    if (!contentMatchesTarget(content, accountConfig, handles)) {
        await patchReplyState(interaction, { status: 'skipped', reason: 'not_target_account', skipped_at: new Date(nowMs).toISOString() });
        return { sent: false, skipped: true, reason: 'not_target_account' };
    }

    const skip = shouldSkipComment({ interaction, content, accountConfig, handles });
    if (skip.skip) {
        await patchReplyState(interaction, { status: 'skipped', reason: skip.reason, skipped_at: new Date(nowMs).toISOString() });
        return { sent: false, skipped: true, reason: skip.reason };
    }

    const { token, source: tokenSource } = await resolveMetaIgAccessToken(accountId, supabaseQuery);
    if (!token) {
        await patchReplyState(interaction, { status: 'failed', reason: 'instagram_graph_token_missing', attempts: Number(state.attempts || 0) + 1, last_attempt_at: new Date(nowMs).toISOString() });
        return { sent: false, failed: true, reason: 'instagram_graph_token_missing' };
    }

    const mode = replyMode();
    if (mode === 'public' && await hasExistingOwnerReply({ commentId: interaction.comment_id, token, accountConfig, accountId })) {
        await patchReplyState(interaction, { status: 'already_replied', reason: 'owner_reply_exists', checked_at: new Date(nowMs).toISOString() });
        return { sent: false, skipped: true, reason: 'owner_reply_exists' };
    }

    const accountHandle = contentAccountHandle(content, accountConfig, handles);
    const decision = await draftCommentReply({ interaction, content, accountHandle });
    if (decision.action !== 'reply' || !decision.reply) {
        await patchReplyState(interaction, { status: 'skipped', reason: decision.reason || 'ai_skip', skipped_at: new Date(nowMs).toISOString() });
        return { sent: false, skipped: true, reason: decision.reason || 'ai_skip' };
    }

    const nextAttempts = Number(state.attempts || 0) + 1;
    const attemptAt = new Date(nowMs).toISOString();
    await patchReplyState(interaction, {
        status: dryRun ? 'dry_run' : 'sending',
        reason: decision.reason || null,
        reply_text: decision.reply,
        due_at: due.due_at || null,
        mode,
        outbound_source: replySourceForMode(mode),
        attempts: nextAttempts,
        last_attempt_at: attemptAt,
        token_source: tokenSource || null,
    });

    if (dryRun) {
        return { sent: false, dry_run: true, reply: decision.reply, reason: 'dry_run' };
    }

    try {
        const graphResponse = await postCommentReply({
            commentId: interaction.comment_id,
            text: decision.reply,
            token,
            mode,
        });
        await patchReplyState(interaction, {
            status: 'sent',
            sent_at: new Date().toISOString(),
            reply_text: decision.reply,
            mode,
            outbound_source: replySourceForMode(mode),
            graph_response: graphResponse || {},
            graph_reply_id: graphResponse?.id || graphResponse?.message_id || null,
            token_source: tokenSource || null,
        });
        return { sent: true, reply_id: graphResponse?.id || graphResponse?.message_id || null, mode };
    } catch (error) {
        const terminal = nextAttempts >= MAX_SEND_ATTEMPTS;
        await patchReplyState(interaction, {
            status: terminal ? 'blocked' : 'failed',
            reason: 'graph_send_failed',
            error: error.message,
            attempts: nextAttempts,
            last_attempt_at: attemptAt,
            reply_text: decision.reply,
            mode,
        });
        return { sent: false, failed: true, blocked: terminal, reason: 'graph_send_failed', error: error.message };
    }
}

async function processDueComments({ dryRun = false } = {}) {
    const nowMs = Date.now();
    const dueRows = await loadDueCommentInteractions(nowMs);
    const contentCache = new Map();
    const maxReplies = intEnv('META_IG_COMMENT_REPLY_MAX_PER_RUN', DEFAULT_MAX_REPLIES_PER_RUN, 1, 25);
    const summary = { due_seen: dueRows.length, sent: 0, dry_run: 0, skipped: 0, failed: 0, blocked: 0, errors: [] };

    for (const interaction of dueRows) {
        if (summary.sent + summary.dry_run >= maxReplies) break;
        try {
            let content = contentCache.get(interaction.content_item_id);
            if (!content && interaction.content_item_id) {
                content = await loadContentItem(interaction.content_item_id);
                contentCache.set(interaction.content_item_id, content);
            }
            if (!content) {
                await patchReplyState(interaction, { status: 'skipped', reason: 'missing_content_item', skipped_at: new Date(nowMs).toISOString() });
                summary.skipped += 1;
                continue;
            }
            const result = await processOneDueComment({ interaction, content, nowMs, dryRun });
            if (result.sent) summary.sent += 1;
            else if (result.dry_run) summary.dry_run += 1;
            else if (result.blocked) summary.blocked += 1;
            else if (result.failed) summary.failed += 1;
            else summary.skipped += 1;
        } catch (error) {
            summary.failed += 1;
            summary.errors.push({ interaction_id: interaction.id, error: error.message });
            console.warn('[meta-ig-comment-reply-worker] due comment failed:', error.message);
        }
    }
    return summary;
}

function parseBody(req) {
    return req.text()
        .then(text => {
            if (!text) return {};
            try { return JSON.parse(text); } catch { return {}; }
        })
        .catch(() => ({}));
}

export default async function handler(req) {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
        return json(500, { ok: false, error: 'Supabase env missing' });
    }
    if (req.method !== 'GET' && req.method !== 'POST') {
        return json(405, { ok: false, error: 'Method not allowed' });
    }

    const url = new URL(req.url);
    const body = req.method === 'POST' ? await parseBody(req) : {};
    const action = cleanString(url.searchParams.get('action') || body.action || '', 40);
    const enabled = boolish(getEnv('META_IG_COMMENT_REPLY_ENABLED'), true);
    const dryRun = boolish(url.searchParams.get('dry_run') || body.dry_run || getEnv('META_IG_COMMENT_REPLY_DRY_RUN'), false);

    if (!enabled && action !== 'status') {
        return json(200, { ok: true, enabled: false, skipped: 'comment_reply_disabled' });
    }

    if (action === 'status') {
        return json(200, {
            ok: true,
            enabled,
            dry_run: dryRun,
            mode: replyMode(),
            target_handles: [...targetHandles()],
            delay_ms: configuredDelayMs(),
            max_comment_age_hours: Math.round(configuredMaxAgeMs() / (60 * 60 * 1000)),
            poll_interval_ms: configuredPollIntervalMs(),
        });
    }

    const shouldPoll = boolish(getEnv('META_IG_COMMENT_REPLY_POLL_ENABLED'), true);
    const pollDue = shouldPoll && (action === 'poll' || shouldPollNow());
    const poll = pollDue ? await pollRecentComments() : {
        skipped: shouldPoll ? 'poll_interval_wait' : 'poll_disabled',
        poll_interval_ms: configuredPollIntervalMs(),
    };
    const replies = action === 'poll' ? { skipped: 'poll_only' } : await processDueComments({ dryRun });
    return json(200, {
        ok: true,
        enabled,
        dry_run: dryRun,
        mode: replyMode(),
        poll,
        replies,
    });
}

export const _test = {
    buildCommentReplyPrompt,
    buildGraphCommentReplyPath,
    commentIsDue,
    contentMatchesTarget,
    configuredPollIntervalMs,
    mostlyEmojiOrPunctuation,
    normalizeHandle,
    parseReplyDecision,
    replySourceForMode,
    sanitizePublicReply,
    shouldRetryState,
    shouldSkipComment,
    shouldPollNow,
    looksLikeSpam,
};
