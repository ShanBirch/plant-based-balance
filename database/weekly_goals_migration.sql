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
  points_awarded_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(user_id, week_start),
  CHECK (jsonb_typeof(selected_goals) = 'array'),
  CHECK (jsonb_array_length(selected_goals) <= 3)
);

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
