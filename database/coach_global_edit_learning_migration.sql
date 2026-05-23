-- Global edit-learning rules for Shannon's DM voice.
--
-- Per-client/per-thread coach_instructions already learn relationship-specific
-- preferences. This table is for conservative cross-client rules that should
-- influence all future DM drafts once they repeat or Shannon gives an explicit
-- edit reason.

CREATE TABLE IF NOT EXISTS public.coach_global_edit_learning_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coach_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    scope TEXT NOT NULL DEFAULT 'dm_voice',
    rule_key TEXT NOT NULL,
    rule_text TEXT NOT NULL,
    evidence_count INTEGER NOT NULL DEFAULT 1,
    active BOOLEAN NOT NULL DEFAULT FALSE,
    source_alert_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    last_source_alert_id UUID,
    last_source_alert_type TEXT,
    first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (coach_id, scope, rule_key)
);

CREATE INDEX IF NOT EXISTS idx_coach_global_edit_learning_rules_active
    ON public.coach_global_edit_learning_rules (coach_id, scope, active, evidence_count DESC, last_seen_at DESC);

DROP TRIGGER IF EXISTS trg_coach_global_edit_learning_rules_updated_at
    ON public.coach_global_edit_learning_rules;
CREATE TRIGGER trg_coach_global_edit_learning_rules_updated_at
    BEFORE UPDATE ON public.coach_global_edit_learning_rules
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.coach_global_edit_learning_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access global edit learning"
    ON public.coach_global_edit_learning_rules;
CREATE POLICY "Service role full access global edit learning"
    ON public.coach_global_edit_learning_rules FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

GRANT ALL ON public.coach_global_edit_learning_rules TO service_role;

COMMENT ON TABLE public.coach_global_edit_learning_rules IS
    'Global Shannon DM voice rules learned from repeated or explicitly explained coach edits. Injected into future draft prompts.';
