const { supabaseQuery } = require('./client-context');
const {
    resolveMetaIgAccountConfig,
    resolveMetaIgAccessToken,
} = require('./meta-ig-accounts');
const { recordGrowthOutcome } = require('./growth-outcomes');

const GRAPH_BASE = (process.env.META_IG_GRAPH_BASE || 'https://graph.instagram.com').replace(/\/+$/, '');
const API_VERSION = process.env.META_IG_API_VERSION || process.env.IG_GRAPH_API_VERSION || 'v24.0';
const DRY_RUN = /^true$/i.test(process.env.META_IG_COMMENT_AUTOMATION_DRY_RUN || '');

function cleanString(value, max = 1000) {
    return String(value || '').trim().slice(0, max);
}

function cleanStringList(value, maxItems = 8, max = 180) {
    const raw = Array.isArray(value)
        ? value
        : String(value || '').split(/\r?\n|[;|]/);
    return raw
        .map(item => cleanString(item, max))
        .filter(Boolean)
        .slice(0, maxItems);
}

function safeObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function compactSourcePostJson(value) {
    const source = safeObject(value);
    const paper = safeObject(source.paper);
    const resource = safeObject(source.resource);
    return {
        slug: cleanString(source.slug, 160) || null,
        title: cleanString(source.publicTitle || source.title, 240) || null,
        source_lane: cleanString(source.source_lane || source.lead_source_lane, 120) || null,
        funnel: cleanString(source.funnel, 120) || null,
        content_type: cleanString(source.content_type || source.type, 120) || null,
        exercise: cleanString(source.exercise || source.exercise_name, 180) || null,
        main_mistake: cleanString(source.main_mistake || source.mistake, 500) || null,
        context_summary: cleanString(source.context_summary || source.summary, 900) || null,
        reply_guidance: cleanString(source.reply_guidance || source.dm_reply_guidance, 1200) || null,
        suggested_next_question: cleanString(source.suggested_next_question, 300) || null,
        asset_title: cleanString(source.asset_title || resource.asset_title, 240) || null,
        private_reply_topic: cleanString(source.private_reply_topic || resource.private_reply_topic, 240) || null,
        next_step: cleanString(source.next_step, 500) || null,
        full_script: cleanString(source.full_script || source.script, 3000) || null,
        coaching_points: cleanStringList(
            source.coaching_points || source.primary_coaching_points || source.cues || source.form_cues,
            12,
            180
        ),
        topic: cleanString(resource.eyebrow || source.topic, 240) || null,
        headline: cleanString(resource.headline, 240) || null,
        paper_title: cleanString(paper.title, 300) || null,
        paper_authors: cleanString(paper.authors, 240) || null,
        paper_year: paper.year || null,
    };
}

function inferSourceLane(post = {}) {
    const lane = cleanString(post.source_lane, 120);
    if (lane) return lane;
    if (post.exercise) return 'exercise_comment_flow';
    const scienceSignals = [
        post.content_type,
        post.topic,
        post.headline,
        post.private_reply_topic,
        post.asset_title,
    ].filter(Boolean).join(' ');
    if (post.paper_title || post.paper_authors || /science|study|paper|research|neuroscience/i.test(scienceSignals)) {
        return 'science_comment_resource';
    }
    return 'comment_resource';
}

function inferFunnel(post = {}, sourceLane = '') {
    const funnel = cleanString(post.funnel, 120);
    if (funnel) return funnel;
    if (/exercise|form|workout/i.test(sourceLane)) return 'exercise_form_fix';
    if (/science|study|paper/i.test(sourceLane)) return 'free_challenge';
    return 'comment_resource';
}

function defaultNextStepForSourceLane(sourceLane = '') {
    if (/exercise|form|workout/i.test(sourceLane)) {
        return 'Use the exercise reel context first. If they reply vaguely, assume they are asking about the form fix from the comment flow and ask one practical troubleshooting question.';
    }
    if (/science|study|paper/i.test(sourceLane)) {
    return 'Use the resource topic as context, then continue the normal Plant-Based Fitness Founders Pass DM path when they show help/start intent.';
    }
    return 'Use the comment-flow context first, then continue the normal DM conversation naturally.';
}

function buildCommentResourceLeadContext({
    row = {},
    event = {},
    contentItem = {},
    matchedKeyword = '',
    privateReplyMessage = '',
    privateReplyId = '',
    status = 'sent',
    sentAt = null,
} = {}) {
    const post = compactSourcePostJson(row.source_post_json);
    const sourceLane = inferSourceLane(post);
    const funnel = inferFunnel(post, sourceLane);
    const landingUrl = cleanString(row.landing_url, 800);
    const keyword = cleanString(matchedKeyword || row.keyword, 120);
    const createdAt = new Date().toISOString();
    return {
        source_lane: sourceLane,
        funnel,
        link_sent: ['sent', 'dry_run'].includes(status),
        link_sent_via: 'instagram_private_reply',
        status: cleanString(status, 40),
        sent_at: sentAt || null,
        recorded_at: createdAt,
        automation_id: row.id || null,
        post_slug: cleanString(row.post_slug || post.slug, 180) || null,
        post_title: cleanString(post.title || contentItem.analysis_summary || contentItem.caption, 240) || null,
        topic: post.topic || null,
        headline: post.headline || null,
        content_type: post.content_type || null,
        exercise: post.exercise || null,
        main_mistake: post.main_mistake || null,
        context_summary: post.context_summary || null,
        reply_guidance: post.reply_guidance || null,
        suggested_next_question: post.suggested_next_question || null,
        asset_title: post.asset_title || null,
        private_reply_topic: post.private_reply_topic || null,
        full_script: post.full_script || null,
        coaching_points: Array.isArray(post.coaching_points) ? post.coaching_points : [],
        paper_title: post.paper_title || null,
        paper_authors: post.paper_authors || null,
        paper_year: post.paper_year || null,
        keyword,
        landing_url: landingUrl || null,
        cta_text: cleanString(row.cta_text, 500) || null,
        private_reply_id: cleanString(privateReplyId, 180) || null,
        private_reply_message: cleanString(privateReplyMessage, 900) || null,
        ig_media_id: cleanString(event.mediaId || contentItem.ig_media_id, 180) || null,
        comment_id: cleanString(event.commentId, 180) || null,
        from_ig_user_id: cleanString(event.fromId, 180) || null,
        from_username: cleanString(event.username, 180) || null,
        next_step: post.next_step || defaultNextStepForSourceLane(sourceLane),
    };
}

function normalizeAccountName(value) {
    return cleanString(value, 180)
        .replace(/^@+/, '')
        .replace(/[^a-zA-Z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .toLowerCase();
}

function normalizeForKeywordMatch(value) {
    return cleanString(value, 4000)
        .toLowerCase()
        .replace(/['\u2019]/g, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function keywordMatches(commentText, keyword) {
    const text = normalizeForKeywordMatch(commentText);
    const wanted = normalizeForKeywordMatch(keyword);
    if (!text || !wanted) return false;
    if (wanted.includes(' ')) return ` ${text} `.includes(` ${wanted} `);
    return new RegExp(`(^|\\s)${escapeRegExp(wanted)}(\\s|$)`).test(text);
}

function escapeRegExp(value) {
    return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function sourceKeyForMediaId(mediaId) {
    const id = cleanString(mediaId, 160);
    return id ? `ig_media:${id}` : '';
}

function rowKeywords(row = {}) {
    const aliases = Array.isArray(row.keyword_aliases) ? row.keyword_aliases : [];
    return [row.keyword, ...aliases].map(item => cleanString(item, 80)).filter(Boolean);
}

function activeInWindow(row = {}, now = new Date()) {
    const nowMs = now.getTime();
    const startsAt = row.starts_at ? new Date(row.starts_at).getTime() : null;
    const endsAt = row.ends_at ? new Date(row.ends_at).getTime() : null;
    if (Number.isFinite(startsAt) && startsAt > nowMs) return false;
    if (Number.isFinite(endsAt) && endsAt < nowMs) return false;
    return true;
}

function automationMatchesComment(row = {}, { event = {}, contentItem = {}, accountConfig = {}, now = new Date() } = {}) {
    if (!row || row.active !== true) return { ok: false, reason: 'inactive' };
    if (!activeInWindow(row, now)) return { ok: false, reason: 'outside_window' };

    const rowBot = normalizeAccountName(row.bot_account || row.target_handle);
    const rowHandle = normalizeAccountName(row.target_handle || row.bot_account);
    const accountBot = normalizeAccountName(accountConfig.botAccount);
    if (rowBot && accountBot && rowBot !== accountBot && rowHandle !== accountBot) {
        return { ok: false, reason: 'account_mismatch' };
    }

    const mediaId = cleanString(event.mediaId || contentItem.ig_media_id || '', 160);
    const sourceKey = cleanString(contentItem.source_key || sourceKeyForMediaId(mediaId), 240);
    if (row.ig_media_id && cleanString(row.ig_media_id, 160) !== mediaId) {
        return { ok: false, reason: 'media_mismatch' };
    }
    if (row.source_key && cleanString(row.source_key, 240) !== sourceKey) {
        return { ok: false, reason: 'source_mismatch' };
    }
    if (!row.ig_media_id && !row.source_key) {
        return { ok: false, reason: 'missing_media_binding' };
    }

    const matchedKeyword = rowKeywords(row).find(keyword => keywordMatches(event.text || '', keyword));
    if (!matchedKeyword) return { ok: false, reason: 'keyword_mismatch' };
    return { ok: true, matchedKeyword };
}

function fillTemplate(template, { row = {}, event = {}, contentItem = {}, matchedKeyword = '' } = {}) {
    const source = cleanString(template, 1800);
    const replacements = {
        landingUrl: row.landing_url || '',
        keyword: matchedKeyword || row.keyword || '',
        postSlug: row.post_slug || '',
        postTitle: contentItem.analysis_summary || contentItem.caption || row.post_slug || '',
        username: event.username || '',
    };
    return Object.entries(replacements).reduce((text, [key, value]) => {
        return text.replace(new RegExp(`\\{${key}\\}`, 'g'), cleanString(value, 800));
    }, source).trim();
}

function graphUrl(apiPath) {
    return `${GRAPH_BASE}/${API_VERSION}/${String(apiPath || '').replace(/^\/+/, '')}`;
}

async function graphPost(apiPath, params, fetchFn = fetch) {
    const body = new URLSearchParams();
    Object.entries(params || {}).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') body.set(key, String(value));
    });

    const res = await fetchFn(graphUrl(apiPath), {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
    });
    const text = await res.text();
    let data = {};
    try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
    if (!res.ok) {
        const error = new Error(data?.error?.message || text || `Graph API error ${res.status}`);
        error.status = res.status;
        error.graph = data;
        throw error;
    }
    return data;
}

function tableMissing(error) {
    return /42P01|PGRST205|Could not find the table|relation .* does not exist/i.test(error?.message || error?.body || '');
}

async function loadActiveAutomations(query = supabaseQuery) {
    try {
        return await query('ig_comment_automations?select=*&active=eq.true&limit=100');
    } catch (err) {
        if (tableMissing(err)) return [];
        throw err;
    }
}

async function findExistingFulfillment(sourceEventId, query = supabaseQuery) {
    const cleanId = cleanString(sourceEventId, 240);
    if (!cleanId) return null;
    try {
        const rows = await query(
            `ig_comment_fulfillments?select=id,status,automation_id,private_reply_id,error&source_event_id=eq.${encodeURIComponent(cleanId)}&limit=1`
        );
        return rows[0] || null;
    } catch (err) {
        if (tableMissing(err)) return null;
        throw err;
    }
}

async function recordFulfillment(row, query = supabaseQuery) {
    const payload = {
        automation_id: row.automation_id || null,
        content_item_id: row.content_item_id || null,
        interaction_id: row.interaction_id || null,
        source_event_id: row.source_event_id,
        comment_id: row.comment_id,
        ig_media_id: row.ig_media_id || null,
        from_ig_user_id: row.from_ig_user_id || null,
        from_username: row.from_username || null,
        matched_keyword: row.matched_keyword || null,
        landing_url: row.landing_url || null,
        private_reply_message: row.private_reply_message || null,
        private_reply_id: row.private_reply_id || null,
        status: row.status || 'pending',
        error: row.error || null,
        raw_payload: safeObject(row.raw_payload),
        sent_at: row.sent_at || null,
    };
    try {
        const rows = await query('ig_comment_fulfillments?on_conflict=source_event_id', {
            method: 'POST',
            body: [payload],
            prefer: 'resolution=merge-duplicates,return=representation',
        });
        return rows[0] || null;
    } catch (err) {
        if (tableMissing(err)) return null;
        throw err;
    }
}

async function recordCommentGrowthOutcome({
    eventType,
    eventStatus = 'recorded',
    row = {},
    event = {},
    contentItem = {},
    interaction = null,
    accountConfig = {},
    matchedKeyword = '',
    fulfillment = null,
    leadContext = {},
    privateReplyId = '',
    score = undefined,
    query = supabaseQuery,
} = {}) {
    const primary = [
        fulfillment?.id,
        event.eventId,
        event.commentId,
        eventType,
    ].filter(Boolean).join(':');
    try {
        return await recordGrowthOutcome({
            eventType,
            eventStatus,
            sourceSystem: 'meta_ig_comment_automation',
            primaryId: primary,
            botAccount: accountConfig.botAccount || row.bot_account,
            fromIgUserId: event.fromId,
            fromUsername: event.username,
            contentItemId: contentItem?.id,
            igCommentAutomationId: row.id,
            igCommentFulfillmentId: fulfillment?.id,
            igThreadId: interaction?.ig_thread_id,
            igMessageId: interaction?.ig_message_id,
            sourceKey: contentItem?.source_key || row.source_key,
            igMediaId: event.mediaId || contentItem?.ig_media_id || row.ig_media_id,
            campaignSlug: row.automation_key || row.post_slug,
            landingUrl: row.landing_url,
            score,
            scoreReason: matchedKeyword,
            occurredAt: leadContext.sent_at || fulfillment?.sent_at || new Date().toISOString(),
            attribution: {
                matched_keyword: matchedKeyword || row.keyword || null,
                comment_id: event.commentId || null,
                private_reply_id: privateReplyId || fulfillment?.private_reply_id || null,
                post_slug: row.post_slug || null,
                source_lane: leadContext.source_lane || null,
                funnel: leadContext.funnel || null,
            },
            rawPayload: {
                lead_context: leadContext,
                event: event.raw || event,
                automation_key: row.automation_key || null,
                interaction_id: interaction?.id || null,
            },
        }, query);
    } catch (err) {
        console.warn('[meta-ig-comment-automation] growth outcome log failed:', err.message || err);
        return null;
    }
}

async function sendInstagramPrivateReply({ ownerId, commentId, message, query = supabaseQuery, fetchFn = fetch }) {
    const { token, source } = await resolveMetaIgAccessToken(ownerId, query);
    if (!token) {
        const error = new Error('missing_meta_ig_access_token');
        error.tokenSource = source || 'none';
        throw error;
    }
    const data = await graphPost(`${encodeURIComponent(commentId)}/private_replies`, {
        message,
        access_token: token,
    }, fetchFn);
    return { data, tokenSource: source || 'unknown' };
}

async function maybeFulfillCommentAutomation({
    event = {},
    contentItem = null,
    interaction = null,
    query = supabaseQuery,
    fetchFn = fetch,
} = {}) {
    if (event.type !== 'comment') return { attempted: false, reason: 'not_comment' };
    if (!event.commentId || !event.text) return { attempted: false, reason: 'missing_comment_or_text' };
    if (event.ownerId && event.fromId && String(event.ownerId) === String(event.fromId)) {
        return { attempted: false, reason: 'owner_comment' };
    }

    let accountConfig = {};
    let matchedAutomation = null;
    let matchedKeyword = '';
    try {
        accountConfig = resolveMetaIgAccountConfig(event.ownerId || event.recipientId || '');
        const automations = await loadActiveAutomations(query);
        const match = automations
            .map(row => ({ row, match: automationMatchesComment(row, { event, contentItem: contentItem || {}, accountConfig }) }))
            .find(item => item.match.ok);

        if (!match) return { attempted: false, reason: 'no_matching_automation' };
        matchedAutomation = match.row;
        matchedKeyword = match.match.matchedKeyword;

        const existing = await findExistingFulfillment(event.eventId, query);
        if (existing?.status === 'sent' || existing?.status === 'dry_run') {
            return {
                attempted: false,
                reason: 'already_fulfilled',
                automationId: existing.automation_id,
                fulfillmentId: existing.id,
                status: existing.status,
            };
        }

        const message = fillTemplate(match.row.private_reply_message, {
            row: match.row,
            event,
            contentItem: contentItem || {},
            matchedKeyword: match.match.matchedKeyword,
        });
        const baseLog = {
            automation_id: match.row.id,
            content_item_id: contentItem?.id || null,
            interaction_id: interaction?.id || null,
            source_event_id: event.eventId,
            comment_id: event.commentId,
            ig_media_id: event.mediaId || contentItem?.ig_media_id || null,
            from_ig_user_id: event.fromId || null,
            from_username: event.username || null,
            matched_keyword: match.match.matchedKeyword,
            landing_url: match.row.landing_url,
            private_reply_message: message,
            raw_payload: {
                event: event.raw || event,
                automation: {
                    id: match.row.id,
                    post_slug: match.row.post_slug,
                    keyword: match.row.keyword,
                    keyword_aliases: Array.isArray(match.row.keyword_aliases) ? match.row.keyword_aliases : [],
                    cta_text: match.row.cta_text || null,
                    landing_url: match.row.landing_url || null,
                },
                source_post: compactSourcePostJson(match.row.source_post_json),
                lead_context: buildCommentResourceLeadContext({
                    row: match.row,
                    event,
                    contentItem: contentItem || {},
                    matchedKeyword: match.match.matchedKeyword,
                    privateReplyMessage: message,
                    status: 'pending',
                }),
                account: {
                    owner_id: event.ownerId || null,
                    bot_account: accountConfig.botAccount || null,
                },
            },
        };

        if (DRY_RUN) {
            const leadContext = buildCommentResourceLeadContext({
                row: match.row,
                event,
                contentItem: contentItem || {},
                matchedKeyword: match.match.matchedKeyword,
                privateReplyMessage: message,
                status: 'dry_run',
                sentAt: new Date().toISOString(),
            });
            const logged = await recordFulfillment({
                ...baseLog,
                status: 'dry_run',
                raw_payload: { ...baseLog.raw_payload, lead_context: leadContext, dry_run: true },
            }, query);
            await recordCommentGrowthOutcome({
                eventType: 'post_comment_keyword_matched',
                eventStatus: 'dry_run',
                row: match.row,
                event,
                contentItem: contentItem || {},
                interaction,
                accountConfig,
                matchedKeyword: match.match.matchedKeyword,
                fulfillment: logged,
                leadContext,
                score: 0,
                query,
            });
            return {
                attempted: true,
                sent: false,
                dryRun: true,
                automationId: match.row.id,
                fulfillmentId: logged?.id || null,
                matchedKeyword: match.match.matchedKeyword,
            };
        }

        const reply = await sendInstagramPrivateReply({
            ownerId: event.ownerId || event.recipientId || '',
            commentId: event.commentId,
            message,
            query,
            fetchFn,
        });
        const privateReplyId = cleanString(reply.data?.message_id || reply.data?.id || '', 180);
        const sentAt = new Date().toISOString();
        const leadContext = buildCommentResourceLeadContext({
            row: match.row,
            event,
            contentItem: contentItem || {},
            matchedKeyword: match.match.matchedKeyword,
            privateReplyMessage: message,
            privateReplyId,
            status: 'sent',
            sentAt,
        });
        const logged = await recordFulfillment({
            ...baseLog,
            status: 'sent',
            private_reply_id: privateReplyId || null,
            sent_at: sentAt,
            raw_payload: {
                ...baseLog.raw_payload,
                lead_context: leadContext,
                graph_response: reply.data,
                token_source: reply.tokenSource,
            },
        }, query);
        await recordCommentGrowthOutcome({
            eventType: 'post_comment_keyword_matched',
            eventStatus: 'sent',
            row: match.row,
            event,
            contentItem: contentItem || {},
            interaction,
            accountConfig,
            matchedKeyword: match.match.matchedKeyword,
            fulfillment: logged,
            leadContext,
            privateReplyId,
            query,
        });
        await recordCommentGrowthOutcome({
            eventType: 'private_reply_sent',
            eventStatus: 'sent',
            row: match.row,
            event,
            contentItem: contentItem || {},
            interaction,
            accountConfig,
            matchedKeyword: match.match.matchedKeyword,
            fulfillment: logged,
            leadContext,
            privateReplyId,
            query,
        });
        return {
            attempted: true,
            sent: true,
            automationId: match.row.id,
            fulfillmentId: logged?.id || null,
            matchedKeyword: match.match.matchedKeyword,
            privateReplyId: privateReplyId || null,
        };
    } catch (err) {
        console.warn('[meta-ig-comment-automation] fulfillment failed:', err.message);
        try {
            await recordFulfillment({
                automation_id: matchedAutomation?.id || null,
                content_item_id: contentItem?.id || null,
                interaction_id: interaction?.id || null,
                source_event_id: event.eventId || `comment:${event.commentId || Date.now()}`,
                comment_id: event.commentId || 'unknown',
                ig_media_id: event.mediaId || contentItem?.ig_media_id || null,
                from_ig_user_id: event.fromId || null,
                from_username: event.username || null,
                matched_keyword: matchedKeyword || null,
                landing_url: matchedAutomation?.landing_url || null,
                status: 'failed',
                error: cleanString(err.message || String(err), 1000),
                raw_payload: {
                    event: event.raw || event,
                    account: accountConfig,
                    graph: err.graph || null,
                    status: err.status || null,
                },
            }, query);
        } catch (logErr) {
            console.warn('[meta-ig-comment-automation] failure log failed:', logErr.message);
        }
        return {
            attempted: true,
            sent: false,
            status: 'failed',
            error: err.message || String(err),
        };
    }
}

module.exports = {
    maybeFulfillCommentAutomation,
    _test: {
        normalizeAccountName,
        normalizeForKeywordMatch,
        keywordMatches,
        automationMatchesComment,
        fillTemplate,
        sourceKeyForMediaId,
        compactSourcePostJson,
        buildCommentResourceLeadContext,
    },
};
