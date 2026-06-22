CREATE OR REPLACE FUNCTION public.refresh_growth_outcome_events(_window_days INTEGER DEFAULT 45)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    safe_days INTEGER := GREATEST(1, LEAST(COALESCE(_window_days, 45), 365));
    cutoff_at TIMESTAMPTZ := NOW() - (INTERVAL '1 day' * GREATEST(1, LEAST(COALESCE(_window_days, 45), 365)));
    weights_count INTEGER := 0;
    stripe_count INTEGER := 0;
    conversion_count INTEGER := 0;
    weekly_goal_count INTEGER := 0;
    daily_checkin_count INTEGER := 0;
    workout_count INTEGER := 0;
    ig_response_count INTEGER := 0;
    client_response_count INTEGER := 0;
    retained_count INTEGER := 0;
BEGIN
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
    GET DIAGNOSTICS weights_count = ROW_COUNT;

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
        'growth_outcome_refresh',
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
      AND COALESCE(s.updated_at, s.created_at, NOW()) >= cutoff_at
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
    GET DIAGNOSTICS stripe_count = ROW_COUNT;

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
        'refreshed',
        'growth_outcome_refresh',
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
      AND COALESCE(e.created_at, NOW()) >= cutoff_at
    ON CONFLICT (event_key) DO UPDATE
    SET event_status = EXCLUDED.event_status,
        score = EXCLUDED.score,
        score_breakdown = EXCLUDED.score_breakdown,
        attribution = EXCLUDED.attribution,
        raw_payload = EXCLUDED.raw_payload,
        updated_at = NOW();
    GET DIAGNOSTICS conversion_count = ROW_COUNT;

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
        'growth_outcome_refresh',
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
      AND COALESCE(wg.updated_at, wg.points_awarded_at, wg.created_at, NOW()) >= cutoff_at
    ON CONFLICT (event_key) DO UPDATE
    SET event_status = EXCLUDED.event_status,
        score = EXCLUDED.score,
        score_breakdown = EXCLUDED.score_breakdown,
        attribution = EXCLUDED.attribution,
        raw_payload = EXCLUDED.raw_payload,
        updated_at = NOW();
    GET DIAGNOSTICS weekly_goal_count = ROW_COUNT;

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
        'growth_outcome_refresh',
        dc.user_id,
        'daily_checkin:' || dc.id,
        3,
        jsonb_build_object('default_score', 3, 'score', 3, 'reason', 'daily check-in completed'),
        jsonb_build_object('checkin_date', dc.checkin_date, 'energy', dc.energy, 'sleep', dc.sleep),
        jsonb_build_object('water_intake', dc.water_intake, 'additional_data', dc.additional_data),
        COALESCE(dc.created_at, dc.checkin_date::TIMESTAMPTZ, NOW())
    FROM public.daily_checkins dc
    WHERE COALESCE(dc.created_at, dc.checkin_date::TIMESTAMPTZ, NOW()) >= cutoff_at
    ON CONFLICT (event_key) DO UPDATE
    SET event_status = EXCLUDED.event_status,
        score = EXCLUDED.score,
        score_breakdown = EXCLUDED.score_breakdown,
        attribution = EXCLUDED.attribution,
        raw_payload = EXCLUDED.raw_payload,
        updated_at = NOW();
    GET DIAGNOSTICS daily_checkin_count = ROW_COUNT;

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
        'growth_outcome_refresh',
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
          AND COALESCE(created_at, updated_at, workout_date::TIMESTAMPTZ, NOW()) >= cutoff_at
        GROUP BY user_id, workout_date, COALESCE(NULLIF(template_name, ''), NULLIF(workout_type, ''), 'workout')
    ) sessions
    ON CONFLICT (event_key) DO UPDATE
    SET event_status = EXCLUDED.event_status,
        score = EXCLUDED.score,
        score_breakdown = EXCLUDED.score_breakdown,
        attribution = EXCLUDED.attribution,
        raw_payload = EXCLUDED.raw_payload,
        updated_at = NOW();
    GET DIAGNOSTICS workout_count = ROW_COUNT;

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
        'growth_outcome_refresh',
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
      AND COALESCE(m.created_at, NOW()) >= cutoff_at
    ON CONFLICT (event_key) DO UPDATE
    SET event_status = EXCLUDED.event_status,
        score = EXCLUDED.score,
        score_breakdown = EXCLUDED.score_breakdown,
        attribution = EXCLUDED.attribution,
        raw_payload = EXCLUDED.raw_payload,
        updated_at = NOW();
    GET DIAGNOSTICS ig_response_count = ROW_COUNT;

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
        'growth_outcome_refresh',
        n.receiver_id,
        'nudge:' || n.id,
        1,
        jsonb_build_object('default_score', 1, 'score', 1, 'reason', 'outbound in-app coach message'),
        jsonb_build_object('sender_id', n.sender_id, 'receiver_id', n.receiver_id, 'nudge_type', n.nudge_type),
        jsonb_build_object('reference_id', n.reference_id, 'text_preview', LEFT(COALESCE(n.message, ''), 220)),
        COALESCE(n.created_at, NOW())
    FROM public.nudges n
    WHERE EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = n.sender_id)
      AND COALESCE(n.created_at, NOW()) >= cutoff_at
    ON CONFLICT (event_key) DO UPDATE
    SET event_status = EXCLUDED.event_status,
        score = EXCLUDED.score,
        score_breakdown = EXCLUDED.score_breakdown,
        attribution = EXCLUDED.attribution,
        raw_payload = EXCLUDED.raw_payload,
        updated_at = NOW();
    GET DIAGNOSTICS client_response_count = ROW_COUNT;

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
        'growth_outcome_refresh',
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
    GET DIAGNOSTICS retained_count = ROW_COUNT;

    RETURN jsonb_build_object(
        'window_days', safe_days,
        'weights', weights_count,
        'stripe_events', stripe_count,
        'conversion_actions', conversion_count,
        'weekly_goal_events', weekly_goal_count,
        'daily_checkin_events', daily_checkin_count,
        'workout_events', workout_count,
        'ig_response_events', ig_response_count,
        'client_response_events', client_response_count,
        'retained_clients', retained_count
    );
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_growth_outcome_events(INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.refresh_growth_outcome_events(INTEGER) TO service_role;
