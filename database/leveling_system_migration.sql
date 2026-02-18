-- Migration: Leveling System
-- Purpose: Add level calculation functions based on lifetime points
-- 99 levels total, takes ~10 months of daily use to max out
-- Created: January 2026

-- ============================================================
-- LEVEL CALCULATION FUNCTION
-- Mirrors the JS formula: points = 0.07 * level^2.4 + 0.7 * level
-- ============================================================

-- Calculate the points required to reach a given level
CREATE OR REPLACE FUNCTION get_points_for_level(p_level INTEGER)
RETURNS INTEGER AS $$
BEGIN
  IF p_level <= 1 THEN
    RETURN 0;
  END IF;
  -- Formula: 0.07 * level^2.4 + 0.7 * level
  RETURN FLOOR(0.07 * POWER(p_level::NUMERIC, 2.4) + 0.7 * p_level);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Calculate user's current level from their lifetime points
CREATE OR REPLACE FUNCTION calculate_user_level(p_lifetime_points INTEGER)
RETURNS JSON AS $$
DECLARE
  v_level INTEGER := 1;
  v_max_level INTEGER := 99;
  v_points_needed INTEGER;
  v_current_level_points INTEGER;
  v_next_level_points INTEGER;
  v_points_into_level INTEGER;
  v_points_needed_for_next INTEGER;
  v_progress INTEGER;
  v_title TEXT;
BEGIN
  -- Find the highest level the user has reached
  WHILE v_level < v_max_level LOOP
    v_points_needed := get_points_for_level(v_level + 1);
    IF p_lifetime_points < v_points_needed THEN
      EXIT;
    END IF;
    v_level := v_level + 1;
  END LOOP;

  v_current_level_points := get_points_for_level(v_level);

  IF v_level < v_max_level THEN
    v_next_level_points := get_points_for_level(v_level + 1);
  ELSE
    v_next_level_points := v_current_level_points;
  END IF;

  -- Calculate progress to next level
  v_points_into_level := p_lifetime_points - v_current_level_points;
  v_points_needed_for_next := v_next_level_points - v_current_level_points;

  IF v_level >= v_max_level THEN
    v_progress := 100;
  ELSIF v_points_needed_for_next > 0 THEN
    v_progress := LEAST(100, FLOOR((v_points_into_level::NUMERIC / v_points_needed_for_next) * 100));
  ELSE
    v_progress := 0;
  END IF;

  -- Get level title
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
    'is_max_level', v_level >= v_max_level
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================
-- LEVEL MILESTONES TABLE
-- Track level-up achievements for history and potential rewards
-- ============================================================
CREATE TABLE IF NOT EXISTS public.level_milestones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  level_reached INTEGER NOT NULL,
  title_earned TEXT NOT NULL,
  lifetime_points_at_unlock INTEGER NOT NULL,

  achieved_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, level_reached)
);

CREATE INDEX IF NOT EXISTS idx_level_milestones_user ON public.level_milestones(user_id, achieved_at DESC);

-- Enable RLS
ALTER TABLE public.level_milestones ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own level milestones" ON public.level_milestones
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own level milestones" ON public.level_milestones
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Allow users to view friends' level milestones (for social features)
CREATE POLICY "Users can view friends level milestones" ON public.level_milestones
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.friendships
      WHERE status = 'accepted'
        AND ((user_id = auth.uid() AND friend_id = level_milestones.user_id)
          OR (friend_id = auth.uid() AND user_id = level_milestones.user_id))
    )
  );

-- ============================================================
-- UPDATED POINTS SUMMARY FUNCTION (includes level data)
-- ============================================================
CREATE OR REPLACE FUNCTION get_user_points_summary(p_user_id UUID)
RETURNS JSON AS $$
DECLARE
  result JSON;
  points_data RECORD;
  level_data JSON;
BEGIN
  SELECT
    COALESCE(current_points, 0) as current_points,
    COALESCE(lifetime_points, 0) as lifetime_points,
    COALESCE(redeemed_points, 0) as redeemed_points,
    COALESCE(current_streak, 0) as current_streak,
    COALESCE(longest_streak, 0) as longest_streak,
    COALESCE(meal_streak, 0) as meal_streak,
    COALESCE(workout_streak, 0) as workout_streak,
    COALESCE(total_meals_logged, 0) as total_meals_logged,
    COALESCE(total_workouts_logged, 0) as total_workouts_logged,
    COALESCE(weeks_redeemed, 0) as weeks_redeemed,
    last_post_date
  INTO points_data
  FROM public.user_points
  WHERE user_id = p_user_id;

  -- Calculate level from lifetime points
  IF points_data IS NOT NULL THEN
    level_data := calculate_user_level(points_data.lifetime_points);

    result := json_build_object(
      'current_points', points_data.current_points,
      'lifetime_points', points_data.lifetime_points,
      'redeemed_points', points_data.redeemed_points,
      'current_streak', points_data.current_streak,
      'longest_streak', points_data.longest_streak,
      'meal_streak', points_data.meal_streak,
      'workout_streak', points_data.workout_streak,
      'total_meals_logged', points_data.total_meals_logged,
      'total_workouts_logged', points_data.total_workouts_logged,
      'weeks_redeemed', points_data.weeks_redeemed,
      'last_post_date', points_data.last_post_date,
      'level', level_data
    );
  ELSE
    -- Return default values with level 1
    level_data := calculate_user_level(0);
    result := json_build_object(
      'current_points', 0,
      'lifetime_points', 0,
      'redeemed_points', 0,
      'current_streak', 0,
      'longest_streak', 0,
      'meal_streak', 0,
      'workout_streak', 0,
      'total_meals_logged', 0,
      'total_workouts_logged', 0,
      'weeks_redeemed', 0,
      'last_post_date', NULL,
      'level', level_data
    );
  END IF;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- FUNCTION: Record level milestone
-- Called when user levels up to track achievement
-- ============================================================
CREATE OR REPLACE FUNCTION record_level_milestone(
  p_user_id UUID,
  p_level INTEGER,
  p_title TEXT,
  p_lifetime_points INTEGER
)
RETURNS BOOLEAN AS $$
BEGIN
  INSERT INTO public.level_milestones (user_id, level_reached, title_earned, lifetime_points_at_unlock)
  VALUES (p_user_id, p_level, p_title, p_lifetime_points)
  ON CONFLICT (user_id, level_reached) DO NOTHING;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- GRANT PERMISSIONS
-- ============================================================
GRANT ALL ON public.level_milestones TO service_role;
GRANT EXECUTE ON FUNCTION get_points_for_level TO service_role;
GRANT EXECUTE ON FUNCTION calculate_user_level TO service_role;
GRANT EXECUTE ON FUNCTION record_level_milestone TO service_role;

-- Also grant to authenticated users for client-side calculations
GRANT EXECUTE ON FUNCTION get_points_for_level TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_user_level TO authenticated;
