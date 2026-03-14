-- ============================================================
-- FIX: Weight Loss Challenge Display ("No weigh-ins yet" bug)
--
-- Problem: When a user has weigh-ins during a weight loss challenge
-- but has gained or maintained weight (score = 0), the UI incorrectly
-- shows "No weigh-ins yet" instead of "0.0% lost".
--
-- Root cause: challenge_points = GREATEST(score, 0) = 0 for both
-- "no weigh-ins" and "has weigh-ins but gained weight", so the
-- frontend couldn't distinguish the two cases.
--
-- Fix: Use sentinel values in current_points so the frontend can tell
-- which state the user is in:
--   -9999 = no weigh-ins found anywhere ("No weigh-ins yet")
--   -9998 = has pre-challenge weigh-in but no in-challenge weigh-in yet
--       0 = in-challenge weigh-ins exist but weight same or gained
--  positive = weight lost (tenths of a %, e.g. 35 = 3.5% lost)
--
-- challenge_points is still always GREATEST(new_score, 0) so rankings
-- are unaffected.
--
-- Also updates get_user_challenges_v2 and get_challenge_leaderboard_v2
-- to return current_points as raw_points for the frontend.
--
-- Run AFTER weight_loss_challenge_migration.sql and
-- wellness_challenges_master_fix.sql.
-- ============================================================

-- 1. Rebuild update_challenge_participant_points with sentinel fix
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
            --
            -- current_points (raw score) sentinel values for frontend display:
            --   -9999 = no weigh-ins found anywhere ("No weigh-ins yet")
            --   -9998 = has pre-challenge weigh-in but no in-challenge weigh-in yet
            --       0 = in-challenge weigh-ins exist but weight same or gained
            --  positive = weight lost (tenths of a percent, e.g. 35 = 3.5% lost)
            -- challenge_points is always GREATEST(new_score, 0) for clean rankings.

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

            -- Compute score with sentinel values so the frontend can distinguish states
            IF v_start_weight IS NULL THEN
                -- No weigh-ins found anywhere
                new_score := -9999;
            ELSIF v_current_weight IS NULL THEN
                -- Has a pre-challenge weigh-in but no in-challenge weigh-in yet
                new_score := -9998;
            ELSIF v_current_weight = v_start_weight THEN
                -- Only one in-challenge weigh-in (equals start weight) or weight unchanged
                new_score := 0;
            ELSE
                -- Allow negative values (weight gain) so frontend knows weigh-ins exist
                new_score := ROUND((v_start_weight - v_current_weight) / v_start_weight * 1000)::INT;
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

-- 2. Rebuild get_user_challenges_v2 to return raw_points (current_points)
DROP FUNCTION IF EXISTS get_user_challenges_v2(UUID);
CREATE OR REPLACE FUNCTION get_user_challenges_v2(p_user_id UUID)
RETURNS TABLE(
  challenge_id UUID,
  challenge_name TEXT,
  creator_id UUID,
  creator_name TEXT,
  start_date DATE,
  end_date DATE,
  duration_days INT,
  status TEXT,
  days_remaining INT,
  participant_count INT,
  user_status TEXT,
  user_rank INT,
  user_points INT,
  leader_name TEXT,
  leader_points INT,
  challenge_type TEXT,
  unit_label TEXT,
  rare_reward_id TEXT,
  entry_fee INT,
  raw_points INT
) AS $$
BEGIN
  -- Perform a point check and update for THIS user first
  PERFORM public.update_challenge_participant_points(p_user_id);

  RETURN QUERY
  SELECT
    c.id as challenge_id,
    c.name as challenge_name,
    c.creator_id,
    creator.name as creator_name,
    c.start_date,
    c.end_date,
    c.duration_days,
    c.status,
    GREATEST(0, c.end_date - CURRENT_DATE)::INT as days_remaining,
    (SELECT COUNT(*)::INT FROM public.challenge_participants cp2
     WHERE cp2.challenge_id = c.id AND cp2.status = 'accepted') as participant_count,
    cp.status as user_status,
    (SELECT COUNT(*)::INT + 1 FROM public.challenge_participants cp3
     WHERE cp3.challenge_id = c.id AND cp3.status = 'accepted'
     AND cp3.challenge_points > cp.challenge_points) as user_rank,
    cp.challenge_points as user_points,
    (SELECT u.name FROM public.challenge_participants cp4
     JOIN public.users u ON u.id = cp4.user_id
     WHERE cp4.challenge_id = c.id AND cp4.status = 'accepted'
     ORDER BY cp4.challenge_points DESC LIMIT 1) as leader_name,
    (SELECT cp5.challenge_points FROM public.challenge_participants cp5
     WHERE cp5.challenge_id = c.id AND cp5.status = 'accepted'
     ORDER BY cp5.challenge_points DESC LIMIT 1) as leader_points,
    c.challenge_type,
    public.get_challenge_unit(c.challenge_type) as unit_label,
    c.rare_reward_id,
    c.entry_fee,
    cp.current_points as raw_points
  FROM public.challenges c
  JOIN public.challenge_participants cp ON cp.challenge_id = c.id AND cp.user_id = p_user_id
  JOIN public.users creator ON creator.id = c.creator_id
  WHERE c.status IN ('pending', 'active')
  AND cp.status NOT IN ('left', 'declined')
  ORDER BY
    CASE WHEN cp.status = 'invited' THEN 0 ELSE 1 END,
    c.start_date ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_user_challenges_v2(UUID) TO authenticated;

-- 3. Rebuild get_challenge_leaderboard_v2 to return raw_points (current_points)
DROP FUNCTION IF EXISTS get_challenge_leaderboard_v2(UUID, UUID);
CREATE OR REPLACE FUNCTION get_challenge_leaderboard_v2(p_challenge_id UUID, p_user_id UUID)
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
  milestone_progress JSONB,
  raw_points INT
) AS $$
BEGIN
  -- Update points for EVERYTHING the user is currently in (simpler than selective)
  PERFORM public.update_challenge_participant_points(p_user_id);

  RETURN QUERY
  SELECT
    ROW_NUMBER() OVER (ORDER BY cp.challenge_points DESC)::INT as rank,
    cp.user_id,
    u.name as user_name,
    u.profile_photo as user_photo,
    cp.challenge_points,
    (cp.user_id = c.creator_id) as is_creator,
    c.challenge_type,
    public.get_challenge_unit(c.challenge_type) as unit_label,
    c.milestone_criteria,
    cp.milestone_progress,
    cp.current_points as raw_points
  FROM public.challenge_participants cp
  JOIN public.users u ON u.id = cp.user_id
  JOIN public.challenges c ON c.id = cp.challenge_id
  WHERE cp.challenge_id = p_challenge_id
  AND cp.status = 'accepted'
  ORDER BY cp.challenge_points DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_challenge_leaderboard_v2(UUID, UUID) TO authenticated;
