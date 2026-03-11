-- ============================================================
-- FIX: Definitive update_challenge_participant_points function
--
-- Merges all challenge types (xp, workouts, volume, calories,
-- steps, streak, sleep, water, weight_loss, milestone) into a
-- single authoritative function.
--
-- Sleep now reads from ALL wearable sources:
--   WHOOP (whoop_sleep), Oura (oura_sleep), Fitbit (fitbit_sleep)
-- The highest value per day is used so having multiple devices
-- connected never penalises the user.
--
-- Run this in Supabase SQL Editor to fix the live database.
-- ============================================================

CREATE OR REPLACE FUNCTION update_challenge_participant_points(user_uuid UUID)
RETURNS VOID AS $$
DECLARE
    user_current_points INTEGER;
    participant_record  RECORD;
    new_score           INTEGER;
    -- Weight-loss variables
    v_start_weight      NUMERIC;
    v_current_weight    NUMERIC;
    -- Milestone variables
    m_criteria          JSONB;
    m_exercise          TEXT;
    m_target_weight     NUMERIC;
    m_target_reps       INTEGER;
    m_metric            TEXT;
    m_best_weight       NUMERIC;
    m_best_reps         INTEGER;
    m_achieved          BOOLEAN;
BEGIN
    -- Get user's current total XP points (used for 'xp' type challenges)
    SELECT COALESCE(current_points, 0) INTO user_current_points
    FROM public.user_points
    WHERE user_id = user_uuid;

    -- Loop through all active challenge participations for this user
    FOR participant_record IN
        SELECT cp.challenge_id, cp.starting_points, cp.xp_multiplier,
               cp.accepted_at,
               c.challenge_type, c.start_date, c.end_date,
               c.milestone_criteria
        FROM public.challenge_participants cp
        JOIN public.challenges c ON c.id = cp.challenge_id
        WHERE cp.user_id = user_uuid
        AND cp.status = 'accepted'
        AND c.status = 'active'
    LOOP
        CASE participant_record.challenge_type

        WHEN 'xp' THEN
            -- XP: delta of user_points since challenge start
            new_score := (user_current_points - participant_record.starting_points)
                         * COALESCE(participant_record.xp_multiplier, 1);

        WHEN 'workouts' THEN
            -- Workouts: count distinct workout dates during challenge period
            SELECT COUNT(DISTINCT w.workout_date)::INT INTO new_score
            FROM public.workouts w
            WHERE w.user_id = user_uuid
            AND w.workout_type = 'history'
            AND w.workout_date >= participant_record.start_date
            AND w.workout_date <= participant_record.end_date;

        WHEN 'volume' THEN
            -- Volume: total kg lifted (weight × reps for each set)
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
            AND w.workout_date >= participant_record.start_date
            AND w.workout_date <= participant_record.end_date;

        WHEN 'calories' THEN
            -- Calories: count days where user logged any calories
            SELECT COUNT(*)::INT INTO new_score
            FROM public.daily_nutrition dn
            WHERE dn.user_id = user_uuid
            AND dn.nutrition_date >= participant_record.start_date
            AND dn.nutrition_date <= participant_record.end_date
            AND dn.total_calories > 0;

        WHEN 'steps' THEN
            -- Steps: total steps from ALL wearable sources, picking the
            -- highest value per day (Oura and Fitbit).
            SELECT COALESCE(SUM(best_steps), 0)::INT INTO new_score
            FROM (
                SELECT d.date, GREATEST(
                    COALESCE((SELECT oa.steps FROM public.oura_daily_activity oa
                              WHERE oa.user_id = user_uuid AND oa.date = d.date), 0),
                    COALESCE((SELECT fa.steps FROM public.fitbit_daily_activity fa
                              WHERE fa.user_id = user_uuid AND fa.date = d.date), 0)
                ) AS best_steps
                FROM generate_series(
                    participant_record.start_date,
                    LEAST(participant_record.end_date, CURRENT_DATE),
                    '1 day'::interval
                ) d(date)
            ) daily_steps
            WHERE best_steps > 0;

        WHEN 'streak' THEN
            -- Streak: days of streak maintained since joining the challenge.
            -- Cap the user's global streak at how many days they've been a
            -- participant so a pre-existing long streak doesn't inflate the score.
            SELECT LEAST(
                COALESCE(up.current_streak, 0),
                GREATEST(0, (CURRENT_DATE - participant_record.accepted_at::DATE)::INT)
            )::INT INTO new_score
            FROM public.user_points up
            WHERE up.user_id = user_uuid;

        WHEN 'sleep' THEN
            -- Sleep: total minutes from ALL wearable sources, picking the
            -- highest value per day so any connected device counts.
            -- Sources: WHOOP (whoop_sleep), Oura (oura_sleep), Fitbit (fitbit_sleep)
            SELECT COALESCE(SUM(best_sleep), 0)::INT INTO new_score
            FROM (
                SELECT d.date, GREATEST(
                    COALESCE((SELECT ws.duration_minutes FROM public.whoop_sleep ws
                              WHERE ws.user_id = user_uuid AND ws.date = d.date), 0),
                    COALESCE((SELECT os.total_sleep_minutes FROM public.oura_sleep os
                              WHERE os.user_id = user_uuid AND os.date = d.date), 0),
                    COALESCE((SELECT fs.duration_minutes FROM public.fitbit_sleep fs
                              WHERE fs.user_id = user_uuid AND fs.date = d.date), 0)
                ) AS best_sleep
                FROM generate_series(
                    participant_record.start_date,
                    LEAST(participant_record.end_date, CURRENT_DATE),
                    '1 day'::interval
                ) d(date)
            ) daily_sleep
            WHERE best_sleep > 0;

        WHEN 'water' THEN
            -- Water: count days where any water intake was logged
            SELECT COUNT(*)::INT INTO new_score
            FROM public.daily_checkins dc
            WHERE dc.user_id = user_uuid
            AND dc.checkin_date >= participant_record.start_date
            AND dc.checkin_date <= participant_record.end_date
            AND dc.water_intake IS NOT NULL
            AND dc.water_intake > 0;

        WHEN 'weight_loss' THEN
            -- Weight Loss: percentage of body weight lost × 10 (stored as integer).
            -- e.g. 3.5% lost → 35 points; 10.0% lost → 100 points.
            -- Requires at least 2 distinct weigh-ins; score = 0 until then.

            -- Starting weight: most recent weigh-in on/before challenge start_date
            SELECT weight_kg INTO v_start_weight
            FROM public.daily_weigh_ins
            WHERE user_id = user_uuid
              AND weigh_in_date <= participant_record.start_date
            ORDER BY weigh_in_date DESC
            LIMIT 1;

            -- Fallback: first weigh-in logged during the challenge period
            IF v_start_weight IS NULL THEN
                SELECT weight_kg INTO v_start_weight
                FROM public.daily_weigh_ins
                WHERE user_id = user_uuid
                  AND weigh_in_date >= participant_record.start_date
                  AND weigh_in_date <= LEAST(participant_record.end_date, CURRENT_DATE)
                ORDER BY weigh_in_date ASC
                LIMIT 1;
            END IF;

            -- Current weight: most recent weigh-in during the challenge
            SELECT weight_kg INTO v_current_weight
            FROM public.daily_weigh_ins
            WHERE user_id = user_uuid
              AND weigh_in_date >= participant_record.start_date
              AND weigh_in_date <= LEAST(participant_record.end_date, CURRENT_DATE)
            ORDER BY weigh_in_date DESC
            LIMIT 1;

            IF v_start_weight IS NOT NULL
               AND v_start_weight > 0
               AND v_current_weight IS NOT NULL
               AND v_current_weight != v_start_weight
            THEN
                new_score := GREATEST(
                    0,
                    ROUND((v_start_weight - v_current_weight) / v_start_weight * 1000)::INT
                );
            ELSE
                new_score := 0;
            END IF;

        WHEN 'milestone' THEN
            -- Milestone: exercise-specific goal race (first to target wins)
            m_criteria      := participant_record.milestone_criteria;
            m_exercise      := m_criteria->>'exercise_name';
            m_target_weight := COALESCE((m_criteria->>'target_weight_kg')::NUMERIC, 0);
            m_target_reps   := COALESCE((m_criteria->>'target_reps')::INTEGER, 1);
            m_metric        := COALESCE(m_criteria->>'metric', 'weight_x_reps');
            m_best_weight   := 0;
            m_best_reps     := 0;
            m_achieved      := FALSE;

            IF m_exercise IS NOT NULL THEN
                SELECT COALESCE(MAX(
                    CASE WHEN w.weight_kg ~ '^[0-9]+\.?[0-9]*$'
                         THEN CAST(w.weight_kg AS NUMERIC) ELSE 0 END
                ), 0) INTO m_best_weight
                FROM public.workouts w
                WHERE w.user_id = user_uuid
                AND w.workout_type = 'history'
                AND LOWER(w.exercise_name) = LOWER(m_exercise)
                AND w.workout_date >= participant_record.start_date
                AND w.workout_date <= participant_record.end_date;

                SELECT COALESCE(MAX(
                    CASE WHEN w.reps ~ '^[0-9]+$'
                         THEN CAST(w.reps AS INTEGER) ELSE 0 END
                ), 0) INTO m_best_reps
                FROM public.workouts w
                WHERE w.user_id = user_uuid
                AND w.workout_type = 'history'
                AND LOWER(w.exercise_name) = LOWER(m_exercise)
                AND w.workout_date >= participant_record.start_date
                AND w.workout_date <= participant_record.end_date;

                IF m_metric = 'weight_x_reps' THEN
                    SELECT EXISTS(
                        SELECT 1 FROM public.workouts w
                        WHERE w.user_id = user_uuid
                        AND w.workout_type = 'history'
                        AND LOWER(w.exercise_name) = LOWER(m_exercise)
                        AND w.workout_date >= participant_record.start_date
                        AND w.workout_date <= participant_record.end_date
                        AND w.weight_kg ~ '^[0-9]+\.?[0-9]*$'
                        AND w.reps ~ '^[0-9]+$'
                        AND CAST(w.weight_kg AS NUMERIC) >= m_target_weight
                        AND CAST(w.reps AS INTEGER) >= m_target_reps
                    ) INTO m_achieved;

                    IF m_achieved THEN
                        new_score := 100;
                    ELSIF m_target_weight > 0 THEN
                        new_score := LEAST(99, FLOOR((m_best_weight / m_target_weight) * 100)::INT);
                    ELSE
                        new_score := 0;
                    END IF;

                ELSIF m_metric = 'reps_at_bodyweight' THEN
                    m_achieved := (m_best_reps >= m_target_reps);
                    IF m_achieved THEN
                        new_score := 100;
                    ELSIF m_target_reps > 0 THEN
                        new_score := LEAST(99, FLOOR((m_best_reps::NUMERIC / m_target_reps) * 100)::INT);
                    ELSE
                        new_score := 0;
                    END IF;

                ELSIF m_metric = 'max_weight' THEN
                    m_achieved := (m_best_weight >= m_target_weight);
                    IF m_achieved THEN
                        new_score := 100;
                    ELSIF m_target_weight > 0 THEN
                        new_score := LEAST(99, FLOOR((m_best_weight / m_target_weight) * 100)::INT);
                    ELSE
                        new_score := 0;
                    END IF;

                ELSE
                    new_score := 0;
                END IF;
            ELSE
                new_score := 0;
            END IF;

            -- Update milestone progress metadata
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

        -- Update challenge points for this participant
        UPDATE public.challenge_participants
        SET
            current_points = CASE
                WHEN participant_record.challenge_type = 'xp' THEN user_current_points
                ELSE new_score
            END,
            challenge_points = GREATEST(COALESCE(new_score, 0), 0)
        WHERE challenge_id = participant_record.challenge_id
        AND user_id = user_uuid;

    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION update_challenge_participant_points(UUID) TO authenticated;
