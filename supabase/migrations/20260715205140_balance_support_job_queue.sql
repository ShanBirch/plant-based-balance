-- Dedicated leased queue for Balance app/program support repairs.
--
-- coach_alerts remains the client-facing source and Needs You receipt. This
-- queue only coordinates repair ownership so the conversational DM manager
-- can hand a problem to a slower specialist without two operators fixing it.

CREATE TABLE IF NOT EXISTS public.balance_support_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_id UUID NOT NULL UNIQUE REFERENCES public.coach_alerts(id) ON DELETE CASCADE,
    client_id UUID,
    thread_id UUID,
    support_issue_key TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'ready',
    priority INTEGER NOT NULL DEFAULT 500,
    due_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reason JSONB NOT NULL DEFAULT '{}'::JSONB,
    claim_owner TEXT,
    claim_token UUID,
    claim_run_id TEXT,
    claim_expires_at TIMESTAMPTZ,
    receipt JSONB NOT NULL DEFAULT '{}'::JSONB,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT balance_support_jobs_issue_key_not_blank
        CHECK (length(trim(support_issue_key)) > 0),
    CONSTRAINT balance_support_jobs_status_check CHECK (status IN (
        'ready', 'claimed', 'waiting', 'needs_you',
        'completed', 'cancelled', 'blocked'
    )),
    CONSTRAINT balance_support_jobs_claim_check CHECK (
        status <> 'claimed'
        OR (claim_owner IS NOT NULL AND claim_token IS NOT NULL AND claim_expires_at IS NOT NULL)
    ),
    CONSTRAINT balance_support_jobs_priority_check CHECK (priority BETWEEN 0 AND 10000)
);

CREATE INDEX IF NOT EXISTS idx_balance_support_jobs_claimable
    ON public.balance_support_jobs (priority DESC, due_at ASC, created_at ASC)
    WHERE status IN ('ready', 'claimed', 'waiting');

CREATE INDEX IF NOT EXISTS idx_balance_support_jobs_issue
    ON public.balance_support_jobs (support_issue_key, created_at DESC);

DROP TRIGGER IF EXISTS trg_balance_support_jobs_updated_at ON public.balance_support_jobs;
CREATE TRIGGER trg_balance_support_jobs_updated_at
    BEFORE UPDATE ON public.balance_support_jobs
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.balance_support_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.balance_support_jobs FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.balance_support_jobs TO service_role;

-- Reconcile manager-routed support alerts into the repair queue. Existing
-- support_exception alerts are included so the split works immediately.
CREATE OR REPLACE FUNCTION public.refresh_balance_support_jobs(
    p_limit INTEGER DEFAULT 50
)
RETURNS SETOF public.balance_support_jobs
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
    RETURN QUERY
    WITH candidates AS (
        SELECT
            a.id AS alert_id,
            a.client_id,
            CASE
                WHEN coalesce(a.data ->> 'thread_id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
                    THEN (a.data ->> 'thread_id')::UUID
                ELSE NULL
            END AS thread_id,
            coalesce(
                nullif(trim(a.data ->> 'support_issue_key'), ''),
                'alert:' || a.id::TEXT
            ) AS issue_key,
            CASE lower(coalesce(a.priority, ''))
                WHEN 'urgent' THEN 1000
                WHEN 'high' THEN 800
                WHEN 'medium' THEN 500
                ELSE 300
            END AS job_priority,
            jsonb_build_object(
                'source', 'coach_alerts',
                'alert_type', a.alert_type,
                'channel', coalesce(a.data ->> 'channel', a.data ->> 'source_channel'),
                'routed_by', coalesce(a.data ->> 'support_routed_by', 'support_exception_reconciliation'),
                'routed_at', coalesce(a.data ->> 'support_routed_at', now()::TEXT)
            ) AS job_reason
        FROM public.coach_alerts a
        WHERE coalesce(a.status, 'pending') = 'pending'
          AND (
              a.data ->> 'operator_queue' = 'support_operator'
              OR coalesce(a.data ->> 'support_exception', 'false') = 'true'
              OR coalesce(a.data ->> 'support_exception_reason', '') = 'app_support_fast_fix'
          )
          AND coalesce(a.data ->> 'support_state', '') NOT IN (
              'fixed_verified',
              'already_fixed_stale_alert',
              'superseded_by_fixed_receipt'
          )
        ORDER BY
            CASE lower(coalesce(a.priority, ''))
                WHEN 'urgent' THEN 1000
                WHEN 'high' THEN 800
                WHEN 'medium' THEN 500
                ELSE 300
            END DESC,
            a.created_at ASC
        LIMIT greatest(1, least(coalesce(p_limit, 50), 200))
    ), inserted AS (
        INSERT INTO public.balance_support_jobs (
            alert_id, client_id, thread_id, support_issue_key,
            priority, due_at, reason
        )
        SELECT
            c.alert_id, c.client_id, c.thread_id, c.issue_key,
            c.job_priority, now(), c.job_reason
        FROM candidates c
        ON CONFLICT (alert_id) DO NOTHING
        RETURNING *
    )
    SELECT * FROM inserted;
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_balance_support_jobs(
    p_owner TEXT,
    p_limit INTEGER DEFAULT 3,
    p_lease_seconds INTEGER DEFAULT 5400,
    p_run_id TEXT DEFAULT NULL
)
RETURNS SETOF public.balance_support_jobs
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_owner TEXT := nullif(trim(coalesce(p_owner, '')), '');
    v_limit INTEGER := greatest(1, least(coalesce(p_limit, 3), 20));
    v_lease_seconds INTEGER := greatest(300, least(coalesce(p_lease_seconds, 5400), 14400));
BEGIN
    IF v_owner IS NULL THEN
        RAISE EXCEPTION 'support job owner is required';
    END IF;

    RETURN QUERY
    WITH claimable AS (
        SELECT q.id
        FROM public.balance_support_jobs q
        WHERE q.due_at <= now()
          AND (
              q.status = 'ready'
              OR (q.status = 'waiting')
              OR (q.status = 'claimed' AND q.claim_expires_at <= now())
          )
        ORDER BY q.priority DESC, q.due_at ASC, q.created_at ASC
        FOR UPDATE SKIP LOCKED
        LIMIT v_limit
    )
    UPDATE public.balance_support_jobs q
    SET status = 'claimed',
        claim_owner = v_owner,
        claim_token = gen_random_uuid(),
        claim_run_id = nullif(left(coalesce(p_run_id, ''), 180), ''),
        claim_expires_at = now() + make_interval(secs => v_lease_seconds),
        completed_at = NULL
    FROM claimable c
    WHERE q.id = c.id
    RETURNING q.*;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_balance_support_job(
    p_job_id UUID,
    p_claim_token UUID,
    p_status TEXT,
    p_due_at TIMESTAMPTZ DEFAULT NULL,
    p_receipt JSONB DEFAULT '{}'::JSONB
)
RETURNS public.balance_support_jobs
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_status TEXT := lower(trim(coalesce(p_status, '')));
    v_result public.balance_support_jobs%ROWTYPE;
BEGIN
    IF v_status NOT IN ('ready', 'waiting', 'needs_you', 'completed', 'cancelled', 'blocked') THEN
        RAISE EXCEPTION 'invalid support job completion status: %', p_status;
    END IF;

    UPDATE public.balance_support_jobs q
    SET status = v_status,
        due_at = CASE
            WHEN v_status IN ('ready', 'waiting') THEN coalesce(p_due_at, now() + interval '2 hours')
            ELSE q.due_at
        END,
        receipt = coalesce(q.receipt, '{}'::JSONB) || coalesce(p_receipt, '{}'::JSONB),
        claim_owner = NULL,
        claim_token = NULL,
        claim_run_id = NULL,
        claim_expires_at = NULL,
        completed_at = CASE
            WHEN v_status IN ('needs_you', 'completed', 'cancelled', 'blocked') THEN now()
            ELSE NULL
        END
    WHERE q.id = p_job_id
      AND q.status = 'claimed'
      AND q.claim_token = p_claim_token
    RETURNING q.* INTO v_result;

    IF v_result.id IS NULL THEN
        RAISE EXCEPTION 'support job claim is missing, expired, or owned by another worker';
    END IF;

    RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_balance_support_jobs(INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_balance_support_jobs(TEXT, INTEGER, INTEGER, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_balance_support_job(UUID, UUID, TEXT, TIMESTAMPTZ, JSONB) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.refresh_balance_support_jobs(INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_balance_support_jobs(TEXT, INTEGER, INTEGER, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_balance_support_job(UUID, UUID, TEXT, TIMESTAMPTZ, JSONB) TO service_role;

COMMENT ON TABLE public.balance_support_jobs IS
    'Leased repair queue for app/program support handed off by the Balance DM manager.';
