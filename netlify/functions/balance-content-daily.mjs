import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const {
    createDailyPost,
    createOneOfEach,
    createPostForLane,
    formatBrisbaneDate,
    laneForDate,
    normalizeCounts,
} = require('../../content-lab/src/balance-content/core.js');

const DEFAULT_SUPABASE_URL = 'https://hzapaorxqboevxnumxkv.supabase.co';
const SHANNON_EMAIL = 'shannonbirch@cocospersonaltraining.com';

export const config = {
    schedule: '0 19 * * 0-5',
};

function getEnv(name) {
    const netlifyValue = globalThis.Netlify?.env?.get?.(name);
    if (netlifyValue) return String(netlifyValue);
    return typeof process !== 'undefined' ? String(process.env?.[name] || '') : '';
}

function json(status, body) {
    return new Response(JSON.stringify(body, null, 2), {
        status,
        headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store',
        },
    });
}

function cleanString(value, max = 1000) {
    return String(value || '').trim().slice(0, max);
}

function getHeader(req, name) {
    return cleanString(req.headers.get(name), 1000);
}

async function readBody(req) {
    try {
        return await req.json();
    } catch {
        return {};
    }
}

function isScheduledInvocation(req, body = {}) {
    return Boolean(body?.next_run || getHeader(req, 'x-nf-event').toLowerCase() === 'schedule');
}

function secrets() {
    return [
        getEnv('BALANCE_CONTENT_AUTOMATION_SECRET'),
        getEnv('IG_STORY_BOT_BRIDGE_SECRET'),
        getEnv('META_IG_SYNC_SECRET'),
        getEnv('META_IG_WEBHOOK_VERIFY_TOKEN'),
        getEnv('META_WEBHOOK_VERIFY_TOKEN'),
    ].map(value => cleanString(value, 500)).filter(Boolean);
}

function isAuthorized(req, body = {}) {
    if (getEnv('CONTEXT') === 'dev') return true;
    if (isScheduledInvocation(req, body)) return true;
    const provided = cleanString(
        getHeader(req, 'x-balance-content-secret')
        || getHeader(req, 'x-ig-story-secret')
        || body.secret,
        500
    );
    return Boolean(provided && secrets().includes(provided));
}

function supabaseUrl() {
    return cleanString(getEnv('SUPABASE_URL') || getEnv('VITE_SUPABASE_URL') || DEFAULT_SUPABASE_URL, 300).replace(/\/+$/, '');
}

function serviceKey() {
    return cleanString(getEnv('SUPABASE_SERVICE_ROLE_KEY') || getEnv('SUPABASE_SERVICE_KEY'), 5000);
}

async function supabaseFetch(path, options = {}) {
    const key = serviceKey();
    if (!supabaseUrl() || !key) throw new Error('Supabase env missing');
    const res = await fetch(`${supabaseUrl()}/rest/v1/${path}`, {
        method: options.method || 'GET',
        headers: {
            apikey: key,
            Authorization: `Bearer ${key}`,
            'Content-Type': 'application/json',
            ...(options.prefer ? { Prefer: options.prefer } : {}),
            ...(options.headers || {}),
        },
        body: options.body == null ? undefined : JSON.stringify(options.body),
    });
    const text = await res.text();
    let data = null;
    try {
        data = text ? JSON.parse(text) : null;
    } catch {
        data = text;
    }
    if (!res.ok) {
        const message = typeof data === 'string' ? data : JSON.stringify(data);
        throw new Error(`Supabase ${res.status}: ${message.slice(0, 500)}`);
    }
    return data || [];
}

async function execSqlJson(sql) {
    return await supabaseFetch('rpc/exec_sql_json', {
        method: 'POST',
        body: { sql },
    });
}

async function findPosterUserId() {
    const explicit = cleanString(getEnv('BALANCE_CONTENT_POST_USER_ID'), 120);
    if (explicit) return explicit;

    const rows = await execSqlJson(`
        SELECT u.id
        FROM public.admin_users au
        JOIN public.users u ON u.id = au.user_id
        WHERE LOWER(COALESCE(u.email, '')) = '${SHANNON_EMAIL}'
        ORDER BY au.created_at ASC NULLS LAST
        LIMIT 1
    `);
    if (rows?.[0]?.id) return rows[0].id;

    const users = await supabaseFetch(`users?select=id,email&email=eq.${encodeURIComponent(SHANNON_EMAIL)}&limit=1`);
    if (users?.[0]?.id) return users[0].id;
    throw new Error('No Shannon user found for Balance content publishing');
}

async function fetchProofSignals() {
    const rows = await execSqlJson(`
        WITH active_users AS (
            SELECT id
            FROM public.users
            WHERE COALESCE(is_test_account, false) = false
        ),
        workout_sessions AS (
            SELECT DISTINCT
                w.user_id,
                w.workout_date,
                COALESCE(NULLIF(w.template_name, ''), NULLIF(w.workout_type, ''), 'workout') AS workout_key
            FROM public.workouts w
            JOIN active_users u ON u.id = w.user_id
            WHERE w.workout_date >= (NOW() AT TIME ZONE 'Australia/Brisbane')::date - INTERVAL '7 days'
                AND COALESCE(w.is_current_workout, false) = false
                AND COALESCE(w.workout_type, 'history') = 'history'
        ),
        current_week_workouts AS (
            SELECT user_id, COUNT(*) AS sessions
            FROM workout_sessions
            GROUP BY user_id
        ),
        pb AS (
            SELECT p.*
            FROM public.pb_history p
            JOIN active_users u ON u.id = p.user_id
            WHERE p.achieved_at >= NOW() - INTERVAL '7 days'
        ),
        mood AS (
            SELECT m.*
            FROM public.mood_logs m
            JOIN active_users u ON u.id = m.user_id
            WHERE m.logged_at >= NOW() - INTERVAL '7 days'
        ),
        checkins AS (
            SELECT n.*
            FROM public.nudges n
            JOIN active_users u ON u.id = n.sender_id
            WHERE n.created_at >= NOW() - INTERVAL '7 days'
        ),
        challenge_active AS (
            SELECT cp.*
            FROM public.challenge_participants cp
            JOIN active_users u ON u.id = cp.user_id
            WHERE cp.status IN ('accepted', 'active', 'joined')
        )
        SELECT
            (SELECT COUNT(*) FROM workout_sessions)::INT AS workout_sessions_7d,
            (SELECT COUNT(DISTINCT user_id) FROM workout_sessions)::INT AS workout_users_7d,
            (SELECT COUNT(*) FROM current_week_workouts WHERE sessions >= 2)::INT AS users_with_2_plus_workouts_7d,
            (SELECT COUNT(*) FROM pb)::INT AS pbs_7d,
            (SELECT COUNT(DISTINCT user_id) FROM pb)::INT AS pb_users_7d,
            (SELECT COUNT(*) FROM mood)::INT AS mood_logs_7d,
            (SELECT COUNT(DISTINCT user_id) FROM mood)::INT AS mood_users_7d,
            (SELECT COUNT(*) FROM checkins)::INT AS client_checkins_7d,
            (SELECT COUNT(*) FROM challenge_active)::INT AS active_challenge_participants
    `);
    return normalizeCounts(rows?.[0] || {});
}

async function countsForRun(body = {}) {
    if (body.counts && typeof body.counts === 'object') return normalizeCounts(body.counts);
    try {
        return await fetchProofSignals();
    } catch (error) {
        console.warn('[balance-content-daily] proof signal fetch failed, using fallback:', error.message);
        return normalizeCounts({});
    }
}

async function findDuplicateStory(userId, post) {
    const prefix = encodeURIComponent(`${post.prefix}*`);
    const rows = await supabaseFetch(
        `stories?select=id,created_at,caption&user_id=eq.${encodeURIComponent(userId)}&media_type=eq.text&caption=ilike.${prefix}&order=created_at.desc&limit=1`
    );
    return rows?.[0] || null;
}

async function publishPostToFeed(post) {
    const userId = await findPosterUserId();
    const duplicate = await findDuplicateStory(userId, post);
    if (duplicate?.id) {
        return {
            ok: true,
            duplicate: true,
            story: duplicate,
            post: { ...post, status: 'duplicate_skipped' },
        };
    }

    const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
    const rows = await supabaseFetch('stories', {
        method: 'POST',
        prefer: 'return=representation',
        body: [{
            user_id: userId,
            media_type: post.mediaType || 'text',
            media_url: post.mediaUrl || '',
            thumbnail_url: post.thumbnailUrl || null,
            caption: post.caption,
            duration: 5,
            background_color: '#f8fafc',
            expires_at: expiresAt,
        }],
    });
    return {
        ok: true,
        duplicate: false,
        story: rows?.[0] || null,
        post: { ...post, status: 'posted' },
    };
}

function forcedDate(body = {}) {
    return cleanString(body.date || body.week || '', 20) || formatBrisbaneDate();
}

export default async (req) => {
    const body = await readBody(req);
    const scheduled = isScheduledInvocation(req, body);

    if (req.method !== 'POST' && !scheduled) {
        return json(405, { ok: false, error: 'method_not_allowed' });
    }

    if (!isAuthorized(req, body)) {
        return json(401, { ok: false, error: 'unauthorized' });
    }

    const action = scheduled ? 'publish-daily' : cleanString(body.action || 'plan', 80).toLowerCase();
    const dateString = forcedDate(body);
    let cachedCounts = null;
    const getCounts = async () => {
        if (!cachedCounts) cachedCounts = await countsForRun(body);
        return cachedCounts;
    };

    try {
        if (action === 'create-one-of-each') {
            const counts = await getCounts();
            const posts = createOneOfEach({ dateString, counts });
            return json(200, { ok: true, action, date: dateString, posts });
        }

        if (action === 'publish-one') {
            const lane = cleanString(body.lane || '', 40);
            const counts = lane === 'proof' ? await getCounts() : undefined;
            const post = lane
                ? createPostForLane({ lane, dateString, counts })
                : createDailyPost({ dateString, counts });
            if (post.skipped) return json(200, { ok: true, skipped: true, post });
            if (body.dryRun) return json(200, { ok: true, dryRun: true, post });
            const published = await publishPostToFeed(post);
            return json(200, { ...published, action, date: dateString });
        }

        if (action === 'publish-daily') {
            const lane = laneForDate(dateString);
            const counts = lane === 'proof' ? await getCounts() : undefined;
            const post = createDailyPost({ dateString, counts });
            if (post.skipped) return json(200, { ok: true, skipped: true, post });
            if (body.dryRun) return json(200, { ok: true, dryRun: true, post });
            const published = await publishPostToFeed(post);
            return json(200, { ...published, action, date: dateString });
        }

        if (action === 'plan') {
            const lane = laneForDate(dateString);
            const counts = lane === 'proof' ? await getCounts() : undefined;
            const post = createDailyPost({ dateString, counts });
            return json(200, { ok: true, action, date: dateString, post });
        }

        return json(400, { ok: false, error: 'unknown_action', action });
    } catch (error) {
        console.error('[balance-content-daily] failed:', error);
        return json(500, {
            ok: false,
            error: error.message || 'balance_content_daily_failed',
            action,
            date: dateString,
        });
    }
};

export const _test = {
    fetchProofSignals,
    findPosterUserId,
    publishPostToFeed,
};
