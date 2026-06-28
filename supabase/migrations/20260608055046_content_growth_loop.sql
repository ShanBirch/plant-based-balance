-- Cross-platform content growth loop.
--
-- Stores owned platform posts and metric snapshots so content automation can
-- learn from Instagram, YouTube, and TikTok without needing a dashboard.

CREATE TABLE IF NOT EXISTS public.content_platform_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_key TEXT NOT NULL UNIQUE,
    platform TEXT NOT NULL CHECK (platform IN ('instagram', 'youtube', 'tiktok')),
    platform_post_id TEXT NOT NULL,
    platform_permalink TEXT,
    content_item_id UUID,
    content_lane TEXT NOT NULL DEFAULT 'unknown' CHECK (content_lane IN (
        'exercise',
        'science',
        'proof',
        'story',
        'other',
        'unknown'
    )),
    source_id TEXT,
    title TEXT,
    caption TEXT,
    asset_url TEXT,
    thumbnail_url TEXT,
    posted_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN (
        'draft',
        'posted',
        'active',
        'private',
        'deleted',
        'failed'
    )),
    metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
    last_metrics_at TIMESTAMPTZ,
    next_metrics_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (platform, platform_post_id)
);

CREATE INDEX IF NOT EXISTS idx_content_platform_posts_due
    ON public.content_platform_posts (next_metrics_at ASC NULLS FIRST, platform, posted_at DESC NULLS LAST)
    WHERE status IN ('posted', 'active', 'private');

CREATE INDEX IF NOT EXISTS idx_content_platform_posts_lane_posted
    ON public.content_platform_posts (content_lane, posted_at DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_content_platform_posts_content_item
    ON public.content_platform_posts (content_item_id)
    WHERE content_item_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.content_metric_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    platform_post_id UUID NOT NULL REFERENCES public.content_platform_posts(id) ON DELETE CASCADE,
    platform TEXT NOT NULL CHECK (platform IN ('instagram', 'youtube', 'tiktok')),
    snapshot_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    views INTEGER NOT NULL DEFAULT 0,
    reach INTEGER,
    impressions INTEGER,
    likes INTEGER NOT NULL DEFAULT 0,
    comments INTEGER NOT NULL DEFAULT 0,
    shares INTEGER NOT NULL DEFAULT 0,
    saves INTEGER NOT NULL DEFAULT 0,
    follows_gained INTEGER NOT NULL DEFAULT 0,
    subscribers_gained INTEGER NOT NULL DEFAULT 0,
    watch_time_minutes NUMERIC,
    average_view_duration_seconds NUMERIC,
    average_view_percentage NUMERIC,
    engagement_score NUMERIC NOT NULL DEFAULT 0,
    raw_metrics JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_content_metric_snapshots_post_recent
    ON public.content_metric_snapshots (platform_post_id, snapshot_at DESC);

CREATE INDEX IF NOT EXISTS idx_content_metric_snapshots_platform_recent
    ON public.content_metric_snapshots (platform, snapshot_at DESC);

CREATE TABLE IF NOT EXISTS public.content_growth_briefs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    window_hours INTEGER NOT NULL DEFAULT 168,
    status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'partial', 'failed')),
    summary TEXT NOT NULL DEFAULT '',
    recommendations JSONB NOT NULL DEFAULT '[]'::JSONB,
    winners JSONB NOT NULL DEFAULT '[]'::JSONB,
    platform_notes JSONB NOT NULL DEFAULT '{}'::JSONB,
    raw_metrics JSONB NOT NULL DEFAULT '{}'::JSONB,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_content_growth_briefs_generated
    ON public.content_growth_briefs (generated_at DESC);

DROP TRIGGER IF EXISTS trg_content_platform_posts_updated_at ON public.content_platform_posts;
CREATE TRIGGER trg_content_platform_posts_updated_at
    BEFORE UPDATE ON public.content_platform_posts
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.content_platform_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_metric_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_growth_briefs ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.content_platform_posts TO authenticated;
GRANT SELECT ON public.content_metric_snapshots TO authenticated;
GRANT SELECT ON public.content_growth_briefs TO authenticated;
GRANT ALL ON public.content_platform_posts TO service_role;
GRANT ALL ON public.content_metric_snapshots TO service_role;
GRANT ALL ON public.content_growth_briefs TO service_role;

DROP POLICY IF EXISTS "Admins can read content platform posts" ON public.content_platform_posts;
CREATE POLICY "Admins can read content platform posts"
    ON public.content_platform_posts FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Admins can read content metric snapshots" ON public.content_metric_snapshots;
CREATE POLICY "Admins can read content metric snapshots"
    ON public.content_metric_snapshots FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Admins can read content growth briefs" ON public.content_growth_briefs;
CREATE POLICY "Admins can read content growth briefs"
    ON public.content_growth_briefs FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()));

COMMENT ON TABLE public.content_platform_posts IS
    'Owned social posts across Instagram, YouTube, and TikTok that Balance should track for growth feedback.';

COMMENT ON TABLE public.content_metric_snapshots IS
    'Time-series metric snapshots for owned social posts, collected by the content growth scanner.';

COMMENT ON TABLE public.content_growth_briefs IS
    'Compact operator briefs summarising content performance and next creative moves for the daily automation.';
