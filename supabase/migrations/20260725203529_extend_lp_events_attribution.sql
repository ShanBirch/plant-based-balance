-- Extend first-party landing-page events into a durable campaign funnel log.
ALTER TABLE public.lp_events
    ADD COLUMN IF NOT EXISTS event_id TEXT,
    ADD COLUMN IF NOT EXISTS visitor_id TEXT,
    ADD COLUMN IF NOT EXISTS page_variant TEXT,
    ADD COLUMN IF NOT EXISTS page_url TEXT,
    ADD COLUMN IF NOT EXISTS utm_term TEXT,
    ADD COLUMN IF NOT EXISTS utm_content TEXT,
    ADD COLUMN IF NOT EXISTS fbclid TEXT,
    ADD COLUMN IF NOT EXISTS fbc TEXT,
    ADD COLUMN IF NOT EXISTS fbp TEXT,
    ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS idx_lp_events_event_id
    ON public.lp_events (event_id)
    WHERE event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lp_events_visitor_created
    ON public.lp_events (visitor_id, created_at DESC)
    WHERE visitor_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lp_events_variant_created
    ON public.lp_events (page_variant, created_at DESC)
    WHERE page_variant IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lp_events_campaign_content_created
    ON public.lp_events (utm_campaign, utm_content, created_at DESC);

ALTER TABLE public.lp_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.lp_events FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.lp_events TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.lp_events_id_seq TO service_role;

COMMENT ON COLUMN public.lp_events.visitor_id IS
'First-party browser identifier used to connect landing sessions before signup.';
COMMENT ON COLUMN public.lp_events.page_variant IS
'Experiment route or message variant, such as plant_based_control or broad_pain.';
COMMENT ON COLUMN public.lp_events.metadata IS
'Bounded event-specific data such as ad IDs, CTA labels and product milestones.';
