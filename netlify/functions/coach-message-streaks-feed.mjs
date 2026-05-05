/**
 * Builds the admin DM streak tracker.
 *
 * The feed blends in-app client DMs and IG/Messenger ManyChat threads, then
 * shows only two admin groups:
 * - Active daily streaks: consecutive local Brisbane dates ending today.
 * - Dropped-off warnings: previous daily streaks with no outbound for 1-3 days.
 */

function getEnv(name) {
    const netlifyValue = globalThis.Netlify?.env?.get?.(name);
    if (netlifyValue) return netlifyValue;
    return typeof process !== 'undefined' ? process.env?.[name] : undefined;
}

const SUPABASE_URL = getEnv('SUPABASE_URL') || getEnv('VITE_SUPABASE_URL');
const SUPABASE_SERVICE_KEY = getEnv('SUPABASE_SERVICE_ROLE_KEY') || getEnv('SUPABASE_SERVICE_KEY');
const BALANCE_ADMIN_EMAIL = 'shannonbirch@cocospersonaltraining.com';

const TIME_ZONE = 'Australia/Brisbane';
const TARGET_LOOKBACK_DAYS = 90;
const STREAK_LOOKBACK_DAYS = 90;
const DEFAULT_WINDOW_DAYS = 30;
const LIMIT = 250;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MIN_DAILY_STREAK_DAYS = 2;
const DROPPED_DAILY_WARNING_DAYS = 3;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function json(statusCode, body) {
    return new Response(JSON.stringify(body), {
        status: statusCode,
        headers: { 'Content-Type': 'application/json' },
    });
}

async function requireShannonAdmin(req) {
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) return { response: json(401, { error: 'Unauthorized' }) };

    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        headers: {
            apikey: SUPABASE_SERVICE_KEY,
            Authorization: `Bearer ${token}`,
        },
    });
    if (!res.ok) return { response: json(401, { error: 'Unauthorized' }) };

    const user = await res.json();
    const email = String(user?.email || '').trim().toLowerCase();
    if (email !== BALANCE_ADMIN_EMAIL) return { response: json(403, { error: 'Forbidden' }) };
    return { user };
}

function clampNumber(value, fallback, min, max) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(min, Math.min(max, Math.round(n)));
}

async function supabase(path) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
        headers: {
            apikey: SUPABASE_SERVICE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
            'Content-Type': 'application/json',
        },
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`${path} -> ${res.status} ${text}`);
    }
    const text = await res.text();
    if (!text || !text.trim()) return [];
    try { return JSON.parse(text); } catch { return []; }
}

async function execSqlJson(sql) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql_json`, {
        method: 'POST',
        headers: {
            apikey: SUPABASE_SERVICE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sql }),
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`exec_sql_json -> ${res.status} ${text.slice(0, 240)}`);
    }
    const json = await res.json();
    if (Array.isArray(json)) return json;
    if (json && json.error) throw new Error(json.error);
    return [];
}

function localDateKey(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const parts = new Intl.DateTimeFormat('en-AU', {
        timeZone: TIME_ZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(d);
    const byType = Object.fromEntries(parts.map(p => [p.type, p.value]));
    return `${byType.year}-${byType.month}-${byType.day}`;
}

function dateKeyToUtcMs(key) {
    if (!key) return null;
    const [y, m, d] = String(key).split('-').map(Number);
    if (!y || !m || !d) return null;
    return Date.UTC(y, m - 1, d);
}

function daysBetween(startKey, endKey) {
    const a = dateKeyToUtcMs(startKey);
    const b = dateKeyToUtcMs(endKey);
    if (a == null || b == null) return null;
    return Math.round((b - a) / MS_PER_DAY);
}

function addDays(key, delta) {
    const t = dateKeyToUtcMs(key);
    if (t == null) return '';
    return new Date(t + delta * MS_PER_DAY).toISOString().slice(0, 10);
}

function cleanText(value, fallback = '') {
    const text = String(value || '')
        .replace(/\{\{[^}]+\}\}/g, '')
        .replace(/\[PHOTO:https?:\/\/[^\s\]]+\]/gi, 'photo')
        .replace(/\[AUDIO:https?:\/\/[^\s\]]+\]/gi, 'voice note')
        .replace(/\[(?:VIDEO|video):\s*https?:\/\/[^\]]+\]/gi, 'video')
        .trim();
    return text || fallback;
}

function buildStatsForTarget(target, events, todayKey, windowDays) {
    const sorted = events
        .filter(e => e && e.created_at)
        .slice()
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const dateSet = new Set(sorted.map(e => e.local_date || localDateKey(e.created_at)).filter(Boolean));
    const dates = Array.from(dateSet).sort().reverse();
    const latestEvent = sorted[0] || null;
    const latestOutboundAt = latestEvent?.created_at || target.last_outbound_at || '';
    const latestDate = latestEvent?.local_date || localDateKey(latestOutboundAt);
    const daysSinceOutbound = latestDate ? Math.max(0, daysBetween(latestDate, todayKey) ?? 0) : null;

    let dailyStreakRaw = 0;
    if (dates.length) {
        let cursor = dates[0];
        while (dateSet.has(cursor)) {
            dailyStreakRaw += 1;
            cursor = addDays(cursor, -1);
        }
    }

    let cadenceTouches = 0;
    let cadenceSpanDays = 0;
    if (dates.length) {
        cadenceTouches = 1;
        let oldestInRun = dates[0];
        for (let i = 1; i < dates.length; i += 1) {
            const gap = daysBetween(dates[i], dates[i - 1]);
            if (gap == null || gap > 3) break;
            cadenceTouches += 1;
            oldestInRun = dates[i];
        }
        cadenceSpanDays = Math.max(1, (daysBetween(oldestInRun, dates[0]) || 0) + 1);
    }

    const sinceWindow = Date.now() - windowDays * MS_PER_DAY;
    const since7 = Date.now() - 7 * MS_PER_DAY;
    const messageCountWindow = sorted.filter(e => new Date(e.created_at).getTime() >= sinceWindow).length;
    const messageCount7d = sorted.filter(e => new Date(e.created_at).getTime() >= since7).length;

    const hasDailyRun = dailyStreakRaw >= MIN_DAILY_STREAK_DAYS;
    const isActiveDaily = hasDailyRun && daysSinceOutbound === 0;
    const isDroppedDaily = hasDailyRun
        && daysSinceOutbound != null
        && daysSinceOutbound >= 1
        && daysSinceOutbound <= DROPPED_DAILY_WARNING_DAYS;
    const streakCategory = isActiveDaily ? 'active_daily' : (isDroppedDaily ? 'dropoff_warning' : 'none');
    const dropoffWarningDaysLeft = isDroppedDaily
        ? Math.max(0, DROPPED_DAILY_WARNING_DAYS - daysSinceOutbound)
        : null;

    let dailyStatus = 'off';
    if (isActiveDaily) dailyStatus = 'active';
    else if (isDroppedDaily) dailyStatus = 'dropped';

    let cadenceStatus = 'never';
    if (daysSinceOutbound === null) cadenceStatus = 'never';
    else if (daysSinceOutbound >= 3) cadenceStatus = 'urgent';
    else if (daysSinceOutbound === 2) cadenceStatus = 'at_risk';
    else cadenceStatus = 'active';

    let priority = 'low';
    let warning = 'Daily streak only. Everyone else stays out of this view.';
    if (isActiveDaily) {
        warning = `${dailyStreakRaw}d daily conversation. Keep them in the real-interaction list.`;
    } else if (isDroppedDaily) {
        priority = daysSinceOutbound >= DROPPED_DAILY_WARNING_DAYS ? 'high' : 'medium';
        const removeText = dropoffWarningDaysLeft > 0
            ? `${dropoffWarningDaysLeft}d left in warnings.`
            : 'Last day in warnings.';
        warning = `${daysSinceOutbound}d since your last DM after a ${dailyStreakRaw}d daily streak. ${removeText}`;
    }

    return {
        ...target,
        messageCountWindow,
        messageCount7d,
        latestOutboundAt,
        lastOutboundDate: latestDate,
        lastInboundAt: target.last_inbound_at || '',
        daysSinceOutbound,
        dailyStreakDays: dailyStreakRaw,
        dailyStreakRaw,
        dailyStatus,
        streakCategory,
        dropoffWarningDaysLeft,
        cadenceTouches,
        cadenceSpanDays,
        cadenceStatus,
        nextDailyDueDate: latestDate ? addDays(latestDate, 1) : '',
        nextThreeDayDueDate: latestDate ? addDays(latestDate, 3) : '',
        priority,
        warning,
    };
}

export default async function(req) {
    if (req.method !== 'POST') {
        return json(405, { error: 'Method not allowed' });
    }
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
        return json(500, { error: 'Server misconfigured' });
    }

    let body = {};
    try {
        const text = await req.text();
        body = text ? JSON.parse(text) : {};
    }
    catch { return json(400, { error: 'Invalid JSON' }); }

    const coachId = String(body.coachId || '').trim();
    const windowDays = clampNumber(body.windowDays, DEFAULT_WINDOW_DAYS, 7, 60);
    if (!UUID_RE.test(coachId)) {
        return json(400, { error: 'Missing or invalid coachId' });
    }

    const adminAuth = await requireShannonAdmin(req);
    if (adminAuth.response) return adminAuth.response;
    if (coachId !== adminAuth.user?.id) return json(403, { error: 'Forbidden' });

    try {
        const clientsSql = `
            WITH client_targets AS (
                SELECT
                    'client'::text AS target_type,
                    cc.client_id::text AS target_id,
                    NULL::text AS thread_id,
                    'in_app'::text AS channel,
                    COALESCE(NULLIF(BTRIM(u.name), ''), SPLIT_PART(u.email, '@', 1), 'Client') AS display_name,
                    u.email,
                    NULL::text AS handle,
                    NULL::text AS lead_stage,
                    NULL::text AS linked_user_id,
                    cc.assigned_at,
                    u.last_login,
                    (
                        SELECT MAX(n.created_at)
                        FROM public.nudges n
                        WHERE n.sender_id = cc.coach_id
                            AND n.receiver_id = cc.client_id
                    ) AS last_outbound_at,
                    (
                        SELECT MAX(n.created_at)
                        FROM public.nudges n
                        WHERE n.sender_id = cc.client_id
                            AND n.receiver_id = cc.coach_id
                    ) AS last_inbound_at
                FROM public.coach_clients cc
                LEFT JOIN public.users u ON u.id = cc.client_id
                WHERE cc.coach_id = '${coachId}'::uuid
                    AND cc.status = 'active'
                    AND cc.client_id <> cc.coach_id
                    AND COALESCE(u.is_test_account, FALSE) = FALSE
            )
            SELECT *
            FROM client_targets
            ORDER BY COALESCE(last_outbound_at, last_inbound_at, assigned_at) DESC NULLS LAST
            LIMIT ${LIMIT}
        `;

        const leadsSql = `
            WITH lead_targets AS (
                SELECT
                    'lead'::text AS target_type,
                    t.id::text AS target_id,
                    t.id::text AS thread_id,
                    COALESCE(t.channel, 'instagram')::text AS channel,
                    COALESCE(NULLIF(BTRIM(t.profile_name), ''), NULLIF(BTRIM(t.ig_username), ''), 'Lead') AS display_name,
                    NULL::text AS email,
                    t.ig_username AS handle,
                    t.lead_stage AS lead_stage,
                    t.linked_user_id::text AS linked_user_id,
                    t.created_at AS assigned_at,
                    NULL::timestamptz AS last_login,
                    t.last_outbound_at,
                    t.last_inbound_at
                FROM public.ig_threads t
                WHERE t.coach_id = '${coachId}'::uuid
                    AND COALESCE(t.lead_stage, 'new') <> 'churned'
                    AND COALESCE(t.last_inbound_at, t.last_outbound_at, t.created_at) >= (NOW() - (INTERVAL '1 day' * ${TARGET_LOOKBACK_DAYS}))
            )
            SELECT *
            FROM lead_targets
            ORDER BY COALESCE(last_outbound_at, last_inbound_at, assigned_at) DESC NULLS LAST
            LIMIT ${LIMIT}
        `;

        const eventsSql = `
            SELECT *
            FROM (
                SELECT
                    'client'::text AS target_type,
                    n.receiver_id::text AS target_id,
                    NULL::text AS thread_id,
                    'in_app'::text AS channel,
                    n.created_at,
                    TO_CHAR((n.created_at AT TIME ZONE '${TIME_ZONE}')::date, 'YYYY-MM-DD') AS local_date
                FROM public.nudges n
                INNER JOIN public.coach_clients cc
                    ON cc.coach_id = n.sender_id
                    AND cc.client_id = n.receiver_id
                    AND cc.status = 'active'
                LEFT JOIN public.users u ON u.id = cc.client_id
                WHERE n.sender_id = '${coachId}'::uuid
                    AND n.created_at >= (NOW() - (INTERVAL '1 day' * ${STREAK_LOOKBACK_DAYS}))
                    AND n.receiver_id <> n.sender_id
                    AND COALESCE(u.is_test_account, FALSE) = FALSE
                UNION ALL
                SELECT
                    'lead'::text AS target_type,
                    m.thread_id::text AS target_id,
                    m.thread_id::text AS thread_id,
                    COALESCE(t.channel, 'instagram')::text AS channel,
                    m.created_at,
                    TO_CHAR((m.created_at AT TIME ZONE '${TIME_ZONE}')::date, 'YYYY-MM-DD') AS local_date
                FROM public.ig_messages m
                INNER JOIN public.ig_threads t ON t.id = m.thread_id
                WHERE t.coach_id = '${coachId}'::uuid
                    AND m.direction = 'out'
                    AND m.created_at >= (NOW() - (INTERVAL '1 day' * ${STREAK_LOOKBACK_DAYS}))
                    AND COALESCE(t.lead_stage, 'new') <> 'churned'
            ) outbound_events
            ORDER BY created_at DESC
            LIMIT 5000
        `;

        const [clientTargets, leadTargets, outboundEvents] = await Promise.all([
            execSqlJson(clientsSql),
            execSqlJson(leadsSql),
            execSqlJson(eventsSql),
        ]);

        const eventsByTarget = new Map();
        (outboundEvents || []).forEach(eventRow => {
            const key = `${eventRow.target_type}:${eventRow.target_id}`;
            if (!eventsByTarget.has(key)) eventsByTarget.set(key, []);
            eventsByTarget.get(key).push(eventRow);
        });

        const todayKey = localDateKey(new Date().toISOString());
        const targets = [...(clientTargets || []), ...(leadTargets || [])]
            .map(t => ({
                targetType: t.target_type,
                targetId: t.target_id,
                threadId: t.thread_id,
                channel: t.channel || 'in_app',
                displayName: cleanText(t.display_name, t.target_type === 'lead' ? 'Lead' : 'Client'),
                email: t.email || '',
                handle: cleanText(t.handle),
                leadStage: t.lead_stage || '',
                linkedUserId: t.linked_user_id || '',
                assignedAt: t.assigned_at || '',
                lastLogin: t.last_login || '',
                last_outbound_at: t.last_outbound_at || '',
                last_inbound_at: t.last_inbound_at || '',
            }));

        const rows = targets
            .map(target => buildStatsForTarget(
                target,
                eventsByTarget.get(`${target.targetType}:${target.targetId}`) || [],
                todayKey,
                windowDays
            ))
            .filter(row => row.streakCategory === 'active_daily' || row.streakCategory === 'dropoff_warning');

        const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
        rows.sort((a, b) => {
            if (a.streakCategory !== b.streakCategory) return a.streakCategory === 'active_daily' ? -1 : 1;
            if (a.streakCategory === 'dropoff_warning' && a.daysSinceOutbound !== b.daysSinceOutbound) {
                return (a.daysSinceOutbound ?? 99) - (b.daysSinceOutbound ?? 99);
            }
            const risk = (priorityOrder[a.priority] ?? 9) - (priorityOrder[b.priority] ?? 9);
            if (risk !== 0) return risk;
            if (b.dailyStreakDays !== a.dailyStreakDays) return (b.dailyStreakDays || 0) - (a.dailyStreakDays || 0);
            if (b.messageCountWindow !== a.messageCountWindow) return (b.messageCountWindow || 0) - (a.messageCountWindow || 0);
            return new Date(b.latestOutboundAt || b.lastInboundAt || 0) - new Date(a.latestOutboundAt || a.lastInboundAt || 0);
        });

        const activeDailyRows = rows.filter(row => row.streakCategory === 'active_daily');
        const dropoffWarningRows = rows.filter(row => row.streakCategory === 'dropoff_warning');

        const summary = rows.reduce((acc, row) => {
            acc.total += 1;
            acc.outboundWindow += row.messageCountWindow;
            if (row.priority === 'urgent') acc.urgent += 1;
            if (row.priority === 'high' || row.priority === 'medium') acc.atRisk += 1;
            if (row.streakCategory === 'active_daily') acc.activeDaily += 1;
            if (row.streakCategory === 'dropoff_warning') acc.droppedDaily += 1;
            if (!acc.topTalked || row.messageCountWindow > acc.topTalked.messageCountWindow) {
                acc.topTalked = {
                    targetType: row.targetType,
                    targetId: row.targetId,
                    channel: row.channel,
                    displayName: row.displayName,
                    messageCountWindow: row.messageCountWindow,
                };
            }
            return acc;
        }, {
            total: 0,
            urgent: 0,
            atRisk: 0,
            activeDaily: 0,
            droppedDaily: 0,
            outboundWindow: 0,
            topTalked: null,
        });
        summary.streakTotal = rows.length;
        summary.watchCount = summary.droppedDaily;

        return json(200, {
            ok: true,
            todayKey,
            timeZone: TIME_ZONE,
            windowDays,
            rows,
            groups: {
                activeDaily: activeDailyRows,
                dropoffWarning: dropoffWarningRows,
            },
            summary,
        });
    } catch (e) {
        console.error('[message-streaks] feed failed:', e);
        return json(500, { error: e.message || 'Failed to build streak feed' });
    }
}

export const config = {
    method: ['POST'],
};
