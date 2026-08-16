CREATE TABLE public.ig_story_viewer_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ig_account TEXT NOT NULL DEFAULT 'shan_n_sunny',
    run_id TEXT NOT NULL,
    story_id TEXT NOT NULL,
    story_url TEXT,
    story_published_at TIMESTAMPTZ,
    observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    viewer_badge_count INTEGER CHECK (viewer_badge_count IS NULL OR viewer_badge_count >= 0),
    captured_viewer_count INTEGER NOT NULL DEFAULT 0 CHECK (captured_viewer_count >= 0),
    is_complete BOOLEAN NOT NULL DEFAULT FALSE,
    boundary_evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
    viewer_set_hash TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (ig_account, run_id, story_id)
);

CREATE TABLE public.ig_story_viewer_observations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    snapshot_id UUID NOT NULL REFERENCES public.ig_story_viewer_snapshots(id) ON DELETE CASCADE,
    ig_account TEXT NOT NULL,
    story_id TEXT NOT NULL,
    viewer_username TEXT NOT NULL,
    viewer_position INTEGER CHECK (viewer_position IS NULL OR viewer_position > 0),
    observed_at TIMESTAMPTZ NOT NULL,
    viewer_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (snapshot_id, viewer_username),
    CHECK (viewer_username = lower(viewer_username)),
    CHECK (viewer_username ~ '^[a-z0-9._]{1,30}$')
);

CREATE INDEX idx_ig_story_viewer_snapshots_observed
    ON public.ig_story_viewer_snapshots (ig_account, observed_at DESC);
CREATE INDEX idx_ig_story_viewer_observations_rank
    ON public.ig_story_viewer_observations (ig_account, viewer_username, observed_at DESC);
CREATE INDEX idx_ig_story_viewer_observations_story
    ON public.ig_story_viewer_observations (ig_account, story_id);

ALTER TABLE public.ig_story_viewer_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ig_story_viewer_observations ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.ig_story_viewer_snapshots FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.ig_story_viewer_observations FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ig_story_viewer_snapshots TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ig_story_viewer_observations TO service_role;

CREATE OR REPLACE FUNCTION public.record_ig_story_viewer_snapshot(
    p_run_id TEXT,
    p_story_id TEXT,
    p_viewers JSONB,
    p_story_url TEXT DEFAULT NULL,
    p_story_published_at TIMESTAMPTZ DEFAULT NULL,
    p_observed_at TIMESTAMPTZ DEFAULT NOW(),
    p_viewer_badge_count INTEGER DEFAULT NULL,
    p_is_complete BOOLEAN DEFAULT FALSE,
    p_boundary_evidence JSONB DEFAULT '{}'::jsonb,
    p_ig_account TEXT DEFAULT 'shan_n_sunny'
)
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    WITH validated AS (
        SELECT
            lower(trim(coalesce(nullif(p_ig_account, ''), 'shan_n_sunny'))) AS ig_account,
            nullif(trim(p_run_id), '') AS run_id,
            nullif(trim(p_story_id), '') AS story_id,
            CASE
                WHEN jsonb_typeof(p_viewers) = 'array' AND jsonb_array_length(p_viewers) <= 10000 THEN p_viewers
                ELSE NULL
            END AS viewers
    ), normalized_input AS (
        SELECT DISTINCT ON (viewer_username)
            lower(trim(CASE WHEN jsonb_typeof(item) = 'string' THEN item #>> '{}' ELSE item ->> 'username' END)) AS viewer_username,
            ordinality::INTEGER AS viewer_position,
            CASE WHEN jsonb_typeof(item) = 'object' THEN item ELSE '{}'::jsonb END AS viewer_data
        FROM validated v
        CROSS JOIN LATERAL jsonb_array_elements(v.viewers) WITH ORDINALITY AS viewer(item, ordinality)
        WHERE v.run_id IS NOT NULL AND v.story_id IS NOT NULL AND v.viewers IS NOT NULL
          AND lower(trim(CASE WHEN jsonb_typeof(item) = 'string' THEN item #>> '{}' ELSE item ->> 'username' END))
              ~ '^[a-z0-9._]{1,30}$'
        ORDER BY viewer_username, ordinality
    ), metrics AS (
        SELECT
            count(*)::INTEGER AS captured_count,
            md5(string_agg(viewer_username, ',' ORDER BY viewer_username)) AS viewer_set_hash
        FROM normalized_input
    ), snapshot AS (
        INSERT INTO public.ig_story_viewer_snapshots (
            ig_account, run_id, story_id, story_url, story_published_at, observed_at,
            viewer_badge_count, captured_viewer_count, is_complete, boundary_evidence,
            viewer_set_hash, updated_at
        )
        SELECT
            ig_account, run_id, story_id, nullif(trim(p_story_url), ''),
            p_story_published_at, coalesce(p_observed_at, NOW()), p_viewer_badge_count,
            m.captured_count, coalesce(p_is_complete, FALSE),
            coalesce(p_boundary_evidence, '{}'::jsonb), m.viewer_set_hash, NOW()
        FROM validated CROSS JOIN metrics m
        WHERE run_id IS NOT NULL AND story_id IS NOT NULL AND viewers IS NOT NULL
          AND (p_viewer_badge_count IS NULL OR p_viewer_badge_count >= 0)
        ON CONFLICT (ig_account, run_id, story_id) DO UPDATE SET
            story_url = EXCLUDED.story_url,
            story_published_at = EXCLUDED.story_published_at,
            observed_at = EXCLUDED.observed_at,
            viewer_badge_count = EXCLUDED.viewer_badge_count,
            captured_viewer_count = EXCLUDED.captured_viewer_count,
            is_complete = EXCLUDED.is_complete,
            boundary_evidence = EXCLUDED.boundary_evidence,
            viewer_set_hash = EXCLUDED.viewer_set_hash,
            updated_at = NOW()
        RETURNING id, ig_account, story_id, observed_at, captured_viewer_count,
                  viewer_badge_count, is_complete, viewer_set_hash
    ), normalized AS (
        SELECT
            s.id AS snapshot_id, s.ig_account, s.story_id, s.observed_at,
            n.viewer_username, n.viewer_position, n.viewer_data
        FROM snapshot s
        CROSS JOIN normalized_input n
    ), removed_stale AS (
        DELETE FROM public.ig_story_viewer_observations o
        USING snapshot s
        WHERE o.snapshot_id = s.id
          AND NOT EXISTS (SELECT 1 FROM normalized n WHERE n.viewer_username = o.viewer_username)
        RETURNING o.id
    ), stored AS (
        INSERT INTO public.ig_story_viewer_observations (
            snapshot_id, ig_account, story_id, viewer_username, viewer_position,
            observed_at, viewer_data
        )
        SELECT snapshot_id, ig_account, story_id, viewer_username, viewer_position, observed_at, viewer_data
        FROM normalized
        ON CONFLICT (snapshot_id, viewer_username) DO UPDATE SET
            viewer_position = EXCLUDED.viewer_position,
            observed_at = EXCLUDED.observed_at,
            viewer_data = EXCLUDED.viewer_data
        RETURNING snapshot_id, viewer_username
    )
    SELECT jsonb_build_object(
        'snapshot_id', id,
        'captured_viewer_count', captured_viewer_count,
        'viewer_badge_count', viewer_badge_count,
        'is_complete', is_complete,
        'viewer_set_hash', viewer_set_hash
    )
    FROM snapshot
$$;

REVOKE ALL ON FUNCTION public.record_ig_story_viewer_snapshot(
    TEXT, TEXT, JSONB, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, INTEGER, BOOLEAN, JSONB, TEXT
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_ig_story_viewer_snapshot(
    TEXT, TEXT, JSONB, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, INTEGER, BOOLEAN, JSONB, TEXT
) TO service_role;

CREATE OR REPLACE FUNCTION public.get_ig_story_viewer_rankings(
    p_days INTEGER DEFAULT 30,
    p_limit INTEGER DEFAULT 50,
    p_ig_account TEXT DEFAULT 'shan_n_sunny'
)
RETURNS TABLE (
    viewer_username TEXT,
    stories_viewed BIGINT,
    total_complete_stories BIGINT,
    view_rate NUMERIC,
    snapshot_appearances BIGINT,
    first_observed_at TIMESTAMPTZ,
    last_observed_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    WITH eligible_snapshots AS (
        SELECT id, story_id, observed_at
        FROM public.ig_story_viewer_snapshots
        WHERE ig_account = lower(trim(coalesce(nullif(p_ig_account, ''), 'shan_n_sunny')))
          AND is_complete = TRUE
          AND observed_at >= NOW() - make_interval(days => greatest(1, least(coalesce(p_days, 30), 3650)))
    ), totals AS (
        SELECT count(DISTINCT story_id)::BIGINT AS total_complete_stories
        FROM eligible_snapshots
    )
    SELECT
        o.viewer_username,
        count(DISTINCT s.story_id)::BIGINT AS stories_viewed,
        t.total_complete_stories,
        CASE WHEN t.total_complete_stories = 0 THEN 0
             ELSE round(count(DISTINCT s.story_id)::NUMERIC / t.total_complete_stories, 4)
        END AS view_rate,
        count(*)::BIGINT AS snapshot_appearances,
        min(o.observed_at) AS first_observed_at,
        max(o.observed_at) AS last_observed_at
    FROM eligible_snapshots s
    JOIN public.ig_story_viewer_observations o ON o.snapshot_id = s.id
    CROSS JOIN totals t
    GROUP BY o.viewer_username, t.total_complete_stories
    ORDER BY stories_viewed DESC, last_observed_at DESC, o.viewer_username
    LIMIT greatest(1, least(coalesce(p_limit, 50), 500))
$$;

REVOKE ALL ON FUNCTION public.get_ig_story_viewer_rankings(INTEGER, INTEGER, TEXT)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_ig_story_viewer_rankings(INTEGER, INTEGER, TEXT)
    TO service_role;

COMMENT ON TABLE public.ig_story_viewer_snapshots IS
    'Complete or partial native Instagram Story viewer-list snapshots captured by the browser dispatcher.';
COMMENT ON TABLE public.ig_story_viewer_observations IS
    'One normalized Instagram username per captured Story viewer snapshot; internal service-role data only.';
COMMENT ON FUNCTION public.record_ig_story_viewer_snapshot(
    TEXT, TEXT, JSONB, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, INTEGER, BOOLEAN, JSONB, TEXT
) IS 'Idempotently records one native Instagram Story viewer snapshot and its ordered viewer identities.';
COMMENT ON FUNCTION public.get_ig_story_viewer_rankings(INTEGER, INTEGER, TEXT)
IS 'Ranks viewers using distinct Stories from complete snapshots only, preventing partial-list and repeat-scan inflation.';
