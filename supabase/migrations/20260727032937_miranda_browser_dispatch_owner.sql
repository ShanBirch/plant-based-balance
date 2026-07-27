-- Give native Direct-message fallback work its own claim owner. This keeps the
-- API DM manager and Chrome dispatcher from ever holding the same reply lease.
ALTER TABLE public.ig_next_actions
    DROP CONSTRAINT IF EXISTS ig_next_actions_owner_check;

ALTER TABLE public.ig_next_actions
    ADD CONSTRAINT ig_next_actions_owner_check CHECK (owner IN (
        'none', 'dm_manager', 'browser_dispatcher', 'story_operator',
        'external_comment_operator', 'follower_operator', 'feed_operator',
        'discovery_operator', 'onboarding', 'manual'
    ));

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
        'dm_manager', 'browser_dispatcher', 'story_operator',
        'external_comment_operator', 'follower_operator', 'feed_operator',
        'discovery_operator', 'onboarding', 'manual'
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
          AND (
              q.status IN ('waiting', 'claimed')
              OR coalesce(q.receipt, '{}'::JSONB) = '{}'::JSONB
          )
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

REVOKE ALL ON FUNCTION public.claim_ig_next_actions(text,integer,integer,text,uuid[])
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_ig_next_actions(text,integer,integer,text,uuid[])
    TO service_role;

COMMENT ON FUNCTION public.claim_ig_next_actions(text,integer,integer,text,uuid[])
IS 'Atomically claims due Instagram actions, including browser-dispatch DM handoffs and delayed reconciliation rows.';
