-- AI Usage Events
--
-- Lightweight server-side usage ledger for OpenAI calls. The app logs model,
-- route/profile, token counts and estimated cost, but never prompt text or
-- client message content.
--
-- Run via exec_sql RPC. Safe to re-run.

CREATE TABLE IF NOT EXISTS public.ai_usage_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    provider TEXT NOT NULL DEFAULT 'openai',
    api_surface TEXT DEFAULT 'responses',
    source TEXT DEFAULT 'netlify',
    label TEXT,
    profile TEXT,
    model TEXT NOT NULL,
    input_tokens INTEGER DEFAULT 0,
    cached_input_tokens INTEGER DEFAULT 0,
    output_tokens INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    input_image_count INTEGER DEFAULT 0,
    input_text_chars INTEGER DEFAULT 0,
    estimated_cost_usd NUMERIC(12, 8),
    pricing JSONB DEFAULT '{}'::jsonb,
    response_id TEXT,
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_events_created_at
    ON public.ai_usage_events(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_usage_events_model_created_at
    ON public.ai_usage_events(model, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_usage_events_label_created_at
    ON public.ai_usage_events(label, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_usage_events_profile_created_at
    ON public.ai_usage_events(profile, created_at DESC);

ALTER TABLE public.ai_usage_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view ai usage events" ON public.ai_usage_events;
CREATE POLICY "Admins can view ai usage events"
    ON public.ai_usage_events FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.admin_users
            WHERE user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Service role full access ai usage events" ON public.ai_usage_events;
CREATE POLICY "Service role full access ai usage events"
    ON public.ai_usage_events FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

GRANT SELECT ON public.ai_usage_events TO authenticated;
GRANT ALL ON public.ai_usage_events TO service_role;
