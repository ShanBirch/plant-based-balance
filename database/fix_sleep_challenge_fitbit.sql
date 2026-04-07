-- ============================================================
-- FIX: Sleep challenge scoring to include Fitbit sleep data
-- The original scoring only read from whoop_sleep and oura_sleep,
-- causing Fitbit users to always show 0m in sleep challenges.
-- Run this in Supabase SQL Editor.
-- ============================================================

CREATE OR REPLACE FUNCTION update_challenge_participant_points(user_uuid UUID)
RETURNS VOID AS $$
DECLARE
    user_current_points INTEGER;
    participant_record RECORD;
    new_score INTEGER;
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
            -- Cap the user's global streak at how many days they've been a participant,
            -- so a pre-existing long streak doesn't inflate their challenge score.
            SELECT LEAST(
                COALESCE(up.current_streak, 0),
                GREATEST(0, (CURRENT_DATE - participant_record.accepted_at::DATE)::INT)
            )::INT INTO new_score
            FROM public.user_points up
            WHERE up.user_id = user_uuid;

        WHEN 'sleep' THEN
            -- Sleep: total sleep minutes from wearables (WHOOP + Oura + Fitbit, pick highest per day)
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
            -- Water glasses are stored in daily_checkins.water_intake
            -- We count days where water_intake > 0 (any logging counts)
            SELECT COUNT(*)::INT INTO new_score
            FROM public.daily_checkins dc
            WHERE dc.user_id = user_uuid
            AND dc.checkin_date >= participant_record.start_date
            AND dc.checkin_date <= participant_record.end_date
            AND dc.water_intake IS NOT NULL
            AND dc.water_intake > 0;

        ELSE
            -- Unknown type: fall back to XP calculation
            new_score := (user_current_points - participant_record.starting_points)
                         * COALESCE(participant_record.xp_multiplier, 1);
        END CASE;

        -- Update the participant's challenge points
        UPDATE public.challenge_participants
        SET challenge_points = GREATEST(0, COALESCE(new_score, 0)),
            updated_at = NOW()
        WHERE user_id = user_uuid
        AND challenge_id = participant_record.challenge_id;

    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
