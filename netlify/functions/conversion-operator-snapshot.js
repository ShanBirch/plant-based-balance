/**
 * conversion-operator-snapshot
 *
 * Read-only operator board for the supervised Balance business funnel:
 * IG lead -> onboarding link -> active 30-day challenge -> day 7/14/30
 * review -> paid coaching or app/group fallback.
 */

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const BALANCE_ADMIN_EMAIL = 'shannonbirch@cocospersonaltraining.com';

const LANE_ORDER = [
    'ready_for_link',
    'lead_pitch_ready',
    'active_challenge',
    'day_7',
    'day_14',
    'day_30',
    'pitch_ready',
    'fallback_app_group',
    'paid',
];

function json(statusCode, body) {
    return {
        statusCode,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    };
}

function getHeader(headers, name) {
    const lower = name.toLowerCase();
    const key = Object.keys(headers || {}).find(k => k.toLowerCase() === lower);
    return key ? headers[key] : '';
}

function isUuid(value) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
}

function sqlLiteral(value) {
    return String(value || '').replace(/'/g, "''");
}

async function requireShannonAdmin(event) {
    const authHeader = getHeader(event.headers, 'authorization');
    const token = String(authHeader || '').match(/^Bearer\s+(.+)$/i)?.[1];
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
        throw new Error(`exec_sql_json -> ${res.status} ${text.slice(0, 400)}`);
    }
    const payload = await res.json();
    if (Array.isArray(payload)) return payload;
    if (payload && payload.error) throw new Error(payload.error);
    return [];
}

function laneMeta(key) {
    const labels = {
        ready_for_link: ['Ready for link', 'Accepted or clearly ready. Human handoff to get them into Balance.'],
        lead_pitch_ready: ['Pitch ready leads', 'Warm enough for a low-pressure challenge invite.'],
        active_challenge: ['Active challenge', 'In the 30-day challenge before the first checkpoint.'],
        day_7: ['Day 7', 'First week review window. Check friction and setup.'],
        day_14: ['Day 14', 'Midpoint review. Find blockers and reinforce wins.'],
        day_30: ['Day 30', 'One-month milestone. Big relationship moment.'],
        pitch_ready: ['Coaching pitch ready', 'Engaged enough for the $29/week coaching step.'],
        fallback_app_group: ['Fallback app/group', 'Better suited to the $20/month app/group offer for now.'],
        paid: ['Paid', 'Converted or already marked paying.'],
    };
    const [label, description] = labels[key] || [key, ''];
    return { key, label, description, order: LANE_ORDER.indexOf(key) };
}

function groupRows(rows) {
    const byLane = new Map(LANE_ORDER.map(key => [key, { ...laneMeta(key), count: 0, items: [] }]));
    rows.forEach(row => {
        const lane = row.lane || 'active_challenge';
        if (!byLane.has(lane)) byLane.set(lane, { ...laneMeta(lane), count: 0, items: [] });
        const bucket = byLane.get(lane);
        bucket.count++;
        bucket.items.push(row);
    });

    return Array.from(byLane.values())
        .map(lane => ({
            ...lane,
            items: lane.items
                .sort((a, b) => {
                    const urgency = Number(b.urgency_score || 0) - Number(a.urgency_score || 0);
                    if (urgency !== 0) return urgency;
                    return String(b.last_inbound_at || b.updated_at || '').localeCompare(String(a.last_inbound_at || a.updated_at || ''));
                })
                .slice(0, 40),
        }))
        .sort((a, b) => (a.order < 0 ? 999 : a.order) - (b.order < 0 ? 999 : b.order));
}

function buildSnapshotSql(coachId) {
    const coach = sqlLiteral(coachId);
    return `
with
params as (
    select
        '${coach}'::uuid as coach_id,
        (now() at time zone 'Australia/Brisbane')::date as brisbane_today
),
active_30_challenges as (
    select c.*
    from public.challenges c, params p
    where c.status = 'active'
      and coalesce(c.duration_days, 30) between 21 and 45
      and (
          coalesce(c.duration_days, 30) = 30
          or lower(coalesce(c.name, '')) like '%30%'
          or lower(coalesce(c.cohort_type, '')) like '%30%'
      )
      and (
          c.end_date is null
          or c.end_date::date >= (p.brisbane_today - 14)
      )
),
challenge_members as (
    select
        cp.user_id,
        cp.challenge_id,
        cp.status as participant_status,
        cp.accepted_at,
        cp.current_points,
        cp.challenge_points,
        cp.milestone_progress,
        c.name as challenge_name,
        c.cohort_type,
        c.start_date,
        c.end_date,
        c.duration_days,
        greatest(1, ((select brisbane_today from params) - c.start_date::date + 1))::int as challenge_day
    from public.challenge_participants cp
    join active_30_challenges c on c.id = cp.challenge_id
    where cp.status = 'accepted'
),
ig_with_scores as (
    select
        t.*,
        case
            when (t.qualifier->>'warmth_score') ~ '^[0-9]+$' then (t.qualifier->>'warmth_score')::int
            else null
        end as warmth_score
    from public.ig_threads t
    where t.coach_id = (select coach_id from params)
),
operator_state as (
    select *
    from (
        select
            e.*,
            row_number() over (
                partition by e.entity_kind, coalesce(e.client_id::text, e.thread_id::text)
                order by e.created_at desc
            ) as rn
        from public.conversion_operator_events e
        where e.coach_id = (select coach_id from params)
    ) ranked
    where rn = 1
),
latest_ig as (
    select distinct on (linked_user_id)
        linked_user_id,
        id as thread_id,
        ig_username,
        profile_name,
        lead_stage,
        qualifier,
        warmth_score,
        last_inbound_at,
        last_outbound_at
    from ig_with_scores
    where linked_user_id is not null
    order by linked_user_id, last_inbound_at desc nulls last, last_outbound_at desc nulls last
),
pending_client_alert as (
    select distinct on (client_id)
        client_id,
        id as pending_alert_id,
        alert_type as pending_alert_type,
        created_at as pending_alert_created_at,
        left(coalesce(suggested_message, scheduled_reply_text, data->>'draft_text', ''), 220) as pending_preview
    from public.coach_alerts
    where status = 'pending'
      and client_id is not null
    order by client_id, created_at desc
),
activity as (
    select
        cm.user_id,
        (select count(distinct created_at::date) from public.workouts w where w.user_id = cm.user_id and w.created_at >= now() - interval '30 days') as workout_days_30,
        (select count(distinct created_at::date) from public.meal_logs m where m.user_id = cm.user_id and m.created_at >= now() - interval '30 days') as meal_days_30,
        (select max(created_at) from public.workouts w where w.user_id = cm.user_id) as last_workout_at,
        (select max(created_at) from public.meal_logs m where m.user_id = cm.user_id) as last_meal_at
    from challenge_members cm
),
challenge_cards as (
    select
        'client'::text as entity_kind,
        case
            when os.action = 'mark_paid' then 'paid'
            when os.action in ('mark_pitch_ready', 'pitch_coaching') then 'pitch_ready'
            when os.action = 'move_fallback' then 'fallback_app_group'
            when lower(coalesce(u.subscription_status, '')) in ('active', 'paid', 'paying') or li.lead_stage = 'paying' then 'paid'
            when cm.challenge_day >= 30 and ((coalesce(a.workout_days_30, 0) * 2) + coalesce(a.meal_days_30, 0)) >= 8 then 'pitch_ready'
            when cm.challenge_day >= 30 then 'fallback_app_group'
            when cm.challenge_day >= 21 and ((coalesce(a.workout_days_30, 0) * 2) + coalesce(a.meal_days_30, 0)) >= 12 then 'pitch_ready'
            when cm.challenge_day >= 21 then 'day_30'
            when cm.challenge_day >= 14 then 'day_14'
            when cm.challenge_day >= 7 then 'day_7'
            else 'active_challenge'
        end as lane,
        coalesce(nullif(u.name, ''), split_part(u.email, '@', 1), 'Client') as display_name,
        u.email,
        li.ig_username as handle,
        u.id::text as client_id,
        li.thread_id::text as thread_id,
        cm.challenge_id::text as challenge_id,
        cm.challenge_name,
        cm.cohort_type,
        cm.challenge_day,
        cm.duration_days,
        cm.end_date,
        cm.current_points,
        cm.challenge_points,
        lower(coalesce(u.subscription_status, '')) as subscription_status,
        li.lead_stage,
        li.qualifier->>'stage' as qualifier_stage,
        li.qualifier->>'stage_label' as qualifier_stage_label,
        li.warmth_score,
        li.last_inbound_at,
        li.last_outbound_at,
        pca.pending_alert_id::text,
        pca.pending_alert_type,
        pca.pending_alert_created_at,
        pca.pending_preview,
        os.action as operator_action,
        os.created_at as operator_action_at,
        os.snoozed_until as operator_snoozed_until,
        os.note as operator_note,
        os.metadata as operator_metadata,
        coalesce(a.workout_days_30, 0) as workout_days_30,
        coalesce(a.meal_days_30, 0) as meal_days_30,
        greatest(a.last_workout_at, a.last_meal_at, li.last_inbound_at, li.last_outbound_at, cm.accepted_at) as updated_at,
        ((coalesce(a.workout_days_30, 0) * 2) + coalesce(a.meal_days_30, 0)) as engagement_score,
        case
            when os.action = 'mark_paid' then 'Converted. Keep retention and proof opportunities visible.'
            when os.action = 'pitch_coaching' then 'Coaching was pitched. Wait for reply, then follow up if needed.'
            when os.action = 'mark_pitch_ready' then 'Open the DM and pitch coaching from their strongest current win.'
            when os.action = 'move_fallback' then 'Use the lower-pressure app/group path and keep the relationship warm.'
            when lower(coalesce(u.subscription_status, '')) in ('active', 'paid', 'paying') or li.lead_stage = 'paying' then 'Keep relationship warm and watch retention.'
            when cm.challenge_day >= 30 and ((coalesce(a.workout_days_30, 0) * 2) + coalesce(a.meal_days_30, 0)) >= 8 then 'Review month-one win and pitch $29/week coaching.'
            when cm.challenge_day >= 30 then 'Use day-30 milestone, then offer $20/month app/group if coaching is too much.'
            when cm.challenge_day >= 21 and ((coalesce(a.workout_days_30, 0) * 2) + coalesce(a.meal_days_30, 0)) >= 12 then 'Start soft coaching-path conversation before day 30.'
            when cm.challenge_day >= 14 then 'Midpoint check: identify blockers and keep the next week specific.'
            when cm.challenge_day >= 7 then 'Week-one check: setup, routine, food friction, and one next step.'
            else 'Keep them active and learning inside the challenge.'
        end as recommended_action,
        case
            when pca.pending_alert_type is not null then 90
            when cm.challenge_day >= 30 then 80
            when cm.challenge_day >= 21 then 70
            when cm.challenge_day >= 14 then 55
            when cm.challenge_day >= 7 then 45
            else 25
        end as urgency_score
    from challenge_members cm
    join public.users u on u.id = cm.user_id
    left join latest_ig li on li.linked_user_id = cm.user_id
    left join pending_client_alert pca on pca.client_id = cm.user_id
    left join activity a on a.user_id = cm.user_id
    left join operator_state os on os.entity_kind = 'client' and os.client_id = cm.user_id
    where coalesce(u.is_test_account, false) = false
      and cm.user_id <> (select coach_id from params)
      and not (os.snoozed_until is not null and os.snoozed_until > now())
),
ready_leads as (
    select
        'lead'::text as entity_kind,
        case
            when os.action = 'mark_paid' then 'paid'
            when os.action = 'move_fallback' then 'fallback_app_group'
            when t.lead_stage = 'invited' or t.qualifier->>'stage' = 'won' then 'ready_for_link'
            else 'lead_pitch_ready'
        end as lane,
        coalesce(nullif(t.profile_name, ''), nullif(t.ig_username, ''), 'IG lead') as display_name,
        null::text as email,
        t.ig_username as handle,
        null::text as client_id,
        t.id::text as thread_id,
        null::text as challenge_id,
        null::text as challenge_name,
        null::text as cohort_type,
        null::int as challenge_day,
        null::int as duration_days,
        null::date as end_date,
        null::numeric as current_points,
        null::numeric as challenge_points,
        null::text as subscription_status,
        t.lead_stage,
        t.qualifier->>'stage' as qualifier_stage,
        t.qualifier->>'stage_label' as qualifier_stage_label,
        t.warmth_score,
        t.last_inbound_at,
        t.last_outbound_at,
        a.id::text as pending_alert_id,
        a.alert_type as pending_alert_type,
        a.created_at as pending_alert_created_at,
        left(coalesce(a.suggested_message, a.scheduled_reply_text, a.data->>'draft_text', ''), 220) as pending_preview,
        os.action as operator_action,
        os.created_at as operator_action_at,
        os.snoozed_until as operator_snoozed_until,
        os.note as operator_note,
        os.metadata as operator_metadata,
        null::bigint as workout_days_30,
        null::bigint as meal_days_30,
        greatest(t.last_inbound_at, t.last_outbound_at, a.created_at) as updated_at,
        coalesce(t.warmth_score, 0) as engagement_score,
        case
            when os.action = 'mark_paid' then 'Converted. Keep retention and proof opportunities visible.'
            when os.action = 'move_fallback' then 'Use the lower-pressure app/group path and keep the relationship warm.'
            when os.action = 'mark_link_sent' then 'Link sent. Watch for signup, then move them into the challenge check-in rhythm.'
            when t.lead_stage = 'invited' or t.qualifier->>'stage' = 'won' then 'Send or confirm the onboarding link, then watch for signup.'
            else 'Earn the next response and ask the low-pressure challenge invite.'
        end as recommended_action,
        case
            when t.lead_stage = 'invited' or t.qualifier->>'stage' = 'won' then 95
            else 65
        end as urgency_score
    from ig_with_scores t
    left join lateral (
        select ca.*
        from public.coach_alerts ca
        where ca.status = 'pending'
          and ca.data->>'ig_thread_id' = t.id::text
        order by ca.created_at desc
        limit 1
    ) a on true
    left join operator_state os on os.entity_kind = 'lead' and os.thread_id = t.id
    where t.coach_id = (select coach_id from params)
      and t.linked_user_id is null
      and coalesce(t.lead_stage, 'new') <> 'churned'
      and not (os.snoozed_until is not null and os.snoozed_until > now())
      and (
          t.lead_stage = 'invited'
          or t.qualifier->>'stage' in ('won', 'commitment', 'pitched')
          or coalesce(t.warmth_score, 0) >= 80
      )
),
paid_threads as (
    select
        'lead'::text as entity_kind,
        'paid'::text as lane,
        coalesce(nullif(t.profile_name, ''), nullif(t.ig_username, ''), 'Paid lead') as display_name,
        null::text as email,
        t.ig_username as handle,
        t.linked_user_id::text as client_id,
        t.id::text as thread_id,
        null::text as challenge_id,
        null::text as challenge_name,
        null::text as cohort_type,
        null::int as challenge_day,
        null::int as duration_days,
        null::date as end_date,
        null::numeric as current_points,
        null::numeric as challenge_points,
        'paying'::text as subscription_status,
        t.lead_stage,
        t.qualifier->>'stage' as qualifier_stage,
        t.qualifier->>'stage_label' as qualifier_stage_label,
        t.warmth_score,
        t.last_inbound_at,
        t.last_outbound_at,
        null::text as pending_alert_id,
        null::text as pending_alert_type,
        null::timestamptz as pending_alert_created_at,
        null::text as pending_preview,
        os.action as operator_action,
        os.created_at as operator_action_at,
        os.snoozed_until as operator_snoozed_until,
        os.note as operator_note,
        os.metadata as operator_metadata,
        null::bigint as workout_days_30,
        null::bigint as meal_days_30,
        greatest(t.last_inbound_at, t.last_outbound_at) as updated_at,
        coalesce(t.warmth_score, 0) as engagement_score,
        'Converted. Keep retention and proof opportunities visible.'::text as recommended_action,
        30 as urgency_score
    from ig_with_scores t
    left join operator_state os on (
        (os.entity_kind = 'client' and os.client_id = t.linked_user_id)
        or (os.entity_kind = 'lead' and os.thread_id = t.id)
    )
    where t.coach_id = (select coach_id from params)
      and t.lead_stage = 'paying'
      and not (os.snoozed_until is not null and os.snoozed_until > now())
      and not exists (
          select 1
          from challenge_members cm
          where cm.user_id = t.linked_user_id
      )
)
select *
from (
    select * from challenge_cards
    union all
    select * from ready_leads
    union all
    select * from paid_threads
) rows
order by urgency_score desc, updated_at desc nulls last
limit 240`;
}

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return json(500, { error: 'Server misconfigured' });

    const admin = await requireShannonAdmin(event);
    if (admin.response) return admin.response;

    let body;
    try { body = JSON.parse(event.body || '{}'); }
    catch { return json(400, { error: 'Invalid JSON' }); }

    const coachId = String(body.coachId || admin.user?.id || '').trim();
    if (!isUuid(coachId)) return json(400, { error: 'Missing coachId' });
    if (coachId !== admin.user?.id) return json(403, { error: 'Forbidden' });

    try {
        const rows = await execSqlJson(buildSnapshotSql(coachId));
        const lanes = groupRows(rows);
        const summary = lanes.reduce((acc, lane) => {
            acc[lane.key] = lane.count;
            acc.total += lane.count;
            return acc;
        }, { total: 0 });

        return json(200, {
            generatedAt: new Date().toISOString(),
            lanes,
            summary,
            laneOrder: LANE_ORDER,
        });
    } catch (error) {
        console.error('[conversion-operator-snapshot] failed:', error);
        return json(500, { error: error.message || 'Snapshot failed' });
    }
};
