-- Balance compliance records
--
-- Stores auditable legal acceptance and basic health-screening snapshots
-- captured from the quiz, checkout and purchase-success flows.
--
-- These tables intentionally do not grant direct browser/client access.
-- Public pages write through the record-compliance-event Edge Function,
-- which uses the service role key and keeps RLS tight.

CREATE TABLE IF NOT EXISTS public.legal_acceptance_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    email TEXT,
    name TEXT,
    event_type TEXT NOT NULL,
    source_page TEXT,
    plan_key TEXT,
    accepted_terms BOOLEAN NOT NULL DEFAULT FALSE,
    accepted_privacy BOOLEAN NOT NULL DEFAULT FALSE,
    accepted_client_agreement BOOLEAN NOT NULL DEFAULT FALSE,
    accepted_refund_policy BOOLEAN NOT NULL DEFAULT FALSE,
    marketing_consent BOOLEAN NOT NULL DEFAULT FALSE,
    health_data_consent BOOLEAN NOT NULL DEFAULT FALSE,
    document_versions JSONB NOT NULL DEFAULT '{}'::jsonb,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    ip_address TEXT,
    user_agent TEXT,
    idempotency_key TEXT,
    accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_legal_acceptance_records_idempotency_key
    ON public.legal_acceptance_records(idempotency_key)
    WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_legal_acceptance_records_email
    ON public.legal_acceptance_records(lower(email))
    WHERE email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_legal_acceptance_records_user
    ON public.legal_acceptance_records(user_id)
    WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_legal_acceptance_records_event_time
    ON public.legal_acceptance_records(event_type, accepted_at DESC);

CREATE TABLE IF NOT EXISTS public.health_screening_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    legal_acceptance_id UUID REFERENCES public.legal_acceptance_records(id) ON DELETE SET NULL,
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    email TEXT,
    name TEXT,
    source_page TEXT,
    screening_status TEXT NOT NULL DEFAULT 'submitted',
    safety_notes TEXT,
    injuries_or_limitations TEXT,
    medical_conditions TEXT,
    medications TEXT,
    pregnancy_status TEXT,
    emergency_contact TEXT,
    responses JSONB NOT NULL DEFAULT '{}'::jsonb,
    risk_flags JSONB NOT NULL DEFAULT '[]'::jsonb,
    reviewed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_health_screening_records_email
    ON public.health_screening_records(lower(email))
    WHERE email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_health_screening_records_user
    ON public.health_screening_records(user_id)
    WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_health_screening_records_created
    ON public.health_screening_records(created_at DESC);

DROP TRIGGER IF EXISTS trg_health_screening_records_updated_at ON public.health_screening_records;
CREATE TRIGGER trg_health_screening_records_updated_at
    BEFORE UPDATE ON public.health_screening_records
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.legal_acceptance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_screening_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages legal acceptance records" ON public.legal_acceptance_records;
CREATE POLICY "Service role manages legal acceptance records"
    ON public.legal_acceptance_records FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role manages health screening records" ON public.health_screening_records;
CREATE POLICY "Service role manages health screening records"
    ON public.health_screening_records FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

REVOKE ALL ON public.legal_acceptance_records FROM anon, authenticated;
REVOKE ALL ON public.health_screening_records FROM anon, authenticated;
GRANT ALL ON public.legal_acceptance_records TO service_role;
GRANT ALL ON public.health_screening_records TO service_role;
