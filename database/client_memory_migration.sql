-- Client Memory Migration
--
-- Per-client relationship memory for coaches. Each (coach_id, client_id) pair
-- gets one row holding goals, communication style, running notes, injuries and
-- personal context. The draft functions (instant-coach-draft.js and
-- pb-celebration-draft.js) load this row and inject it into the Vertex prompt
-- so replies reference real history instead of generic 7-day activity.
--
-- Rows are maintained two ways:
--   1. Manual — Shannon edits in the admin-dashboard.html "Client notes" modal.
--   2. Auto — DB trigger fires extract-client-memory Netlify function every
--      time a coach_alert transitions from pending to sent; extracted facts
--      get appended/merged into the row.
--
-- Run via exec_sql RPC. Safe to re-run (idempotent CREATEs + ALTER).

-- 1. Table
CREATE TABLE IF NOT EXISTS public.client_memory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coach_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    goals TEXT,
    communication_style TEXT,
    running_notes TEXT,
    injuries_limits TEXT,
    personal_context TEXT,
    preferences JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (coach_id, client_id)
);

CREATE INDEX IF NOT EXISTS idx_client_memory_coach ON public.client_memory(coach_id);
CREATE INDEX IF NOT EXISTS idx_client_memory_client ON public.client_memory(client_id);

-- 2. updated_at trigger — reuse project-wide update_updated_at_column()
DROP TRIGGER IF EXISTS trg_client_memory_updated_at ON public.client_memory;
CREATE TRIGGER trg_client_memory_updated_at
    BEFORE UPDATE ON public.client_memory
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. RLS — mirrors coach_clients pattern (multi_coach_migration.sql)
ALTER TABLE public.client_memory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Coaches see own client memory" ON public.client_memory;
CREATE POLICY "Coaches see own client memory"
    ON public.client_memory FOR SELECT
    USING (
        coach_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.admin_users
            WHERE user_id = auth.uid() AND role = 'super_admin'
        )
    );

DROP POLICY IF EXISTS "Coaches manage own client memory" ON public.client_memory;
CREATE POLICY "Coaches manage own client memory"
    ON public.client_memory FOR ALL
    USING (coach_id = auth.uid())
    WITH CHECK (coach_id = auth.uid());

DROP POLICY IF EXISTS "Service role full access client memory" ON public.client_memory;
CREATE POLICY "Service role full access client memory"
    ON public.client_memory FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- 4. Grants (RLS gates reads/writes; grants are needed to reach the policies)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_memory TO authenticated;
GRANT ALL ON public.client_memory TO service_role;

-- Verify:
--   SELECT table_name FROM information_schema.tables WHERE table_name = 'client_memory';
--   SELECT tgname FROM pg_trigger WHERE tgname = 'trg_client_memory_updated_at';
--   SELECT polname FROM pg_policy WHERE polrelid = 'public.client_memory'::regclass;
