-- ============================================================
-- FIX: Steps Challenge Multi-Source Support
--
-- Problem: update_challenge_participant_points() only reads steps
-- from oura_daily_activity, giving Fitbit users and native-health
-- (HealthKit / Health Connect) users a score of 0.
--
-- Fix:
--   1. WHEN 'steps' now takes GREATEST(oura, fitbit) per day.
--   2. New RPC upsert_native_daily_steps() lets the JS client
--      write HealthKit / Health Connect steps into oura_daily_activity
--      without overwriting better wearable data.
--
-- Run this in Supabase SQL Editor.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. RPC: upsert native steps (GREATEST wins)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION upsert_native_daily_steps(
    p_user_id UUID,
    p_date     DATE,
    p_steps    INT
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO public.oura_daily_activity (user_id, date, steps)
    VALUES (p_user_id, p_date, p_steps)
    ON CONFLICT (user_id, date)
    DO UPDATE SET steps = GREATEST(public.oura_daily_activity.steps, EXCLUDED.steps);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION upsert_native_daily_steps(UUID, DATE, INT) TO authenticated;

-- ────────────────────────────────────────────────────────────
-- 2. Update challenge points function — steps reads both tables
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_challenge_participant_points(user_uuid UUID)
RETURNS VOID AS $$
DECLARE
    user_current_points INTEGER;
    participant_record RECORD;
    new_score INTEGER;
    -- Milestone-specific variables
    m_criteria JSONB;
    m_exercise TEXT;
    m_target_weight NUMERIC;
    m_target_reps INTEGER;
    m_metric TEXT;
    m_best_weight NUMERIC;
    m_best_reps INTEGER;
    m_achieved BOOLEAN;
BEGIN
    -- Get user's current total XP points (used for 'xp' type challenges)
    SELECT COALESCE(current_points, 0) INTO user_current_points
    FROM public.user_points
    WHERE user_id = user_uuid;

    -- Loop through all active challenge participations for this user
    FOR participant_record IN
        SELECT cp.challenge_id, cp.starting_points, cp.xp_multiplier,
               c.challenge_type, c.start_date, c.end_date, c.milestone_criteria
        FROM public.challenge_participants cp
        JOIN public.challenges c ON c.id = cp.challenge_id
        WHERE cp.user_id = user_uuid
        AND cp.status = 'accepted'
        AND c.status = 'active'
    LOOP
        -- Calculate score based on challenge type
        CASE participant_record.challenge_type

        WHEN 'xp' THEN
            new_score := (user_current_points - participant_record.starting_points)
                         * COALESCE(participant_record.xp_multiplier, 1);

        WHEN 'workouts' THEN
            SELECT COUNT(DISTINCT w.workout_date)::INT INTO new_score
            FROM public.workouts w
            WHERE w.user_id = user_uuid
            AND w.workout_type = 'history'
            AND CAST(w.workout_date AS DATE) >= CAST(participant_record.start_date AS DATE)
            AND CAST(w.workout_date AS DATE) <= CAST(participant_record.end_date AS DATE);

        WHEN 'volume' THEN
            SELECT COALESCE(SUM(
                CASE
                    WHEN w.weight_kg ~ '^[0-9]+\.?[0-9]*$' AND w.reps ~ '^[0-9]+$'
                    THEN CAST(w.weight_kg AS NUMERIC) * CAST(w.reps AS INTEGER)
                    ELSE 0
                END
            ), 0)::INT INTO new_score
            FROM public.workouts w
            WHERE w.user_id = user_uuid
            AND w.workout_type = 'history'
            AND CAST(w.workout_date AS DATE) >= CAST(participant_record.start_date AS DATE)
            AND CAST(w.workout_date AS DATE) <= CAST(participant_record.end_date AS DATE);

        WHEN 'calories' THEN
            -- Counts individual verified photo meals, EXCLUDING water.
            SELECT COUNT(*)::INT INTO new_score
            FROM public.meal_logs ml
            WHERE ml.user_id = user_uuid
            AND CAST(ml.meal_date AS DATE) >= CAST(participant_record.start_date AS DATE)
            AND CAST(ml.meal_date AS DATE) <= CAST(participant_record.end_date AS DATE)
            AND COALESCE(ml.meal_type, '') != 'water'
            AND ml.photo_url IS NOT NULL
            AND ml.photo_url != 'text-input'
            AND ml.photo_url != '';

        WHEN 'water' THEN
            -- Water challenge counts photo-verified water logs!
            SELECT COUNT(*)::INT INTO new_score
            FROM public.meal_logs ml
            WHERE ml.user_id = user_uuid
            AND CAST(ml.meal_date AS DATE) >= CAST(participant_record.start_date AS DATE)
            AND CAST(ml.meal_date AS DATE) <= CAST(participant_record.end_date AS DATE)
            AND ml.meal_type = 'water'
            AND ml.photo_url IS NOT NULL
            AND ml.photo_url != 'text-input'
            AND ml.photo_url != '';

        WHEN 'steps' THEN
            -- Take the GREATEST step count per day across all connected sources:
            --   • oura_daily_activity  (Oura ring + native HealthKit/Health Connect via JS upsert)
            --   • fitbit_daily_activity (Fitbit)
            SELECT COALESCE(SUM(daily_max), 0)::INT INTO new_score
            FROM (
                SELECT d::DATE AS day,
                    GREATEST(
                        COALESCE((
                            SELECT oa.steps
                            FROM public.oura_daily_activity oa
                            WHERE oa.user_id = user_uuid
                              AND CAST(oa.date AS DATE) = d::DATE
                            LIMIT 1
                        ), 0),
                        COALESCE((
                            SELECT fa.steps
                            FROM public.fitbit_daily_activity fa
                            WHERE fa.user_id = user_uuid
                              AND CAST(fa.date AS DATE) = d::DATE
                            LIMIT 1
                        ), 0)
                    ) AS daily_max
                FROM generate_series(
                    CAST(participant_record.start_date AS DATE),
                    CAST(LEAST(participant_record.end_date, CURRENT_DATE) AS DATE),
                    '1 day'::interval
                ) d
            ) daily_data
            WHERE daily_max > 0;

        WHEN 'streak' THEN
            SELECT COALESCE(up.current_streak, 0)::INT INTO new_score
            FROM public.user_points up
            WHERE up.user_id = user_uuid;

        WHEN 'sleep' THEN
            SELECT COALESCE(SUM(best_sleep), 0)::INT INTO new_score
            FROM (
                SELECT d.date, GREATEST(
                    COALESCE((SELECT ws.duration_minutes FROM public.whoop_sleep ws
                              WHERE ws.user_id = user_uuid AND CAST(ws.date AS DATE) = CAST(d.date AS DATE)), 0),
                    COALESCE((SELECT os.total_sleep_minutes FROM public.oura_sleep os
                              WHERE os.user_id = user_uuid AND CAST(os.date AS DATE) = CAST(d.date AS DATE)), 0)
                ) as best_sleep
                FROM generate_series(
                    CAST(participant_record.start_date AS DATE),
                    CAST(LEAST(participant_record.end_date, CURRENT_DATE) AS DATE),
                    '1 day'::interval
                ) d(date)
            ) daily_sleep
            WHERE best_sleep > 0;

        WHEN 'milestone' THEN
            -- Milestone: exercise-specific goal race
            m_criteria := participant_record.milestone_criteria;
            m_exercise := m_criteria->>'exercise_name';
            m_target_weight := COALESCE((m_criteria->>'target_weight_kg')::NUMERIC, 0);
            m_target_reps := COALESCE((m_criteria->>'target_reps')::INTEGER, 1);
            m_metric := COALESCE(m_criteria->>'metric', 'weight_x_reps');
            m_best_weight := 0;
            m_best_reps := 0;
            m_achieved := FALSE;

            IF m_exercise IS NOT NULL THEN
                -- Find user's best weight
                SELECT COALESCE(MAX(
                    CASE WHEN w.weight_kg ~ '^[0-9]+\.?[0-9]*$'
                         THEN CAST(w.weight_kg AS NUMERIC) ELSE 0 END
                ), 0) INTO m_best_weight
                FROM public.workouts w
                WHERE w.user_id = user_uuid
                AND w.workout_type = 'history'
                AND LOWER(w.exercise_name) = LOWER(m_exercise)
                AND CAST(w.workout_date AS DATE) >= CAST(participant_record.start_date AS DATE)
                AND CAST(w.workout_date AS DATE) <= CAST(participant_record.end_date AS DATE);

                -- Find user's best reps
                SELECT COALESCE(MAX(
                    CASE WHEN w.reps ~ '^[0-9]+$'
                         THEN CAST(w.reps AS INTEGER) ELSE 0 END
                ), 0) INTO m_best_reps
                FROM public.workouts w
                WHERE w.user_id = user_uuid
                AND w.workout_type = 'history'
                AND LOWER(w.exercise_name) = LOWER(m_exercise)
                AND CAST(w.workout_date AS DATE) >= CAST(participant_record.start_date AS DATE)
                AND CAST(w.workout_date AS DATE) <= CAST(participant_record.end_date AS DATE);

                -- Check achievement based on metric type
                IF m_metric = 'weight_x_reps' THEN
                    SELECT EXISTS(
                        SELECT 1 FROM public.workouts w
                        WHERE w.user_id = user_uuid
                        AND w.workout_type = 'history'
                        AND LOWER(w.exercise_name) = LOWER(m_exercise)
                        AND CAST(w.workout_date AS DATE) >= CAST(participant_record.start_date AS DATE)
                        AND CAST(w.workout_date AS DATE) <= CAST(participant_record.end_date AS DATE)
                        AND w.weight_kg ~ '^[0-9]+\.?[0-9]*$'
                        AND w.reps ~ '^[0-9]+$'
                        AND CAST(w.weight_kg AS NUMERIC) >= m_target_weight
                        AND CAST(w.reps AS INTEGER) >= m_target_reps
                    ) INTO m_achieved;

                    IF m_achieved THEN new_score := 100;
                    ELSIF m_target_weight > 0 THEN new_score := LEAST(99, FLOOR((m_best_weight / m_target_weight) * 100)::INT);
                    ELSE new_score := 0; END IF;

                ELSIF m_metric = 'reps_at_bodyweight' THEN
                    m_achieved := (m_best_reps >= m_target_reps);
                    IF m_achieved THEN new_score := 100;
                    ELSIF m_target_reps > 0 THEN new_score := LEAST(99, FLOOR((m_best_reps::NUMERIC / m_target_reps) * 100)::INT);
                    ELSE new_score := 0; END IF;

                ELSIF m_metric = 'max_weight' THEN
                    m_achieved := (m_best_weight >= m_target_weight);
                    IF m_achieved THEN new_score := 100;
                    ELSIF m_target_weight > 0 THEN new_score := LEAST(99, FLOOR((m_best_weight / m_target_weight) * 100)::INT);
                    ELSE new_score := 0; END IF;

                ELSE new_score := 0; END IF;
            ELSE new_score := 0; END IF;

            -- Update milestone_progress on the participant
            UPDATE public.challenge_participants
            SET milestone_progress = jsonb_build_object(
                'best_weight_kg', m_best_weight,
                'best_reps', m_best_reps,
                'achieved', m_achieved,
                'achieved_at', CASE
                    WHEN m_achieved AND (milestone_progress IS NULL OR (milestone_progress->>'achieved')::BOOLEAN IS NOT TRUE)
                    THEN NOW()
                    WHEN m_achieved AND (milestone_progress->>'achieved')::BOOLEAN = TRUE
                    THEN (milestone_progress->>'achieved_at')::TIMESTAMPTZ
                    ELSE NULL
                END
            )
            WHERE challenge_id = participant_record.challenge_id
            AND user_id = user_uuid;

        ELSE
            -- Unknown type: fall back to XP calculation
            new_score := (user_current_points - participant_record.starting_points)
                         * COALESCE(participant_record.xp_multiplier, 1);
        END CASE;

        -- Update the participant's challenge points
        UPDATE public.challenge_participants
        SET
            current_points = CASE
                WHEN participant_record.challenge_type = 'xp' THEN user_current_points
                ELSE new_score
            END,
            challenge_points = GREATEST(new_score, 0)
        WHERE challenge_id = participant_record.challenge_id
        AND user_id = user_uuid;

    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION update_challenge_participant_points(UUID) TO authenticated;

-- Force Supabase schema cache reload
NOTIFY pgrst, 'reload schema';
