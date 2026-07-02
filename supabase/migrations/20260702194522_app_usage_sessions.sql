-- Real foreground time spent in the Balance app.
-- One row represents one browser/native app session and accumulates visible active seconds.

CREATE TABLE IF NOT EXISTS public.app_usage_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  active_seconds INTEGER NOT NULL DEFAULT 0 CHECK (active_seconds >= 0 AND active_seconds <= 86400),
  page_path TEXT,
  app_surface TEXT NOT NULL DEFAULT 'dashboard',
  source TEXT NOT NULL DEFAULT 'auth_guard',
  device JSONB NOT NULL DEFAULT '{}'::jsonb,
  viewport JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, session_id)
);

CREATE INDEX IF NOT EXISTS idx_app_usage_sessions_user_started
  ON public.app_usage_sessions(user_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_app_usage_sessions_user_last_seen
  ON public.app_usage_sessions(user_id, last_seen_at DESC);

CREATE INDEX IF NOT EXISTS idx_app_usage_sessions_started
  ON public.app_usage_sessions(started_at DESC);

CREATE INDEX IF NOT EXISTS idx_app_usage_sessions_active_seconds
  ON public.app_usage_sessions(active_seconds);

GRANT SELECT, INSERT, UPDATE ON TABLE public.app_usage_sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.app_usage_sessions TO service_role;

ALTER TABLE public.app_usage_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own app usage sessions" ON public.app_usage_sessions;
CREATE POLICY "Users can view own app usage sessions"
  ON public.app_usage_sessions
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own app usage sessions" ON public.app_usage_sessions;
CREATE POLICY "Users can insert own app usage sessions"
  ON public.app_usage_sessions
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own app usage sessions" ON public.app_usage_sessions;
CREATE POLICY "Users can update own app usage sessions"
  ON public.app_usage_sessions
  FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Admins can view all app usage sessions" ON public.app_usage_sessions;
CREATE POLICY "Admins can view all app usage sessions"
  ON public.app_usage_sessions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.admin_users au
      WHERE au.user_id = (SELECT auth.uid())
    )
  );

DROP TRIGGER IF EXISTS update_app_usage_sessions_updated_at ON public.app_usage_sessions;
CREATE TRIGGER update_app_usage_sessions_updated_at
  BEFORE UPDATE ON public.app_usage_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.app_usage_sessions IS 'Foreground app usage sessions for measuring real time spent in Balance.';
COMMENT ON COLUMN public.app_usage_sessions.active_seconds IS 'Accumulated seconds while the app was visible/foregrounded. Background/sleep gaps are capped client-side.';
