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
    if (rawType.includes('AUDIO')) {
        return `[AUDIO:${clean}]`;
    }
    if (rawType.includes('VIDEO') || /\.mp4(\?|$)/i.test(clean) || /\.mov(\?|$)/i.test(clean)) {
        return `[VIDEO:${clean}]`;
    }
    return `[PHOTO:${clean}]`;
}

function cleanId(value) {
    const s = String(value || '').trim();
    return s && !/\{\{[^}]+\}\}/.test(s) ? s : null;
}

function mediaMarkerForAttachment(attachment = {}) {
    const type = String(attachment.type || attachment.media_type || '').toUpperCase();
    const payload = attachment.payload || {};
    const url = payload.url || attachment.url || attachment.media_url || '';
    if (!url) return '';
    if (type.includes('AUDIO')) return `[AUDIO:${url}]`;
    if (type.includes('VIDEO')) return `[VIDEO:${url}]`;
    if (type.includes('IMAGE') || type.includes('PHOTO') || type.includes('GIF') || type.includes('STICKER')) {
        return `[PHOTO:${url}]`;
    }
    return `[attachment:${url}]`;
}

function buildDirectMessageText(message = {}) {
    const parts = [];
    const text = cleanText(message.text || '');
    if (text) parts.push(text);
    for (const attachment of Array.isArray(message.attachments) ? message.attachments : []) {
        const marker = mediaMarkerForAttachment(attachment);
        if (marker) parts.push(marker);
    }
    return cleanText(parts.join(' '), 4000);
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
        ownerId: cleanId(entry?.id || value.owner?.id || value.recipient?.id),
        recipientId: cleanId(entry?.id || value.owner?.id || value.recipient?.id),
        direction: 'in',
        isEcho: false,
        raw: rawChange || value,
    };
}

function normalizeStoryReplyEvent(entry, messageEvent) {
    const message = messageEvent?.message || {};
    const story = message.reply_to?.story || {};
    if (!story.id && !story.url) return null;
    const igAccountId = cleanId(entry?.id);
    const senderId = cleanId(messageEvent.sender?.id);
    const recipientId = cleanId(messageEvent.recipient?.id);
    const direction = message.is_echo || message.is_self || (igAccountId && senderId === igAccountId)
        ? 'out'
        : 'in';
    const mid = message.mid ? String(message.mid) : `story:${senderId || 'unknown'}:${messageEvent.timestamp || Date.now()}:${story.id || hash(story.url)}`;
    return {
        type: 'story_reply',
        eventId: `story_reply:${mid}`,
        commentId: null,
        messageId: mid,
        text: cleanText(message.text || ''),
        fromId: senderId,
        recipientId,
        igAccountId,
        ownerId: igAccountId,
        direction,
        isEcho: direction === 'out',
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

function normalizeDirectMessageEvent(entry, messageEvent) {
    const message = messageEvent?.message || {};
    if (!message || message.reply_to?.story) return null;
    const igAccountId = cleanId(entry?.id || messageEvent.recipient?.id);
    const senderId = cleanId(messageEvent.sender?.id);
    const recipientId = cleanId(messageEvent.recipient?.id);
    const direction = message.is_echo || message.is_self || (igAccountId && senderId === igAccountId)
        ? 'out'
        : 'in';
    const text = buildDirectMessageText(message);
    if (!senderId || !text) return null;
    const mid = message.mid ? String(message.mid) : `message:${senderId}:${messageEvent.timestamp || Date.now()}:${hash(text)}`;
    return {
        type: 'message',
        eventId: `message:${mid}`,
        commentId: null,
        messageId: mid,
        text,
        fromId: senderId,
        recipientId,
        igAccountId,
        ownerId: igAccountId,
        direction,
        isEcho: direction === 'out',
        username: messageEvent.sender?.username || null,
        mediaId: null,
        storyId: null,
        storyUrl: null,
        mediaProductType: null,
        contentType: 'dm',
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
            if (storyReply) {
                events.push(storyReply);
                continue;
            }
            const message = normalizeDirectMessageEvent(entry, messageEvent);
            if (message && message.direction === 'in') events.push(message);
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

function buildVerifiedStoryContext(content = {}) {
    const parts = [];
    const caption = cleanText(content.caption || '', 700);
    const visibleText = cleanText(content.analysis_visible_text || content.visible_text || '', 700);
    const summary = cleanText(content.analysis_reply_context || content.analysis_summary || '', 700);
    if (caption) parts.push(`Story caption: ${caption}`);
    if (visibleText) parts.push(`Visible story text: ${visibleText}`);
    if (summary && !parts.some(part => part.toLowerCase().includes(summary.toLowerCase()))) {
        parts.push(`Story summary: ${summary}`);
    }
    if (parts.length) return parts.join('\n');
    return "They replied to Shannon's IG story. Balance does not have verified story contents here, so do not infer the scene, trip, location, or photo from this context.";
}

function extractStoryReplyText(text) {
    const raw = String(text || '');
    if (!/\[IG_STORY_REPLY_CONTEXT\]|Raw IG message:\s*replied to your story|^\s*replied to your story\b/i.test(raw)) {
        return cleanText(raw);
    }

    const replyLine = raw.split(/\r?\n/).find(line => /^Their reply:/i.test(line.trim()));
    if (replyLine) {
        const cleaned = cleanText(replyLine.replace(/^Their reply:\s*/i, ''))
            .replace(/^"|"$/g, '')
            .trim();
        if (cleaned && !/^\(no text/i.test(cleaned)) return cleaned;
    }

    const rawMatch = raw.match(/Raw IG message:\s*replied to your story(?:\s*\([^)]*\))?\s*([\s\S]*)$/i);
    if (rawMatch) {
        const cleaned = cleanText(rawMatch[1] || '')
            .replace(/^(?:\[(?:PHOTO|VIDEO):https?:\/\/[^\]]+\]\s*)+/i, '')
            .trim();
        if (cleaned) return cleaned;
    }

    const inlineMatch = raw.match(/^\s*replied to your story(?:\s*\([^)]*\))?\s+(.+)$/i);
    if (inlineMatch) {
        const cleaned = cleanText(inlineMatch[1] || '');
        if (cleaned) return cleaned;
    }

    return '';
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
        const replyText = event.text ? `"${event.text}"` : '(no text, story interaction only)';
        if (event.direction === 'out') {
            return [
                '[IG_OUTBOUND_STORY_REPLY_CONTEXT]',
                "Shannon replied to their IG story. Balance does not have verified story contents here, so do not infer the scene, trip, location, or photo from this context.",
                `Shannon's reply: ${replyText}`,
                "Story media, if present, belongs to the other person's story reference. It is not a separate photo or video from the lead, and the next reply should not assume Shannon posted it.",
            ].join('\n');
        }
        return [
            '[IG_STORY_REPLY_CONTEXT]',
            buildVerifiedStoryContext(content),
            `Their reply: ${replyText}`,
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
    buildVerifiedStoryContext,
    extractStoryReplyText,
    buildContextMessage,
    _test: {
        parseJsonMaybe,
        normalizeCommentEvent,
        normalizeStoryReplyEvent,
        normalizeDirectMessageEvent,
        mediaMarkerForAttachment,
        buildDirectMessageText,
        hash,
    },
};
