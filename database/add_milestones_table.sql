-- Migration: Add workout milestones table for progress tracking
-- Purpose: Track user workout milestones (first workout, 5th, 10th, etc.)

-- ============================================================
-- WORKOUT MILESTONES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.workout_milestones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- Milestone info
  milestone_type TEXT NOT NULL, -- 'first_workout', '5_workouts', '10_workouts', '25_workouts', '50_workouts', '100_workouts', 'weekly_streak', 'monthly_streak', 'pr_weight', 'pr_reps'
  milestone_value INTEGER, -- e.g., 5, 10, 25 (workout count) or streak days

  -- Exercise specific (for PRs)
  exercise_name TEXT,
  achievement_data JSONB, -- Additional data like weight lifted, reps achieved, etc.

  -- Timestamps
  achieved_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  INDEX idx_milestones_user_type (user_id, milestone_type, achieved_at DESC)
);

-- Enable RLS
ALTER TABLE public.workout_milestones ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own milestones" ON public.workout_milestones
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own milestones" ON public.workout_milestones
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all milestones" ON public.workout_milestones
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE admin_users.user_id = auth.uid()
    )
  );

-- ============================================================
-- HELPER FUNCTION: Get total workout count for a user
-- ============================================================
CREATE OR REPLACE FUNCTION get_user_workout_count(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  workout_count INTEGER;
BEGIN
  SELECT COUNT(DISTINCT workout_date) INTO workout_count
  FROM public.workouts
  WHERE user_id = p_user_id
    AND workout_type = 'history'
    AND workout_date IS NOT NULL;

  RETURN COALESCE(workout_count, 0);
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- HELPER FUNCTION: Check if milestone already achieved
-- ============================================================
CREATE OR REPLACE FUNCTION milestone_already_achieved(
  p_user_id UUID,
  p_milestone_type TEXT,
  p_milestone_value INTEGER DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  milestone_exists BOOLEAN;
BEGIN
  IF p_milestone_value IS NULL THEN
    SELECT EXISTS(
      SELECT 1 FROM public.workout_milestones
      WHERE user_id = p_user_id
        AND milestone_type = p_milestone_type
    ) INTO milestone_exists;
  ELSE
    SELECT EXISTS(
      SELECT 1 FROM public.workout_milestones
      WHERE user_id = p_user_id
        AND milestone_type = p_milestone_type
        AND milestone_value = p_milestone_value
    ) INTO milestone_exists;
  END IF;

  RETURN milestone_exists;
END;
$$ LANGUAGE plpgsql;
