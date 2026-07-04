-- Keep Tahlia's generated XP learning-led. Workouts should show up, but not
-- dominate her challenge breakdown while the seeded account is used socially.

CREATE OR REPLACE FUNCTION private.seed_xp_category_for_award(
    p_award_index INTEGER
)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = private, public
AS $$
    SELECT CASE ((GREATEST(COALESCE(p_award_index, 1), 1) - 1) % 8)
        WHEN 0 THEN 'learning'
        WHEN 1 THEN 'nutrition'
        WHEN 2 THEN 'learning'
        WHEN 3 THEN 'check_in'
        WHEN 4 THEN 'workout'
        WHEN 5 THEN 'learning'
        WHEN 6 THEN 'nutrition'
        ELSE 'learning'
    END
$$;

REVOKE ALL ON FUNCTION private.seed_xp_category_for_award(INTEGER) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.run_seed_xp_worker(
    p_rule_key TEXT DEFAULT 'tahlia_brooks_xp_autopilot',
    p_now TIMESTAMPTZ DEFAULT NOW()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = private, public, extensions
AS $$
DECLARE
    v_rule RECORD;
    v_plan_id UUID;
    v_award RECORD;
    v_day_total INTEGER;
    v_award_xp INTEGER;
    v_category TEXT;
    v_transaction_type TEXT;
    v_description TEXT;
    v_workout_xp INTEGER;
    v_learning_overflow_xp INTEGER;
    v_tx_id UUID;
    v_overflow_tx_id UUID;
    v_awarded INTEGER := 0;
    v_awarded_xp INTEGER := 0;
    v_skipped INTEGER := 0;
    v_due INTEGER := 0;
BEGIN
    IF NOT pg_try_advisory_xact_lock(HASHTEXT('seed_xp_worker:' || p_rule_key)) THEN
        RETURN jsonb_build_object('ok', TRUE, 'locked', TRUE, 'rule_key', p_rule_key);
    END IF;

    SELECT *
    INTO v_rule
    FROM private.seed_xp_automation_rules
    WHERE rule_key = p_rule_key
      AND enabled = TRUE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', FALSE, 'error', 'rule_not_found_or_disabled', 'rule_key', p_rule_key);
    END IF;

    v_plan_id := private.ensure_seed_xp_daily_plan(p_rule_key, p_now);

    FOR v_award IN
        SELECT a.*, p.target_xp, p.local_date, r.transaction_type, r.reference_type, r.description, r.timezone
        FROM private.seed_xp_awards a
        JOIN private.seed_xp_daily_plans p ON p.id = a.plan_id
        JOIN private.seed_xp_automation_rules r ON r.id = p.rule_id
        WHERE r.rule_key = p_rule_key
          AND a.applied_at IS NULL
          AND a.skipped_reason IS NULL
          AND a.scheduled_for <= p_now
        ORDER BY a.scheduled_for ASC
        LIMIT 20
        FOR UPDATE OF a SKIP LOCKED
    LOOP
        v_due := v_due + 1;
        v_day_total := private.seed_xp_for_local_date(v_award.user_id, v_award.local_date, v_award.timezone);
        v_award_xp := LEAST(v_award.xp_amount, GREATEST(0, v_award.target_xp - v_day_total));

        IF v_award_xp <= 0 THEN
            UPDATE private.seed_xp_awards
            SET skipped_reason = 'daily_target_already_met',
                applied_at = p_now,
                xp_amount = 0
            WHERE id = v_award.id;
            v_skipped := v_skipped + 1;
            CONTINUE;
        END IF;

        v_category := private.seed_xp_category_for_award(v_award.award_index);
        v_tx_id := NULL;
        v_overflow_tx_id := NULL;

        IF v_category = 'workout' THEN
            v_workout_xp := LEAST(v_award_xp, 3);
            v_learning_overflow_xp := GREATEST(0, v_award_xp - v_workout_xp);

            IF v_workout_xp > 0 THEN
                INSERT INTO public.point_transactions (
                    user_id,
                    transaction_type,
                    points_amount,
                    reference_id,
                    reference_type,
                    photo_verified,
                    description,
                    created_at
                )
                VALUES (
                    v_award.user_id,
                    'earn_workout',
                    v_workout_xp,
                    v_award.id,
                    v_award.reference_type,
                    FALSE,
                    'Workout logged',
                    LEAST(v_award.scheduled_for, p_now)
                )
                RETURNING id INTO v_tx_id;
            END IF;

            IF v_learning_overflow_xp > 0 THEN
                INSERT INTO public.point_transactions (
                    user_id,
                    transaction_type,
                    points_amount,
                    reference_id,
                    reference_type,
                    photo_verified,
                    description,
                    created_at
                )
                VALUES (
                    v_award.user_id,
                    'earn_quiz',
                    v_learning_overflow_xp,
                    v_award.id,
                    'tahlia_brooks_xp_autopilot_learning_overflow',
                    FALSE,
                    'Health IQ quiz',
                    LEAST(v_award.scheduled_for + INTERVAL '1 second', p_now)
                )
                RETURNING id INTO v_overflow_tx_id;

                v_tx_id := COALESCE(v_tx_id, v_overflow_tx_id);
            END IF;
        ELSE
            v_transaction_type := CASE v_category
                WHEN 'nutrition' THEN 'earn_meal'
                WHEN 'check_in' THEN 'daily_checkin'
                ELSE 'earn_quiz'
            END;
            v_description := CASE v_category
                WHEN 'nutrition' THEN 'Meal logged'
                WHEN 'check_in' THEN 'Daily check-in'
                ELSE 'Health IQ quiz'
            END;

            INSERT INTO public.point_transactions (
                user_id,
                transaction_type,
                points_amount,
                reference_id,
                reference_type,
                photo_verified,
                description,
                created_at
            )
            VALUES (
                v_award.user_id,
                v_transaction_type,
                v_award_xp,
                v_award.id,
                v_award.reference_type,
                FALSE,
                v_description,
                LEAST(v_award.scheduled_for, p_now)
            )
            RETURNING id INTO v_tx_id;
        END IF;

        PERFORM public.increment_user_points(v_award.user_id, v_award_xp);
        PERFORM public.update_challenge_participant_points(v_award.user_id);

        UPDATE private.seed_xp_awards
        SET applied_at = p_now,
            point_transaction_id = v_tx_id,
            xp_amount = v_award_xp
        WHERE id = v_award.id;

        v_awarded := v_awarded + 1;
        v_awarded_xp := v_awarded_xp + v_award_xp;
    END LOOP;

    RETURN jsonb_build_object(
        'ok', TRUE,
        'rule_key', p_rule_key,
        'plan_id', v_plan_id,
        'checked_at', p_now,
        'due', v_due,
        'awarded', v_awarded,
        'awarded_xp', v_awarded_xp,
        'skipped', v_skipped
    );
END;
$$;

REVOKE ALL ON FUNCTION private.run_seed_xp_worker(TEXT, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.run_seed_xp_worker(TEXT, TIMESTAMPTZ) TO service_role;

WITH tahlia AS (
    SELECT id
    FROM public.users
    WHERE email = 'seed.tahlia.brooks+kayla30@plantbased-balance.org'
),
current_challenge AS (
    SELECT c.id, c.start_date, c.end_date
    FROM public.challenges c
    JOIN public.challenge_participants cp ON cp.challenge_id = c.id
    JOIN tahlia u ON u.id = cp.user_id
    WHERE c.name = '6-Week Transformation Challenge'
      AND c.is_system_cohort = TRUE
      AND c.start_date <= CURRENT_DATE
      AND c.end_date >= CURRENT_DATE
      AND cp.status = 'accepted'
    ORDER BY c.start_date DESC
    LIMIT 1
),
autopilot_tx AS (
    SELECT
        pt.id,
        pt.points_amount AS original_points,
        private.seed_xp_category_for_award((ROW_NUMBER() OVER (ORDER BY pt.created_at, pt.id))::INTEGER) AS category_key
    FROM public.point_transactions pt
    JOIN tahlia u ON u.id = pt.user_id
    JOIN current_challenge c
      ON pt.created_at >= c.start_date::TIMESTAMPTZ
     AND pt.created_at < (LEAST(c.end_date, CURRENT_DATE) + 1)::TIMESTAMPTZ
    WHERE pt.points_amount > 0
      AND pt.reference_type = 'tahlia_brooks_xp_autopilot'
),
split_workouts AS (
    UPDATE public.point_transactions pt
    SET points_amount = LEAST(pt.points_amount, 3),
        transaction_type = 'earn_workout',
        description = 'Workout logged'
    FROM autopilot_tx tx
    WHERE pt.id = tx.id
      AND tx.category_key = 'workout'
    RETURNING
        pt.id,
        tx.original_points,
        pt.points_amount AS workout_points
),
learning_overflow AS (
    INSERT INTO public.point_transactions (
        user_id,
        transaction_type,
        points_amount,
        reference_id,
        reference_type,
        photo_verified,
        photo_timestamp,
        verification_method,
        ai_confidence,
        description,
        created_at
    )
    SELECT
        pt.user_id,
        'earn_quiz',
        sw.original_points - sw.workout_points,
        pt.reference_id,
        'tahlia_brooks_xp_autopilot_learning_overflow',
        pt.photo_verified,
        pt.photo_timestamp,
        pt.verification_method,
        pt.ai_confidence,
        'Health IQ quiz',
        pt.created_at + INTERVAL '1 second'
    FROM split_workouts sw
    JOIN public.point_transactions pt ON pt.id = sw.id
    WHERE sw.original_points > sw.workout_points
    RETURNING id
),
recategorized AS (
    UPDATE public.point_transactions pt
    SET transaction_type = CASE tx.category_key
            WHEN 'nutrition' THEN 'earn_meal'
            WHEN 'check_in' THEN 'daily_checkin'
            ELSE 'earn_quiz'
        END,
        description = CASE tx.category_key
            WHEN 'nutrition' THEN 'Meal logged'
            WHEN 'check_in' THEN 'Daily check-in'
            ELSE 'Health IQ quiz'
        END
    FROM autopilot_tx tx
    WHERE pt.id = tx.id
      AND tx.category_key <> 'workout'
    RETURNING pt.id
)
SELECT public.update_challenge_participant_points(id)
FROM tahlia;
