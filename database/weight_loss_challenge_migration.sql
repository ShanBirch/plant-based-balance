-- ============================================================
-- WEIGHT LOSS CHALLENGE MIGRATION
-- Adds 'weight_loss' challenge type to the challenge system.
--
-- Fairness design:
--   Score = tenths of a percent of body weight lost
--   e.g. losing 3.5% of body weight = 35 points
--   This normalises for body size so heavier and lighter
--   participants compete on equal footing.
--
-- Starting weight = most recent weigh-in on/before challenge
--   start_date (or first weigh-in during the challenge if none
--   exists before the start date).
-- Current weight = most recent weigh-in during the challenge.
-- Minimum 2 weigh-ins required to appear on the leaderboard.
--
-- Run this in Supabase SQL Editor AFTER
-- challenge_type_quiz_milestone_fix.sql
-- ============================================================

-- 1. Extend the check constraint to include 'weight_loss'
ALTER TABLE public.challenges
DROP CONSTRAINT IF EXISTS challenges_challenge_type_check;

ALTER TABLE public.challenges
ADD CONSTRAINT challenges_challenge_type_check
CHECK (challenge_type IN (
    'xp', 'workouts', 'volume', 'calories', 'steps',
    'streak', 'sleep', 'water', 'milestone', 'quiz', 'weight_loss'
));

-- 2. Rebuild update_challenge_participant_points with weight_loss support
CREATE OR REPLACE FUNCTION update_challenge_participant_points(user_uuid UUID)
RETURNS VOID AS $$
DECLARE
    user_current_points INTEGER;
    participant_record  RECORD;
    new_score           INTEGER;
    v_start_weight      NUMERIC;
    v_current_weight    NUMERIC;
BEGIN
    -- Get user's current total XP points (used for 'xp' type challenges)
    SELECT COALESCE(current_points, 0) INTO user_current_points
    FROM public.user_points
    WHERE user_id = user_uuid;

    -- Loop through all active challenge participations for this user
    FOR participant_record IN
        SELECT cp.challenge_id, cp.starting_points, cp.xp_multiplier,
               cp.accepted_at,
               c.challenge_type, c.start_date, c.end_date
        FROM public.challenge_participants cp
        JOIN public.challenges c ON c.id = cp.challenge_id
        WHERE cp.user_id = user_uuid
        AND cp.status = 'accepted'
        AND c.status = 'active'
    LOOP
        -- Calculate score based on challenge type
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
            -- Volume: total kg lifted (weight * reps for each set)
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
            -- Calories: count days where user completed their daily nutrition log
            SELECT COUNT(*)::INT INTO new_score
            FROM public.daily_nutrition dn
            WHERE dn.user_id = user_uuid
            AND dn.nutrition_date >= participant_record.start_date
            AND dn.nutrition_date <= participant_record.end_date
            AND dn.day_completed = TRUE;

        WHEN 'steps' THEN
            -- Steps: total steps from wearable data (Oura)
            SELECT COALESCE(SUM(oa.steps), 0)::INT INTO new_score
            FROM public.oura_daily_activity oa
            WHERE oa.user_id = user_uuid
            AND oa.date >= participant_record.start_date
            AND oa.date <= participant_record.end_date;

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
            -- Sleep: total minutes from all wearable sources (WHOOP + Oura + Fitbit, pick highest per day)
            SELECT COALESCE(SUM(best_sleep), 0)::INT INTO new_score
            FROM (
                SELECT d.date, GREATEST(
                    COALESCE((SELECT ws.duration_minutes FROM public.whoop_sleep ws
                              WHERE ws.user_id = user_uuid AND ws.date = d.date), 0),
                    COALESCE((SELECT os.total_sleep_minutes FROM public.oura_sleep os
                              WHERE os.user_id = user_uuid AND os.date = d.date), 0),
                    COALESCE((SELECT fs.duration_minutes FROM public.fitbit_sleep fs
                              WHERE fs.user_id = user_uuid AND fs.date = d.date), 0)
                ) as best_sleep
                FROM generate_series(
                    participant_record.start_date,
                    LEAST(participant_record.end_date, CURRENT_DATE),
                    '1 day'::interval
                ) d(date)
            ) daily_sleep
            WHERE best_sleep > 0;

        WHEN 'water' THEN
            -- Water: count days where hydration goal was met
            SELECT COUNT(*)::INT INTO new_score
            FROM public.daily_checkins dc
            WHERE dc.user_id = user_uuid
            AND dc.checkin_date >= participant_record.start_date
            AND dc.checkin_date <= participant_record.end_date
            AND dc.water_intake IS NOT NULL
            AND dc.water_intake > 0;

        WHEN 'weight_loss' THEN
            -- Weight Loss: percentage of body weight lost, stored as tenths of a
            -- percent (integer) for leaderboard ranking.
            -- e.g. 3.5% lost → 35 points; 10.0% lost → 100 points.
            --
            -- Starting weight: most recent weigh-in on/before challenge start_date.
            -- Fallback: first weigh-in logged during the challenge period.
            -- Current weight: most recent weigh-in during the challenge period.
            -- Requires at least 2 distinct weigh-ins; score = 0 until then.

            -- Resolve starting weight
            SELECT weight_kg INTO v_start_weight
            FROM public.daily_weigh_ins
            WHERE user_id = user_uuid
              AND weigh_in_date <= participant_record.start_date
            ORDER BY weigh_in_date DESC
            LIMIT 1;

            -- If no pre-challenge weigh-in exists, use first one during challenge
            IF v_start_weight IS NULL THEN
                SELECT weight_kg INTO v_start_weight
                FROM public.daily_weigh_ins
                WHERE user_id = user_uuid
                  AND weigh_in_date >= participant_record.start_date
                  AND weigh_in_date <= LEAST(participant_record.end_date, CURRENT_DATE)
                ORDER BY weigh_in_date ASC
                LIMIT 1;
            END IF;

            -- Resolve current (most recent) weight during challenge
            SELECT weight_kg INTO v_current_weight
            FROM public.daily_weigh_ins
            WHERE user_id = user_uuid
              AND weigh_in_date >= participant_record.start_date
              AND weigh_in_date <= LEAST(participant_record.end_date, CURRENT_DATE)
            ORDER BY weigh_in_date DESC
            LIMIT 1;

            -- Compute score (need start ≠ current to prove at least 2 weigh-ins)
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

-- 3. Add weight_loss to the unit helper used by the leaderboard RPC
CREATE OR REPLACE FUNCTION get_challenge_unit(challenge_type_val TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN CASE challenge_type_val
        WHEN 'xp'          THEN 'XP'
        WHEN 'workouts'    THEN 'workouts'
        WHEN 'volume'      THEN 'kg'
        WHEN 'calories'    THEN 'days'
        WHEN 'steps'       THEN 'steps'
        WHEN 'streak'      THEN 'days'
        WHEN 'sleep'       THEN 'min'
        WHEN 'water'       THEN 'days'
        WHEN 'weight_loss' THEN '%'
        ELSE 'pts'
    END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

GRANT EXECUTE ON FUNCTION get_challenge_unit(TEXT) TO authenticated;
