-- Shannon-only UI pilot for the Balance-to-Instagram social journey.
-- The table is ownership-scoped so the same storage contract can be rolled
-- out later without a schema rewrite. The app currently gates the UI to
-- Shannon's exact account.

CREATE TABLE IF NOT EXISTS public.social_journey_progress (
  user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  journey_version TEXT NOT NULL DEFAULT 'social_identity_v1',
  current_week SMALLINT NOT NULL DEFAULT 1
    CHECK (current_week BETWEEN 1 AND 12),
  week_started_at DATE NOT NULL DEFAULT ((NOW() AT TIME ZONE 'Australia/Brisbane')::DATE),
  onboarding_complete BOOLEAN NOT NULL DEFAULT FALSE,
  completed_task_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  progress_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  reminder_receipts JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT social_journey_completed_task_ids_array_check
    CHECK (jsonb_typeof(completed_task_ids) = 'array'),
  CONSTRAINT social_journey_progress_snapshot_object_check
    CHECK (jsonb_typeof(progress_snapshot) = 'object'),
  CONSTRAINT social_journey_settings_object_check
    CHECK (jsonb_typeof(settings) = 'object'),
  CONSTRAINT social_journey_reminder_receipts_array_check
    CHECK (jsonb_typeof(reminder_receipts) = 'array')
);

ALTER TABLE public.social_journey_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own social journey" ON public.social_journey_progress;
CREATE POLICY "Users can view their own social journey"
  ON public.social_journey_progress
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can start their own social journey" ON public.social_journey_progress;
CREATE POLICY "Users can start their own social journey"
  ON public.social_journey_progress
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own social journey" ON public.social_journey_progress;
CREATE POLICY "Users can update their own social journey"
  ON public.social_journey_progress
  FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

GRANT SELECT, INSERT, UPDATE ON public.social_journey_progress TO authenticated;
GRANT ALL ON public.social_journey_progress TO service_role;

DROP TRIGGER IF EXISTS update_social_journey_progress_updated_at ON public.social_journey_progress;
CREATE TRIGGER update_social_journey_progress_updated_at
  BEFORE UPDATE ON public.social_journey_progress
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.social_journey_progress IS
  'Account-owned progress for the optional Balance Feed to Instagram confidence journey. UI rollout is currently Shannon-only.';

NOTIFY pgrst, 'reload schema';
