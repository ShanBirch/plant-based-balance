-- Automatically pay weekly-goal XP after each member's local Sunday ends.
-- Independent of Weekly Wrapped. A later wearable sync can safely add only
-- the remaining XP while it is still Monday for that member.

CREATE OR REPLACE FUNCTION public.award_weekly_goal_points_for_user(p_user_id UUID, p_week_start DATE)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_goal public.weekly_goals%ROWTYPE; v_completed INTEGER; v_total INTEGER;
  v_max_points INTEGER; v_earned_total INTEGER; v_already_awarded INTEGER;
  v_delta INTEGER; v_new_total INTEGER;
BEGIN
  SELECT * INTO v_goal FROM public.weekly_goals
  WHERE user_id = p_user_id AND week_start = p_week_start FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'weekly_goal_not_found', 'pointsAwarded', 0);
  END IF;
  v_completed := LEAST(3, GREATEST(0, COALESCE(v_goal.completed_count, 0)));
  v_total := LEAST(3, GREATEST(0, COALESCE(NULLIF(v_goal.total_count, 0), jsonb_array_length(v_goal.selected_goals))));
  v_max_points := LEAST(50, (v_total * 10) + CASE WHEN v_total >= 3 THEN 20 ELSE 0 END);
  v_earned_total := LEAST(50, (v_completed * 10) + CASE WHEN v_completed >= 3 AND v_total >= 3 THEN 20 ELSE 0 END);
  v_already_awarded := LEAST(50, GREATEST(0, COALESCE(v_goal.points_awarded_amount, 0)));
  v_delta := GREATEST(0, v_earned_total - v_already_awarded);
  IF v_delta <= 0 THEN
    RETURN jsonb_build_object('success', true, 'alreadyAwarded', true, 'pointsAwarded', 0,
      'totalWeeklyGoalPoints', v_already_awarded, 'maxWeeklyGoalPoints', v_max_points);
  END IF;
  SELECT public.increment_user_points(p_user_id, v_delta) INTO v_new_total;
  INSERT INTO public.point_transactions (user_id, transaction_type, points_amount, reference_id, reference_type, verification_method, description)
  VALUES (p_user_id, 'earn_weekly_goals', v_delta, v_goal.id, 'weekly_goals', 'data_verified', 'Earned ' || v_delta || ' XP for weekly goals');
  UPDATE public.weekly_goals SET points_awarded_amount = v_earned_total,
    points_awarded = v_earned_total >= v_max_points, points_awarded_at = NOW() WHERE id = v_goal.id;
  BEGIN PERFORM public.update_challenge_participant_points(p_user_id); EXCEPTION WHEN OTHERS THEN NULL; END;
  RETURN jsonb_build_object('success', true, 'pointsAwarded', v_delta,
    'totalWeeklyGoalPoints', v_earned_total, 'maxWeeklyGoalPoints', v_max_points, 'newTotal', v_new_total);
END;
$$;

CREATE OR REPLACE FUNCTION public.process_due_weekly_goal_rewards()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_goal RECORD; v_result JSONB; v_processed INTEGER := 0; v_awarded INTEGER := 0;
BEGIN
  FOR v_goal IN
    SELECT g.user_id, g.week_start
    FROM public.weekly_goals g
    LEFT JOIN public.meal_reminder_preferences mrp ON mrp.user_id = g.user_id
    CROSS JOIN LATERAL (SELECT COALESCE(NULLIF(mrp.timezone, ''), 'Australia/Brisbane') AS requested_timezone) candidate
    CROSS JOIN LATERAL (SELECT CASE WHEN EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = candidate.requested_timezone)
      THEN candidate.requested_timezone ELSE 'Australia/Brisbane' END AS timezone) tz
    WHERE g.week_end = ((NOW() AT TIME ZONE tz.timezone)::date - 1)
      AND EXTRACT(ISODOW FROM (NOW() AT TIME ZONE tz.timezone)) = 1
  LOOP
    v_result := public.award_weekly_goal_points_for_user(v_goal.user_id, v_goal.week_start);
    v_processed := v_processed + 1;
    v_awarded := v_awarded + COALESCE((v_result->>'pointsAwarded')::INTEGER, 0);
  END LOOP;
  RETURN jsonb_build_object('success', true, 'processed', v_processed, 'pointsAwarded', v_awarded);
END;
$$;

REVOKE ALL ON FUNCTION public.award_weekly_goal_points_for_user(UUID, DATE) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.process_due_weekly_goal_rewards() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_due_weekly_goal_rewards() TO service_role;
