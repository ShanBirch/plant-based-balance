-- Raw media inbox for Shannon's private IG Operator.
--
-- Admin uploads from the dashboard land here first, then the operator can turn
-- them into story/post/reel plans before anything is published.

CREATE TABLE IF NOT EXISTS public.ig_operator_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_user_id UUID,
    source TEXT NOT NULL DEFAULT 'admin_upload',
    status TEXT NOT NULL DEFAULT 'raw' CHECK (status IN (
        'raw',
        'planned',
        'approved',
        'posted',
        'archived',
        'rejected'
    )),
    media_type TEXT NOT NULL DEFAULT 'unknown' CHECK (media_type IN (
        'image',
        'video',
        'unknown'
    )),
    content_type TEXT,
    original_filename TEXT,
    storage_provider TEXT NOT NULL DEFAULT 'backblaze_b2',
    storage_key TEXT,
    storage_file_id TEXT,
    media_url TEXT NOT NULL,
    thumbnail_url TEXT,
    size_bytes BIGINT,
    operator_notes TEXT,
    ai_tags TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
    metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ig_operator_assets_status_created
    ON public.ig_operator_assets (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ig_operator_assets_admin_created
    ON public.ig_operator_assets (admin_user_id, created_at DESC)
    WHERE admin_user_id IS NOT NULL;

DROP TRIGGER IF EXISTS trg_ig_operator_assets_updated_at ON public.ig_operator_assets;
CREATE TRIGGER trg_ig_operator_assets_updated_at
    BEFORE UPDATE ON public.ig_operator_assets
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.ig_operator_assets ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ig_operator_assets TO authenticated;
GRANT ALL ON public.ig_operator_assets TO service_role;

DROP POLICY IF EXISTS "Admins can manage IG operator assets" ON public.ig_operator_assets;
CREATE POLICY "Admins can manage IG operator assets"
    ON public.ig_operator_assets
    FOR ALL
    USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()))
    WITH CHECK (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()));

COMMENT ON TABLE public.ig_operator_assets IS
    'Private IG Operator raw photo/video inbox for Shannon before content planning or publishing.';
