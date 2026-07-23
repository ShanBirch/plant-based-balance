-- Keep Balance progression running beyond level 99 so all later character
-- unlocks remain reachable. The existing power curve keeps each level harder.

CREATE OR REPLACE FUNCTION public.calculate_user_level(p_lifetime_points INTEGER)
RETURNS JSON AS $$
DECLARE
  v_level INTEGER := 1;
  v_lifetime_points INTEGER := GREATEST(COALESCE(p_lifetime_points, 0), 0);
  v_points_needed INTEGER;
  v_current_level_points INTEGER;
  v_next_level_points INTEGER;
  v_points_into_level INTEGER;
  v_points_needed_for_next INTEGER;
  v_progress INTEGER;
  v_title TEXT;
BEGIN
  LOOP
    v_points_needed := public.get_points_for_level(v_level + 1);
    IF v_lifetime_points < v_points_needed THEN
      EXIT;
    END IF;
    v_level := v_level + 1;
  END LOOP;

  v_current_level_points := public.get_points_for_level(v_level);
  v_next_level_points := public.get_points_for_level(v_level + 1);
  v_points_into_level := v_lifetime_points - v_current_level_points;
  v_points_needed_for_next := v_next_level_points - v_current_level_points;

  IF v_points_needed_for_next > 0 THEN
    v_progress := LEAST(100, FLOOR((v_points_into_level::NUMERIC / v_points_needed_for_next) * 100));
  ELSE
    v_progress := 0;
  END IF;

  v_title := CASE
    WHEN v_level >= 99 THEN 'Legend'
    WHEN v_level >= 90 THEN 'Master'
    WHEN v_level >= 80 THEN 'Champion'
    WHEN v_level >= 70 THEN 'Expert'
    WHEN v_level >= 60 THEN 'Veteran'
    WHEN v_level >= 50 THEN 'Dedicated'
    WHEN v_level >= 40 THEN 'Committed'
    WHEN v_level >= 30 THEN 'Consistent'
    WHEN v_level >= 20 THEN 'Growing'
    WHEN v_level >= 10 THEN 'Rising'
    WHEN v_level >= 5 THEN 'Beginner'
    ELSE 'Newcomer'
  END;

  RETURN json_build_object(
    'level', v_level,
    'title', v_title,
    'current_level_points', v_current_level_points,
    'next_level_points', v_next_level_points,
    'points_into_level', v_points_into_level,
    'points_needed_for_next', v_points_needed_for_next,
    'progress', v_progress,
    'is_max_level', FALSE
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;
