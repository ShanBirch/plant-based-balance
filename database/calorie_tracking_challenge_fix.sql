-- ============================================================
-- CALORIE TRACKING CHALLENGE FIX (V3 - ROBUST)
-- 1. Updates 'calories' challenge type to count individual photo-verified meals
-- 2. Uses a more robust date comparison and filters
-- 3. Correctly handles 'meals' unit label
-- ============================================================

-- Update update_challenge_participant_points with meal-based calorie scoring (photo-only)
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
            AND w.workout_date >= participant_record.start_date
            AND w.workout_date <= participant_record.end_date;

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
            AND w.workout_date >= participant_record.start_date
            AND w.workout_date <= participant_record.end_date;

        WHEN 'calories' THEN
            -- Counts individual verified photo meals.
            -- This is robust against timestamps and ensures valid photos are present.
            SELECT COUNT(*)::INT INTO new_score
            FROM public.meal_logs ml
            WHERE ml.user_id = user_uuid
            AND ml.meal_date::DATE >= participant_record.start_date::DATE
            AND ml.meal_date::DATE <= participant_record.end_date::DATE
            AND ml.photo_url IS NOT NULL 
            AND ml.photo_url != 'text-input'
            AND ml.photo_url != '';

        WHEN 'steps' THEN
            SELECT COALESCE(SUM(oa.steps), 0)::INT INTO new_score
            FROM public.oura_daily_activity oa
            WHERE oa.user_id = user_uuid
            AND oa.date >= participant_record.start_date
            AND oa.date <= participant_record.end_date;

        WHEN 'streak' THEN
            SELECT COALESCE(up.current_streak, 0)::INT INTO new_score
            FROM public.user_points up
            WHERE up.user_id = user_uuid;

        WHEN 'sleep' THEN
            SELECT COALESCE(SUM(best_sleep), 0)::INT INTO new_score
            FROM (
                SELECT d.date, GREATEST(
                    COALESCE((SELECT ws.duration_minutes FROM public.whoop_sleep ws
                              WHERE ws.user_id = user_uuid AND ws.date = d.date), 0),
                    COALESCE((SELECT os.total_sleep_minutes FROM public.oura_sleep os
                              WHERE os.user_id = user_uuid AND os.date = d.date), 0)
                ) as best_sleep
                FROM generate_series(
                    participant_record.start_date,
                    LEAST(participant_record.end_date, CURRENT_DATE),
                    '1 day'::interval
                ) d(date)
            ) daily_sleep
            WHERE best_sleep > 0;

        WHEN 'water' THEN
            SELECT COUNT(*)::INT INTO new_score
            FROM public.daily_checkins dc
            WHERE dc.user_id = user_uuid
            AND dc.checkin_date >= participant_record.start_date
            AND dc.checkin_date <= participant_record.end_date
            AND dc.water_intake IS NOT NULL
            AND dc.water_intake > 0;

        WHEN 'milestone' THEN
            -- Handled separately, keeping simple to avoid breaking.
            new_score := 0; -- Milestone uses jsonb column usually.

        ELSE
            new_score := (user_current_points - participant_record.starting_points)
                         * COALESCE(participant_record.xp_multiplier, 1);
        END CASE;

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

-- Ensure reward unit labels are correct
CREATE OR REPLACE FUNCTION get_challenge_unit(challenge_type_val TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN CASE LOWER(challenge_type_val)
        WHEN 'xp' THEN 'XP'
        WHEN 'workouts' THEN 'workouts'
        WHEN 'volume' THEN 'kg'
        WHEN 'calories' THEN 'meals'
        WHEN 'steps' THEN 'steps'
        WHEN 'streak' THEN 'days'
        WHEN 'sleep' THEN 'min'
        WHEN 'water' THEN 'days'
        WHEN 'milestone' THEN '%'
        ELSE 'pts'
    END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;
