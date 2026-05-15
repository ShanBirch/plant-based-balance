-- Content Radar
--
-- Operator-side content feedback loop. Stores daily/on-demand runs that mine
-- recent IG/FB lead DMs, client DMs, client memory, and IG content reactions
-- into postable content themes for Shannon.
--
-- Safe to re-run.

CREATE TABLE IF NOT EXISTS public.content_radar_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coach_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    window_days INTEGER NOT NULL DEFAULT 30 CHECK (window_days BETWEEN 7 AND 90),
    status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('running', 'completed', 'failed')),
    summary TEXT,
    source_counts JSONB NOT NULL DEFAULT '{}'::JSONB,
    themes JSONB NOT NULL DEFAULT '[]'::JSONB,
    raw_model JSONB NOT NULL DEFAULT '{}'::JSONB,
    error TEXT,
    generated_by TEXT NOT NULL DEFAULT 'manual',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_content_radar_runs_coach_recent
    ON public.content_radar_runs (coach_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.content_radar_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID NOT NULL REFERENCES public.content_radar_runs(id) ON DELETE CASCADE,
    coach_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    rank INTEGER NOT NULL DEFAULT 0,
    idea_type TEXT NOT NULL DEFAULT 'reel' CHECK (idea_type IN (
        'reel',
        'story',
        'post',
        'carousel',
        'live',
        'email',
        'other'
    )),
    title TEXT NOT NULL,
    hook TEXT,
    angle TEXT,
    talking_points TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
    script TEXT,
    caption TEXT,
    cta TEXT,
    source_theme TEXT,
    source_mix TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
    evidence JSONB NOT NULL DEFAULT '[]'::JSONB,
    privacy_note TEXT,
    priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
    status TEXT NOT NULL DEFAULT 'idea' CHECK (status IN ('idea', 'saved', 'used', 'dismissed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_content_radar_items_run_rank
    ON public.content_radar_items (run_id, rank);

CREATE INDEX IF NOT EXISTS idx_content_radar_items_coach_status
    ON public.content_radar_items (coach_id, status, created_at DESC);

DROP TRIGGER IF EXISTS trg_content_radar_runs_updated_at ON public.content_radar_runs;
CREATE TRIGGER trg_content_radar_runs_updated_at
    BEFORE UPDATE ON public.content_radar_runs
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_content_radar_items_updated_at ON public.content_radar_items;
CREATE TRIGGER trg_content_radar_items_updated_at
    BEFORE UPDATE ON public.content_radar_items
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.content_radar_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_radar_items ENABLE ROW LEVEL SECURITY;

GRANT SELECT, UPDATE ON public.content_radar_runs TO authenticated;
GRANT SELECT, UPDATE ON public.content_radar_items TO authenticated;
GRANT ALL ON public.content_radar_runs TO service_role;
GRANT ALL ON public.content_radar_items TO service_role;

DROP POLICY IF EXISTS "Admins can read content radar runs" ON public.content_radar_runs;
CREATE POLICY "Admins can read content radar runs"
    ON public.content_radar_runs FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Admins can update content radar runs" ON public.content_radar_runs;
CREATE POLICY "Admins can update content radar runs"
    ON public.content_radar_runs FOR UPDATE
    USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()))
    WITH CHECK (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Admins can read content radar items" ON public.content_radar_items;
CREATE POLICY "Admins can read content radar items"
    ON public.content_radar_items FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Admins can update content radar items" ON public.content_radar_items;
CREATE POLICY "Admins can update content radar items"
    ON public.content_radar_items FOR UPDATE
    USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()))
    WITH CHECK (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()));

COMMENT ON TABLE public.content_radar_runs IS
    'Admin-only Content Radar generations from recent DMs, client memory, and IG content feedback.';

COMMENT ON TABLE public.content_radar_items IS
    'Ready-to-film/post content ideas with theme evidence and privacy-safe source notes.';
