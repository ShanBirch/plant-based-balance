-- Per-user overrides for shared/prebuilt workout templates.
-- Removing an exercise stores it here for that user/workout key only; it does
-- not mutate the base workout library used by everyone else.

CREATE TABLE IF NOT EXISTS public.workout_customizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  workout_key TEXT NOT NULL,
  added_exercises JSONB NOT NULL DEFAULT '[]'::jsonb,
  removed_exercises JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT workout_customizations_user_workout_key UNIQUE (user_id, workout_key),
  CONSTRAINT workout_customizations_added_is_array CHECK (jsonb_typeof(added_exercises) = 'array'),
  CONSTRAINT workout_customizations_removed_is_array CHECK (jsonb_typeof(removed_exercises) = 'array')
);

CREATE INDEX IF NOT EXISTS idx_workout_customizations_user
  ON public.workout_customizations(user_id);

CREATE INDEX IF NOT EXISTS idx_workout_customizations_workout_key
  ON public.workout_customizations(workout_key);

ALTER TABLE public.workout_customizations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own workout customizations"
  ON public.workout_customizations;
CREATE POLICY "Users can view own workout customizations"
  ON public.workout_customizations
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own workout customizations"
  ON public.workout_customizations;
CREATE POLICY "Users can insert own workout customizations"
  ON public.workout_customizations
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own workout customizations"
  ON public.workout_customizations;
CREATE POLICY "Users can update own workout customizations"
  ON public.workout_customizations
  FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete own workout customizations"
  ON public.workout_customizations;
CREATE POLICY "Users can delete own workout customizations"
  ON public.workout_customizations
  FOR DELETE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.workout_customizations TO authenticated;

CREATE OR REPLACE TRIGGER update_workout_customizations_updated_at
  BEFORE UPDATE ON public.workout_customizations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.workout_customizations IS
  'Per-user added and removed exercise overrides for shared workout templates.';
