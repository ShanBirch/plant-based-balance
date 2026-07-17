-- Preserve every completed Instagram operator receipt before the single-current
-- action row is reused, prevent duplicate open support jobs for one issue, and
-- align the commercial queue with the Founders Pass primary offer.

CREATE TABLE IF NOT EXISTS public.ig_next_action_receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action_id UUID NOT NULL,
    action_version INTEGER NOT NULL,
    subject_key TEXT NOT NULL,
    thread_id UUID,
    ig_username TEXT,
    owner TEXT NOT NULL,
    action_type TEXT NOT NULL,
    terminal_status TEXT NOT NULL,
    receipt JSONB NOT NULL,
    completed_at TIMESTAMPTZ,
    archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (action_id, action_version)
);

CREATE INDEX IF NOT EXISTS idx_ig_next_action_receipts_subject
    ON public.ig_next_action_receipts (subject_key, archived_at DESC);

CREATE INDEX IF NOT EXISTS idx_ig_next_action_receipts_thread
    ON public.ig_next_action_receipts (thread_id, archived_at DESC)
    WHERE thread_id IS NOT NULL;

ALTER TABLE public.ig_next_action_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.ig_next_action_receipts FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.ig_next_action_receipts TO service_role;

CREATE OR REPLACE FUNCTION public.archive_ig_next_action_receipt()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_should_archive BOOLEAN := FALSE;
BEGIN
    IF TG_OP = 'DELETE' THEN
        v_should_archive := coalesce(OLD.receipt, '{}'::JSONB) <> '{}'::JSONB;
    ELSE
        v_should_archive := coalesce(OLD.receipt, '{}'::JSONB) <> '{}'::JSONB
            AND (NEW.action_version IS DISTINCT FROM OLD.action_version
                OR coalesce(NEW.receipt, '{}'::JSONB) = '{}'::JSONB);
    END IF;

    IF v_should_archive THEN
        INSERT INTO public.ig_next_action_receipts (
            action_id, action_version, subject_key, thread_id, ig_username,
            owner, action_type, terminal_status, receipt, completed_at,
            archived_at
        ) VALUES (
            OLD.id, OLD.action_version, OLD.subject_key, OLD.thread_id,
            OLD.ig_username, OLD.owner, OLD.action_type, OLD.status,
            OLD.receipt, OLD.completed_at, NOW()
        )
        ON CONFLICT (action_id, action_version) DO UPDATE
        SET receipt = public.ig_next_action_receipts.receipt || EXCLUDED.receipt,
            terminal_status = EXCLUDED.terminal_status,
            completed_at = coalesce(EXCLUDED.completed_at,
                public.ig_next_action_receipts.completed_at),
            archived_at = NOW();
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_archive_ig_next_action_receipt
    ON public.ig_next_actions;
CREATE TRIGGER trg_archive_ig_next_action_receipt
    BEFORE UPDATE OR DELETE ON public.ig_next_actions
    FOR EACH ROW EXECUTE FUNCTION public.archive_ig_next_action_receipt();

REVOKE ALL ON FUNCTION public.archive_ig_next_action_receipt()
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.archive_ig_next_action_receipt() TO service_role;

-- Backfill current receipts before repairing stale ready rows. Those rows are
-- a new/current instruction carrying an older instruction's proof, so the proof
-- belongs in history rather than on the claimable row.
INSERT INTO public.ig_next_action_receipts (
    action_id, action_version, subject_key, thread_id, ig_username,
    owner, action_type, terminal_status, receipt, completed_at, archived_at
)
SELECT id, action_version, subject_key, thread_id, ig_username, owner,
       action_type, status, receipt, completed_at, NOW()
FROM public.ig_next_actions
WHERE coalesce(receipt, '{}'::JSONB) <> '{}'::JSONB
ON CONFLICT (action_id, action_version) DO UPDATE
SET receipt = public.ig_next_action_receipts.receipt || EXCLUDED.receipt,
    terminal_status = EXCLUDED.terminal_status,
    completed_at = coalesce(EXCLUDED.completed_at,
        public.ig_next_action_receipts.completed_at),
    archived_at = NOW();

UPDATE public.ig_next_actions
SET status = 'cooldown',
    safe_after = greatest(
        coalesce(safe_after, NOW()),
        NOW() + CASE WHEN owner = 'feed_operator'
            THEN interval '7 days' ELSE interval '24 hours' END
    ),
    receipt = '{}'::JSONB,
    completed_at = NULL,
    action_version = action_version + 1,
    reason = coalesce(reason, '{}'::JSONB) || jsonb_build_object(
        'stale_receipt_reconciled_at', NOW(),
        'stale_receipt_history', 'ig_next_action_receipts',
        'stale_receipt_safety_cooldown',
            CASE WHEN owner = 'feed_operator' THEN '7 days' ELSE '24 hours' END
    )
WHERE status = 'ready'
  AND coalesce(receipt, '{}'::JSONB) <> '{}'::JSONB;

CREATE OR REPLACE FUNCTION public.upsert_ig_next_action(
    p_thread_id uuid,
    p_ig_username text,
    p_lead_state text,
    p_owner text,
    p_action_type text,
    p_priority integer DEFAULT 0,
    p_due_at timestamptz DEFAULT now(),
    p_safe_after timestamptz DEFAULT NULL,
    p_reason jsonb DEFAULT '{}'::jsonb,
    p_source_message_id uuid DEFAULT NULL,
    p_supersede boolean DEFAULT false
)
RETURNS public.ig_next_actions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    v_subject_key text := public.ig_next_action_subject_key(p_thread_id, p_ig_username);
    v_existing public.ig_next_actions%ROWTYPE;
    v_result public.ig_next_actions%ROWTYPE;
    v_is_external_comment_reply boolean :=
        p_owner = 'external_comment_operator'
        AND p_action_type = 'reply_external_comment'
        AND coalesce(p_reason->>'notification_type', '') = 'reply_to_shannon_comment_on_external_post';
BEGIN
    IF p_thread_id IS NULL AND NULLIF(trim(coalesce(p_ig_username, '')), '') IS NULL THEN
        RAISE EXCEPTION 'an Instagram thread or handle is required';
    END IF;

    SELECT * INTO v_existing
    FROM public.ig_next_actions
    WHERE subject_key = v_subject_key
       OR (p_thread_id IS NOT NULL AND thread_id = p_thread_id)
    ORDER BY CASE WHEN subject_key = v_subject_key THEN 0 ELSE 1 END
    LIMIT 1
    FOR UPDATE;

    IF FOUND AND NOT p_supersede THEN
        IF (v_existing.status = 'claimed' AND v_existing.claim_expires_at > now())
            OR (v_existing.status = 'cooldown' AND v_existing.safe_after > now()
                AND NOT v_is_external_comment_reply)
            OR (v_existing.status IN ('ready', 'waiting', 'needs_you', 'blocked')
                AND v_existing.action_type <> p_action_type) THEN
            RETURN v_existing;
        END IF;
    END IF;

    IF FOUND THEN
        UPDATE public.ig_next_actions
        SET
            thread_id = coalesce(p_thread_id, v_existing.thread_id),
            ig_username = coalesce(NULLIF(trim(p_ig_username), ''), v_existing.ig_username),
            lead_state = coalesce(NULLIF(trim(p_lead_state), ''), v_existing.lead_state),
            owner = p_owner,
            status = 'ready',
            action_type = p_action_type,
            priority = greatest(0, least(coalesce(p_priority, 0), 10000)),
            due_at = coalesce(p_due_at, now()),
            safe_after = p_safe_after,
            source_message_id = coalesce(p_source_message_id, v_existing.source_message_id),
            reason = coalesce(p_reason, '{}'::jsonb),
            claim_owner = NULL,
            claim_token = NULL,
            claim_run_id = NULL,
            claim_expires_at = NULL,
            completed_at = NULL,
            receipt = '{}'::JSONB,
            action_version = v_existing.action_version + 1
        WHERE id = v_existing.id
        RETURNING * INTO v_result;
    ELSE
        INSERT INTO public.ig_next_actions (
            subject_key, thread_id, ig_username, lead_state, owner, status,
            action_type, priority, due_at, safe_after, source_message_id, reason
        ) VALUES (
            v_subject_key, p_thread_id, NULLIF(trim(p_ig_username), ''),
            coalesce(NULLIF(trim(p_lead_state), ''), 'new'), p_owner, 'ready',
            p_action_type, greatest(0, least(coalesce(p_priority, 0), 10000)),
            coalesce(p_due_at, now()), p_safe_after, p_source_message_id,
            coalesce(p_reason, '{}'::jsonb)
        )
        RETURNING * INTO v_result;
    END IF;

    RETURN v_result;
END;
$function$;

COMMENT ON FUNCTION public.upsert_ig_next_action(uuid,text,text,text,text,integer,timestamptz,timestamptz,jsonb,uuid,boolean)
IS 'Upserts the single current Instagram instruction. Prior receipts are archived before a new action version becomes claimable.';

CREATE OR REPLACE FUNCTION public.claim_ig_next_actions(
    p_owner text,
    p_limit integer DEFAULT 20,
    p_lease_seconds integer DEFAULT 900,
    p_run_id text DEFAULT NULL,
    p_thread_ids uuid[] DEFAULT NULL
)
RETURNS SETOF public.ig_next_actions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
    IF p_owner NOT IN (
        'dm_manager', 'story_operator', 'external_comment_operator',
        'follower_operator', 'feed_operator', 'discovery_operator',
        'onboarding', 'manual'
    ) THEN
        RAISE EXCEPTION 'invalid queue owner';
    END IF;

    RETURN QUERY
    WITH candidates AS (
        SELECT q.id
        FROM public.ig_next_actions q
        WHERE q.owner = p_owner
          AND (p_thread_ids IS NULL OR q.thread_id = ANY(p_thread_ids))
          AND q.due_at <= NOW()
          AND COALESCE(q.safe_after, '-infinity'::TIMESTAMPTZ) <= NOW()
          AND coalesce(q.receipt, '{}'::JSONB) = '{}'::JSONB
          AND (
              q.status = 'ready'
              OR (q.status = 'waiting' AND q.safe_after <= NOW())
              OR (q.status = 'claimed' AND q.claim_expires_at <= NOW())
              OR (q.status = 'cooldown' AND q.safe_after <= NOW())
          )
        ORDER BY q.priority DESC, q.due_at ASC, q.created_at ASC
        LIMIT LEAST(GREATEST(COALESCE(p_limit, 20), 1), 100)
        FOR UPDATE SKIP LOCKED
    )
    UPDATE public.ig_next_actions q
    SET status = 'claimed',
        claim_owner = p_owner,
        claim_token = gen_random_uuid(),
        claim_run_id = NULLIF(trim(p_run_id), ''),
        claim_expires_at = NOW() + make_interval(
            secs => LEAST(GREATEST(COALESCE(p_lease_seconds, 900), 60), 7200)
        )
    FROM candidates c
    WHERE q.id = c.id
    RETURNING q.*;
END;
$function$;

-- Reconcile existing duplicate open support jobs without touching client or
-- alert data. Prefer a verified receipt, then a healthy lease, then a ready job.
WITH ranked AS (
    SELECT q.id, q.support_issue_key,
           first_value(q.id) OVER (
               PARTITION BY q.support_issue_key
               ORDER BY
                   CASE
                       WHEN coalesce(q.receipt, '{}'::JSONB) <> '{}'::JSONB THEN 0
                       WHEN q.status = 'claimed' AND q.claim_expires_at > NOW() THEN 1
                       WHEN q.status = 'ready' THEN 2
                       WHEN q.status IN ('waiting', 'needs_you', 'blocked') THEN 3
                       ELSE 4
                   END,
                   q.created_at,
                   q.id
           ) AS canonical_id,
           row_number() OVER (
               PARTITION BY q.support_issue_key
               ORDER BY
                   CASE
                       WHEN coalesce(q.receipt, '{}'::JSONB) <> '{}'::JSONB THEN 0
                       WHEN q.status = 'claimed' AND q.claim_expires_at > NOW() THEN 1
                       WHEN q.status = 'ready' THEN 2
                       WHEN q.status IN ('waiting', 'needs_you', 'blocked') THEN 3
                       ELSE 4
                   END,
                   q.created_at,
                   q.id
           ) AS rn
    FROM public.balance_support_jobs q
    WHERE q.status IN ('ready', 'claimed', 'waiting', 'needs_you', 'blocked')
), cancelled AS (
    UPDATE public.balance_support_jobs q
    SET status = 'cancelled',
        receipt = coalesce(q.receipt, '{}'::JSONB) || jsonb_build_object(
            'decision', 'duplicate_support_job_reconciled',
            'canonical_job_id', r.canonical_id,
            'reconciled_at', NOW()
        ),
        claim_owner = NULL,
        claim_token = NULL,
        claim_run_id = NULL,
        claim_expires_at = NULL,
        completed_at = NOW()
    FROM ranked r
    WHERE q.id = r.id AND r.rn > 1
    RETURNING q.id
)
SELECT count(*) FROM cancelled;

UPDATE public.balance_support_jobs
SET status = 'ready',
    claim_owner = NULL,
    claim_token = NULL,
    claim_run_id = NULL,
    claim_expires_at = NULL,
    completed_at = NULL,
    due_at = least(due_at, NOW()),
    receipt = coalesce(receipt, '{}'::JSONB) || jsonb_build_object(
        'lease_recovered_at', NOW(),
        'lease_recovery_reason', 'expired_support_worker_lease'
    )
WHERE status = 'claimed'
  AND claim_expires_at <= NOW();

CREATE UNIQUE INDEX IF NOT EXISTS uq_balance_support_jobs_open_issue
    ON public.balance_support_jobs (support_issue_key)
    WHERE status IN ('ready', 'claimed', 'waiting', 'needs_you', 'blocked');

CREATE OR REPLACE FUNCTION public.refresh_balance_support_jobs(
    p_limit INTEGER DEFAULT 50
)
RETURNS SETOF public.balance_support_jobs
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
    -- Serialize refreshes so the partial unique index is a final guard rather
    -- than the normal control path.
    PERFORM pg_advisory_xact_lock(hashtext('refresh_balance_support_jobs'));

    RETURN QUERY
    WITH candidates AS (
        SELECT DISTINCT ON (issue_key) *
        FROM (
            SELECT
                a.id AS alert_id,
                a.client_id,
                CASE
                    WHEN coalesce(a.data ->> 'thread_id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
                        THEN (a.data ->> 'thread_id')::UUID
                    ELSE NULL
                END AS thread_id,
                coalesce(nullif(trim(a.data ->> 'support_issue_key'), ''),
                    'alert:' || a.id::TEXT) AS issue_key,
                CASE lower(coalesce(a.priority, ''))
                    WHEN 'urgent' THEN 1000 WHEN 'high' THEN 800
                    WHEN 'medium' THEN 500 ELSE 300 END AS job_priority,
                jsonb_build_object(
                    'source', 'coach_alerts', 'alert_type', a.alert_type,
                    'channel', coalesce(a.data ->> 'channel', a.data ->> 'source_channel'),
                    'routed_by', coalesce(a.data ->> 'support_routed_by', 'support_exception_reconciliation'),
                    'routed_at', coalesce(a.data ->> 'support_routed_at', now()::TEXT)
                ) AS job_reason,
                a.created_at
            FROM public.coach_alerts a
            WHERE coalesce(a.status, 'pending') = 'pending'
              AND (
                  a.data ->> 'operator_queue' = 'support_operator'
                  OR coalesce(a.data ->> 'support_exception', 'false') = 'true'
                  OR coalesce(a.data ->> 'support_exception_reason', '') = 'app_support_fast_fix'
              )
              AND coalesce(a.data ->> 'support_state', '') NOT IN (
                  'fixed_verified', 'already_fixed_stale_alert',
                  'superseded_by_fixed_receipt'
              )
        ) source_rows
        WHERE NOT EXISTS (
            SELECT 1 FROM public.balance_support_jobs q
            WHERE q.support_issue_key = source_rows.issue_key
              AND q.status IN ('ready', 'claimed', 'waiting', 'needs_you', 'blocked')
        )
        ORDER BY issue_key, job_priority DESC, created_at ASC
        LIMIT greatest(1, least(coalesce(p_limit, 50), 200))
    ), inserted AS (
        INSERT INTO public.balance_support_jobs (
            alert_id, client_id, thread_id, support_issue_key,
            priority, due_at, reason
        )
        SELECT c.alert_id, c.client_id, c.thread_id, c.issue_key,
               c.job_priority, now(), c.job_reason
        FROM candidates c
        ON CONFLICT DO NOTHING
        RETURNING *
    )
    SELECT * FROM inserted;
END;
$$;

CREATE OR REPLACE FUNCTION public.ig_message_has_coaching_checkout_link(p_text TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
    SELECT lower(COALESCE(p_text, '')) LIKE '%plantbased-balance.org/vegan-fitness.html%'
        OR lower(COALESCE(p_text, '')) LIKE '%future-balance.netlify.app/vegan-fitness.html%'
        OR lower(COALESCE(p_text, '')) LIKE '%plantbased-balance.org/coaching.html%'
        OR lower(COALESCE(p_text, '')) LIKE '%future-balance.netlify.app/coaching.html%';
$$;

COMMENT ON FUNCTION public.ig_message_has_coaching_checkout_link(TEXT) IS
    'Recognises the primary Founders Pass link and legacy Starter Coaching checkout links.';

CREATE OR REPLACE FUNCTION public.ig_inbound_has_buyer_intent(p_text TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
    SELECT
        lower(trim(COALESCE(p_text, ''))) ~ '^(how much|price\??|pricing\??|cost\??|what(''s| is) included\??|send (me )?(the )?(link|details)\m)'
        OR lower(COALESCE(p_text, '')) ~ '\m(can|could) you send (me )?(the )?(link|details)\M'
        OR lower(COALESCE(p_text, '')) ~ '\m(can|could|how do|where do) i (join|start|sign up|get (the )?(link|details))\M'
        OR lower(COALESCE(p_text, '')) ~ '\m(i(''m| am)|im) (in|keen|ready)(\M| to (join|start|sign up))'
        OR lower(COALESCE(p_text, '')) ~ '\m(i want|i''d like|i would like|keen|ready) to (join|start|sign up|work with you)\M'
        OR lower(COALESCE(p_text, '')) ~ '\m(founders pass|founder''s pass|coaching|starter coaching|balance|work with you|your (program|coaching))\M.{0,80}\m(price|cost|details|included|inclusions|link|join|sign up|start)\M'
        OR lower(COALESCE(p_text, '')) ~ '\m(price|cost|details|included|inclusions|link|join|sign up)\M.{0,80}\m(founders pass|founder''s pass|coaching|starter coaching|balance|work with you|your (program|coaching))\M';
$$;

-- Keep the mature money-queue implementation intact while replacing only its
-- legacy offer predicates and operator explanations.
DO $$
DECLARE
    v_definition TEXT;
    v_updated TEXT;
BEGIN
    SELECT pg_get_functiondef('public.refresh_ig_money_queue(integer,text)'::REGPROCEDURE)
    INTO v_definition;
    v_updated := v_definition;
    v_updated := replace(v_updated,
        'WHEN lower(COALESCE(l.outbound_text, '''')) LIKE ''%starter coaching%'' THEN ''offer_followup''',
        'WHEN (lower(COALESCE(l.outbound_text, '''')) LIKE ''%founders pass%'' OR lower(COALESCE(l.outbound_text, '''')) LIKE ''%starter coaching%'') THEN ''offer_followup''');
    v_updated := replace(v_updated,
        'OR lower(COALESCE(l.outbound_text, '''')) LIKE ''%starter coaching%''',
        'OR (lower(COALESCE(l.outbound_text, '''')) LIKE ''%founders pass%'' OR lower(COALESCE(l.outbound_text, '''')) LIKE ''%starter coaching%'')');
    v_updated := replace(v_updated,
        'Starter Coaching offered 24h+ ago; one contextual follow-up is available',
        'Founders Pass offered 24h+ ago; one contextual follow-up is available');
    v_updated := replace(v_updated,
        'Lead acknowledged a coaching need; inspect for an earned offer bridge',
        'Lead acknowledged a relevant need; inspect for an earned Founders Pass bridge');

    IF v_updated = v_definition THEN
        RAISE EXCEPTION 'refresh_ig_money_queue Founders Pass targets were not found';
    END IF;
    EXECUTE v_updated;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_balance_support_jobs(INTEGER)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_balance_support_jobs(INTEGER) TO service_role;
