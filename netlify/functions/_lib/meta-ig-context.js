const crypto = require('crypto');

const {
    callGeminiFallback,
    callVertexGeminiMultimodal,
    buildMessageMediaParts,
    truncate,
} = require('./client-context');

function cleanText(value, max = 4000) {
    return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function parseJsonMaybe(text) {
    const raw = String(text || '').trim();
    if (!raw) return null;
    const unfenced = raw
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();
    try {
        return JSON.parse(unfenced);
    } catch {
        const match = unfenced.match(/\{[\s\S]*\}/);
        if (!match) return null;
        try {
            return JSON.parse(match[0]);
        } catch {
            return null;
        }
    }
}

function hash(value) {
    return crypto.createHash('sha256').update(String(value || '')).digest('hex').slice(0, 24);
}

function normalizeTimestamp(value) {
    if (!value) return null;
    if (typeof value === 'number') {
        const ms = value > 9999999999 ? value : value * 1000;
        const d = new Date(ms);
        return Number.isNaN(d.getTime()) ? null : d.toISOString();
    }
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function contentTypeFromProduct(productType, fallback = 'unknown') {
    const raw = String(productType || '').toUpperCase();
    if (raw.includes('STORY')) return 'story';
    if (raw.includes('REEL')) return 'reel';
    if (raw.includes('CAROUSEL')) return 'carousel';
    if (raw.includes('LIVE')) return 'live';
    if (raw.includes('AD')) return 'ad';
    if (raw.includes('FEED') || raw.includes('IMAGE') || raw.includes('VIDEO')) return 'post';
    return fallback;
}

function mediaMarkerForUrl(url, mediaType = '') {
    const clean = String(url || '').trim();
    if (!clean) return '';
    const rawType = String(mediaType || '').toUpperCase();
    if (rawType.includes('VIDEO') || /\.mp4(\?|$)/i.test(clean) || /\.mov(\?|$)/i.test(clean)) {
        return `[VIDEO:${clean}]`;
    }
    return `[PHOTO:${clean}]`;
}

function sourceKeyForEvent(event = {}) {
    if (event.mediaId) return `ig_media:${event.mediaId}`;
    if (event.storyId) return `ig_story:${event.storyId}`;
    if (event.storyUrl) return `ig_story_url:${hash(event.storyUrl)}`;
    return `ig_unknown:${hash(JSON.stringify(event.raw || event))}`;
}

function normalizeCommentEvent(entry, value, field, rawChange) {
    if (!value || !value.id) return null;
    const media = value.media || {};
    const mediaProductType = media.media_product_type || value.media_product_type || null;
    return {
        type: 'comment',
        eventId: `comment:${value.id}`,
        commentId: String(value.id),
        messageId: null,
        text: cleanText(value.text || ''),
        fromId: value.from?.id ? String(value.from.id) : (value.sender_id ? String(value.sender_id) : null),
        username: value.from?.username || value.username || null,
        mediaId: media.id ? String(media.id) : (value.media_id ? String(value.media_id) : null),
        storyId: null,
        storyUrl: null,
        mediaProductType,
        contentType: contentTypeFromProduct(mediaProductType, field === 'live_comments' ? 'live' : 'unknown'),
        timestamp: normalizeTimestamp(entry?.time || value.created_time || value.timestamp),
        raw: rawChange || value,
    };
}

function normalizeStoryReplyEvent(entry, messageEvent) {
    const message = messageEvent?.message || {};
    const story = message.reply_to?.story || {};
    if (!story.id && !story.url) return null;
    const senderId = messageEvent.sender?.id ? String(messageEvent.sender.id) : null;
    const mid = message.mid ? String(message.mid) : `story:${senderId || 'unknown'}:${messageEvent.timestamp || Date.now()}:${story.id || hash(story.url)}`;
    return {
        type: 'story_reply',
        eventId: `story_reply:${mid}`,
        commentId: null,
        messageId: mid,
        text: cleanText(message.text || ''),
        fromId: senderId,
        username: messageEvent.sender?.username || null,
        mediaId: null,
        storyId: story.id ? String(story.id) : null,
        storyUrl: story.url || null,
        mediaProductType: 'STORY',
        contentType: 'story',
        timestamp: normalizeTimestamp(messageEvent.timestamp || entry?.time),
        raw: messageEvent,
    };
}

function normalizeMetaIgWebhookEvents(payload = {}) {
    const events = [];
    for (const entry of Array.isArray(payload.entry) ? payload.entry : []) {
        const changeList = Array.isArray(entry.changes)
            ? entry.changes
            : (entry.field && entry.value ? [{ field: entry.field, value: entry.value }] : []);
        for (const change of changeList) {
            if (change?.field !== 'comments' && change?.field !== 'live_comments') continue;
            const value = change.value || {};
            const comment = normalizeCommentEvent(entry, value, change.field, change);
            if (comment) events.push(comment);
        }
        for (const messageEvent of Array.isArray(entry.messaging) ? entry.messaging : []) {
            const storyReply = normalizeStoryReplyEvent(entry, messageEvent);
            if (storyReply) events.push(storyReply);
        }
    }
    return events;
}

function buildFallbackSummary(content = {}) {
    const parts = [];
    const type = content.content_type || content.contentType || 'Instagram content';
    if (content.caption) parts.push(`Caption: ${cleanText(content.caption, 700)}`);
    if (content.media_product_type || content.mediaProductType) parts.push(`Format: ${content.media_product_type || content.mediaProductType}`);
    if (content.permalink) parts.push(`Link: ${content.permalink}`);
    if (!parts.length) return `${type} from Shannon's Instagram.`;
    return `${type}: ${parts.join(' | ')}`;
}

async function analyzeInstagramContent(content = {}) {
    const mediaUrl = content.media_url || content.mediaUrl || content.thumbnail_url || content.thumbnailUrl || '';
    const mediaType = content.media_type || content.mediaType || content.media_product_type || content.mediaProductType || '';
    const marker = mediaMarkerForUrl(mediaUrl, mediaType);
    const caption = cleanText(content.caption || '', 1200);
    const prompt = `Analyze this Instagram content for Shannon's Balance DM reply system.

Return JSON only:
{
  "summary": "one sentence describing what Shannon posted",
  "visible_text": "any readable text on the image/video, or empty string",
  "topics": ["short topic", "short topic"],
  "offer_angle": "how this could naturally connect to Balance or the 30-day challenge, if at all",
  "reply_context": "short context line an AI draft should know before replying to someone who reacted"
}

Keep it practical. Do not mention AI. Do not invent medical claims or exact details you cannot see.

Known caption/context: ${caption || '(none supplied)'}
Content type: ${content.content_type || content.contentType || 'unknown'}
Media product type: ${content.media_product_type || content.mediaProductType || 'unknown'}`;

    let mediaParts = [];
    if (marker) {
        try {
            const built = await buildMessageMediaParts(marker);
            mediaParts = built.mediaParts || [];
        } catch (err) {
            return {
                analysis_status: 'failed',
                analysis_summary: buildFallbackSummary(content),
                analysis_error: `media_fetch_failed: ${err.message.slice(0, 240)}`,
                analysis_model: 'none',
            };
        }
    }

    const contents = [{ role: 'user', parts: [{ text: prompt }, ...mediaParts] }];
    const generationConfig = { maxOutputTokens: 700, temperature: 0.2 };
    let raw = '';
    let model = 'gemini';
    try {
        raw = await callGeminiFallback(contents, generationConfig);
    } catch (err) {
        try {
            raw = await callVertexGeminiMultimodal(contents, generationConfig);
            model = 'vertex-gemini';
        } catch (err2) {
            return {
                analysis_status: 'failed',
                analysis_summary: buildFallbackSummary(content),
                analysis_error: `${err.message.slice(0, 160)} | ${err2.message.slice(0, 160)}`,
                analysis_model: 'none',
            };
        }
    }

    const parsed = parseJsonMaybe(raw) || {};
    const summary = cleanText(parsed.summary || '', 800) || buildFallbackSummary(content);
    const topics = Array.isArray(parsed.topics)
        ? parsed.topics.map(t => cleanText(t, 60)).filter(Boolean).slice(0, 8)
        : [];
    return {
        analysis_status: 'analyzed',
        analysis_summary: summary,
        analysis_visible_text: cleanText(parsed.visible_text || '', 1000) || null,
        analysis_topics: topics,
        analysis_offer_angle: cleanText(parsed.offer_angle || '', 700) || null,
        analysis_reply_context: cleanText(parsed.reply_context || summary, 900),
        analysis_model: model,
        analysis_error: null,
    };
}

function buildContextMessage(event = {}, content = {}) {
    const summary = content.analysis_reply_context || content.analysis_summary || buildFallbackSummary(content);
    if (event.type === 'story_reply') {
        const leadText = event.text ? `"${event.text}"` : '(no text, story interaction only)';
        return [
            '[IG_STORY_REPLY_CONTEXT]',
            `They replied to Shannon's story: ${truncate(summary, 700)}`,
            `Their reply: ${leadText}`,
            'Story media, if present, belongs to Shannon\'s story reference. It is not a separate photo or video from the lead, and the reply should not ask them to resend it.',
        ].join('\n');
    }
    const leadText = event.text ? `"${event.text}"` : '(no text)';
    return [
        '[IG_COMMENT_CONTEXT]',
        `They commented on Shannon's ${content.content_type || event.contentType || 'Instagram post'}: ${truncate(summary, 700)}`,
        `Their comment: ${leadText}`,
    ].join('\n');
}

module.exports = {
    cleanText,
    normalizeTimestamp,
    contentTypeFromProduct,
    mediaMarkerForUrl,
    sourceKeyForEvent,
    normalizeMetaIgWebhookEvents,
    analyzeInstagramContent,
    buildFallbackSummary,
    buildContextMessage,
    _test: {
        parseJsonMaybe,
        normalizeCommentEvent,
        normalizeStoryReplyEvent,
        hash,
    },
};
