-- ============================================================
-- FIX: Weight Loss Challenge Not Tracking Weigh-Ins
--      + Steps Challenge Multi-Source Restore
--
-- Supersedes: weight_loss_goal_direction.sql,
--             fix_steps_challenge_tracking.sql,
--             fix_steps_challenge_multi_source.sql
--
-- Bugs fixed:
--   1. get_challenge_leaderboard_v2 only refreshed points for the
--      calling user. Other participants' rows stayed stale, so they
--      permanently showed "No weigh-ins yet" even after logging weight.
--
--   2. When a user had a pre-challenge weigh-in but no in-challenge
--      weigh-in, the SQL wrote a -99999999 sentinel into current_points
--      which the frontend displayed as "No weigh-ins yet". This was
--      misleading — the user DID have a baseline weigh-in. Now we treat
--      the starting weight as the current weight (delta = 0) in that
--      case, so the UI shows "0.0 kg" until the user logs a new weight.
--
--      current_points is still NULL when the user has no weigh-ins at
--      all (anywhere, ever), so "No weigh-ins yet" still fires for
--      truly weightless users.
--
--   3. The earlier version of this migration regressed the Steps
--      challenge by reading only from oura_daily_activity. Fitbit users
--      (whose data lands in fitbit_daily_activity) and users whose
--      steps come in via another wearable were stuck on 0, even though
--      Activity Insights on the home screen correctly displayed their
--      step count. Now the 'steps' case uses the same multi-source
--      GREATEST-per-day pattern as the 'sleep' case, so steps from any
--      connected source count toward the challenge.
--
--   4. Self-contained: adds weight_goal column and weight_loss unit
--      label if missing, so the migration works regardless of whether
--      earlier weight-loss migrations were applied. Previously, if
--      weight_loss_goal_direction.sql had never been run, the new
--      functions would compile fine but crash at runtime when they
--      referenced cp.weight_goal. That made the leaderboard fall back
--      to the v1 RPC (which doesn't return raw_points), pinning the
--      UI at "No weigh-ins yet" forever.
--
-- Run this in Supabase SQL Editor.
-- ============================================================

-- 0. Ensure prerequisite schema exists (idempotent)

-- 0a. weight_goal column on challenge_participants
ALTER TABLE public.challenge_participants
ADD COLUMN IF NOT EXISTS weight_goal TEXT DEFAULT 'lose';

-- 0b. Ensure 'weight_loss' is a valid challenge_type
ALTER TABLE public.challenges
DROP CONSTRAINT IF EXISTS challenges_challenge_type_check;

ALTER TABLE public.challenges
ADD CONSTRAINT challenges_challenge_type_check
CHECK (challenge_type IN (
    'xp', 'workouts', 'volume', 'calories', 'steps',
    'streak', 'sleep', 'water', 'milestone', 'quiz', 'weight_loss'
));

-- 0c. Ensure get_challenge_unit knows all the types (milestone_challenge_migration.sql
--     left out weight_loss; weight_loss_challenge_migration.sql left out milestone).
--     Rebuild it here as the source of truth.
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
        WHEN 'milestone'   THEN '%'
        WHEN 'weight_loss' THEN '%'
        ELSE 'pts'
    END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

GRANT EXECUTE ON FUNCTION get_challenge_unit(TEXT) TO authenticated;

-- 1. Rebuild update_challenge_participant_points with corrected
--    weight_loss scoring (no more -99999999 sentinel)
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
            -- Steps: total steps from ALL wearable sources, picking the
            -- highest value per day so any connected device (Oura, native
            -- HealthKit / Health Connect via upsert_native_daily_steps,
            -- or Fitbit) counts toward the challenge.
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
            --                    NULL = no weigh-ins at all anywhere
            --                    0    = has a weigh-in, no progress yet
            --
            -- Starting weight: most recent weigh-in on/before challenge start_date.
            --   Fallback: first weigh-in during the challenge period (if none exist
            --   on/before start).
            -- Current weight:  most recent weigh-in during the challenge period.
            --   Fallback: starting weight (so a user with only a pre-challenge
            --   weigh-in shows delta = 0 instead of a sentinel).

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

            -- Final fallback: if user only has pre-challenge weigh-ins, use
            -- the most recent of those as the "current" weight so they see
            -- a delta of 0 instead of a confusing "No weigh-ins yet".
            IF v_current_weight IS NULL AND v_start_weight IS NOT NULL THEN
                SELECT weight_kg INTO v_current_weight
                FROM public.daily_weigh_ins
                WHERE user_id = user_uuid
                ORDER BY weigh_in_date DESC
                LIMIT 1;
            END IF;

            -- Compute scores
            IF v_start_weight IS NULL OR v_current_weight IS NULL THEN
                -- No weigh-ins at all
                new_score := 0;
                v_weight_delta_grams := NULL;
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

-- 2. Rebuild get_challenge_leaderboard_v2 so it refreshes points for
--    EVERY participant, not just the calling user. Without this, only
--    the viewer's row was kept in sync; everyone else's row stayed
--    stale and permanently displayed "No weigh-ins yet".
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
DECLARE
  v_participant RECORD;
BEGIN
  -- Refresh points for every accepted participant so the leaderboard
  -- reflects the latest weigh-ins / workouts / etc. for everyone, not
  -- just the user opening the modal.
  FOR v_participant IN
    SELECT cp.user_id
    FROM public.challenge_participants cp
    WHERE cp.challenge_id = p_challenge_id
    AND cp.status = 'accepted'
  LOOP
    PERFORM public.update_challenge_participant_points(v_participant.user_id);
  END LOOP;

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

-- 3. Rebuild get_user_challenges_v2 to also refresh points for any
--    co-participants the user will see leader stats for. This keeps
--    the "leader_name / leader_points" fields on home-screen challenge
--    cards from going stale when the leader is a different user.
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
DECLARE
  v_other_user RECORD;
BEGIN
  -- Refresh the calling user first…
  PERFORM public.update_challenge_participant_points(p_user_id);

  -- …then refresh any co-participants so leader_name / leader_points
  -- shown on the home-screen challenge cards is accurate. Limited to
  -- active challenges the user is in to keep the work bounded.
  FOR v_other_user IN
    SELECT DISTINCT cp2.user_id
    FROM public.challenge_participants cp2
    JOIN public.challenges c2 ON c2.id = cp2.challenge_id
    JOIN public.challenge_participants self
      ON self.challenge_id = cp2.challenge_id AND self.user_id = p_user_id
    WHERE cp2.status = 'accepted'
    AND self.status = 'accepted'
    AND c2.status = 'active'
    AND cp2.user_id <> p_user_id
  LOOP
    PERFORM public.update_challenge_participant_points(v_other_user.user_id);
  END LOOP;

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

-- 4. Ensure upsert_native_daily_steps exists so the JS client can write
--    native HealthKit / Health Connect steps into oura_daily_activity.
--    Uses GREATEST so a real Oura sync is never overwritten by a lower
--    native value. (Originally from fix_steps_challenge_tracking.sql.)
CREATE OR REPLACE FUNCTION upsert_native_daily_steps(
    p_user_id UUID,
    p_date    DATE,
    p_steps   INTEGER
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO public.oura_daily_activity (user_id, date, steps, synced_at)
    VALUES (p_user_id, p_date, p_steps, NOW())
    ON CONFLICT (user_id, date)
    DO UPDATE SET
        steps     = GREATEST(public.oura_daily_activity.steps, EXCLUDED.steps),
        synced_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION upsert_native_daily_steps(UUID, DATE, INTEGER) TO authenticated;

-- Force Supabase schema cache reload
NOTIFY pgrst, 'reload schema';
