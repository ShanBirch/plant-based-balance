/**
 * Auto Feed Comment
 *
 * Adds a simple same-day Shannon comment to fresh Balance feed posts.
 * The feed already stores comments in `feed_comments`, so this function stays
 * deliberately narrow: wait a human-ish delay, skip if Shannon already
 * commented, generate one short contextual comment, then insert it directly.
 */

const {
    supabaseQuery,
    callVertexAIModel,
    callGeminiFallback,
    truncate,
} = require('./_lib/client-context');

const BALANCE_ADMIN_EMAIL = 'shannonbirch@cocospersonaltraining.com';
const BRISBANE_OFFSET_MS = 10 * 60 * 60 * 1000;
const MIN_DELAY_MINUTES = 90;
const MAX_DELAY_MINUTES = 360;
const MAX_POST_AGE_HOURS = 24;
const ACTIVE_WINDOW_START_MINUTE = 7 * 60 + 30;
const ACTIVE_WINDOW_END_MINUTE = 21 * 60 + 45;
const DEFAULT_MAX_COMMENTS_PER_RUN = 8;
const DEFAULT_SCAN_LIMIT = 50;

function json(statusCode, body) {
    return {
        statusCode,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    };
}

function cleanText(value, max = 500) {
    return String(value || '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, max);
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

function parseCaption(caption) {
    const raw = String(caption || '').trim();
    if (!raw) return { raw: '', payload: null };
    try {
        const parsed = JSON.parse(raw);
        return { raw, payload: parsed && typeof parsed === 'object' ? parsed : null };
    } catch (_) {
        return { raw, payload: null };
    }
}

function formatList(values, max = 4) {
    return (values || [])
        .map(v => cleanText(v, 80))
        .filter(Boolean)
        .slice(0, max)
        .join(', ');
}

function describeStory(story, author = {}) {
    const { raw, payload } = parseCaption(story.caption);
    const name = cleanText(author.name || author.email || 'someone', 80);
    const type = cleanText(story.media_type || 'post', 50);
    if (payload?.card_type === 'workout' || type === 'workout_card') {
        const exercises = Array.isArray(payload?.exercises)
            ? formatList(payload.exercises.map(e => e?.name || e?.exercise || e), 5)
            : '';
        const pbBits = Array.isArray(payload?.pbs)
            ? formatList(payload.pbs.map(p => p?.exercise || p?.name || p), 3)
            : '';
        return cleanText(`${name} shared a workout: ${payload?.workout_name || 'workout'}${payload?.duration ? `, ${payload.duration}` : ''}${payload?.total_sets ? `, ${payload.total_sets} sets` : ''}${exercises ? `. Exercises: ${exercises}` : ''}${pbBits ? `. PBs: ${pbBits}` : ''}`, 700);
    }
    if (payload?.card_type === 'pb') {
        return cleanText(`${name} shared a PB: ${payload.exercise || 'exercise'} ${payload.value || ''}${payload.weight ? ` at ${payload.weight}kg` : ''}${payload.reps ? ` for ${payload.reps} reps` : ''}`, 700);
    }
    if (payload?.card_type === 'meal' || type === 'meal_card') {
        return cleanText(`${name} shared a meal: ${payload?.meal_type || 'meal'}${payload?.foods ? ` with ${payload.foods}` : ''}${payload?.protein ? `, ${payload.protein}g protein` : ''}`, 700);
    }
    if (payload?.card_type === 'nutrition' || type === 'nutrition_card') {
        return cleanText(`${name} shared a nutrition day: ${payload?.calories || 0} calories, ${payload?.protein || 0}g protein, ${payload?.meal_count || 0} meals`, 700);
    }
    if (payload?.card_type === 'level_up' || type === 'level_up_card') {
        return cleanText(`${name} shared a level up: level ${payload?.level || ''}${payload?.title ? `, ${payload.title}` : ''}`, 700);
    }
    if (raw && !payload) {
        return cleanText(`${name} shared a ${type} feed post. Caption: ${raw}`, 700);
    }
    return cleanText(`${name} shared a ${type} feed post with no caption.`, 700);
}

function isSensitivePost(story) {
    const summary = `${story.media_type || ''} ${story.caption || ''}`.toLowerCase();
    return /\b(grief|death|dead|died|hospital|surgery|injury|injured|pain|panic|depressed|depression|anxiety|self harm|eating disorder|binge|purge|pregnant|pregnancy|miscarriage|blood|diagnosis|trauma|abuse)\b/.test(summary);
}

function fallbackComment(story) {
    const { payload, raw } = parseCaption(story.caption);
    const type = String(story.media_type || '').toLowerCase();
    const text = raw.toLowerCase();
    if (payload?.card_type === 'pb') return 'thats a solid pb';
    if (payload?.card_type === 'level_up' || type === 'level_up_card') return 'lets goo';
    if (payload?.card_type === 'nutrition' || type === 'nutrition_card') return 'solid day that';
    if (payload?.card_type === 'meal' || type === 'meal_card' || /\b(meal|food|breakfast|lunch|dinner|tofu|tempeh|protein)\b/.test(text)) return 'so good';
    if (payload?.card_type === 'workout' || type === 'workout_card' || /\b(workout|session|gym|run|walk|ride|lift|sets|reps)\b/.test(text)) return 'nice work';
    return 'nice one';
}

function normalizeGeneratedComment(value) {
    let comment = String(value || '').trim();
    if (!comment) return '';
    try {
        const parsed = JSON.parse(comment.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim());
        comment = parsed.comment || parsed.text || '';
    } catch (_) {
        const jsonMatch = comment.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            try {
                const parsed = JSON.parse(jsonMatch[0]);
                comment = parsed.comment || parsed.text || '';
            } catch { /* keep raw text */ }
        }
    }
    comment = String(comment || '')
        .replace(/^comment\s*:\s*/i, '')
        .replace(/^["']|["']$/g, '')
        .replace(/[“”]/g, '"')
        .replace(/[’‘]/g, "'")
        .replace(/[\u2014\u2013]/g, ',')
        .replace(/[!]+/g, '')
        .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
    comment = comment
        .replace(/\bhow'd\b/g, 'howd')
        .replace(/\bhow\?d\b/g, 'howd')
        .replace(/\bthat's\b/g, 'thats')
        .replace(/\bthat\?s\b/g, 'thats')
        .replace(/\byou're\b/g, 'youre')
        .replace(/\byou\?re\b/g, 'youre')
        .replace(/\bit's\b/g, 'its');
    if (!comment || /^(skip|no comment|none|null|n\/a)$/i.test(comment)) return '';
    if (comment.includes('?')) return '';
    if (/\b(what'?s your next goal|whats your next goal|next goal|howd|how did|how are you|how was|what are you|what did|what do you|what'?s next|whats next)\b/i.test(comment)) return '';
    if (comment.length > 120) comment = truncate(comment, 120).replace(/[,.!?;:]+$/g, '').trim();
    if (/@|http|www\.|balance|challenge|coaching|coach|app|ai|automation|bot/i.test(comment)) return '';
    if (/\b(hot|sexy|skinny|fat|body|weight|physique|looking good|look good)\b/i.test(comment)) return '';
    return comment;
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

async function loadRecentFeedCommentExamples(shannonId) {
    if (!shannonId) return [];
    const rows = await supabaseQuery(
        `feed_comments?select=comment_text,created_at&user_id=eq.${shannonId}&order=created_at.desc&limit=20`
    ).catch(() => []);
    return rows
        .map(row => normalizeGeneratedComment(row.comment_text))
        .filter(text => text && text.length <= 120)
        .slice(0, 8);
}

async function hasShannonComment(storyId, shannonId) {
    const rows = await supabaseQuery(
        `feed_comments?select=id&story_id=eq.${storyId}&user_id=eq.${shannonId}&limit=1`
    ).catch(() => []);
    return rows.length > 0;
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

async function generateComment({ story, author, examples = [] }) {
    const fallback = normalizeGeneratedComment(fallbackComment(story));
    const summary = describeStory(story, author);
    const exampleBlock = examples.length
        ? `\nRECENT SHANNON FEED COMMENTS:\n${examples.map(e => `- ${e}`).join('\n')}`
        : '';
    const prompt = `Write ONE short Balance feed comment as Shannon.

This comment posts directly under a client/community feed post, so be simple and safe.

Rules:
- lower-case casual Shannon voice
- 2 to 12 words, max 120 characters
- no greeting, no name, no emoji, no exclamation mark
- no questions, just a short hype/support comment
- no mention of Balance, app, coaching, challenge, AI, automation, or links
- never comment on body, weight, appearance, attractiveness, or medical stuff
- for level ups, prefer comments like hell yeah, lets goo, so good, nice one, huge, love that
- if this should not be commented on, return {"comment":""}

POST:
${summary}
${exampleBlock}

Return JSON only: {"comment":"..."}`;

    const contents = [{ role: 'user', parts: [{ text: prompt }] }];
    const generationConfig = { maxOutputTokens: 80, temperature: 0.35 };
    for (const call of [callVertexAIModel, callGeminiFallback]) {
        try {
            const reply = await call(contents, generationConfig);
            const normalized = normalizeGeneratedComment(reply);
            if (normalized) return { comment: normalized, model: call === callVertexAIModel ? 'vertex-v7' : 'gemini-fallback' };
        } catch (err) {
            console.warn(`[auto-feed-comment] model failed: ${err.message}`);
        }
    }
    return { comment: fallback, model: 'fallback-rule' };
}

async function insertFeedComment({ storyId, shannonId, comment, dryRun = false }) {
    if (dryRun) return { id: null, dryRun: true };
    const rows = await supabaseQuery('feed_comments', {
        method: 'POST',
        body: [{ story_id: storyId, user_id: shannonId, comment_text: comment }],
    });
    return rows[0] || null;
}

async function runAutoFeedComment({ now = new Date(), dryRun = false, force = false, scanLimit = DEFAULT_SCAN_LIMIT, maxComments = DEFAULT_MAX_COMMENTS_PER_RUN } = {}) {
    const summary = {
        scanned: 0,
        eligible: 0,
        commented: 0,
        skipped: {},
        comments: [],
        dry_run: dryRun,
    };

    if (String(process.env.FEED_AUTO_COMMENT_DISABLED || '').toLowerCase() === 'true') {
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
    const examples = await loadRecentFeedCommentExamples(shannon.id);

    for (const story of stories) {
        if (summary.commented >= maxComments) {
            summary.skipped.run_cap = (summary.skipped.run_cap || 0) + 1;
            continue;
        }

        const author = users.get(story.user_id) || {};
        const gate = shouldConsiderStory({ story, author, shannonId: shannon.id, now });
        if (!gate.ok) {
            summary.skipped[gate.reason] = (summary.skipped[gate.reason] || 0) + 1;
            continue;
        }

        if (await hasShannonComment(story.id, shannon.id)) {
            summary.skipped.already_commented = (summary.skipped.already_commented || 0) + 1;
            continue;
        }

        summary.eligible += 1;
        const generated = await generateComment({ story, author, examples });
        const comment = normalizeGeneratedComment(generated.comment);
        if (!comment) {
            summary.skipped.empty_comment = (summary.skipped.empty_comment || 0) + 1;
            continue;
        }

        if (await hasShannonComment(story.id, shannon.id)) {
            summary.skipped.already_commented_race = (summary.skipped.already_commented_race || 0) + 1;
            continue;
        }

        const inserted = await insertFeedComment({ storyId: story.id, shannonId: shannon.id, comment, dryRun });
        summary.commented += 1;
        summary.comments.push({
            story_id: story.id,
            user_id: story.user_id,
            user_name: author.name || null,
            comment,
            model: generated.model,
            due_at: gate.dueAt,
            comment_id: inserted?.id || null,
        });
        examples.unshift(comment);
    }

    return summary;
}

exports.handler = async (event = {}) => {
    try {
        const qs = event.queryStringParameters || {};
        const dryRun = qs.dry_run === '1' || qs.dryRun === '1' || String(process.env.FEED_AUTO_COMMENT_DRY_RUN || '').toLowerCase() === 'true';
        const force = qs.force === '1';
        const scanLimit = asNumber(qs.limit || process.env.FEED_AUTO_COMMENT_SCAN_LIMIT, DEFAULT_SCAN_LIMIT);
        const maxComments = asNumber(qs.max_comments || process.env.FEED_AUTO_COMMENT_MAX_PER_RUN, DEFAULT_MAX_COMMENTS_PER_RUN);
        const summary = await runAutoFeedComment({ dryRun, force, scanLimit, maxComments });
        return json(200, { ok: true, ...summary });
    } catch (err) {
        console.error('[auto-feed-comment] failed:', err);
        return json(500, { ok: false, error: err.message || String(err) });
    }
};

exports.__test = {
    autoDelayMinutes,
    brisbaneMinutesOfDay,
    describeStory,
    fallbackComment,
    inActiveWindow,
    normalizeGeneratedComment,
    shouldConsiderStory,
};
