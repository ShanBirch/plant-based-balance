/**
 * Tahlia Social Worker
 *
 * Drafts approval-only Feed posts and supportive comments for the seeded
 * Tahlia Brooks account. Nothing is published here. Every action is queued as
 * a pending Needs You card with a proposed action Shannon must approve.
 */

const {
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
    storyText,
} = require('./_lib/tahlia-profile');

const SOURCE = 'tahlia-social-worker';
const TAHLIA_EMAIL = 'seed.tahlia.brooks+kayla30@plantbased-balance.org';
const SHANNON_EMAIL = 'shannonbirch@cocospersonaltraining.com';
const BRISBANE_OFFSET_MS = 10 * 60 * 60 * 1000;
const DEFAULT_POST_TX_LOOKBACK_HOURS = 6;
const DEFAULT_STORY_LOOKBACK_HOURS = 72;
const DEFAULT_MIN_STORY_AGE_MINUTES = 30;
const DEFAULT_MAX_POST_ALERTS_PER_RUN = 2;
const DEFAULT_MAX_COMMENT_ALERTS_PER_RUN = 3;

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
    if (type.includes('workout') || desc.includes('workout')) return 'workout';
    if (type.includes('meal') || desc.includes('meal')) return 'meal';
    if (type.includes('weigh') || desc.includes('weigh') || desc.includes('weight')) return 'weigh_in';
    if (type.includes('checkin') || type.includes('check_in') || desc.includes('check-in') || desc.includes('check in')) {
        return (hashString(tx.id || tx.created_at) % 2 === 0) ? 'weigh_in' : 'fitness_diary';
    }
    return '';
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
    const draft = buildTahliaPostDraft({
        activityType: activityType || 'fitness_diary',
        seed: transaction.id || transaction.created_at,
    });
    const label = activityLabel(draft.activityType);
    const caption = cleanPublicText(draft.caption, 500);
    const action = {
        id: postActionId(transaction),
        type: 'publish_tahlia_feed_post',
        label: `Publish Tahlia ${label} post`,
        status: 'pending',
        preview: caption,
        payload: {
            user_id: tahliaUser.id,
            media_type: 'text',
            caption,
            background_color: '#f8fafc',
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
        return !!pointTransactionActivityType(row);
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

function shouldConsiderStory({ story, author, tahliaId, shannonId }) {
    if (!story?.id || !story.user_id) return { ok: false, reason: 'missing_story_fields' };
    if (story.user_id === tahliaId) return { ok: false, reason: 'own_post' };
    if (story.user_id === shannonId) return { ok: false, reason: 'shannon_post' };
    if (author?.is_test_account) return { ok: false, reason: 'test_account' };
    if (String(author?.email || '').toLowerCase() === SHANNON_EMAIL) return { ok: false, reason: 'admin_user' };
    if (isSensitiveFeedText(`${story.media_type || ''} ${storyText(story)}`)) return { ok: false, reason: 'sensitive_post' };
    return { ok: true };
}

async function queueFeedPostApprovals({ coachId, tahliaUser, now, maxAlerts, lookbackHours }) {
    const transactions = await loadRecentTahliaTransactions(tahliaUser.id, now, lookbackHours);
    const inserted = [];
    const skipped = { deduped: 0, cap: 0 };

    for (const transaction of transactions) {
        if (inserted.length >= maxAlerts) {
            skipped.cap += 1;
            continue;
        }
        const key = `tahlia_feed_post:${transaction.id}`;
        const alertRow = buildFeedPostAlert({ coachId, tahliaUser, transaction, now });
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

async function queueCommentApprovals({ coachId, tahliaUser, shannonId, now, maxAlerts, storyLookbackHours, minStoryAgeMinutes }) {
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
        const alertRow = buildCommentAlert({ coachId, tahliaUser, story, author, now });
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
    postTxLookbackHours = DEFAULT_POST_TX_LOOKBACK_HOURS,
    storyLookbackHours = DEFAULT_STORY_LOOKBACK_HOURS,
    minStoryAgeMinutes = DEFAULT_MIN_STORY_AGE_MINUTES,
} = {}) {
    if (String(process.env.TAHLIA_SOCIAL_WORKER_DISABLED || '').toLowerCase() === 'true') {
        return { ok: true, skipped: 'disabled' };
    }

    const [tahliaUser, shannonUser] = await Promise.all([
        loadUserByEmail(TAHLIA_EMAIL),
        loadUserByEmail(SHANNON_EMAIL),
    ]);
    if (!tahliaUser?.id) return { ok: false, error: 'tahlia_user_not_found' };
    if (!shannonUser?.id) return { ok: false, error: 'shannon_user_not_found' };

    const [feedPosts, comments] = await Promise.all([
        queueFeedPostApprovals({
            coachId: shannonUser.id,
            tahliaUser,
            now,
            maxAlerts: maxPostAlerts,
            lookbackHours: postTxLookbackHours,
        }),
        queueCommentApprovals({
            coachId: shannonUser.id,
            tahliaUser,
            shannonId: shannonUser.id,
            now,
            maxAlerts: maxCommentAlerts,
            storyLookbackHours,
            minStoryAgeMinutes,
        }),
    ]);

    return {
        ok: true,
        checked_at: now.toISOString(),
        tahlia_user_id: tahliaUser.id,
        coach_id: shannonUser.id,
        profile: tahliaProfileForAlert(),
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
    brisbaneDateKey,
    isSensitiveFeedText,
    pointTransactionActivityType,
    runTahliaSocialWorker,
    shouldConsiderStory,
    tahliaNeedsYouReviewData,
};
