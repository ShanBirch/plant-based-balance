-- ============================================================
-- WEIGHT LOSS CHALLENGE: GOAL DIRECTION SUPPORT
--
-- Supersedes: fix_weight_loss_display.sql
--
-- Changes:
--  1. Add weight_goal column to challenge_participants
--     ('lose' or 'gain', default 'lose')
--  2. join_wellness_challenge accepts optional p_weight_goal
--  3. update_challenge_participant_points:
--     - challenge_points = % toward goal × 1000 (for ranking)
--     - current_points   = grams of weight change (for display)
--       Positive = weight gained, negative = weight lost.
--       NULL    = no weigh-ins found at all
--       -99999999 = sentinel: has pre-challenge weigh-in only
--  4. get_user_challenges_v2 returns raw_points + weight_goal
--  5. get_challenge_leaderboard_v2 returns raw_points + weight_goal
--
-- Run this in Supabase SQL Editor.
-- ============================================================

-- 1. Add weight_goal column
ALTER TABLE public.challenge_participants
ADD COLUMN IF NOT EXISTS weight_goal TEXT DEFAULT 'lose';

-- 2. Update join_wellness_challenge to accept a weight goal
DROP FUNCTION IF EXISTS join_wellness_challenge(UUID, UUID);
CREATE OR REPLACE FUNCTION join_wellness_challenge(
    p_challenge_id UUID,
    p_user_id      UUID,
    p_weight_goal  TEXT DEFAULT 'lose'
)
RETURNS JSONB AS $$
DECLARE
    v_entry_fee        INTEGER;
    v_new_balance      INTEGER;
    v_current_points   INTEGER;
    v_challenge_status TEXT;
    v_user_status      TEXT;
BEGIN
    RAISE NOTICE '[JoinChallenge] Starting for user % in challenge %', p_user_id, p_challenge_id;

    -- 1. Verify challenge status
    SELECT status, entry_fee INTO v_challenge_status, v_entry_fee
    FROM public.challenges WHERE id = p_challenge_id;

    IF v_challenge_status NOT IN ('pending', 'active') THEN
        RETURN jsonb_build_object('error', 'invalid_status', 'message', 'This challenge is no longer accepting participants');
    END IF;

    SELECT status INTO v_user_status
    FROM public.challenge_participants
    WHERE challenge_id = p_challenge_id AND user_id = p_user_id;

    IF v_user_status = 'accepted' THEN
        RETURN jsonb_build_object('error', 'already_joined', 'message', 'You have already joined this challenge');
    END IF;

    -- 2. Debit coins
    SELECT debit_coins INTO v_new_balance
    FROM public.debit_coins(p_user_id, v_entry_fee, 'challenge_entry', 'Joined challenge');

    IF v_new_balance = -1 THEN
        RETURN jsonb_build_object('error', 'insufficient_coins', 'message', 'Not enough coins to join challenge');
    END IF;

    -- 3. Get user's current points
    SELECT COALESCE(current_points, 0) INTO v_current_points
    FROM public.user_points
    WHERE user_id = p_user_id;

    -- 4. Upsert participant record (with weight_goal)
    INSERT INTO public.challenge_participants (
        challenge_id, user_id, status, accepted_at,
        starting_points, current_points, challenge_points,
        has_paid, paid_at, weight_goal
    ) VALUES (
        p_challenge_id, p_user_id, 'accepted', NOW(),
        v_current_points, v_current_points, 0,
        TRUE, NOW(),
        COALESCE(p_weight_goal, 'lose')
    )
    ON CONFLICT (challenge_id, user_id) DO UPDATE
    SET
        status          = 'accepted',
        accepted_at     = NOW(),
        starting_points = v_current_points,
        current_points  = v_current_points,
        challenge_points = 0,
        has_paid        = TRUE,
        paid_at         = NOW(),
        weight_goal     = COALESCE(p_weight_goal, 'lose');

    -- 5. Auto-start challenge if 2+ participants
    IF v_challenge_status = 'pending' THEN
        PERFORM public.start_challenge(p_challenge_id);
    END IF;
    RAISE NOTICE '[JoinChallenge] Success. New Balance: %', v_new_balance;

    RETURN jsonb_build_object(
        'success', true,
        'new_balance', v_new_balance
    );
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '[JoinChallenge] CRITICAL ERROR: %', SQLERRM;
    RETURN jsonb_build_object('error', 'internal_error', 'message', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION join_wellness_challenge(UUID, UUID, TEXT) TO authenticated;

-- 3. Rebuild update_challenge_participant_points with goal-aware weight_loss scoring
CREATE OR REPLACE FUNCTION update_challenge_participant_points(user_uuid UUID)
RETURNS VOID AS $$
DECLARE
    user_current_points  INTEGER;
    participant_record   RECORD;
    new_score            INTEGER;
    v_start_weight       NUMERIC;
    v_current_weight     NUMERIC;
    v_weight_goal        TEXT;
    v_weight_delta_grams INTEGER;
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
        -- Reset weight-loss display variable each iteration
        v_weight_delta_grams := NULL;

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
            SELECT LEAST(
                COALESCE(up.current_streak, 0),
                GREATEST(0, (CURRENT_DATE - participant_record.accepted_at::DATE)::INT)
            )::INT INTO new_score
            FROM public.user_points up
            WHERE up.user_id = user_uuid;

        WHEN 'sleep' THEN
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
            SELECT COUNT(*)::INT INTO new_score
            FROM public.daily_checkins dc
            WHERE dc.user_id = user_uuid
            AND dc.checkin_date >= participant_record.start_date
            AND dc.checkin_date <= participant_record.end_date
            AND dc.water_intake IS NOT NULL
            AND dc.water_intake > 0;

        WHEN 'weight_loss' THEN
            -- Weight change challenge. Each participant picks 'lose' or 'gain'.
            -- challenge_points = % toward their goal × 1000 (integer, for ranking).
            -- current_points   = weight change in grams (positive=gained, negative=lost)
            --                    NULL = no weigh-ins at all
            --                    -99999999 = sentinel: only pre-challenge weigh-in exists
            --
            -- Starting weight: most recent weigh-in on/before challenge start_date.
            -- Fallback: first weigh-in during the challenge period.
            -- Current weight:  most recent weigh-in during the challenge period.

            -- Get user's goal direction for this challenge
            SELECT COALESCE(weight_goal, 'lose') INTO v_weight_goal
            FROM public.challenge_participants
            WHERE challenge_id = participant_record.challenge_id AND user_id = user_uuid;

            -- Resolve starting weight
            SELECT weight_kg INTO v_start_weight
            FROM public.daily_weigh_ins
            WHERE user_id = user_uuid
              AND weigh_in_date <= participant_record.start_date
            ORDER BY weigh_in_date DESC
            LIMIT 1;

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

            -- Compute scores
            IF v_start_weight IS NULL THEN
                -- No weigh-ins at all
                new_score := 0;
                v_weight_delta_grams := NULL;
            ELSIF v_current_weight IS NULL THEN
                -- Has pre-challenge weigh-in but no in-challenge weigh-in yet
                new_score := 0;
                v_weight_delta_grams := -99999999;  -- sentinel
            ELSE
                -- Grams delta for display (positive = gained, negative = lost)
                v_weight_delta_grams := ROUND((v_current_weight - v_start_weight) * 1000)::INT;

                -- Ranking score = % toward goal × 1000 (never negative)
                IF v_weight_goal = 'gain' THEN
                    new_score := GREATEST(0,
                        ROUND((v_current_weight - v_start_weight) / v_start_weight * 1000)::INT);
                ELSE  -- 'lose' (default)
                    new_score := GREATEST(0,
                        ROUND((v_start_weight - v_current_weight) / v_start_weight * 1000)::INT);
                END IF;
            END IF;

        ELSE
            new_score := (user_current_points - participant_record.starting_points)
                         * COALESCE(participant_record.xp_multiplier, 1);
        END CASE;

        -- Update the participant's challenge points
        UPDATE public.challenge_participants
        SET
            current_points = CASE
                WHEN participant_record.challenge_type = 'xp'          THEN user_current_points
                WHEN participant_record.challenge_type = 'weight_loss' THEN v_weight_delta_grams
                ELSE new_score
            END,
            challenge_points = GREATEST(new_score, 0)
        WHERE challenge_id = participant_record.challenge_id
        AND user_id = user_uuid;

    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION update_challenge_participant_points(UUID) TO authenticated;

-- 4. Rebuild get_user_challenges_v2 to return raw_points and weight_goal
DROP FUNCTION IF EXISTS get_user_challenges_v2(UUID);
CREATE OR REPLACE FUNCTION get_user_challenges_v2(p_user_id UUID)
RETURNS TABLE(
  challenge_id     UUID,
  challenge_name   TEXT,
  creator_id       UUID,
  creator_name     TEXT,
  start_date       DATE,
  end_date         DATE,
  duration_days    INT,
  status           TEXT,
  days_remaining   INT,
  participant_count INT,
  user_status      TEXT,
  user_rank        INT,
  user_points      INT,
  leader_name      TEXT,
  leader_points    INT,
  challenge_type   TEXT,
  unit_label       TEXT,
  rare_reward_id   TEXT,
  entry_fee        INT,
  raw_points       INT,
  weight_goal      TEXT
) AS $$
BEGIN
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
    cp.current_points as raw_points,
    cp.weight_goal
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

-- 5. Rebuild get_challenge_leaderboard_v2 to return raw_points and weight_goal
DROP FUNCTION IF EXISTS get_challenge_leaderboard_v2(UUID, UUID);
CREATE OR REPLACE FUNCTION get_challenge_leaderboard_v2(p_challenge_id UUID, p_user_id UUID)
RETURNS TABLE(
  rank              INT,
  user_id           UUID,
  user_name         TEXT,
  user_photo        TEXT,
  challenge_points  INT,
  is_creator        BOOLEAN,
  challenge_type    TEXT,
  unit_label        TEXT,
  milestone_criteria JSONB,
  milestone_progress JSONB,
  raw_points        INT,
  weight_goal       TEXT
) AS $$
BEGIN
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
    cp.current_points as raw_points,
    cp.weight_goal
  FROM public.challenge_participants cp
  JOIN public.users u ON u.id = cp.user_id
  JOIN public.challenges c ON c.id = cp.challenge_id
  WHERE cp.challenge_id = p_challenge_id
  AND cp.status = 'accepted'
  ORDER BY cp.challenge_points DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_challenge_leaderboard_v2(UUID, UUID) TO authenticated;
