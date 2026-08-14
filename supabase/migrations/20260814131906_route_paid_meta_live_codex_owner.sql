-- Give the allowlisted local Codex conversation worker exclusive ownership of
-- its live paid-Meta reply. The ordinary manager can only reclaim the action
-- through the explicit failure handback below.
ALTER TABLE public.ig_next_actions
    DROP CONSTRAINT IF EXISTS ig_next_actions_owner_check;

ALTER TABLE public.ig_next_actions
    ADD CONSTRAINT ig_next_actions_owner_check CHECK (owner IN (
        'none', 'dm_manager', 'codex_live_worker', 'browser_dispatcher',
        'story_operator', 'external_comment_operator', 'follower_operator',
        'feed_operator', 'discovery_operator', 'onboarding', 'manual'
    ));

CREATE OR REPLACE FUNCTION public.claim_ig_next_actions(
    p_owner text,
    p_limit integer DEFAULT 20,
    p_lease_seconds integer DEFAULT 900,
    p_run_id text DEFAULT NULL,
    p_thread_ids uuid[] DEFAULT NULL
)
RETURNS SETOF public.ig_next_actions
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
    IF p_owner NOT IN (
        'dm_manager', 'codex_live_worker', 'browser_dispatcher',
        'story_operator', 'external_comment_operator', 'follower_operator',
        'feed_operator', 'discovery_operator', 'onboarding', 'manual'
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
          AND (q.status IN ('waiting', 'claimed') OR coalesce(q.receipt, '{}'::JSONB) = '{}'::JSONB)
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
        claim_expires_at = NOW() + make_interval(secs => LEAST(GREATEST(COALESCE(p_lease_seconds, 900), 60), 7200))
    FROM candidates c
    WHERE q.id = c.id
    RETURNING q.*;
END;
$function$;

CREATE OR REPLACE FUNCTION public.route_paid_meta_live_codex_action(
    p_thread_id uuid,
    p_alert_id uuid
)
RETURNS public.ig_next_actions
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    v_result public.ig_next_actions%ROWTYPE;
    v_source_message_id uuid;
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM public.ig_threads t
        JOIN public.coach_alerts a ON a.id = p_alert_id
        WHERE t.id = p_thread_id
          AND t.linked_user_id IS NULL
          AND t.custom_data->>'codex_live_chat_enabled' = 'true'
          AND a.status = 'pending'
          AND COALESCE(a.data->>'ig_thread_id', a.data->>'codex_live_chat_ig_thread_id') = p_thread_id::text
          AND a.data->>'codex_live_chat_required' = 'true'
    ) THEN
        RAISE EXCEPTION 'thread or alert is not eligible for live Codex ownership';
    END IF;

    SELECT m.id INTO v_source_message_id
    FROM public.ig_messages m
    WHERE m.thread_id = p_thread_id AND m.direction = 'in'
    ORDER BY m.created_at DESC, m.id DESC
    LIMIT 1;

    UPDATE public.ig_next_actions q
    SET owner = 'codex_live_worker',
        status = 'ready',
        action_type = 'reply_inbound',
        priority = GREATEST(q.priority, 950),
        due_at = NOW(), safe_after = NOW(),
        source_message_id = COALESCE(v_source_message_id, q.source_message_id),
        reason = COALESCE(q.reason, '{}'::jsonb) || jsonb_build_object(
            'codex_live_chat_required', true,
            'codex_live_chat_alert_id', p_alert_id,
            'routed_at', NOW()
        ),
        claim_owner = NULL, claim_token = NULL, claim_run_id = NULL, claim_expires_at = NULL,
        receipt = '{}'::jsonb, completed_at = NULL,
        action_version = q.action_version + 1
    WHERE q.thread_id = p_thread_id
      AND q.owner = 'dm_manager'
      AND q.action_type = 'reply_inbound'
      AND (q.status <> 'claimed' OR q.claim_expires_at <= NOW())
    RETURNING q.* INTO v_result;

    RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.release_paid_meta_live_codex_action(
    p_action_id uuid,
    p_claim_token uuid,
    p_error text DEFAULT NULL
)
RETURNS public.ig_next_actions
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_result public.ig_next_actions%ROWTYPE;
BEGIN
    UPDATE public.ig_next_actions q
    SET owner = 'dm_manager', status = 'waiting', safe_after = NOW() + INTERVAL '30 seconds',
        reason = COALESCE(q.reason, '{}'::jsonb) || jsonb_build_object(
            'codex_live_worker_failed', true,
            'codex_live_worker_error', left(COALESCE(p_error, 'unknown error'), 500),
            'codex_live_worker_released_at', NOW()
        ),
        claim_owner = NULL, claim_token = NULL, claim_run_id = NULL, claim_expires_at = NULL,
        receipt = COALESCE(q.receipt, '{}'::jsonb) || jsonb_build_object(
            'codex_live_worker_failed', true, 'outbound_attempted', false,
            'error', left(COALESCE(p_error, 'unknown error'), 500)
        ),
        action_version = q.action_version + 1
    WHERE q.id = p_action_id
      AND q.owner = 'codex_live_worker'
      AND q.status = 'claimed'
      AND q.claim_token = p_claim_token
    RETURNING q.* INTO v_result;
    RETURN v_result;
END;
$function$;

REVOKE ALL ON FUNCTION public.claim_ig_next_actions(text,integer,integer,text,uuid[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.route_paid_meta_live_codex_action(uuid,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_paid_meta_live_codex_action(uuid,uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_ig_next_actions(text,integer,integer,text,uuid[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.route_paid_meta_live_codex_action(uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_paid_meta_live_codex_action(uuid,uuid,text) TO service_role;
