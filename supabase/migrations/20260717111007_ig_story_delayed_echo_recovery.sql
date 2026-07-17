-- Allow a Story send with strong native "Sent" feedback but a delayed Graph
-- echo to remain reconcile-only. The action becomes claimable again only after
-- safe_after, so a later browser shift can verify it without clicking Send twice.
CREATE OR REPLACE FUNCTION public.claim_ig_next_actions(
    p_owner TEXT,
    p_limit INTEGER DEFAULT 20,
    p_lease_seconds INTEGER DEFAULT 900,
    p_run_id TEXT DEFAULT NULL,
    p_thread_ids UUID[] DEFAULT NULL
)
RETURNS SETOF public.ig_next_actions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
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
    SET
        status = 'claimed',
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

REVOKE ALL ON FUNCTION public.claim_ig_next_actions(TEXT, INTEGER, INTEGER, TEXT, UUID[])
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_ig_next_actions(TEXT, INTEGER, INTEGER, TEXT, UUID[])
    TO service_role;

COMMENT ON FUNCTION public.claim_ig_next_actions(TEXT, INTEGER, INTEGER, TEXT, UUID[]) IS
    'Claims due Instagram work, including delayed Story-echo verification rows held in waiting until safe_after.';
