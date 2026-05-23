-- Coco's scoped reward-learning loop.
--
-- This stores outcomes for the contained cocos_pt_studio acquisition lane and
-- promotes only evidence-backed prompt-policy rules into the Coco's fork. It
-- intentionally does not touch the existing Shannon Sunny / Balance DM voice
-- learner.

CREATE TABLE IF NOT EXISTS public.cocos_learning_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_id UUID NOT NULL REFERENCES public.coach_alerts(id) ON DELETE CASCADE,
    coach_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    client_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    ig_thread_id UUID REFERENCES public.ig_threads(id) ON DELETE SET NULL,
    algorithm_fork TEXT NOT NULL DEFAULT 'cocos_acquisition_v1',
    bot_account TEXT NOT NULL DEFAULT 'cocos_pt_studio',
    ig_handle TEXT,
    context_bucket TEXT NOT NULL DEFAULT 'unknown',
    action_bucket TEXT NOT NULL DEFAULT 'unknown',
    outcome_key TEXT NOT NULL DEFAULT 'tracking',
    reward_score NUMERIC NOT NULL DEFAULT 0,
    reward_label TEXT,
    reward_reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
    review_hold_neutral BOOLEAN NOT NULL DEFAULT FALSE,
    source_status TEXT,
    source_alert_type TEXT,
    source_created_at TIMESTAMPTZ,
    source_actioned_at TIMESTAMPTZ,
    event_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (alert_id)
);

CREATE INDEX IF NOT EXISTS idx_cocos_learning_events_recent
    ON public.cocos_learning_events (algorithm_fork, event_at DESC);

CREATE INDEX IF NOT EXISTS idx_cocos_learning_events_reward
    ON public.cocos_learning_events (algorithm_fork, context_bucket, action_bucket, reward_score DESC);

CREATE INDEX IF NOT EXISTS idx_cocos_learning_events_thread
    ON public.cocos_learning_events (ig_thread_id, event_at DESC)
    WHERE ig_thread_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.cocos_algorithm_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    algorithm_fork TEXT NOT NULL DEFAULT 'cocos_acquisition_v1',
    rule_key TEXT NOT NULL,
    rule_text TEXT NOT NULL,
    context_bucket TEXT,
    action_bucket TEXT,
    evidence_count INTEGER NOT NULL DEFAULT 0,
    positive_count INTEGER NOT NULL DEFAULT 0,
    neutral_count INTEGER NOT NULL DEFAULT 0,
    negative_count INTEGER NOT NULL DEFAULT 0,
    reward_sum NUMERIC NOT NULL DEFAULT 0,
    reward_avg NUMERIC NOT NULL DEFAULT 0,
    active BOOLEAN NOT NULL DEFAULT FALSE,
    auto_activated_at TIMESTAMPTZ,
    last_evaluated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_reason TEXT,
    source_alert_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (algorithm_fork, rule_key)
);

CREATE INDEX IF NOT EXISTS idx_cocos_algorithm_rules_active
    ON public.cocos_algorithm_rules (algorithm_fork, active, reward_avg DESC, evidence_count DESC);

DROP TRIGGER IF EXISTS trg_cocos_learning_events_updated_at
    ON public.cocos_learning_events;
CREATE TRIGGER trg_cocos_learning_events_updated_at
    BEFORE UPDATE ON public.cocos_learning_events
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_cocos_algorithm_rules_updated_at
    ON public.cocos_algorithm_rules;
CREATE TRIGGER trg_cocos_algorithm_rules_updated_at
    BEFORE UPDATE ON public.cocos_algorithm_rules
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.cocos_learning_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cocos_algorithm_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages Cocos learning events"
    ON public.cocos_learning_events;
CREATE POLICY "Service role manages Cocos learning events"
    ON public.cocos_learning_events FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role manages Cocos algorithm rules"
    ON public.cocos_algorithm_rules;
CREATE POLICY "Service role manages Cocos algorithm rules"
    ON public.cocos_algorithm_rules FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

REVOKE ALL ON public.cocos_learning_events FROM anon, authenticated;
REVOKE ALL ON public.cocos_algorithm_rules FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cocos_learning_events TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cocos_algorithm_rules TO service_role;

COMMENT ON TABLE public.cocos_learning_events IS
    'Outcome/reward events for Coco''s scoped acquisition lane. Needs-attention/media review holds are neutral unless followed by a concrete bad outcome.';

COMMENT ON TABLE public.cocos_algorithm_rules IS
    'Active and candidate prompt-policy rules learned only from Coco''s acquisition rewards.';

NOTIFY pgrst, 'reload schema';
