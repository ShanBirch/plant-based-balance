-- IG content context memory for Meta Graph webhooks.
--
-- Stores Shannon-owned IG posts, reels, and active stories so inbound comments
-- and story replies can carry the post/story context into Balance.
--
-- Safe to re-run.

CREATE TABLE IF NOT EXISTS public.ig_content_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_key TEXT NOT NULL UNIQUE,
    ig_media_id TEXT,
    ig_story_id TEXT,
    content_type TEXT NOT NULL DEFAULT 'unknown' CHECK (content_type IN (
        'story',
        'post',
        'reel',
        'carousel',
        'live',
        'ad',
        'unknown'
    )),
    media_product_type TEXT,
    media_type TEXT,
    caption TEXT,
    permalink TEXT,
    media_url TEXT,
    thumbnail_url TEXT,
    posted_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    media_url_expires_at TIMESTAMPTZ,
    analysis_status TEXT NOT NULL DEFAULT 'pending' CHECK (analysis_status IN (
        'pending',
        'analyzed',
        'skipped',
        'failed'
    )),
    analysis_summary TEXT,
    analysis_visible_text TEXT,
    analysis_topics TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
    analysis_offer_angle TEXT,
    analysis_reply_context TEXT,
    analysis_model TEXT,
    analysis_error TEXT,
    raw_payload JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ig_content_items_media_id
    ON public.ig_content_items (ig_media_id)
    WHERE ig_media_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ig_content_items_story_id
    ON public.ig_content_items (ig_story_id)
    WHERE ig_story_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ig_content_items_type_posted
    ON public.ig_content_items (content_type, posted_at DESC NULLS LAST);

CREATE TABLE IF NOT EXISTS public.ig_content_interactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_event_id TEXT NOT NULL UNIQUE,
    event_type TEXT NOT NULL CHECK (event_type IN (
        'comment',
        'story_reply'
    )),
    content_item_id UUID REFERENCES public.ig_content_items(id) ON DELETE SET NULL,
    ig_thread_id UUID REFERENCES public.ig_threads(id) ON DELETE SET NULL,
    ig_message_id UUID REFERENCES public.ig_messages(id) ON DELETE SET NULL,
    comment_id TEXT,
    message_id TEXT,
    from_ig_user_id TEXT,
    from_username TEXT,
    text TEXT,
    media_product_type TEXT,
    raw_payload JSONB NOT NULL DEFAULT '{}'::JSONB,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ig_content_interactions_content_recent
    ON public.ig_content_interactions (content_item_id, received_at DESC);

CREATE INDEX IF NOT EXISTS idx_ig_content_interactions_from_recent
    ON public.ig_content_interactions (from_ig_user_id, received_at DESC)
    WHERE from_ig_user_id IS NOT NULL;

DROP TRIGGER IF EXISTS trg_ig_content_items_updated_at ON public.ig_content_items;
CREATE TRIGGER trg_ig_content_items_updated_at
    BEFORE UPDATE ON public.ig_content_items
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_ig_content_interactions_updated_at ON public.ig_content_interactions;
CREATE TRIGGER trg_ig_content_interactions_updated_at
    BEFORE UPDATE ON public.ig_content_interactions
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.ig_content_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ig_content_interactions ENABLE ROW LEVEL SECURITY;

GRANT SELECT, UPDATE ON public.ig_content_items TO authenticated;
GRANT SELECT ON public.ig_content_interactions TO authenticated;
GRANT ALL ON public.ig_content_items TO service_role;
GRANT ALL ON public.ig_content_interactions TO service_role;

DROP POLICY IF EXISTS "Admins can read ig content items" ON public.ig_content_items;
CREATE POLICY "Admins can read ig content items"
    ON public.ig_content_items FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Admins can read ig content interactions" ON public.ig_content_interactions;
CREATE POLICY "Admins can read ig content interactions"
    ON public.ig_content_interactions FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Admins can update ig content items" ON public.ig_content_items;
CREATE POLICY "Admins can update ig content items"
    ON public.ig_content_items FOR UPDATE
    USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()))
    WITH CHECK (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()));

COMMENT ON TABLE public.ig_content_items IS
    'Shannon-owned Instagram posts/reels/stories plus AI-readable content context for comments and story replies.';

COMMENT ON TABLE public.ig_content_interactions IS
    'Inbound Meta Graph comment/story-reply events linked back to the IG content item they reacted to.';
