-- Raise Learn milestone rewards while keeping the existing active-challenge multiplier.
-- A unit awards 20 base XP and a full topic/module awards 100 base XP once only.

CREATE OR REPLACE FUNCTION public.complete_unit(
  p_user_id UUID,
  p_unit_id TEXT,
  p_module_id TEXT
)
RETURNS JSON AS $$
DECLARE
  xp_per_unit INTEGER := 20;
  already_completed BOOLEAN;
  milestone_inserted BOOLEAN := FALSE;
BEGIN
  SELECT COALESCE(p_unit_id = ANY(units_completed), FALSE)
  INTO already_completed
  FROM public.user_learning_progress
  WHERE user_id = p_user_id;

  IF already_completed THEN
    RETURN json_build_object('success', TRUE, 'xp_earned', 0, 'already_completed', TRUE);
  END IF;

  xp_per_unit := xp_per_unit * public.get_active_challenge_xp_multiplier(p_user_id);

  INSERT INTO public.learning_milestones (user_id, milestone_type, milestone_id, xp_awarded)
  VALUES (p_user_id, 'unit_complete', p_unit_id, xp_per_unit)
  ON CONFLICT DO NOTHING
  RETURNING TRUE INTO milestone_inserted;

  IF NOT COALESCE(milestone_inserted, FALSE) THEN
    RETURN json_build_object('success', TRUE, 'xp_earned', 0, 'already_completed', TRUE);
  END IF;

  UPDATE public.user_learning_progress
  SET units_completed = array_append(units_completed, p_unit_id),
      total_xp_from_learning = total_xp_from_learning + xp_per_unit,
      updated_at = NOW()
  WHERE user_id = p_user_id;

  UPDATE public.user_points
  SET lifetime_points = lifetime_points + xp_per_unit,
      updated_at = NOW()
  WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    INSERT INTO public.user_points (user_id, lifetime_points)
    VALUES (p_user_id, xp_per_unit)
    ON CONFLICT (user_id) DO UPDATE
    SET lifetime_points = user_points.lifetime_points + EXCLUDED.lifetime_points,
        updated_at = NOW();
  END IF;

  RETURN json_build_object('success', TRUE, 'xp_earned', xp_per_unit, 'already_completed', FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.complete_module(
  p_user_id UUID,
  p_module_id TEXT
)
RETURNS JSON AS $$
DECLARE
  xp_per_module INTEGER := 100;
  already_completed BOOLEAN;
  milestone_inserted BOOLEAN := FALSE;
BEGIN
  SELECT COALESCE(p_module_id = ANY(modules_completed), FALSE)
  INTO already_completed
  FROM public.user_learning_progress
  WHERE user_id = p_user_id;

  IF already_completed THEN
    RETURN json_build_object('success', TRUE, 'xp_earned', 0, 'already_completed', TRUE);
  END IF;

  xp_per_module := xp_per_module * public.get_active_challenge_xp_multiplier(p_user_id);

  INSERT INTO public.learning_milestones (user_id, milestone_type, milestone_id, xp_awarded)
  VALUES (p_user_id, 'module_complete', p_module_id, xp_per_module)
  ON CONFLICT DO NOTHING
  RETURNING TRUE INTO milestone_inserted;

  IF NOT COALESCE(milestone_inserted, FALSE) THEN
    RETURN json_build_object('success', TRUE, 'xp_earned', 0, 'already_completed', TRUE);
  END IF;

  UPDATE public.user_learning_progress
  SET modules_completed = array_append(modules_completed, p_module_id),
      total_xp_from_learning = total_xp_from_learning + xp_per_module,
      updated_at = NOW()
  WHERE user_id = p_user_id;

  UPDATE public.user_points
  SET lifetime_points = lifetime_points + xp_per_module,
      updated_at = NOW()
  WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    INSERT INTO public.user_points (user_id, lifetime_points)
    VALUES (p_user_id, xp_per_module)
    ON CONFLICT (user_id) DO UPDATE
    SET lifetime_points = user_points.lifetime_points + EXCLUDED.lifetime_points,
        updated_at = NOW();
  END IF;

  RETURN json_build_object('success', TRUE, 'xp_earned', xp_per_module, 'already_completed', FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.complete_unit(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_unit(UUID, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_module(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_module(UUID, TEXT) TO service_role;
