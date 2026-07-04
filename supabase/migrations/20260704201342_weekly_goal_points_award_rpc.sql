ALTER TABLE public.weekly_goals
  ADD COLUMN IF NOT EXISTS points_awarded_amount INTEGER NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.weekly_goals'::regclass
      AND conname = 'weekly_goals_points_awarded_amount_check'
  ) THEN
    ALTER TABLE public.weekly_goals
      ADD CONSTRAINT weekly_goals_points_awarded_amount_check
      CHECK (points_awarded_amount >= 0 AND points_awarded_amount <= 50);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.award_weekly_goal_points(p_week_start DATE)
RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_goal public.weekly_goals%ROWTYPE;
  v_completed INTEGER;
  v_total INTEGER;
  v_max_points INTEGER;
  v_earned_total INTEGER;
  v_already_awarded INTEGER;
  v_delta INTEGER;
  v_new_total INTEGER;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'reason', 'not_authenticated',
      'pointsAwarded', 0
    );
  END IF;

  SELECT *
  INTO v_goal
  FROM public.weekly_goals
  WHERE user_id = v_user_id
    AND week_start = p_week_start
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'reason', 'weekly_goal_not_found',
      'pointsAwarded', 0
    );
  END IF;

  IF (NOW() AT TIME ZONE 'Australia/Brisbane')::DATE < (p_week_start + 6) THEN
    RETURN jsonb_build_object(
      'success', false,
      'reason', 'weekly_goal_reward_not_ready',
      'pointsAwarded', 0
    );
  END IF;

  v_completed := LEAST(3, GREATEST(0, COALESCE(v_goal.completed_count, 0)));
  v_total := LEAST(3, GREATEST(0, COALESCE(NULLIF(v_goal.total_count, 0), jsonb_array_length(v_goal.selected_goals))));
  v_max_points := LEAST(50, (v_total * 10) + CASE WHEN v_total >= 3 THEN 20 ELSE 0 END);
  v_earned_total := LEAST(50, (v_completed * 10) + CASE WHEN v_completed >= 3 AND v_total >= 3 THEN 20 ELSE 0 END);
  v_already_awarded := LEAST(50, GREATEST(0, COALESCE(v_goal.points_awarded_amount, 0)));
  v_delta := GREATEST(0, v_earned_total - v_already_awarded);

  IF v_delta <= 0 THEN
    RETURN jsonb_build_object(
      'success', true,
      'alreadyAwarded', true,
      'pointsAwarded', 0,
      'totalWeeklyGoalPoints', v_already_awarded,
      'maxWeeklyGoalPoints', v_max_points,
      'completedCount', v_completed,
      'totalCount', v_total,
      'allGoalsHit', v_total > 0 AND v_completed >= v_total
    );
  END IF;

  SELECT public.increment_user_points(v_user_id, v_delta)
  INTO v_new_total;

  INSERT INTO public.point_transactions (
    user_id,
    transaction_type,
    points_amount,
    reference_id,
    reference_type,
    verification_method,
    description
  ) VALUES (
    v_user_id,
    'earn_weekly_goals',
    v_delta,
    v_goal.id,
    'weekly_goals',
    'data_verified',
    'Earned ' || v_delta || ' XP for weekly goals'
  );

  UPDATE public.weekly_goals
  SET points_awarded_amount = v_earned_total,
      points_awarded = v_earned_total >= v_max_points,
      points_awarded_at = NOW()
  WHERE id = v_goal.id;

  BEGIN
    PERFORM public.update_challenge_participant_points(v_user_id);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN jsonb_build_object(
    'success', true,
    'pointsAwarded', v_delta,
    'totalWeeklyGoalPoints', v_earned_total,
    'maxWeeklyGoalPoints', v_max_points,
    'newTotal', v_new_total,
    'completedCount', v_completed,
    'totalCount', v_total,
    'allGoalsHit', v_total > 0 AND v_completed >= v_total
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.award_weekly_goal_points(DATE) TO authenticated;
