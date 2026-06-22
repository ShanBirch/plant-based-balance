-- Backfill and extend the Balance growth outcome spine with existing app,
-- sales, and retention signals. Every insert is idempotent by event_key.

INSERT INTO public.growth_outcome_event_weights (event_type, family, default_score, description)
VALUES
    ('ig_dm_response_sent', 'engagement', 1, 'A coach/operator sent an outbound IG or Facebook DM response.'),
    ('client_message_response_sent', 'engagement', 1, 'A coach sent an in-app message response to a client.'),
    ('client_checkin_completed', 'retention', 3, 'A client completed a daily check-in.'),
    ('client_workout_logged', 'retention', 3, 'A client logged a workout session.'),
    ('client_goal_completed', 'retention', 10, 'A client completed a weekly goal.'),
    ('client_retained_30d', 'retention', 15, 'A client remained active beyond 30 days.')
ON CONFLICT (event_type) DO UPDATE
SET family = EXCLUDED.family,
    default_score = EXCLUDED.default_score,
    description = EXCLUDED.description,
    active = EXCLUDED.active,
    updated_at = NOW();

INSERT INTO public.growth_outcome_events (
    event_key,
    event_type,
    event_family,
    event_status,
    source_system,
    bot_account,
    lead_key,
    from_ig_user_id,
    from_username,
    email,
    email_key,
    campaign_id,
    ig_growth_lead_id,
    ig_growth_submission_id,
    source_key,
    campaign_slug,
    landing_url,
    score,
    score_breakdown,
    attribution,
    raw_payload,
    occurred_at
)
SELECT
    'ig_growth_submission:' || s.id || ':free_info_unlocked',
    'free_info_unlocked',
    'acquisition',
    'backfilled',
    'growth_outcome_source_backfill',
    s.bot_account,
    l.lead_key,
    s.from_ig_user_id,
    s.from_username,
    lower(NULLIF(trim(s.email), '')),
    lower(NULLIF(trim(s.email), '')),
    s.campaign_id,
    s.lead_id,
    s.id,
    s.submission_key,
    s.submission_key,
    s.source_page,
    10,
    jsonb_build_object('default_score', 10, 'score', 10, 'reason', 'existing growth lead submission'),
    jsonb_build_object('source_page', s.source_page, 'content_interests', s.content_interests),
    jsonb_build_object('submission_key', s.submission_key, 'raw_payload', s.raw_payload),
    COALESCE(s.created_at, NOW())
FROM public.ig_growth_lead_submissions s
LEFT JOIN public.ig_growth_leads l ON l.id = s.lead_id
ON CONFLICT (event_key) DO UPDATE
SET event_status = EXCLUDED.event_status,
    score = EXCLUDED.score,
    score_breakdown = EXCLUDED.score_breakdown,
    attribution = EXCLUDED.attribution,
    raw_payload = EXCLUDED.raw_payload,
    updated_at = NOW();

INSERT INTO public.growth_outcome_events (
    event_key,
    event_type,
    event_family,
    event_status,
    source_system,
    bot_account,
    lead_key,
    from_ig_user_id,
    from_username,
    email,
    email_key,
    campaign_id,
    ig_growth_lead_id,
    ig_growth_submission_id,
    source_key,
    campaign_slug,
    landing_url,
    score,
    score_breakdown,
    attribution,
    raw_payload,
    occurred_at
)
SELECT
    'ig_growth_submission:' || s.id || ':email_captured',
    'email_captured',
    'acquisition',
    'backfilled',
    'growth_outcome_source_backfill',
    s.bot_account,
    l.lead_key,
    s.from_ig_user_id,
    s.from_username,
    lower(NULLIF(trim(s.email), '')),
    lower(NULLIF(trim(s.email), '')),
    s.campaign_id,
    s.lead_id,
    s.id,
    s.submission_key,
    s.submission_key,
    s.source_page,
    12,
    jsonb_build_object('default_score', 12, 'score', 12, 'reason', 'existing growth lead email submission'),
    jsonb_build_object('email_consent', s.email_consent, 'email_consent_at', s.email_consent_at),
    jsonb_build_object('submission_key', s.submission_key, 'raw_payload', s.raw_payload),
    COALESCE(s.email_consent_at, s.created_at, NOW())
FROM public.ig_growth_lead_submissions s
LEFT JOIN public.ig_growth_leads l ON l.id = s.lead_id
WHERE NULLIF(trim(s.email), '') IS NOT NULL
ON CONFLICT (event_key) DO UPDATE
SET event_status = EXCLUDED.event_status,
    score = EXCLUDED.score,
    score_breakdown = EXCLUDED.score_breakdown,
    attribution = EXCLUDED.attribution,
    raw_payload = EXCLUDED.raw_payload,
    updated_at = NOW();

INSERT INTO public.growth_outcome_events (
    event_key,
    event_type,
    event_family,
    event_status,
    source_system,
    bot_account,
    lead_key,
    from_ig_user_id,
    from_username,
    email,
    email_key,
    campaign_id,
    ig_growth_lead_id,
    source_key,
    ig_media_id,
    score,
    score_breakdown,
    attribution,
    raw_payload,
    occurred_at
)
SELECT
    'ig_growth_lead:' || l.id || ':private_reply_sent',
    'private_reply_sent',
    'acquisition',
    'backfilled',
    'growth_outcome_source_backfill',
    COALESCE(l.metadata->>'bot_account', 'shan_n_sunny'),
    l.lead_key,
    l.from_ig_user_id,
    l.from_username,
    lower(NULLIF(trim(l.email), '')),
    lower(NULLIF(trim(l.email), '')),
    l.campaign_id,
    l.id,
    l.lead_key,
    l.source_media_id,
    8,
    jsonb_build_object('default_score', 8, 'score', 8, 'reason', 'existing growth lead private reply timestamp'),
    jsonb_build_object('first_keyword', l.first_keyword, 'status', l.status),
    jsonb_build_object('lead_key', l.lead_key, 'metadata', l.metadata, 'questionnaire', l.questionnaire),
    COALESCE(l.last_private_reply_at, l.created_at, NOW())
FROM public.ig_growth_leads l
WHERE l.last_private_reply_at IS NOT NULL
   OR l.status = 'private_reply_sent'
ON CONFLICT (event_key) DO UPDATE
SET event_status = EXCLUDED.event_status,
    score = EXCLUDED.score,
    score_breakdown = EXCLUDED.score_breakdown,
    attribution = EXCLUDED.attribution,
    raw_payload = EXCLUDED.raw_payload,
    updated_at = NOW();

INSERT INTO public.growth_outcome_events (
    event_key,
    event_type,
    event_family,
    event_status,
    source_system,
    bot_account,
    lead_key,
    from_ig_user_id,
    from_username,
    email,
    email_key,
    campaign_id,
    ig_growth_lead_id,
    source_key,
    ig_media_id,
    score,
    score_breakdown,
    attribution,
    raw_payload,
    occurred_at
)
SELECT
    'ig_growth_lead:' || l.id || ':dm_qualified',
    'dm_qualified',
    'sales',
    'backfilled',
    'growth_outcome_source_backfill',
    COALESCE(l.metadata->>'bot_account', 'shan_n_sunny'),
    l.lead_key,
    l.from_ig_user_id,
    l.from_username,
    lower(NULLIF(trim(l.email), '')),
    lower(NULLIF(trim(l.email), '')),
    l.campaign_id,
    l.id,
    l.lead_key,
    l.source_media_id,
    15,
    jsonb_build_object('default_score', 15, 'score', 15, 'reason', 'existing qualified/booked growth lead'),
    jsonb_build_object('first_keyword', l.first_keyword, 'status', l.status),
    jsonb_build_object('lead_key', l.lead_key, 'metadata', l.metadata, 'questionnaire', l.questionnaire),
    COALESCE(l.last_submission_at, l.last_inbound_at, l.created_at, NOW())
FROM public.ig_growth_leads l
WHERE l.status IN ('qualified', 'booked')
ON CONFLICT (event_key) DO UPDATE
SET event_status = EXCLUDED.event_status,
    score = EXCLUDED.score,
    score_breakdown = EXCLUDED.score_breakdown,
    attribution = EXCLUDED.attribution,
    raw_payload = EXCLUDED.raw_payload,
    updated_at = NOW();

INSERT INTO public.growth_outcome_events (
    event_key,
    event_type,
    event_family,
    event_status,
    source_system,
    ig_thread_id,
    client_id,
    conversion_operator_event_id,
    coach_alert_id,
    from_username,
    score,
    score_breakdown,
    attribution,
    raw_payload,
    occurred_at
)
SELECT
    'conversion_operator:' || e.id || ':' || mapped.event_type,
    mapped.event_type,
    mapped.family,
    'backfilled',
    'conversion_operator_backfill',
    e.thread_id,
    e.client_id,
    e.id,
    CASE
        WHEN NULLIF(e.metadata->>'pending_alert_id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
            THEN (e.metadata->>'pending_alert_id')::UUID
        ELSE NULL
    END,
    t.ig_username,
    mapped.score,
    jsonb_build_object('default_score', mapped.score, 'score', mapped.score, 'reason', e.action),
    jsonb_build_object('action', e.action, 'previous_lane', e.previous_lane, 'entity_kind', e.entity_kind),
    jsonb_build_object('note', e.note, 'metadata', e.metadata),
    COALESCE(e.created_at, NOW())
FROM public.conversion_operator_events e
LEFT JOIN public.ig_threads t ON t.id = e.thread_id
CROSS JOIN LATERAL (
    SELECT
        CASE e.action
            WHEN 'mark_link_sent' THEN 'challenge_invited'
            WHEN 'mark_pitch_ready' THEN 'dm_qualified'
            WHEN 'pitch_coaching' THEN 'coaching_pitched'
            WHEN 'mark_paid' THEN 'subscription_started'
            ELSE NULL
        END AS event_type,
        CASE e.action
            WHEN 'mark_paid' THEN 'revenue'
            ELSE 'sales'
        END AS family,
        CASE e.action
            WHEN 'mark_link_sent' THEN 12
            WHEN 'mark_pitch_ready' THEN 15
            WHEN 'pitch_coaching' THEN 20
            WHEN 'mark_paid' THEN 100
            ELSE 0
        END AS score
) mapped
WHERE mapped.event_type IS NOT NULL
ON CONFLICT (event_key) DO UPDATE
SET event_status = EXCLUDED.event_status,
    score = EXCLUDED.score,
    score_breakdown = EXCLUDED.score_breakdown,
    attribution = EXCLUDED.attribution,
    raw_payload = EXCLUDED.raw_payload,
    updated_at = NOW();

INSERT INTO public.growth_outcome_events (
    event_key,
    event_type,
    event_family,
    event_status,
    source_system,
    email,
    email_key,
    client_id,
    stripe_subscription_link_id,
    score,
    score_breakdown,
    attribution,
    raw_payload,
    occurred_at
)
SELECT
    CASE
        WHEN s.subscription_status IN ('active', 'trialing')
            THEN 'stripe_subscription:' || s.stripe_subscription_id || ':subscription_started'
        ELSE 'stripe_subscription:' || s.stripe_subscription_id || ':subscription_canceled:backfill'
    END,
    CASE
        WHEN s.subscription_status IN ('active', 'trialing') THEN 'subscription_started'
        ELSE 'subscription_canceled'
    END,
    'revenue',
    COALESCE(NULLIF(s.subscription_status, ''), 'unknown'),
    'stripe_subscription_backfill',
    s.email,
    COALESCE(s.email_key, lower(NULLIF(trim(s.email), ''))),
    s.user_id,
    s.id,
    CASE WHEN s.subscription_status IN ('active', 'trialing') THEN 100 ELSE -30 END,
    jsonb_build_object(
        'default_score',
        CASE WHEN s.subscription_status IN ('active', 'trialing') THEN 100 ELSE -30 END,
        'score',
        CASE WHEN s.subscription_status IN ('active', 'trialing') THEN 100 ELSE -30 END,
        'reason',
        s.subscription_status
    ),
    jsonb_build_object(
        'stripe_customer_id', s.stripe_customer_id,
        'stripe_subscription_id', s.stripe_subscription_id,
        'stripe_price_id', s.stripe_price_id,
        'subscription_plan', s.subscription_plan,
        'last_event_type', s.last_event_type
    ),
    jsonb_build_object('raw_summary', s.raw_summary, 'last_event_id', s.last_event_id),
    COALESCE(s.created_at, s.updated_at, NOW())
FROM public.stripe_subscription_links s
WHERE NULLIF(s.stripe_subscription_id, '') IS NOT NULL
ON CONFLICT (event_key) DO UPDATE
SET event_status = EXCLUDED.event_status,
    email = EXCLUDED.email,
    email_key = EXCLUDED.email_key,
    client_id = EXCLUDED.client_id,
    stripe_subscription_link_id = EXCLUDED.stripe_subscription_link_id,
    score = EXCLUDED.score,
    score_breakdown = EXCLUDED.score_breakdown,
    attribution = EXCLUDED.attribution,
    raw_payload = EXCLUDED.raw_payload,
    updated_at = NOW();

INSERT INTO public.growth_outcome_events (
    event_key,
    event_type,
    event_family,
    event_status,
    source_system,
    client_id,
    source_key,
    score,
    score_breakdown,
    attribution,
    raw_payload,
    occurred_at
)
SELECT
    'weekly_goals:' || wg.id || ':client_goal_completed',
    'client_goal_completed',
    'retention',
    COALESCE(NULLIF(wg.status, ''), 'completed'),
    'client_engagement_backfill',
    wg.user_id,
    'weekly_goals:' || wg.id,
    GREATEST(COALESCE(wg.completed_count, 0), 0) * 10,
    jsonb_build_object(
        'default_score', 10,
        'completed_count', COALESCE(wg.completed_count, 0),
        'score', GREATEST(COALESCE(wg.completed_count, 0), 0) * 10,
        'reason', 'weekly goals completed'
    ),
    jsonb_build_object(
        'week_start', wg.week_start,
        'week_end', wg.week_end,
        'total_count', wg.total_count,
        'completion_rate', wg.completion_rate
    ),
    jsonb_build_object('selected_goals', wg.selected_goals, 'progress_snapshot', wg.progress_snapshot),
    COALESCE(wg.points_awarded_at, wg.updated_at, wg.created_at, NOW())
FROM public.weekly_goals wg
WHERE COALESCE(wg.completed_count, 0) > 0
ON CONFLICT (event_key) DO UPDATE
SET event_status = EXCLUDED.event_status,
    score = EXCLUDED.score,
    score_breakdown = EXCLUDED.score_breakdown,
    attribution = EXCLUDED.attribution,
    raw_payload = EXCLUDED.raw_payload,
    updated_at = NOW();

INSERT INTO public.growth_outcome_events (
    event_key,
    event_type,
    event_family,
    event_status,
    source_system,
    client_id,
    source_key,
    score,
    score_breakdown,
    attribution,
    raw_payload,
    occurred_at
)
SELECT
    'daily_checkin:' || dc.id || ':client_checkin_completed',
    'client_checkin_completed',
    'retention',
    'completed',
    'client_engagement_backfill',
    dc.user_id,
    'daily_checkin:' || dc.id,
    3,
    jsonb_build_object('default_score', 3, 'score', 3, 'reason', 'daily check-in completed'),
    jsonb_build_object('checkin_date', dc.checkin_date, 'energy', dc.energy, 'sleep', dc.sleep),
    jsonb_build_object('water_intake', dc.water_intake, 'additional_data', dc.additional_data),
    COALESCE(dc.created_at, dc.checkin_date::TIMESTAMPTZ, NOW())
FROM public.daily_checkins dc
ON CONFLICT (event_key) DO UPDATE
SET event_status = EXCLUDED.event_status,
    score = EXCLUDED.score,
    score_breakdown = EXCLUDED.score_breakdown,
    attribution = EXCLUDED.attribution,
    raw_payload = EXCLUDED.raw_payload,
    updated_at = NOW();

INSERT INTO public.growth_outcome_events (
    event_key,
    event_type,
    event_family,
    event_status,
    source_system,
    client_id,
    source_key,
    score,
    score_breakdown,
    attribution,
    raw_payload,
    occurred_at
)
SELECT
    'workout_session:' || session_key || ':client_workout_logged',
    'client_workout_logged',
    'retention',
    'logged',
    'client_engagement_backfill',
    user_id,
    'workout_session:' || session_key,
    3,
    jsonb_build_object('default_score', 3, 'score', 3, 'reason', 'workout session logged'),
    jsonb_build_object('workout_date', workout_date, 'workout_type', workout_type, 'template_name', template_name, 'set_rows', set_rows),
    jsonb_build_object('sample_exercises', sample_exercises),
    occurred_at
FROM (
    SELECT
        md5(user_id::TEXT || '|' || workout_date::TEXT || '|' || COALESCE(NULLIF(template_name, ''), NULLIF(workout_type, ''), 'workout')) AS session_key,
        user_id,
        workout_date,
        MAX(COALESCE(created_at, updated_at, workout_date::TIMESTAMPTZ, NOW())) AS occurred_at,
        NULLIF(MAX(workout_type), '') AS workout_type,
        NULLIF(MAX(template_name), '') AS template_name,
        COUNT(*)::INT AS set_rows,
        ARRAY_AGG(DISTINCT exercise_name) FILTER (WHERE NULLIF(exercise_name, '') IS NOT NULL) AS sample_exercises
    FROM public.workouts
    WHERE user_id IS NOT NULL
      AND workout_date IS NOT NULL
    GROUP BY user_id, workout_date, COALESCE(NULLIF(template_name, ''), NULLIF(workout_type, ''), 'workout')
) sessions
ON CONFLICT (event_key) DO UPDATE
SET event_status = EXCLUDED.event_status,
    score = EXCLUDED.score,
    score_breakdown = EXCLUDED.score_breakdown,
    attribution = EXCLUDED.attribution,
    raw_payload = EXCLUDED.raw_payload,
    updated_at = NOW();

INSERT INTO public.growth_outcome_events (
    event_key,
    event_type,
    event_family,
    event_status,
    source_system,
    bot_account,
    from_username,
    ig_thread_id,
    ig_message_id,
    client_id,
    source_key,
    score,
    score_breakdown,
    attribution,
    raw_payload,
    occurred_at
)
SELECT
    'ig_message:' || m.id || ':ig_dm_response_sent',
    'ig_dm_response_sent',
    'engagement',
    'sent',
    'ig_dm_response_backfill',
    COALESCE(t.channel, 'instagram'),
    t.ig_username,
    m.thread_id,
    m.id,
    t.linked_user_id,
    'ig_message:' || m.id,
    1,
    jsonb_build_object('default_score', 1, 'score', 1, 'reason', 'outbound IG/FB DM response'),
    jsonb_build_object('thread_lead_stage', t.lead_stage, 'channel', t.channel),
    jsonb_build_object('source', m.source, 'text_preview', LEFT(COALESCE(m.text, ''), 220)),
    COALESCE(m.created_at, NOW())
FROM public.ig_messages m
LEFT JOIN public.ig_threads t ON t.id = m.thread_id
WHERE m.direction = 'out'
ON CONFLICT (event_key) DO UPDATE
SET event_status = EXCLUDED.event_status,
    score = EXCLUDED.score,
    score_breakdown = EXCLUDED.score_breakdown,
    attribution = EXCLUDED.attribution,
    raw_payload = EXCLUDED.raw_payload,
    updated_at = NOW();

INSERT INTO public.growth_outcome_events (
    event_key,
    event_type,
    event_family,
    event_status,
    source_system,
    client_id,
    source_key,
    score,
    score_breakdown,
    attribution,
    raw_payload,
    occurred_at
)
SELECT
    'nudge:' || n.id || ':client_message_response_sent',
    'client_message_response_sent',
    'engagement',
    'sent',
    'client_message_response_backfill',
    n.receiver_id,
    'nudge:' || n.id,
    1,
    jsonb_build_object('default_score', 1, 'score', 1, 'reason', 'outbound in-app coach message'),
    jsonb_build_object('sender_id', n.sender_id, 'receiver_id', n.receiver_id, 'nudge_type', n.nudge_type),
    jsonb_build_object('reference_id', n.reference_id, 'text_preview', LEFT(COALESCE(n.message, ''), 220)),
    COALESCE(n.created_at, NOW())
FROM public.nudges n
WHERE EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = n.sender_id)
ON CONFLICT (event_key) DO UPDATE
SET event_status = EXCLUDED.event_status,
    score = EXCLUDED.score,
    score_breakdown = EXCLUDED.score_breakdown,
    attribution = EXCLUDED.attribution,
    raw_payload = EXCLUDED.raw_payload,
    updated_at = NOW();

INSERT INTO public.growth_outcome_events (
    event_key,
    event_type,
    event_family,
    event_status,
    source_system,
    email,
    email_key,
    client_id,
    score,
    score_breakdown,
    attribution,
    raw_payload,
    occurred_at
)
SELECT
    'client:' || u.id || ':client_retained_30d',
    'client_retained_30d',
    'retention',
    COALESCE(NULLIF(u.subscription_status, ''), 'active'),
    'client_retention_backfill',
    u.email,
    lower(NULLIF(trim(u.email), '')),
    u.id,
    15,
    jsonb_build_object('default_score', 15, 'score', 15, 'reason', 'active client beyond 30 days'),
    jsonb_build_object('created_at', u.created_at, 'subscription_status', u.subscription_status),
    jsonb_build_object('name', u.name),
    COALESCE(u.created_at + INTERVAL '30 days', NOW())
FROM public.users u
WHERE COALESCE(u.is_test_account, FALSE) = FALSE
  AND u.subscription_status IN ('active', 'trialing', 'paying')
  AND u.created_at <= NOW() - INTERVAL '30 days'
ON CONFLICT (event_key) DO UPDATE
SET event_status = EXCLUDED.event_status,
    email = EXCLUDED.email,
    email_key = EXCLUDED.email_key,
    score = EXCLUDED.score,
    score_breakdown = EXCLUDED.score_breakdown,
    attribution = EXCLUDED.attribution,
    raw_payload = EXCLUDED.raw_payload,
    updated_at = NOW();
