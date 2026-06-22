-- Comment keyword automations for Shannon-owned Instagram science reels.
--
-- A reel package can register a keyword such as "neuroscience" against the
-- published IG media id. The Meta IG webhook then sends one private reply with
-- the matching resource/landing-page URL and records the fulfilment.

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS public.ig_comment_automations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bot_account TEXT NOT NULL,
    target_handle TEXT NOT NULL,
    automation_key TEXT NOT NULL,
    ig_media_id TEXT,
    source_key TEXT,
    post_slug TEXT NOT NULL,
    keyword TEXT NOT NULL,
    keyword_aliases TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
    cta_text TEXT,
    landing_url TEXT NOT NULL,
    private_reply_message TEXT NOT NULL,
    active BOOLEAN NOT NULL DEFAULT FALSE,
    starts_at TIMESTAMPTZ,
    ends_at TIMESTAMPTZ,
    source_post_json JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ig_comment_automations_media_or_source CHECK (
        ig_media_id IS NOT NULL OR source_key IS NOT NULL OR active = FALSE
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ig_comment_automations_key
    ON public.ig_comment_automations (automation_key);

CREATE INDEX IF NOT EXISTS idx_ig_comment_automations_active_media
    ON public.ig_comment_automations (active, ig_media_id)
    WHERE active = TRUE AND ig_media_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ig_comment_automations_active_source
    ON public.ig_comment_automations (active, source_key)
    WHERE active = TRUE AND source_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.ig_comment_fulfillments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    automation_id UUID REFERENCES public.ig_comment_automations(id) ON DELETE SET NULL,
    content_item_id UUID REFERENCES public.ig_content_items(id) ON DELETE SET NULL,
    interaction_id UUID REFERENCES public.ig_content_interactions(id) ON DELETE SET NULL,
    source_event_id TEXT NOT NULL UNIQUE,
    comment_id TEXT NOT NULL,
    ig_media_id TEXT,
    from_ig_user_id TEXT,
    from_username TEXT,
    matched_keyword TEXT,
    landing_url TEXT,
    private_reply_message TEXT,
    private_reply_id TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending',
        'sent',
        'skipped',
        'failed',
        'dry_run'
    )),
    error TEXT,
    raw_payload JSONB NOT NULL DEFAULT '{}'::JSONB,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ig_comment_fulfillments_automation_recent
    ON public.ig_comment_fulfillments (automation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ig_comment_fulfillments_comment
    ON public.ig_comment_fulfillments (comment_id);

CREATE INDEX IF NOT EXISTS idx_ig_comment_fulfillments_from_user_recent
    ON public.ig_comment_fulfillments (from_ig_user_id, created_at DESC)
    WHERE from_ig_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ig_comment_fulfillments_from_username_recent
    ON public.ig_comment_fulfillments (from_username, created_at DESC)
    WHERE from_username IS NOT NULL;

DROP TRIGGER IF EXISTS trg_ig_comment_automations_updated_at ON public.ig_comment_automations;
CREATE TRIGGER trg_ig_comment_automations_updated_at
    BEFORE UPDATE ON public.ig_comment_automations
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_ig_comment_fulfillments_updated_at ON public.ig_comment_fulfillments;
CREATE TRIGGER trg_ig_comment_fulfillments_updated_at
    BEFORE UPDATE ON public.ig_comment_fulfillments
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.ig_comment_automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ig_comment_fulfillments ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.ig_comment_automations TO authenticated;
GRANT SELECT ON public.ig_comment_fulfillments TO authenticated;
GRANT ALL ON public.ig_comment_automations TO service_role;
GRANT ALL ON public.ig_comment_fulfillments TO service_role;

DROP POLICY IF EXISTS "Admins can read ig comment automations" ON public.ig_comment_automations;
CREATE POLICY "Admins can read ig comment automations"
    ON public.ig_comment_automations FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Admins can read ig comment fulfillments" ON public.ig_comment_fulfillments;
CREATE POLICY "Admins can read ig comment fulfillments"
    ON public.ig_comment_fulfillments FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()));

COMMENT ON TABLE public.ig_comment_automations IS
    'Per-post Instagram comment keyword automations that send a private reply with a science resource link.';

COMMENT ON TABLE public.ig_comment_fulfillments IS
    'Deduped audit log of Instagram comment keyword private-reply fulfilment attempts.';
