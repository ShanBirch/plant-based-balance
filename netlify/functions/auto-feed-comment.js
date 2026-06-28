/**
 * Auto Feed Reaction
 *
 * Adds a same-day Shannon reaction to fresh Balance feed posts.
 * The deployed scheduled function keeps the legacy `auto-feed-comment` name,
 * but this no longer generates or inserts feed comments.
 */

const { supabaseQuery } = require('./_lib/client-context');

const BALANCE_ADMIN_EMAIL = 'shannonbirch@cocospersonaltraining.com';
const BRISBANE_OFFSET_MS = 10 * 60 * 60 * 1000;
const MIN_DELAY_MINUTES = 90;
const MAX_DELAY_MINUTES = 360;
const MAX_POST_AGE_HOURS = 24;
const ACTIVE_WINDOW_START_MINUTE = 7 * 60 + 30;
const ACTIVE_WINDOW_END_MINUTE = 21 * 60 + 45;
const DEFAULT_MAX_REACTIONS_PER_RUN = 8;
const DEFAULT_SCAN_LIMIT = 50;
const SHANNON_REACTION = 'love';

function json(statusCode, body) {
    return {
        statusCode,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    };
}

function asNumber(value, fallback) {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : fallback;
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

function autoDelayMinutes(story) {
    const span = MAX_DELAY_MINUTES - MIN_DELAY_MINUTES;
    return MIN_DELAY_MINUTES + (hashString(`${story.id}:${story.created_at}`) % (span + 1));
}

function brisbaneMinutesOfDay(date = new Date()) {
    const shifted = new Date(date.getTime() + BRISBANE_OFFSET_MS);
    return shifted.getUTCHours() * 60 + shifted.getUTCMinutes();
}

function inActiveWindow(date = new Date()) {
    const minute = brisbaneMinutesOfDay(date);
    return minute >= ACTIVE_WINDOW_START_MINUTE && minute <= ACTIVE_WINDOW_END_MINUTE;
}

function isSensitivePost(story) {
    const summary = `${story.media_type || ''} ${story.caption || ''}`.toLowerCase();
    return /\b(grief|death|dead|died|hospital|surgery|injury|injured|pain|panic|depressed|depression|anxiety|self harm|eating disorder|binge|purge|pregnant|pregnancy|miscarriage|blood|diagnosis|trauma|abuse)\b/.test(summary);
}

async function loadShannonUser() {
    const rows = await supabaseQuery(`users?select=id,email,name&email=eq.${encodeURIComponent(BALANCE_ADMIN_EMAIL)}&limit=1`);
    return rows[0] || null;
}

async function loadStories(now = new Date(), scanLimit = DEFAULT_SCAN_LIMIT) {
    const newest = new Date(now.getTime() - MIN_DELAY_MINUTES * 60 * 1000).toISOString();
    const oldest = new Date(now.getTime() - MAX_POST_AGE_HOURS * 60 * 60 * 1000).toISOString();
    return supabaseQuery(
        `stories?select=id,user_id,media_type,media_url,caption,created_at,expires_at&created_at=gte.${encodeURIComponent(oldest)}&created_at=lte.${encodeURIComponent(newest)}&expires_at=gt.${encodeURIComponent(now.toISOString())}&order=created_at.asc&limit=${scanLimit}`
    );
}

async function loadUsersById(userIds = []) {
    const ids = [...new Set(userIds.filter(Boolean))];
    if (ids.length === 0) return new Map();
    const rows = await supabaseQuery(
        `users?select=id,name,email,is_test_account&id=in.(${ids.join(',')})&limit=${ids.length}`
    ).catch(() => []);
    return new Map(rows.map(row => [row.id, row]));
}

async function hasShannonReaction(storyId, shannonId) {
    const rows = await supabaseQuery(
        `feed_reactions?select=id,reaction&story_id=eq.${storyId}&user_id=eq.${shannonId}&limit=1`
    ).catch(() => []);
    return rows[0] || null;
}

function shouldConsiderStory({ story, author, shannonId, now = new Date() }) {
    if (!story?.id || !story.user_id) return { ok: false, reason: 'missing_story_fields' };
    if (story.user_id === shannonId) return { ok: false, reason: 'own_post' };
    if (author?.is_test_account) return { ok: false, reason: 'test_account' };
    if (String(author?.email || '').toLowerCase() === BALANCE_ADMIN_EMAIL) return { ok: false, reason: 'admin_user' };
    if (isSensitivePost(story)) return { ok: false, reason: 'sensitive_post' };
    const createdAt = Date.parse(story.created_at || '');
    if (!Number.isFinite(createdAt)) return { ok: false, reason: 'bad_created_at' };
    const dueAt = createdAt + autoDelayMinutes(story) * 60 * 1000;
    if (now.getTime() < dueAt) return { ok: false, reason: 'not_due_yet' };
    return { ok: true, dueAt: new Date(dueAt).toISOString() };
}

async function upsertFeedReaction({ storyId, shannonId, reaction = SHANNON_REACTION, dryRun = false }) {
    if (dryRun) return { id: null, reaction, dryRun: true };
    const rows = await supabaseQuery('feed_reactions?on_conflict=story_id,user_id', {
        method: 'POST',
        body: [{ story_id: storyId, user_id: shannonId, reaction }],
        prefer: 'resolution=merge-duplicates,return=representation',
    });
    return rows[0] || null;
}

async function runAutoFeedReaction({
    now = new Date(),
    dryRun = false,
    force = false,
    scanLimit = DEFAULT_SCAN_LIMIT,
    maxReactions = DEFAULT_MAX_REACTIONS_PER_RUN,
} = {}) {
    const summary = {
        scanned: 0,
        eligible: 0,
        reacted: 0,
        skipped: {},
        reactions: [],
        dry_run: dryRun,
    };

    if (String(process.env.FEED_AUTO_REACTION_DISABLED || process.env.FEED_AUTO_COMMENT_DISABLED || '').toLowerCase() === 'true') {
        summary.skipped.disabled = 1;
        return summary;
    }
    if (!force && !inActiveWindow(now)) {
        summary.skipped.outside_active_window = 1;
        return summary;
    }

    const shannon = await loadShannonUser();
    if (!shannon?.id) throw new Error('Shannon admin user not found');

    const stories = await loadStories(now, scanLimit);
    summary.scanned = stories.length;
    const users = await loadUsersById(stories.map(s => s.user_id));

    for (const story of stories) {
        if (summary.reacted >= maxReactions) {
            summary.skipped.run_cap = (summary.skipped.run_cap || 0) + 1;
            continue;
        }

        const author = users.get(story.user_id) || {};
        const gate = shouldConsiderStory({ story, author, shannonId: shannon.id, now });
        if (!gate.ok) {
            summary.skipped[gate.reason] = (summary.skipped[gate.reason] || 0) + 1;
            continue;
        }

        if (await hasShannonReaction(story.id, shannon.id)) {
            summary.skipped.already_reacted = (summary.skipped.already_reacted || 0) + 1;
            continue;
        }

        summary.eligible += 1;
        if (await hasShannonReaction(story.id, shannon.id)) {
            summary.skipped.already_reacted_race = (summary.skipped.already_reacted_race || 0) + 1;
            continue;
        }

        const inserted = await upsertFeedReaction({ storyId: story.id, shannonId: shannon.id, dryRun });
        summary.reacted += 1;
        summary.reactions.push({
            story_id: story.id,
            user_id: story.user_id,
            user_name: author.name || null,
            reaction: inserted?.reaction || SHANNON_REACTION,
            due_at: gate.dueAt,
            reaction_id: inserted?.id || null,
        });
    }

    return summary;
}

exports.handler = async (event = {}) => {
    try {
        const qs = event.queryStringParameters || {};
        const dryRun = qs.dry_run === '1'
            || qs.dryRun === '1'
            || String(process.env.FEED_AUTO_REACTION_DRY_RUN || process.env.FEED_AUTO_COMMENT_DRY_RUN || '').toLowerCase() === 'true';
        const force = qs.force === '1';
        const scanLimit = asNumber(
            qs.limit || process.env.FEED_AUTO_REACTION_SCAN_LIMIT || process.env.FEED_AUTO_COMMENT_SCAN_LIMIT,
            DEFAULT_SCAN_LIMIT
        );
        const maxReactions = asNumber(
            qs.max_reactions || qs.max_comments || process.env.FEED_AUTO_REACTION_MAX_PER_RUN || process.env.FEED_AUTO_COMMENT_MAX_PER_RUN,
            DEFAULT_MAX_REACTIONS_PER_RUN
        );
        const summary = await runAutoFeedReaction({ dryRun, force, scanLimit, maxReactions });
        return json(200, { ok: true, ...summary });
    } catch (err) {
        console.error('[auto-feed-reaction] failed:', err);
        return json(500, { ok: false, error: err.message || String(err) });
    }
};

exports.__test = {
    autoDelayMinutes,
    brisbaneMinutesOfDay,
    inActiveWindow,
    runAutoFeedReaction,
    shouldConsiderStory,
    upsertFeedReaction,
};
