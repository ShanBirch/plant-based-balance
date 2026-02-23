-- ============================================================
-- MILESTONE CHALLENGE MIGRATION
-- Adds 'milestone' challenge type for exercise-specific goal races
-- e.g. "First to squat 200kg for 1 rep wins"
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Add 'milestone' to the challenge_type CHECK constraint
ALTER TABLE public.challenges DROP CONSTRAINT IF EXISTS challenges_challenge_type_check;
ALTER TABLE public.challenges
ADD CONSTRAINT challenges_challenge_type_check
CHECK (challenge_type IN ('xp', 'workouts', 'volume', 'calories', 'steps', 'streak', 'sleep', 'water', 'milestone'));

-- 2. Add milestone_criteria JSONB column to challenges
-- Stores: { exercise_name, target_weight_kg, target_reps, metric }
-- metric values: 'weight_x_reps', 'reps_at_bodyweight', 'max_weight'
ALTER TABLE public.challenges
ADD COLUMN IF NOT EXISTS milestone_criteria JSONB;

-- 3. Add milestone_progress JSONB column to challenge_participants
-- Stores: { best_weight_kg, best_reps, achieved, achieved_at }
ALTER TABLE public.challenge_participants
ADD COLUMN IF NOT EXISTS milestone_progress JSONB;

-- 4. Relax min_duration constraint (28 → 7 days) for shorter milestone races
ALTER TABLE public.challenges DROP CONSTRAINT IF EXISTS min_duration;
ALTER TABLE public.challenges ADD CONSTRAINT min_duration CHECK (duration_days >= 7);

-- ============================================================
-- 5. Update update_challenge_participant_points with milestone branch
-- ============================================================
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
            SELECT COUNT(*)::INT INTO new_score
            FROM public.daily_nutrition dn
            WHERE dn.user_id = user_uuid
            AND dn.nutrition_date >= participant_record.start_date
            AND dn.nutrition_date <= participant_record.end_date
            AND dn.day_completed = TRUE;

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
            -- Milestone: exercise-specific goal race (first to target wins)
            m_criteria := participant_record.milestone_criteria;
            m_exercise := m_criteria->>'exercise_name';
            m_target_weight := COALESCE((m_criteria->>'target_weight_kg')::NUMERIC, 0);
            m_target_reps := COALESCE((m_criteria->>'target_reps')::INTEGER, 1);
            m_metric := COALESCE(m_criteria->>'metric', 'weight_x_reps');
            m_best_weight := 0;
            m_best_reps := 0;
            m_achieved := FALSE;

            IF m_exercise IS NOT NULL THEN
                -- Find user's best weight for this exercise during challenge period
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

                -- Find user's best reps for this exercise during challenge period
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

                -- Check achievement based on metric type
                IF m_metric = 'weight_x_reps' THEN
                    -- Check if any single set meets BOTH weight and reps target
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

                    -- Progress = best weight as % of target
                    IF m_achieved THEN
                        new_score := 100;
                    ELSIF m_target_weight > 0 THEN
                        new_score := LEAST(99, FLOOR((m_best_weight / m_target_weight) * 100)::INT);
                    ELSE
                        new_score := 0;
                    END IF;

                ELSIF m_metric = 'reps_at_bodyweight' THEN
                    -- Bodyweight exercise: just check reps
                    m_achieved := (m_best_reps >= m_target_reps);
                    IF m_achieved THEN
                        new_score := 100;
                    ELSIF m_target_reps > 0 THEN
                        new_score := LEAST(99, FLOOR((m_best_reps::NUMERIC / m_target_reps) * 100)::INT);
                    ELSE
                        new_score := 0;
                    END IF;

                ELSIF m_metric = 'max_weight' THEN
                    -- Max weight at any rep count
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

-- ============================================================
-- 6. Update complete_challenge to handle milestone winner (first achiever)
-- ============================================================
CREATE OR REPLACE FUNCTION complete_challenge(challenge_uuid UUID)
RETURNS JSONB AS $$
DECLARE
    winner_user_id UUID;
    winner_pts INT;
    winner_user_name TEXT;
    already_rewarded BOOLEAN;
    challenge_rare_reward TEXT;
    challenge_type_val TEXT;
    participant_record RECORD;
    random_item_id UUID;
BEGIN
    -- Check if winner was already rewarded
    SELECT winner_rewarded, rare_reward_id, challenge_type
    INTO already_rewarded, challenge_rare_reward, challenge_type_val
    FROM public.challenges
    WHERE id = challenge_uuid;

    IF already_rewarded = TRUE THEN
        RETURN jsonb_build_object(
            'error', 'already_completed',
            'message', 'Challenge winner was already rewarded'
        );
    END IF;

    -- Find the winner
    IF challenge_type_val = 'milestone' THEN
        -- Milestone: winner = first person to achieve the target
        SELECT cp.user_id, cp.challenge_points, u.name
        INTO winner_user_id, winner_pts, winner_user_name
        FROM public.challenge_participants cp
        JOIN public.users u ON u.id = cp.user_id
        WHERE cp.challenge_id = challenge_uuid AND cp.status = 'accepted'
        AND cp.milestone_progress IS NOT NULL
        AND (cp.milestone_progress->>'achieved')::BOOLEAN = TRUE
        ORDER BY (cp.milestone_progress->>'achieved_at')::TIMESTAMPTZ ASC
        LIMIT 1;

        -- Fallback: if nobody achieved, closest person wins (highest challenge_points)
        IF winner_user_id IS NULL THEN
            SELECT cp.user_id, cp.challenge_points, u.name
            INTO winner_user_id, winner_pts, winner_user_name
            FROM public.challenge_participants cp
            JOIN public.users u ON u.id = cp.user_id
            WHERE cp.challenge_id = challenge_uuid AND cp.status = 'accepted'
            ORDER BY cp.challenge_points DESC
            LIMIT 1;
        END IF;
    ELSE
        -- Standard: highest challenge_points wins
        SELECT cp.user_id, cp.challenge_points, u.name
        INTO winner_user_id, winner_pts, winner_user_name
        FROM public.challenge_participants cp
        JOIN public.users u ON u.id = cp.user_id
        WHERE cp.challenge_id = challenge_uuid AND cp.status = 'accepted'
        ORDER BY cp.challenge_points DESC
        LIMIT 1;
    END IF;

    IF winner_user_id IS NULL THEN
        RETURN jsonb_build_object(
            'error', 'no_participants',
            'message', 'No accepted participants in this challenge'
        );
    END IF;

    -- Update challenge with winner
    UPDATE public.challenges
    SET
        status = 'completed',
        winner_id = winner_user_id,
        winner_points = winner_pts,
        completed_at = NOW(),
        updated_at = NOW(),
        winner_rewarded = TRUE
    WHERE id = challenge_uuid;

    -- Award 200 points to winner
    UPDATE public.user_points
    SET
        current_points = current_points + 200,
        lifetime_points = lifetime_points + 200
    WHERE user_id = winner_user_id;

    -- Record the point transaction
    INSERT INTO public.point_transactions (user_id, transaction_type, points, description)
    VALUES (winner_user_id, 'challenge_win', 200, 'Won challenge: ' || (SELECT name FROM public.challenges WHERE id = challenge_uuid));

    -- Award cosmetic to winner (rare/legendary)
    SELECT ci.id INTO random_item_id
    FROM public.cosmetic_items ci
    WHERE ci.rarity IN ('rare', 'legendary')
    AND ci.is_active = TRUE
    AND ci.id NOT IN (SELECT item_id FROM public.user_inventory WHERE user_id = winner_user_id)
    ORDER BY random()
    LIMIT 1;

    IF random_item_id IS NOT NULL THEN
        INSERT INTO public.user_inventory (user_id, item_id, source, challenge_id)
        VALUES (winner_user_id, random_item_id, 'challenge_win', challenge_uuid)
        ON CONFLICT (user_id, item_id) DO NOTHING;
    END IF;

    -- Award common cosmetic to other participants
    FOR participant_record IN
        SELECT cp.user_id
        FROM public.challenge_participants cp
        WHERE cp.challenge_id = challenge_uuid
        AND cp.status = 'accepted'
        AND cp.user_id != winner_user_id
    LOOP
        SELECT ci.id INTO random_item_id
        FROM public.cosmetic_items ci
        WHERE ci.rarity IN ('common', 'uncommon')
        AND ci.is_active = TRUE
        AND ci.id NOT IN (SELECT item_id FROM public.user_inventory WHERE user_id = participant_record.user_id)
        ORDER BY random()
        LIMIT 1;

        IF random_item_id IS NOT NULL THEN
            INSERT INTO public.user_inventory (user_id, item_id, source, challenge_id)
            VALUES (participant_record.user_id, random_item_id, 'challenge_participation', challenge_uuid)
            ON CONFLICT (user_id, item_id) DO NOTHING;
        END IF;
    END LOOP;

    RETURN jsonb_build_object(
        'winner_id', winner_user_id,
        'winner_name', winner_user_name,
        'winner_points', winner_pts,
        'rare_reward_id', challenge_rare_reward
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION complete_challenge(UUID) TO authenticated;

-- ============================================================
-- 7. Update get_challenge_leaderboard to include milestone data
-- ============================================================
CREATE OR REPLACE FUNCTION get_challenge_leaderboard(challenge_uuid UUID)
RETURNS TABLE(
  rank INT,
  user_id UUID,
  user_name TEXT,
  user_photo TEXT,
  challenge_points INT,
  is_creator BOOLEAN,
  challenge_type TEXT,
  unit_label TEXT,
  milestone_criteria JSONB,
  milestone_progress JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ROW_NUMBER() OVER (ORDER BY cp.challenge_points DESC)::INT as rank,
    cp.user_id,
    u.name as user_name,
    u.profile_photo as user_photo,
    cp.challenge_points,
    (cp.user_id = c.creator_id) as is_creator,
    c.challenge_type,
    get_challenge_unit(c.challenge_type) as unit_label,
    c.milestone_criteria,
    cp.milestone_progress
  FROM public.challenge_participants cp
  JOIN public.users u ON u.id = cp.user_id
  JOIN public.challenges c ON c.id = cp.challenge_id
  WHERE cp.challenge_id = challenge_uuid
  AND cp.status = 'accepted'
  ORDER BY cp.challenge_points DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_challenge_leaderboard(UUID) TO authenticated;

-- ============================================================
-- 8. Update get_challenge_unit to return '%' for milestone
-- ============================================================
CREATE OR REPLACE FUNCTION get_challenge_unit(challenge_type_val TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN CASE challenge_type_val
        WHEN 'xp' THEN 'XP'
        WHEN 'workouts' THEN 'workouts'
        WHEN 'volume' THEN 'kg'
        WHEN 'calories' THEN 'days'
        WHEN 'steps' THEN 'steps'
        WHEN 'streak' THEN 'days'
        WHEN 'sleep' THEN 'min'
        WHEN 'water' THEN 'days'
        WHEN 'milestone' THEN '%'
        ELSE 'pts'
    END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

GRANT EXECUTE ON FUNCTION get_challenge_unit(TEXT) TO authenticated;
