-- lp_events: lightweight server-side analytics for landing pages.
-- Captures page_view, scroll milestones, clicks, and time-on-page so we can
-- answer "did anyone view / engage / click today" without depending on
-- GA4 / Facebook Pixel API access.

CREATE TABLE IF NOT EXISTS public.lp_events (
    id              BIGSERIAL PRIMARY KEY,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    session_id      TEXT NOT NULL,
    landing_page    TEXT NOT NULL,
    event_type      TEXT NOT NULL,
    target          TEXT,
    target_text     TEXT,
    scroll_depth    INTEGER,
    duration_ms     INTEGER,
    viewport_w      INTEGER,
    viewport_h      INTEGER,
    click_x         INTEGER,
    click_y         INTEGER,
    utm_source      TEXT,
    utm_medium      TEXT,
    utm_campaign    TEXT,
    referrer        TEXT,
    user_agent      TEXT
);

CREATE INDEX IF NOT EXISTS idx_lp_events_landing_page_created
    ON public.lp_events (landing_page, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lp_events_session_id
    ON public.lp_events (session_id);
CREATE INDEX IF NOT EXISTS idx_lp_events_event_type
    ON public.lp_events (event_type, created_at DESC);

-- Row-level security: only service role writes (via the netlify function).
-- No user-facing reads needed — admin queries via service role.
ALTER TABLE public.lp_events ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.lp_events IS
'Landing-page analytics events. Written server-side by /.netlify/functions/log-lp-event. event_type values: page_view, scroll, click, time_on_page.';
