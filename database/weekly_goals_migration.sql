-- ============================================================
-- WEEKLY GOALS
-- User-selected weekly commitments that feed the Home card and Weekly Wrapped.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.weekly_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- Monday-based week window. Sunday afternoon planning can create next Monday.
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,

  -- Up to 3 chosen goal objects from the client catalogue:
  -- [{ id, label, category, target, unit }]
  selected_goals JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Last calculated client snapshot for fast Home/Wrapped rendering.
  progress_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  arc_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,

  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'completed', 'archived')),
  completed_count INTEGER NOT NULL DEFAULT 0,
  total_count INTEGER NOT NULL DEFAULT 0,
  completion_rate NUMERIC(5,2) NOT NULL DEFAULT 0,

  points_awarded BOOLEAN NOT NULL DEFAULT FALSE,
  points_awarded_amount INTEGER NOT NULL DEFAULT 0,
  points_awarded_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(user_id, week_start),
  CONSTRAINT weekly_goals_selected_goals_array_check CHECK (jsonb_typeof(selected_goals) = 'array'),
  CONSTRAINT weekly_goals_selected_goals_max_check CHECK (jsonb_array_length(selected_goals) <= 3),
  CONSTRAINT weekly_goals_points_awarded_amount_check CHECK (points_awarded_amount >= 0 AND points_awarded_amount <= 50)
);

ALTER TABLE public.weekly_goals
  ADD COLUMN IF NOT EXISTS points_awarded_amount INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.weekly_goals
  DROP CONSTRAINT IF EXISTS weekly_goals_points_awarded_amount_check;

ALTER TABLE public.weekly_goals
  ADD CONSTRAINT weekly_goals_points_awarded_amount_check CHECK (points_awarded_amount >= 0 AND points_awarded_amount <= 50);

CREATE INDEX IF NOT EXISTS idx_weekly_goals_user_week
  ON public.weekly_goals(user_id, week_start DESC);

ALTER TABLE public.weekly_goals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own weekly goals" ON public.weekly_goals;
CREATE POLICY "Users can view own weekly goals" ON public.weekly_goals
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own weekly goals" ON public.weekly_goals;
CREATE POLICY "Users can insert own weekly goals" ON public.weekly_goals
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own weekly goals" ON public.weekly_goals;
CREATE POLICY "Users can update own weekly goals" ON public.weekly_goals
  FOR UPDATE USING (auth.uid() = user_id);

GRANT ALL ON public.weekly_goals TO authenticated;
GRANT ALL ON public.weekly_goals TO service_role;

DROP TRIGGER IF EXISTS update_weekly_goals_updated_at ON public.weekly_goals;
CREATE TRIGGER update_weekly_goals_updated_at
  BEFORE UPDATE ON public.weekly_goals
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.award_weekly_goal_points(p_week_start DATE)
RETURNS JSONB AS $$
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

  IF CURRENT_DATE < (p_week_start + 6) THEN
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
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION public.award_weekly_goal_points(DATE) TO authenticated;

-- Feed card posts already use card media types in the app. Make the schema
-- explicit and add meal_card for one-meal sharing from the meal detail popup.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.stories'::regclass
      AND conname = 'stories_media_type_check'
  ) THEN
    ALTER TABLE public.stories DROP CONSTRAINT stories_media_type_check;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.stories'::regclass
      AND conname = 'stories_media_type_check'
  ) THEN
    ALTER TABLE public.stories
      ADD CONSTRAINT stories_media_type_check
      CHECK (media_type IN (
        'image',
        'video',
        'workout_card',
        'nutrition_card',
        'meal_card',
        'level_up_card'
      ));
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
