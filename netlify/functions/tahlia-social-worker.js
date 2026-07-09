/**
 * Tahlia Social Worker
 *
 * Drafts approval-only Feed posts and supportive comments for the seeded
 * Tahlia Brooks account. Nothing is published here. Every action is queued as
 * a pending Needs You card with a proposed action Shannon must approve.
 */

const {
    callGeminiFallback,
    insertCoachAlert,
    supabaseQuery,
    truncate,
} = require('./_lib/client-context');
const {
    TAHLIA_PROFILE,
    activityLabel,
    buildTahliaCommentDraft,
    buildTahliaPostDraft,
    cleanPublicText,
    parseCardCaption,
    storyText,
} = require('./_lib/tahlia-profile');

const SOURCE = 'tahlia-social-worker';
const TAHLIA_EMAIL = 'seed.tahlia.brooks+kayla30@plantbased-balance.org';
const SHANNON_EMAIL = 'shannonbirch@cocospersonaltraining.com';
const BRISBANE_OFFSET_MS = 10 * 60 * 60 * 1000;
const DEFAULT_POST_TX_LOOKBACK_HOURS = 6;
const DEFAULT_STORY_LOOKBACK_HOURS = 72;
const DEFAULT_MIN_STORY_AGE_MINUTES = 30;
const DEFAULT_MAX_POST_ALERTS_PER_RUN = 1;
const DEFAULT_MAX_COMMENT_ALERTS_PER_RUN = 1;
const DEFAULT_DAILY_POST_ALERT_CAP = 3;
const DEFAULT_DAILY_COMMENT_ALERT_CAP = 6;
const DEFAULT_RESUME_DATE_KEY = '2026-07-05';
const TAHLIA_LEARNING_EXAMPLE_LIMIT = 8;
const ALLOWED_TAHLIA_POST_ACTIVITY_TYPES = new Set(['workout', 'personal_best', 'weigh_in', 'fitness_diary']);

function json(statusCode, body) {
    return {
        statusCode,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    };
}

function asNumber(value, fallback) {
    const n = Number(value);
    return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function brisbaneDateKey(date = new Date()) {
    return new Date(date.getTime() + BRISBANE_OFFSET_MS).toISOString().slice(0, 10);
}

function brisbaneDayBounds(date = new Date()) {
    const shifted = new Date(date.getTime() + BRISBANE_OFFSET_MS);
    shifted.setUTCHours(0, 0, 0, 0);
    const start = new Date(shifted.getTime() - BRISBANE_OFFSET_MS);
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    return {
        dateKey: brisbaneDateKey(date),
        startIso: start.toISOString(),
        endIso: end.toISOString(),
    };
}

function isBeforeBrisbaneDateKey(now = new Date(), resumeDateKey = '') {
    const key = String(resumeDateKey || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return false;
    return brisbaneDateKey(now) < key;
}

function brisbaneHour(value) {
    const parsed = Date.parse(value || '');
    if (!Number.isFinite(parsed)) return null;
    return new Date(parsed + BRISBANE_OFFSET_MS).getUTCHours();
}

function hashString(value) {
    let hash = 2166136261;
    const s = String(value || '');
    for (let i = 0; i < s.length; i += 1) {
        hash ^= s.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
}

function isSensitiveFeedText(value = '') {
    return /\b(grief|death|dead|died|hospital|surgery|injury|injured|pain|panic|depressed|depression|anxiety|self harm|eating disorder|binge|purge|pregnant|pregnancy|miscarriage|blood|diagnosis|trauma|abuse)\b/i
        .test(String(value || ''));
}

function tahliaProfileForAlert() {
    return {
        key: TAHLIA_PROFILE.key,
        display_name: TAHLIA_PROFILE.displayName,
        age: TAHLIA_PROFILE.age,
        gender: TAHLIA_PROFILE.gender,
        role: TAHLIA_PROFILE.role,
        tone: TAHLIA_PROFILE.voice.tone,
        boundaries: TAHLIA_PROFILE.boundaries,
    };
}

function pointTransactionActivityType(tx = {}) {
    const type = String(tx.transaction_type || '').toLowerCase();
    const desc = String(tx.description || '').toLowerCase();
    if (type.includes('personal_best') || type.includes('pb') || /\b(pb|personal best)\b/.test(desc)) return 'personal_best';
    if (type.includes('workout') || desc.includes('workout')) return 'workout';
    if (type.includes('meal') || desc.includes('meal') || desc.includes('food')) return '';
    if (type.includes('weigh') || desc.includes('weigh') || desc.includes('weight')) return 'weigh_in';
    if (type.includes('checkin') || type.includes('check_in') || desc.includes('check-in') || desc.includes('check in')) {
        const hour = brisbaneHour(tx.created_at);
        if (hour !== null && hour < 18) return '';
        return 'fitness_diary';
    }
    return '';
}

function isAllowedTahliaPostActivityType(activityType) {
    return ALLOWED_TAHLIA_POST_ACTIVITY_TYPES.has(String(activityType || '').trim());
}

function postActionId(tx = {}) {
    return `tahlia-post-${String(tx.id || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 50) || hashString(tx.created_at)}`;
}

function commentActionId(story = {}) {
    return `tahlia-comment-${String(story.id || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 50) || hashString(story.created_at)}`;
}

function tahliaNeedsYouReviewData({ actionKind, draftText, evidence = {}, now = new Date() }) {
    return {
        subtype: 'tahlia_social_approval',
        source: SOURCE,
        operator_queue: 'needs_you',
        needs_you_required: true,
        needs_shannon_approval: true,
        needs_you_reason: 'tahlia_social_approval',
        needs_you_reasons: ['tahlia_social_approval'],
        approval_only: true,
        social_action: actionKind,
        draft_text: draftText,
        tahlia_profile: tahliaProfileForAlert(),
        tahlia_profile_key: TAHLIA_PROFILE.key,
        tahlia_display_name: TAHLIA_PROFILE.displayName,
        drafted_at: now.toISOString(),
        evidence,
        codex_review: {
            source: SOURCE,
            decision: 'needs_you_tahlia_social_approval',
            queue: 'needs_you',
            reason: 'Tahlia social activity is approval-only while her voice and behaviour are being tested.',
            needs_shannon_approval: true,
            reviewed_at: now.toISOString(),
            automation_id: SOURCE,
        },
    };
}

function buildFeedPostAlert({ coachId, tahliaUser, transaction, now = new Date() }) {
    const activityType = pointTransactionActivityType(transaction);
    if (!isAllowedTahliaPostActivityType(activityType)) return null;
    const draft = buildTahliaPostDraft({
        activityType,
        seed: transaction.id || transaction.created_at,
    });
    const label = activityLabel(draft.activityType);
    const caption = cleanPublicText(draft.caption, 500);
    const cardPayload = draft.cardPayload && typeof draft.cardPayload === 'object' ? draft.cardPayload : null;
    const storyCaption = cardPayload ? JSON.stringify(cardPayload) : caption;
    const mediaType = draft.mediaType || (cardPayload ? 'workout_card' : 'text');
    const action = {
        id: postActionId(transaction),
        type: 'publish_tahlia_feed_post',
        label: `Publish Tahlia ${label} post`,
        status: 'pending',
        preview: caption,
        payload: {
            user_id: tahliaUser.id,
            media_type: mediaType,
            caption: storyCaption,
            card_payload: cardPayload,
            proposed_created_at: transaction.created_at || now.toISOString(),
            background_color: cardPayload ? null : '#f8fafc',
            activity_type: draft.activityType,
            source: SOURCE,
            source_transaction_id: transaction.id || null,
            source_transaction_type: transaction.transaction_type || null,
            source_reference_type: transaction.reference_type || null,
        },
    };
    const evidence = {
        source_transaction_id: transaction.id || null,
        source_transaction_type: transaction.transaction_type || null,
        source_description: transaction.description || null,
        source_points: transaction.points_amount || null,
        source_created_at: transaction.created_at || null,
        activity_type: draft.activityType,
        post_media_type: mediaType,
        post_card_type: cardPayload?.card_type || null,
        post_card_data: cardPayload,
    };
    return {
        alert_type: 'general_idea',
        client_id: null,
        client_name: TAHLIA_PROFILE.displayName,
        coach_id: coachId,
        priority: 'medium',
        title: `Approve Tahlia ${label} Feed post`,
        description: `Draft: "${truncate(caption, 220)}"`,
        suggested_message: null,
        status: 'pending',
        data: {
            ...tahliaNeedsYouReviewData({ actionKind: 'feed_post', draftText: caption, evidence, now }),
            tahlia_user_id: tahliaUser.id,
            activity_type: draft.activityType,
            proposed_actions: [action],
        },
    };
}

function buildCommentAlert({ coachId, tahliaUser, story, author = {}, now = new Date() }) {
    const draft = buildTahliaCommentDraft({
        story,
        seed: `${story.id}:${brisbaneDateKey(now)}`,
    });
    const comment = cleanPublicText(draft.comment, 500);
    const authorName = author.name || author.email?.split('@')[0] || 'someone';
    const storyCardData = parseCardCaption(story.caption);
    const action = {
        id: commentActionId(story),
        type: 'publish_tahlia_feed_comment',
        label: 'Publish Tahlia comment',
        status: 'pending',
        preview: comment,
        payload: {
            user_id: tahliaUser.id,
            story_id: story.id,
            comment_text: comment,
            proposed_created_at: now.toISOString(),
            source: SOURCE,
            story_author_id: story.user_id || null,
            story_author_name: authorName,
        },
    };
    const evidence = {
        story_id: story.id,
        story_author_id: story.user_id || null,
        story_author_name: authorName,
        story_media_type: story.media_type || null,
        story_media_url: story.media_url || null,
        story_thumbnail_url: story.thumbnail_url || null,
        story_background_color: story.background_color || null,
        story_created_at: story.created_at || null,
        story_text: storyText(story),
        story_card_type: storyCardData?.card_type || null,
        story_card_data: storyCardData || null,
        inferred_theme: draft.theme,
    };
    return {
        alert_type: 'general_idea',
        client_id: null,
        client_name: TAHLIA_PROFILE.displayName,
        coach_id: coachId,
        priority: 'low',
        title: `Approve Tahlia comment on ${authorName}'s Feed post`,
        description: `Draft: "${truncate(comment, 220)}"`,
        suggested_message: null,
        status: 'pending',
        data: {
            ...tahliaNeedsYouReviewData({ actionKind: 'feed_comment', draftText: comment, evidence, now }),
            tahlia_user_id: tahliaUser.id,
            target_story_id: story.id,
            target_story_author_id: story.user_id || null,
            target_story_author_name: authorName,
            proposed_actions: [action],
        },
    };
}

async function loadUserByEmail(email) {
    const rows = await supabaseQuery(`users?select=id,name,email,is_test_account&email=eq.${encodeURIComponent(email)}&limit=1`);
    return rows[0] || null;
}

async function loadUsersById(userIds = []) {
    const ids = [...new Set(userIds.filter(Boolean))];
    if (!ids.length) return new Map();
    const rows = await supabaseQuery(
        `users?select=id,name,email,is_test_account&id=in.(${ids.join(',')})&limit=${ids.length}`
    ).catch(() => []);
    return new Map((rows || []).map(row => [row.id, row]));
}

async function loadRecentTahliaTransactions(tahliaId, now = new Date(), lookbackHours = DEFAULT_POST_TX_LOOKBACK_HOURS) {
    const since = new Date(now.getTime() - lookbackHours * 60 * 60 * 1000).toISOString();
    const rows = await supabaseQuery(
        `point_transactions?select=id,transaction_type,points_amount,reference_type,description,created_at&user_id=eq.${encodeURIComponent(tahliaId)}&points_amount=gt.0&created_at=gte.${encodeURIComponent(since)}&order=created_at.asc&limit=40`
    ).catch(() => []);
    return (rows || []).filter(row => {
        if (String(row.reference_type || '') !== 'tahlia_brooks_xp_autopilot') return false;
        return isAllowedTahliaPostActivityType(pointTransactionActivityType(row));
    });
}

async function loadRecentStories(now = new Date(), { lookbackHours = DEFAULT_STORY_LOOKBACK_HOURS, minAgeMinutes = DEFAULT_MIN_STORY_AGE_MINUTES } = {}) {
    const oldest = new Date(now.getTime() - lookbackHours * 60 * 60 * 1000).toISOString();
    const newest = new Date(now.getTime() - minAgeMinutes * 60 * 1000).toISOString();
    return supabaseQuery(
        `stories?select=id,user_id,media_type,media_url,thumbnail_url,background_color,caption,created_at,expires_at&created_at=gte.${encodeURIComponent(oldest)}&created_at=lte.${encodeURIComponent(newest)}&expires_at=gt.${encodeURIComponent(now.toISOString())}&order=created_at.desc&limit=60`
    ).catch(() => []);
}

async function hasTahliaComment(storyId, tahliaId) {
    const rows = await supabaseQuery(
        `feed_comments?select=id&story_id=eq.${encodeURIComponent(storyId)}&user_id=eq.${encodeURIComponent(tahliaId)}&limit=1`
    ).catch(() => []);
    return rows.length > 0;
}

async function hasPendingOrActionedAlert(idempotencyKey) {
    const rows = await supabaseQuery(
        `coach_alerts?select=id&idempotency_key=eq.${encodeURIComponent(idempotencyKey)}&limit=1`
    ).catch(() => []);
    return rows.length > 0;
}

function parseMaybeJsonObject(value) {
    if (!value) return {};
    if (typeof value === 'object') return value;
    if (typeof value !== 'string') return {};
    try {
        const parsed = JSON.parse(value);
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
        return {};
    }
}

function normalizeTahliaSocialLearningExamples(rows = [], limit = TAHLIA_LEARNING_EXAMPLE_LIMIT) {
    const examples = [];
    const seen = new Set();
    for (const row of rows || []) {
        const data = parseMaybeJsonObject(row?.data);
        const history = Array.isArray(data.tahlia_social_edit_history)
            ? data.tahlia_social_edit_history
            : (data.tahlia_social_last_edit ? [data.tahlia_social_last_edit] : []);
        for (const item of history) {
            const originalText = cleanPublicText(item?.original_text || '', 500);
            const editedText = cleanPublicText(item?.edited_text || '', 500);
            if (!editedText || editedText === originalText) continue;
            const key = `${item?.action_kind || ''}:${editedText.toLowerCase()}`;
            if (seen.has(key)) continue;
            seen.add(key);
            examples.push({
                alert_id: row.id || null,
                action_kind: item?.action_kind || data.social_action || null,
                action_type: item?.action_type || null,
                activity_type: item?.activity_type || data.activity_type || null,
                inferred_theme: item?.inferred_theme || data.evidence?.inferred_theme || null,
                story_author_name: item?.story_author_name || null,
                original_text: originalText,
                edited_text: editedText,
                edit_reason: cleanPublicText(item?.edit_reason || '', 240),
                edited_at: item?.edited_at || data.tahlia_social_learning_updated_at || row.created_at || null,
            });
        }
    }
    return examples
        .sort((a, b) => Date.parse(b.edited_at || 0) - Date.parse(a.edited_at || 0))
        .slice(0, Math.max(1, Number(limit) || TAHLIA_LEARNING_EXAMPLE_LIMIT));
}

async function loadTahliaSocialLearningExamples(limit = TAHLIA_LEARNING_EXAMPLE_LIMIT) {
    const rows = await supabaseQuery(
        `coach_alerts?select=id,created_at,data&client_name=eq.${encodeURIComponent(TAHLIA_PROFILE.displayName)}&order=created_at.desc&limit=120`
    ).catch(() => []);
    return normalizeTahliaSocialLearningExamples(rows, limit);
}

function selectTahliaSocialLearningExamples(examples = [], { actionKind = '', activityType = '', theme = '' } = {}) {
    const sameKind = (examples || []).filter(item => item.action_kind === actionKind);
    return sameKind
        .map(item => ({
            ...item,
            relevance: Number(!!activityType && item.activity_type === activityType) * 2
                + Number(!!theme && item.inferred_theme === theme) * 2,
        }))
        .sort((a, b) => b.relevance - a.relevance || Date.parse(b.edited_at || 0) - Date.parse(a.edited_at || 0))
        .slice(0, 6);
}

function parseTahliaDraftReply(value = '') {
    const raw = String(value || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/i, '').trim();
    try {
        const parsed = JSON.parse(raw);
        return cleanPublicText(parsed?.text || parsed?.comment || parsed?.caption || '', 500);
    } catch {
        const match = raw.match(/\{[\s\S]*\}/);
        if (match) {
            try {
                const parsed = JSON.parse(match[0]);
                return cleanPublicText(parsed?.text || parsed?.comment || parsed?.caption || '', 500);
            } catch (_) {}
        }
        return cleanPublicText(raw.replace(/^['"]|['"]$/g, ''), 500);
    }
}

function isSafeLearnedTahliaDraft(value = '') {
    const text = cleanPublicText(value, 500);
    if (text.length < 2 || text.length > 240) return false;
    if (/https?:\/\/|www\.|#\w+|\b(ai|automation|bot|model|prompt|seeded account|test account)\b/i.test(text)) return false;
    if (/\b(you should|you need to|make sure you|try to|calorie deficit|weight loss|diagnos|injur|medical|doctor)\b/i.test(text)) return false;
    if (isSensitiveFeedText(text)) return false;
    return true;
}

async function generateLearnedTahliaDraft({ actionKind, baseText, activityType = '', theme = '', contextText = '', learningExamples = [] }) {
    const selected = selectTahliaSocialLearningExamples(learningExamples, { actionKind, activityType, theme });
    if (!selected.length) {
        return { text: baseText, mode: 'profile_template', example_count: 0, example_alert_ids: [] };
    }
    const examplesBlock = selected.map((item, index) => [
        `${index + 1}. Before: ${item.original_text}`,
        `   Shannon changed it to: ${item.edited_text}`,
        item.edit_reason ? `   Reason: ${item.edit_reason}` : '',
    ].filter(Boolean).join('\n')).join('\n');
    const prompt = `Write one private approval draft for Tahlia Brooks in the Balance Feed.

Tahlia voice: warm, casual, slightly self-aware, one short sentence, supportive but never coach-like.
This is a ${actionKind === 'feed_comment' ? 'comment' : 'post caption'}.
Activity: ${activityType || theme || 'general'}.
Feed context: ${truncate(contextText || '(none)', 500)}
Starting draft: ${baseText}

Learn from Shannon's recent edits to Tahlia drafts:
${examplesBlock}

Rules:
- Apply the pattern of Shannon's edits, but do not copy an old line unless it genuinely fits.
- Keep it under 240 characters.
- No advice, diagnosis, body or weight judgement, hashtags, URLs, or claims about unseen media.
- Never mention internal tools, testing, or how the draft was made.
- Return only JSON: {"text":"..."}`;
    try {
        const reply = await callGeminiFallback([{ role: 'user', parts: [{ text: prompt }] }], {
            maxOutputTokens: 180,
            temperature: 0.45,
        });
        const learnedText = parseTahliaDraftReply(reply);
        if (!isSafeLearnedTahliaDraft(learnedText)) throw new Error('unsafe_or_empty_learned_draft');
        return {
            text: learnedText,
            mode: 'recent_shannon_edits',
            example_count: selected.length,
            example_alert_ids: [...new Set(selected.map(item => item.alert_id).filter(Boolean))],
        };
    } catch (error) {
        console.warn('[tahlia-social-worker] learned draft fallback:', error.message);
        return {
            text: baseText,
            mode: 'profile_template_fallback',
            example_count: selected.length,
            example_alert_ids: [...new Set(selected.map(item => item.alert_id).filter(Boolean))],
        };
    }
}

function applyGeneratedTahliaDraft(alertRow, generated = {}) {
    const text = cleanPublicText(generated.text || alertRow?.data?.draft_text || '', 500);
    const actions = Array.isArray(alertRow?.data?.proposed_actions) ? alertRow.data.proposed_actions : [];
    const action = actions[0];
    if (!action || !text) return alertRow;
    const payload = { ...(action.payload || {}) };
    if (action.type === 'publish_tahlia_feed_comment') {
        payload.comment_text = text;
    } else if (action.type === 'publish_tahlia_feed_post') {
        const card = parseCardCaption(payload.caption) || parseMaybeJsonObject(payload.card_payload);
        if (card?.card_type) {
            const nextCard = { ...card };
            if (String(nextCard.card_type).toLowerCase() === 'fitness_diary') nextCard.note = text;
            else nextCard.share_caption = text;
            payload.card_payload = nextCard;
            payload.caption = JSON.stringify(nextCard);
        } else {
            payload.caption = text;
        }
    }
    const patchedAction = {
        ...action,
        original_template_preview: action.original_template_preview || action.preview || alertRow.data.draft_text || '',
        preview: text,
        payload,
    };
    return {
        ...alertRow,
        description: `Draft: "${truncate(text, 220)}"`,
        data: {
            ...alertRow.data,
            draft_text: text,
            proposed_actions: [patchedAction, ...actions.slice(1)],
            tahlia_social_learning: {
                mode: generated.mode || 'profile_template',
                example_count: Number(generated.example_count || 0),
                example_alert_ids: generated.example_alert_ids || [],
                applied_at: new Date().toISOString(),
            },
        },
    };
}

function isTahliaSocialAlertData(data = {}) {
    return data.source === SOURCE
        || data.subtype === 'tahlia_social_approval'
        || data.tahlia_profile_key === TAHLIA_PROFILE.key;
}

function summarizeDailyTahliaAlertCounts(rows = []) {
    const counts = { feed_post: 0, feed_comment: 0, total: 0 };
    for (const row of rows || []) {
        const data = parseMaybeJsonObject(row?.data);
        if (!isTahliaSocialAlertData(data)) continue;
        counts.total += 1;
        if (data.social_action === 'feed_post') counts.feed_post += 1;
        if (data.social_action === 'feed_comment') counts.feed_comment += 1;
    }
    return counts;
}

async function loadDailyTahliaAlertCounts(now = new Date()) {
    const bounds = brisbaneDayBounds(now);
    const rows = await supabaseQuery(
        `coach_alerts?select=id,status,data,created_at&client_name=eq.${encodeURIComponent(TAHLIA_PROFILE.displayName)}&created_at=gte.${encodeURIComponent(bounds.startIso)}&created_at=lt.${encodeURIComponent(bounds.endIso)}&order=created_at.desc&limit=500`
    ).catch(() => []);
    return {
        date_key: bounds.dateKey,
        ...summarizeDailyTahliaAlertCounts(rows),
    };
}

function dailyCappedResult({ dailyCount, dailyCap }) {
    return {
        scanned: 0,
        inserted: [],
        skipped: { daily_cap: 1 },
        daily_count: dailyCount,
        daily_cap: dailyCap,
    };
}

function shouldConsiderStory({ story, author, tahliaId, shannonId }) {
    if (!story?.id || !story.user_id) return { ok: false, reason: 'missing_story_fields' };
    if (story.user_id === tahliaId) return { ok: false, reason: 'own_post' };
    if (story.user_id === shannonId) return { ok: false, reason: 'shannon_post' };
    if (author?.is_test_account) return { ok: false, reason: 'test_account' };
    if (String(author?.email || '').toLowerCase() === SHANNON_EMAIL) return { ok: false, reason: 'admin_user' };
    if (isSensitiveFeedText(`${story.media_type || ''} ${storyText(story)}`)) return { ok: false, reason: 'sensitive_post' };
    return { ok: true };
}

async function queueFeedPostApprovals({ coachId, tahliaUser, now, maxAlerts, lookbackHours, learningExamples = [] }) {
    const transactions = await loadRecentTahliaTransactions(tahliaUser.id, now, lookbackHours);
    const inserted = [];
    const skipped = { deduped: 0, cap: 0 };

    for (const transaction of transactions) {
        if (inserted.length >= maxAlerts) {
            skipped.cap += 1;
            continue;
        }
        const key = `tahlia_feed_post:${transaction.id}`;
        const baseAlertRow = buildFeedPostAlert({ coachId, tahliaUser, transaction, now });
        if (!baseAlertRow) {
            skipped.unsupported = (skipped.unsupported || 0) + 1;
            continue;
        }
        const generated = await generateLearnedTahliaDraft({
            actionKind: 'feed_post',
            baseText: baseAlertRow.data.draft_text,
            activityType: baseAlertRow.data.activity_type,
            contextText: baseAlertRow.data.evidence?.source_description || activityLabel(baseAlertRow.data.activity_type),
            learningExamples,
        });
        const alertRow = applyGeneratedTahliaDraft(baseAlertRow, generated);
        const result = await insertCoachAlert(alertRow, key);
        if (result.alertId && !result.deduped) {
            inserted.push({
                alert_id: result.alertId,
                transaction_id: transaction.id,
                activity_type: alertRow.data.activity_type,
            });
        } else {
            skipped.deduped += 1;
        }
    }

    return { scanned: transactions.length, inserted, skipped };
}

async function queueCommentApprovals({ coachId, tahliaUser, shannonId, now, maxAlerts, storyLookbackHours, minStoryAgeMinutes, learningExamples = [] }) {
    const stories = await loadRecentStories(now, {
        lookbackHours: storyLookbackHours,
        minAgeMinutes: minStoryAgeMinutes,
    });
    const authors = await loadUsersById(stories.map(story => story.user_id));
    const inserted = [];
    const skipped = {
        own_post: 0,
        shannon_post: 0,
        admin_user: 0,
        test_account: 0,
        sensitive_post: 0,
        existing_comment: 0,
        existing_alert: 0,
        cap: 0,
        missing_story_fields: 0,
    };

    for (const story of stories) {
        if (inserted.length >= maxAlerts) {
            skipped.cap += 1;
            continue;
        }
        const author = authors.get(story.user_id) || {};
        const gate = shouldConsiderStory({ story, author, tahliaId: tahliaUser.id, shannonId });
        if (!gate.ok) {
            skipped[gate.reason] = (skipped[gate.reason] || 0) + 1;
            continue;
        }
        if (await hasTahliaComment(story.id, tahliaUser.id)) {
            skipped.existing_comment += 1;
            continue;
        }
        const key = `tahlia_feed_comment:${story.id}:${brisbaneDateKey(now)}`;
        if (await hasPendingOrActionedAlert(key)) {
            skipped.existing_alert += 1;
            continue;
        }
        const baseAlertRow = buildCommentAlert({ coachId, tahliaUser, story, author, now });
        const generated = await generateLearnedTahliaDraft({
            actionKind: 'feed_comment',
            baseText: baseAlertRow.data.draft_text,
            theme: baseAlertRow.data.evidence?.inferred_theme || '',
            contextText: baseAlertRow.data.evidence?.story_text || storyText(story),
            learningExamples,
        });
        const alertRow = applyGeneratedTahliaDraft(baseAlertRow, generated);
        const result = await insertCoachAlert(alertRow, key);
        if (result.alertId && !result.deduped) {
            inserted.push({
                alert_id: result.alertId,
                story_id: story.id,
                author_id: story.user_id,
            });
        } else {
            skipped.existing_alert += 1;
        }
    }

    return { scanned: stories.length, inserted, skipped };
}

async function runTahliaSocialWorker({
    now = new Date(),
    maxPostAlerts = DEFAULT_MAX_POST_ALERTS_PER_RUN,
    maxCommentAlerts = DEFAULT_MAX_COMMENT_ALERTS_PER_RUN,
    dailyPostCap = DEFAULT_DAILY_POST_ALERT_CAP,
    dailyCommentCap = DEFAULT_DAILY_COMMENT_ALERT_CAP,
    resumeDateKey = DEFAULT_RESUME_DATE_KEY,
    postTxLookbackHours = DEFAULT_POST_TX_LOOKBACK_HOURS,
    storyLookbackHours = DEFAULT_STORY_LOOKBACK_HOURS,
    minStoryAgeMinutes = DEFAULT_MIN_STORY_AGE_MINUTES,
} = {}) {
    if (String(process.env.TAHLIA_SOCIAL_WORKER_DISABLED || '').toLowerCase() === 'true') {
        return { ok: true, skipped: 'disabled' };
    }
    if (isBeforeBrisbaneDateKey(now, resumeDateKey)) {
        return {
            ok: true,
            skipped: 'paused_until_resume_date',
            checked_at: now.toISOString(),
            brisbane_date_key: brisbaneDateKey(now),
            resume_date_key: resumeDateKey,
        };
    }

    const [tahliaUser, shannonUser, learningExamples] = await Promise.all([
        loadUserByEmail(TAHLIA_EMAIL),
        loadUserByEmail(SHANNON_EMAIL),
        loadTahliaSocialLearningExamples(),
    ]);
    if (!tahliaUser?.id) return { ok: false, error: 'tahlia_user_not_found' };
    if (!shannonUser?.id) return { ok: false, error: 'shannon_user_not_found' };

    const dailyCounts = await loadDailyTahliaAlertCounts(now);
    const postSlots = Math.min(maxPostAlerts, Math.max(0, dailyPostCap - dailyCounts.feed_post));
    const commentSlots = Math.min(maxCommentAlerts, Math.max(0, dailyCommentCap - dailyCounts.feed_comment));

    const [feedPosts, comments] = await Promise.all([
        postSlots > 0 ? queueFeedPostApprovals({
            coachId: shannonUser.id,
            tahliaUser,
            now,
            maxAlerts: postSlots,
            lookbackHours: postTxLookbackHours,
            learningExamples,
        }) : Promise.resolve(dailyCappedResult({
            dailyCount: dailyCounts.feed_post,
            dailyCap: dailyPostCap,
        })),
        commentSlots > 0 ? queueCommentApprovals({
            coachId: shannonUser.id,
            tahliaUser,
            shannonId: shannonUser.id,
            now,
            maxAlerts: commentSlots,
            storyLookbackHours,
            minStoryAgeMinutes,
            learningExamples,
        }) : Promise.resolve(dailyCappedResult({
            dailyCount: dailyCounts.feed_comment,
            dailyCap: dailyCommentCap,
        })),
    ]);

    return {
        ok: true,
        checked_at: now.toISOString(),
        tahlia_user_id: tahliaUser.id,
        coach_id: shannonUser.id,
        profile: tahliaProfileForAlert(),
        learning: {
            edit_examples_loaded: learningExamples.length,
            source: 'recent_shannon_feed_edits',
        },
        daily_caps: {
            date_key: dailyCounts.date_key,
            comments: {
                count: dailyCounts.feed_comment,
                cap: dailyCommentCap,
                remaining_before_run: Math.max(0, dailyCommentCap - dailyCounts.feed_comment),
            },
            feed_posts: {
                count: dailyCounts.feed_post,
                cap: dailyPostCap,
                remaining_before_run: Math.max(0, dailyPostCap - dailyCounts.feed_post),
            },
        },
        feed_posts: feedPosts,
        comments,
    };
}

exports.handler = async (event = {}) => {
    try {
        const qs = event.queryStringParameters || {};
        const result = await runTahliaSocialWorker({
            maxPostAlerts: asNumber(qs.max_posts || process.env.TAHLIA_SOCIAL_MAX_POST_ALERTS, DEFAULT_MAX_POST_ALERTS_PER_RUN),
            maxCommentAlerts: asNumber(qs.max_comments || process.env.TAHLIA_SOCIAL_MAX_COMMENT_ALERTS, DEFAULT_MAX_COMMENT_ALERTS_PER_RUN),
            dailyPostCap: asNumber(qs.daily_post_cap || process.env.TAHLIA_SOCIAL_DAILY_POST_CAP, DEFAULT_DAILY_POST_ALERT_CAP),
            dailyCommentCap: asNumber(qs.daily_comment_cap || process.env.TAHLIA_SOCIAL_DAILY_COMMENT_CAP, DEFAULT_DAILY_COMMENT_ALERT_CAP),
            resumeDateKey: qs.resume_date_key || process.env.TAHLIA_SOCIAL_RESUME_DATE_KEY || DEFAULT_RESUME_DATE_KEY,
            postTxLookbackHours: asNumber(qs.tx_lookback_hours || process.env.TAHLIA_SOCIAL_TX_LOOKBACK_HOURS, DEFAULT_POST_TX_LOOKBACK_HOURS),
            storyLookbackHours: asNumber(qs.story_lookback_hours || process.env.TAHLIA_SOCIAL_STORY_LOOKBACK_HOURS, DEFAULT_STORY_LOOKBACK_HOURS),
            minStoryAgeMinutes: asNumber(qs.min_story_age_minutes || process.env.TAHLIA_SOCIAL_MIN_STORY_AGE_MINUTES, DEFAULT_MIN_STORY_AGE_MINUTES),
        });
        return json(result.ok === false ? 500 : 200, result);
    } catch (error) {
        console.error('[tahlia-social-worker] failed:', error);
        return json(500, { ok: false, error: error.message || String(error) });
    }
};

exports._test = {
    buildCommentAlert,
    buildFeedPostAlert,
    brisbaneDayBounds,
    brisbaneDateKey,
    isBeforeBrisbaneDateKey,
    isSensitiveFeedText,
    pointTransactionActivityType,
    runTahliaSocialWorker,
    shouldConsiderStory,
    isAllowedTahliaPostActivityType,
    isTahliaSocialAlertData,
    normalizeTahliaSocialLearningExamples,
    selectTahliaSocialLearningExamples,
    applyGeneratedTahliaDraft,
    isSafeLearnedTahliaDraft,
    parseTahliaDraftReply,
    summarizeDailyTahliaAlertCounts,
    tahliaNeedsYouReviewData,
    DEFAULT_DAILY_COMMENT_ALERT_CAP,
    DEFAULT_DAILY_POST_ALERT_CAP,
    DEFAULT_MAX_COMMENT_ALERTS_PER_RUN,
    DEFAULT_MAX_POST_ALERTS_PER_RUN,
    DEFAULT_RESUME_DATE_KEY,
};
