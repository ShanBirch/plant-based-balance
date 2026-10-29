-- Read-only attribution of existing sends. Never infer AI authorship from
-- author_type, wording, timestamps alone, or a native inbox import.
CREATE OR REPLACE FUNCTION public.balance_dm_delivery_attribution(
    p_start timestamptz, p_end timestamptz
) RETURNS TABLE (
    message_id uuid, thread_id uuid, sent_at timestamptz,
    attribution text, operator_lane text, action_id uuid, action_version integer,
    run_id text, source_message_id text, receipt_key text
) LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $$
BEGIN
    IF p_start IS NULL OR p_end IS NULL OR p_end <= p_start
       OR p_end - p_start > interval '31 days' THEN
        RAISE EXCEPTION 'An ordered activity window of at most 31 days is required';
    END IF;
    RETURN QUERY
    WITH messages AS MATERIALIZED (
        SELECT m.id, m.thread_id, m.created_at FROM public.ig_messages m
        WHERE m.direction = 'out' AND m.created_at >= p_start AND m.created_at < p_end
    ), receipts AS (
        SELECT a.id AS aid, a.action_version AS version, a.thread_id AS tid,
            a.ig_username, a.owner, a.action_type, a.status AS terminal_status,
            a.receipt FROM public.ig_next_actions a WHERE a.receipt <> '{}'::jsonb
        UNION ALL
        SELECT a.action_id, a.action_version, a.thread_id, a.ig_username,
            a.owner, a.action_type, a.terminal_status, a.receipt
        FROM public.ig_next_action_receipts a
    ), candidates AS (
        SELECT DISTINCT m.id, r.aid, r.version, r.owner,
            coalesce(nullif(r.receipt->>'claim_run_id',''),r.receipt->>'run_id') AS rid,
            r.receipt->>'source_message_id' AS source_id,
            ids.evidence_key
        FROM receipts r
        CROSS JOIN LATERAL (
            SELECT min(k.key) AS evidence_key, min(k.value) AS outbound_id,
                count(DISTINCT k.value) AS references_count
            FROM jsonb_each_text(r.receipt) k
            WHERE k.key IN ('canonical_outbound_message_id','canonical_outbound_id',
                'canonical_message_id','outbound_message_id') AND nullif(k.value,'') IS NOT NULL
        ) ids
        JOIN messages m ON m.id::text = ids.outbound_id
        JOIN public.ig_threads t ON t.id = m.thread_id
        WHERE ids.references_count = 1 AND r.terminal_status = 'completed'
          AND r.owner IN ('dm_manager','story_operator','follower_operator')
          AND r.action_type IN ('reply_inbound','story_reply','welcome_follower')
          AND (r.tid = m.thread_id OR (r.tid IS NULL
              AND r.receipt->>'canonical_thread_id' = m.thread_id::text
              AND lower(r.ig_username) = lower(t.ig_username)))
          AND (nullif(r.receipt->>'canonical_thread_id','') IS NULL
              OR r.receipt->>'canonical_thread_id' = m.thread_id::text)
          AND (r.receipt->>'native_verified' = 'true'
              OR (r.receipt->>'native_visible' = 'true'
                  AND coalesce(r.receipt->>'composer_empty',r.receipt->>'composer_clear',
                      r.receipt->>'composer_cleared') = 'true'))
          AND coalesce(r.receipt->>'reconciliation_required','false') <> 'true'
          AND coalesce(r.receipt->>'result',r.receipt->>'outcome','')
              NOT IN ('uncertain','failed','blocked','not_sent')
          AND (nullif(r.receipt->>'source_message_id','') IS NULL OR EXISTS (
              SELECT 1 FROM public.ig_messages src
              WHERE src.id::text = r.receipt->>'source_message_id'
                AND src.thread_id = m.thread_id AND src.direction = 'in'
                AND src.created_at <= m.created_at))
          AND EXISTS (SELECT 1 FROM public.ig_browser_shift_runs run
              WHERE run.run_id = coalesce(nullif(r.receipt->>'claim_run_id',''),r.receipt->>'run_id'))
    ), unique_evidence AS (
        -- Current and archived copies of the same action/version count once.
        -- Distinct actions claiming one outbound are ambiguous and stay unknown.
        SELECT c.id FROM candidates c GROUP BY c.id
        HAVING count(DISTINCT (c.aid,c.version)) = 1
    )
    SELECT m.id, m.thread_id, m.created_at,
        CASE WHEN c.aid IS NULL THEN 'unknown' ELSE 'verified_automation' END,
        c.owner, c.aid, c.version, c.rid, c.source_id, c.evidence_key
    FROM messages m
    LEFT JOIN unique_evidence u ON u.id = m.id
    LEFT JOIN LATERAL (SELECT x.* FROM candidates x WHERE x.id = u.id
        ORDER BY x.aid,x.version,x.evidence_key LIMIT 1) c ON true
    ORDER BY m.created_at,m.id;
END;
$$;
REVOKE ALL ON FUNCTION public.balance_dm_delivery_attribution(timestamptz,timestamptz)
    FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.balance_dm_delivery_attribution(timestamptz,timestamptz)
    TO service_role;
COMMENT ON FUNCTION public.balance_dm_delivery_attribution(timestamptz,timestamptz) IS
    'Read-only exact-ID native send attribution across current and archived receipts; unknown is not manual or failed. Does not change ABC, claims, delivery or training eligibility.';
