-- Migration: Learning System
-- Purpose: Duolingo-style learning tab for fitness education
-- XP rewards integrated with existing leveling system
-- Created: February 2026

-- ============================================================
-- USER LEARNING PROGRESS TABLE
-- Tracks overall progress and daily limits
-- ============================================================

CREATE TABLE IF NOT EXISTS public.user_learning_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- Module progress (stored as JSON for flexibility)
  modules_completed TEXT[] DEFAULT '{}',
  units_completed TEXT[] DEFAULT '{}',
  lessons_completed TEXT[] DEFAULT '{}',

  -- Daily tracking
  lessons_today INTEGER DEFAULT 0,
  last_lesson_date DATE,

  -- Stats
  total_lessons_completed INTEGER DEFAULT 0,
  total_xp_from_learning INTEGER DEFAULT 0,
  current_learning_streak INTEGER DEFAULT 0,
  longest_learning_streak INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_learning_progress_user ON public.user_learning_progress(user_id);

-- ============================================================
-- LESSON COMPLETIONS TABLE
-- Detailed log of every lesson completion
-- ============================================================

CREATE TABLE IF NOT EXISTS public.lesson_completions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  lesson_id TEXT NOT NULL,
  unit_id TEXT NOT NULL,
  module_id TEXT NOT NULL,

  -- Game results
  games_played INTEGER DEFAULT 0,
  games_correct INTEGER DEFAULT 0,
  score_percentage INTEGER DEFAULT 0,

  -- XP awarded
  xp_earned INTEGER DEFAULT 0,

  completed_at TIMESTAMPTZ DEFAULT NOW(),

  -- Prevent duplicate completions on same day (can redo for practice, no XP)
  UNIQUE(user_id, lesson_id, (completed_at::DATE))
);

CREATE INDEX IF NOT EXISTS idx_lesson_completions_user ON public.lesson_completions(user_id, completed_at DESC);
CREATE INDEX IF NOT EXISTS idx_lesson_completions_lesson ON public.lesson_completions(lesson_id);

-- ============================================================
-- LEARNING MILESTONES TABLE
-- Track achievements like module completions, streaks
-- ============================================================

CREATE TABLE IF NOT EXISTS public.learning_milestones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  milestone_type TEXT NOT NULL, -- 'unit_complete', 'module_complete', 'streak_7', 'all_complete'
  milestone_id TEXT NOT NULL,   -- e.g., 'mind-1', 'body', 'streak_7'
  milestone_label TEXT,         -- Human readable label

  xp_awarded INTEGER DEFAULT 0,
  achieved_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, milestone_type, milestone_id)
);

CREATE INDEX IF NOT EXISTS idx_learning_milestones_user ON public.learning_milestones(user_id, achieved_at DESC);

-- ============================================================
-- ENABLE RLS
-- ============================================================

ALTER TABLE public.user_learning_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_milestones ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS POLICIES
-- ============================================================

-- User Learning Progress
CREATE POLICY "Users can view own learning progress" ON public.user_learning_progress
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own learning progress" ON public.user_learning_progress
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own learning progress" ON public.user_learning_progress
  FOR UPDATE USING (auth.uid() = user_id);

-- Lesson Completions
CREATE POLICY "Users can view own lesson completions" ON public.lesson_completions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own lesson completions" ON public.lesson_completions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Learning Milestones
CREATE POLICY "Users can view own learning milestones" ON public.learning_milestones
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own learning milestones" ON public.learning_milestones
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Friends can see learning milestones (social motivation)
CREATE POLICY "Users can view friends learning milestones" ON public.learning_milestones
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.friendships
      WHERE status = 'accepted'
        AND ((user_id = auth.uid() AND friend_id = learning_milestones.user_id)
          OR (friend_id = auth.uid() AND user_id = learning_milestones.user_id))
    )
  );

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- Get or create user learning progress
CREATE OR REPLACE FUNCTION get_or_create_learning_progress(p_user_id UUID)
RETURNS JSON AS $$
DECLARE
  result JSON;
  progress_record RECORD;
BEGIN
  -- Try to get existing progress
  SELECT * INTO progress_record
  FROM public.user_learning_progress
  WHERE user_id = p_user_id;

  -- Create if doesn't exist
  IF progress_record IS NULL THEN
    INSERT INTO public.user_learning_progress (user_id)
    VALUES (p_user_id)
    RETURNING * INTO progress_record;
  END IF;

  -- Reset daily count if new day
  IF progress_record.last_lesson_date IS NULL OR progress_record.last_lesson_date < CURRENT_DATE THEN
    UPDATE public.user_learning_progress
    SET lessons_today = 0,
        last_lesson_date = CURRENT_DATE,
        updated_at = NOW()
    WHERE user_id = p_user_id
    RETURNING * INTO progress_record;
  END IF;

  RETURN row_to_json(progress_record);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user can do more lessons today (daily limit: 3)
CREATE OR REPLACE FUNCTION can_do_lesson_today(p_user_id UUID)
RETURNS JSON AS $$
DECLARE
  progress_record RECORD;
  daily_limit INTEGER := 3;
BEGIN
  SELECT * INTO progress_record
  FROM public.user_learning_progress
  WHERE user_id = p_user_id;

  IF progress_record IS NULL THEN
    RETURN json_build_object(
      'can_learn', TRUE,
      'lessons_remaining', daily_limit,
      'lessons_done_today', 0
    );
  END IF;

  -- Reset count if new day
  IF progress_record.last_lesson_date IS NULL OR progress_record.last_lesson_date < CURRENT_DATE THEN
    RETURN json_build_object(
      'can_learn', TRUE,
      'lessons_remaining', daily_limit,
      'lessons_done_today', 0
    );
  END IF;

  RETURN json_build_object(
    'can_learn', progress_record.lessons_today < daily_limit,
    'lessons_remaining', GREATEST(0, daily_limit - progress_record.lessons_today),
    'lessons_done_today', progress_record.lessons_today
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Complete a lesson and award XP
CREATE OR REPLACE FUNCTION complete_lesson(
  p_user_id UUID,
  p_lesson_id TEXT,
  p_unit_id TEXT,
  p_module_id TEXT,
  p_games_played INTEGER,
  p_games_correct INTEGER
)
RETURNS JSON AS $$
DECLARE
  daily_limit INTEGER := 3;
  xp_per_lesson INTEGER := 1;
  progress_record RECORD;
  score_pct INTEGER;
  xp_earned INTEGER := 0;
  already_completed BOOLEAN;
  is_new_lesson BOOLEAN;
  result JSON;
BEGIN
  -- Calculate score percentage
  IF p_games_played > 0 THEN
    score_pct := ROUND((p_games_correct::NUMERIC / p_games_played) * 100);
  ELSE
    score_pct := 0;
  END IF;

  -- Get current progress
  SELECT * INTO progress_record
  FROM public.user_learning_progress
  WHERE user_id = p_user_id;

  -- Create progress record if doesn't exist
  IF progress_record IS NULL THEN
    INSERT INTO public.user_learning_progress (user_id, lessons_today)
    VALUES (p_user_id, 0)
    RETURNING * INTO progress_record;
  END IF;

  -- Reset daily count if new day
  IF progress_record.last_lesson_date IS NULL OR progress_record.last_lesson_date < CURRENT_DATE THEN
    UPDATE public.user_learning_progress
    SET lessons_today = 0,
        last_lesson_date = CURRENT_DATE,
        -- Update streak
        current_learning_streak = CASE
          WHEN progress_record.last_lesson_date = CURRENT_DATE - 1 THEN progress_record.current_learning_streak + 1
          ELSE 1
        END,
        longest_learning_streak = GREATEST(
          progress_record.longest_learning_streak,
          CASE
            WHEN progress_record.last_lesson_date = CURRENT_DATE - 1 THEN progress_record.current_learning_streak + 1
            ELSE 1
          END
        ),
        updated_at = NOW()
    WHERE user_id = p_user_id
    RETURNING * INTO progress_record;
  END IF;

  -- Check daily limit
  IF progress_record.lessons_today >= daily_limit THEN
    RETURN json_build_object(
      'success', FALSE,
      'error', 'daily_limit_reached',
      'message', 'You have reached your daily learning limit. Come back tomorrow!'
    );
  END IF;

  -- Check if lesson already completed with 100% score
  is_new_lesson := NOT (p_lesson_id = ANY(progress_record.lessons_completed));

  -- Award XP only when user gets 100% AND hasn't already earned XP for this lesson
  -- Users can retake quizzes to earn XP if they didn't get 100% before
  IF score_pct = 100 AND is_new_lesson THEN
    xp_earned := xp_per_lesson;
  END IF;

  -- Record the completion
  INSERT INTO public.lesson_completions (
    user_id, lesson_id, unit_id, module_id,
    games_played, games_correct, score_percentage, xp_earned
  )
  VALUES (
    p_user_id, p_lesson_id, p_unit_id, p_module_id,
    p_games_played, p_games_correct, score_pct, xp_earned
  )
  ON CONFLICT (user_id, lesson_id, (completed_at::DATE)) DO UPDATE
  SET games_played = EXCLUDED.games_played,
      games_correct = EXCLUDED.games_correct,
      score_percentage = EXCLUDED.score_percentage;

  -- Update progress
  -- Only mark lesson as completed when user gets 100% (so they can retake for XP)
  UPDATE public.user_learning_progress
  SET lessons_today = lessons_today + 1,
      total_lessons_completed = CASE WHEN is_new_lesson AND score_pct = 100 THEN total_lessons_completed + 1 ELSE total_lessons_completed END,
      total_xp_from_learning = total_xp_from_learning + xp_earned,
      lessons_completed = CASE
        WHEN is_new_lesson AND score_pct = 100 THEN array_append(lessons_completed, p_lesson_id)
        ELSE lessons_completed
      END,
      updated_at = NOW()
  WHERE user_id = p_user_id;

  -- Award XP to main points system if earned
  IF xp_earned > 0 THEN
    UPDATE public.user_points
    SET lifetime_points = lifetime_points + xp_earned,
        updated_at = NOW()
    WHERE user_id = p_user_id;

    -- Create if doesn't exist
    IF NOT FOUND THEN
      INSERT INTO public.user_points (user_id, lifetime_points)
      VALUES (p_user_id, xp_earned)
      ON CONFLICT (user_id) DO UPDATE
      SET lifetime_points = user_points.lifetime_points + xp_earned;
    END IF;
  END IF;

  RETURN json_build_object(
    'success', TRUE,
    'xp_earned', xp_earned,
    'is_new_lesson', is_new_lesson,
    'score_percentage', score_pct,
    'needs_perfect_score', score_pct < 100 AND is_new_lesson,
    'lessons_remaining_today', daily_limit - progress_record.lessons_today - 1,
    'current_streak', progress_record.current_learning_streak
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Complete a unit (called when all 5 lessons in a unit are done)
CREATE OR REPLACE FUNCTION complete_unit(
  p_user_id UUID,
  p_unit_id TEXT,
  p_module_id TEXT
)
RETURNS JSON AS $$
DECLARE
  xp_per_unit INTEGER := 2;
  already_completed BOOLEAN;
BEGIN
  -- Check if already completed
  SELECT p_unit_id = ANY(units_completed)
  INTO already_completed
  FROM public.user_learning_progress
  WHERE user_id = p_user_id;

  IF already_completed THEN
    RETURN json_build_object('success', TRUE, 'xp_earned', 0, 'already_completed', TRUE);
  END IF;

  -- Mark unit complete
  UPDATE public.user_learning_progress
  SET units_completed = array_append(units_completed, p_unit_id),
      total_xp_from_learning = total_xp_from_learning + xp_per_unit,
      updated_at = NOW()
  WHERE user_id = p_user_id;

  -- Record milestone
  INSERT INTO public.learning_milestones (user_id, milestone_type, milestone_id, xp_awarded)
  VALUES (p_user_id, 'unit_complete', p_unit_id, xp_per_unit)
  ON CONFLICT DO NOTHING;

  -- Award XP
  UPDATE public.user_points
  SET lifetime_points = lifetime_points + xp_per_unit
  WHERE user_id = p_user_id;

  RETURN json_build_object('success', TRUE, 'xp_earned', xp_per_unit, 'already_completed', FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Complete a module (called when all 5 units in a module are done)
CREATE OR REPLACE FUNCTION complete_module(
  p_user_id UUID,
  p_module_id TEXT
)
RETURNS JSON AS $$
DECLARE
  xp_per_module INTEGER := 5;
  already_completed BOOLEAN;
BEGIN
  -- Check if already completed
  SELECT p_module_id = ANY(modules_completed)
  INTO already_completed
  FROM public.user_learning_progress
  WHERE user_id = p_user_id;

  IF already_completed THEN
    RETURN json_build_object('success', TRUE, 'xp_earned', 0, 'already_completed', TRUE);
  END IF;

  -- Mark module complete
  UPDATE public.user_learning_progress
  SET modules_completed = array_append(modules_completed, p_module_id),
      total_xp_from_learning = total_xp_from_learning + xp_per_module,
      updated_at = NOW()
  WHERE user_id = p_user_id;

  -- Record milestone
  INSERT INTO public.learning_milestones (user_id, milestone_type, milestone_id, xp_awarded)
  VALUES (p_user_id, 'module_complete', p_module_id, xp_per_module)
  ON CONFLICT DO NOTHING;

  -- Award XP
  UPDATE public.user_points
  SET lifetime_points = lifetime_points + xp_per_module
  WHERE user_id = p_user_id;

  RETURN json_build_object('success', TRUE, 'xp_earned', xp_per_module, 'already_completed', FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get learning summary for display
CREATE OR REPLACE FUNCTION get_learning_summary(p_user_id UUID)
RETURNS JSON AS $$
DECLARE
  progress_record RECORD;
  daily_check JSON;
BEGIN
  SELECT * INTO progress_record
  FROM public.user_learning_progress
  WHERE user_id = p_user_id;

  daily_check := can_do_lesson_today(p_user_id);

  IF progress_record IS NULL THEN
    RETURN json_build_object(
      'total_lessons_completed', 0,
      'total_xp_from_learning', 0,
      'modules_completed', ARRAY[]::TEXT[],
      'units_completed', ARRAY[]::TEXT[],
      'lessons_completed', ARRAY[]::TEXT[],
      'current_streak', 0,
      'longest_streak', 0,
      'daily_status', daily_check
    );
  END IF;

  RETURN json_build_object(
    'total_lessons_completed', progress_record.total_lessons_completed,
    'total_xp_from_learning', progress_record.total_xp_from_learning,
    'modules_completed', progress_record.modules_completed,
    'units_completed', progress_record.units_completed,
    'lessons_completed', progress_record.lessons_completed,
    'current_streak', progress_record.current_learning_streak,
    'longest_streak', progress_record.longest_learning_streak,
    'daily_status', daily_check
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- GRANT PERMISSIONS
-- ============================================================

GRANT ALL ON public.user_learning_progress TO service_role;
GRANT ALL ON public.lesson_completions TO service_role;
GRANT ALL ON public.learning_milestones TO service_role;

GRANT SELECT, INSERT, UPDATE ON public.user_learning_progress TO authenticated;
GRANT SELECT, INSERT ON public.lesson_completions TO authenticated;
GRANT SELECT, INSERT ON public.learning_milestones TO authenticated;

GRANT EXECUTE ON FUNCTION get_or_create_learning_progress TO authenticated;
GRANT EXECUTE ON FUNCTION can_do_lesson_today TO authenticated;
GRANT EXECUTE ON FUNCTION complete_lesson TO authenticated;
GRANT EXECUTE ON FUNCTION complete_unit TO authenticated;
GRANT EXECUTE ON FUNCTION complete_module TO authenticated;
GRANT EXECUTE ON FUNCTION get_learning_summary TO authenticated;

GRANT EXECUTE ON FUNCTION get_or_create_learning_progress TO service_role;
GRANT EXECUTE ON FUNCTION can_do_lesson_today TO service_role;
GRANT EXECUTE ON FUNCTION complete_lesson TO service_role;
GRANT EXECUTE ON FUNCTION complete_unit TO service_role;
GRANT EXECUTE ON FUNCTION complete_module TO service_role;
GRANT EXECUTE ON FUNCTION get_learning_summary TO service_role;
