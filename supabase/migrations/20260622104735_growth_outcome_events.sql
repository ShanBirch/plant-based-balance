-- Canonical acquisition/content/sales outcome trail for Balance.
--
-- This is the spine used to teach the operator which posts, comments, free
-- resources, DM actions, and subscriptions actually move people toward sales.

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS public.growth_outcome_event_weights (
    event_type TEXT PRIMARY KEY,
    family TEXT NOT NULL,
    default_score NUMERIC NOT NULL DEFAULT 0,
    description TEXT NOT NULL DEFAULT '',
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.growth_outcome_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_key TEXT NOT NULL UNIQUE,
    event_type TEXT NOT NULL,
    event_family TEXT NOT NULL DEFAULT 'acquisition',
    event_status TEXT NOT NULL DEFAULT 'recorded',
    source_system TEXT NOT NULL DEFAULT 'balance',
    bot_account TEXT,
    lead_key TEXT,
    from_ig_user_id TEXT,
    from_username TEXT,
    email TEXT,
    email_key TEXT,
    ig_thread_id UUID REFERENCES public.ig_threads(id) ON DELETE SET NULL,
    ig_message_id UUID REFERENCES public.ig_messages(id) ON DELETE SET NULL,
    content_item_id UUID REFERENCES public.ig_content_items(id) ON DELETE SET NULL,
    content_platform_post_id UUID REFERENCES public.content_platform_posts(id) ON DELETE SET NULL,
    campaign_id UUID REFERENCES public.ig_growth_campaigns(id) ON DELETE SET NULL,
    ig_comment_automation_id UUID REFERENCES public.ig_comment_automations(id) ON DELETE SET NULL,
    ig_comment_fulfillment_id UUID REFERENCES public.ig_comment_fulfillments(id) ON DELETE SET NULL,
    ig_growth_lead_id UUID REFERENCES public.ig_growth_leads(id) ON DELETE SET NULL,
    ig_growth_submission_id UUID REFERENCES public.ig_growth_lead_submissions(id) ON DELETE SET NULL,
    conversion_operator_event_id UUID REFERENCES public.conversion_operator_events(id) ON DELETE SET NULL,
    coach_alert_id UUID REFERENCES public.coach_alerts(id) ON DELETE SET NULL,
    client_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    stripe_subscription_link_id UUID REFERENCES public.stripe_subscription_links(id) ON DELETE SET NULL,
    cohort_invitation_id UUID REFERENCES public.cohort_invitations(id) ON DELETE SET NULL,
    source_key TEXT,
    ig_media_id TEXT,
    story_id TEXT,
    story_comment_run_id TEXT,
    campaign_slug TEXT,
    landing_url TEXT,
    utm_source TEXT,
    utm_medium TEXT,
    utm_campaign TEXT,
    score NUMERIC NOT NULL DEFAULT 0,
    score_breakdown JSONB NOT NULL DEFAULT '{}'::JSONB,
    attribution JSONB NOT NULL DEFAULT '{}'::JSONB,
    raw_payload JSONB NOT NULL DEFAULT '{}'::JSONB,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT growth_outcome_events_event_type_not_blank CHECK (length(trim(event_type)) > 0),
    CONSTRAINT growth_outcome_events_event_key_not_blank CHECK (length(trim(event_key)) > 0)
);

CREATE TABLE IF NOT EXISTS public.story_comment_outreach_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_key TEXT NOT NULL UNIQUE,
    bot_account TEXT NOT NULL,
    ig_username TEXT,
    from_username TEXT,
    story_id TEXT,
    story_url TEXT,
    run_id TEXT,
    send_status TEXT NOT NULL,
    safety_reason TEXT,
    story_content_type TEXT,
    story_description TEXT,
    raw_comment TEXT,
    draft_comment TEXT,
    screenshot_path TEXT,
    video_path TEXT,
    balance_bridge_analyzed BOOLEAN NOT NULL DEFAULT FALSE,
    balance_bridge_saved BOOLEAN NOT NULL DEFAULT FALSE,
    linked_outcome_event_id UUID REFERENCES public.growth_outcome_events(id) ON DELETE SET NULL,
    raw_payload JSONB NOT NULL DEFAULT '{}'::JSONB,
    source_created_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_growth_outcome_events_type_time
    ON public.growth_outcome_events (event_type, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_growth_outcome_events_family_time
    ON public.growth_outcome_events (event_family, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_growth_outcome_events_thread_time
    ON public.growth_outcome_events (ig_thread_id, occurred_at DESC)
    WHERE ig_thread_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_growth_outcome_events_content_item_time
    ON public.growth_outcome_events (content_item_id, occurred_at DESC)
    WHERE content_item_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_growth_outcome_events_content_platform_time
    ON public.growth_outcome_events (content_platform_post_id, occurred_at DESC)
    WHERE content_platform_post_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_growth_outcome_events_username_time
    ON public.growth_outcome_events (bot_account, from_username, occurred_at DESC)
    WHERE from_username IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_growth_outcome_events_email_time
    ON public.growth_outcome_events (email_key, occurred_at DESC)
    WHERE email_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_growth_outcome_events_media_time
    ON public.growth_outcome_events (bot_account, ig_media_id, occurred_at DESC)
    WHERE ig_media_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_story_comment_outreach_account_time
    ON public.story_comment_outreach_events (bot_account, source_created_at DESC);

CREATE INDEX IF NOT EXISTS idx_story_comment_outreach_username_time
    ON public.story_comment_outreach_events (bot_account, ig_username, source_created_at DESC)
    WHERE ig_username IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_story_comment_outreach_run
    ON public.story_comment_outreach_events (run_id, send_status)
    WHERE run_id IS NOT NULL;

DROP TRIGGER IF EXISTS trg_growth_outcome_event_weights_updated_at ON public.growth_outcome_event_weights;
CREATE TRIGGER trg_growth_outcome_event_weights_updated_at
    BEFORE UPDATE ON public.growth_outcome_event_weights
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_growth_outcome_events_updated_at ON public.growth_outcome_events;
CREATE TRIGGER trg_growth_outcome_events_updated_at
    BEFORE UPDATE ON public.growth_outcome_events
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_story_comment_outreach_events_updated_at ON public.story_comment_outreach_events;
CREATE TRIGGER trg_story_comment_outreach_events_updated_at
    BEFORE UPDATE ON public.story_comment_outreach_events
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.growth_outcome_event_weights (event_type, family, default_score, description)
VALUES
    ('story_comment_sent', 'acquisition', 2, 'Local story commenter sent a visible story reply.'),
    ('story_comment_send_attempted', 'acquisition', 1, 'Local story commenter started a send attempt.'),
    ('story_comment_liked', 'acquisition', 1, 'Local story commenter used a like fallback.'),
    ('story_comment_blocked', 'acquisition', 0, 'Story commenter blocked or suppressed a candidate.'),
    ('story_comment_draft_only', 'acquisition', 0, 'Story commenter produced or recorded a draft-only candidate.'),
    ('story_comment_replied', 'acquisition', 5, 'A story outreach recipient replied.'),
    ('post_comment_keyword_matched', 'acquisition', 4, 'A reel/post comment matched a free-info keyword.'),
    ('private_reply_sent', 'acquisition', 8, 'Instagram private reply delivered a free-info link.'),
    ('free_info_unlocked', 'acquisition', 10, 'A lead unlocked the free-info resource.'),
    ('email_captured', 'acquisition', 12, 'A lead submitted email/contact details.'),
    ('dm_qualified', 'sales', 15, 'DM evidence qualified a lead.'),
    ('challenge_invited', 'sales', 12, 'A lead was invited to the free challenge.'),
    ('challenge_accepted', 'sales', 25, 'A lead accepted or joined the free challenge.'),
    ('app_joined', 'sales', 35, 'A lead became an app user.'),
    ('coaching_pitched', 'sales', 20, 'The coaching offer was pitched.'),
    ('subscription_started', 'revenue', 100, 'A Stripe subscription became active or trialing.'),
    ('subscription_canceled', 'revenue', -30, 'A paid subscription ended or became inactive.'),
    ('client_goal_completed', 'retention', 10, 'A client completed a goal or accountability target.'),
    ('client_retained_30d', 'retention', 15, 'A client retained beyond a 30-day checkpoint.')
ON CONFLICT (event_type) DO UPDATE
SET family = EXCLUDED.family,
    default_score = EXCLUDED.default_score,
    description = EXCLUDED.description,
    active = EXCLUDED.active,
    updated_at = NOW();

ALTER TABLE public.growth_outcome_event_weights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.growth_outcome_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_comment_outreach_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.growth_outcome_event_weights FROM anon;
REVOKE ALL ON public.growth_outcome_events FROM anon;
REVOKE ALL ON public.story_comment_outreach_events FROM anon;

GRANT SELECT ON public.growth_outcome_event_weights TO authenticated;
GRANT SELECT ON public.growth_outcome_events TO authenticated;
GRANT SELECT ON public.story_comment_outreach_events TO authenticated;
GRANT ALL ON public.growth_outcome_event_weights TO service_role;
GRANT ALL ON public.growth_outcome_events TO service_role;
GRANT ALL ON public.story_comment_outreach_events TO service_role;

DROP POLICY IF EXISTS "Admins can read growth outcome weights" ON public.growth_outcome_event_weights;
CREATE POLICY "Admins can read growth outcome weights"
    ON public.growth_outcome_event_weights FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Admins can read growth outcome events" ON public.growth_outcome_events;
CREATE POLICY "Admins can read growth outcome events"
    ON public.growth_outcome_events FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Admins can read story comment outreach events" ON public.story_comment_outreach_events;
CREATE POLICY "Admins can read story comment outreach events"
    ON public.story_comment_outreach_events FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()));

COMMENT ON TABLE public.growth_outcome_event_weights IS
    'Adjustable scoring parameters for acquisition, sales, revenue, and retention outcomes.';

COMMENT ON TABLE public.growth_outcome_events IS
    'Canonical event-sourced outcome trail linking content, comments, DMs, free-info unlocks, and paid subscriptions.';

COMMENT ON TABLE public.story_comment_outreach_events IS
    'Normalized import of local story-commenter JSONL rows so outreach quality can be tied back to replies and sales.';
