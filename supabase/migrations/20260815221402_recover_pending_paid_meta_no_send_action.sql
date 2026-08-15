-- Re-open a live paid-Meta action only when the alert is still pending and the
-- previous worker explicitly completed without attempting an outbound. The
-- canonical message check is the terminal no-repeat guard.
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
            'routed_at', NOW(),
            'recovered_no_send_action', q.owner = 'codex_live_worker'
        ),
        claim_owner = NULL, claim_token = NULL, claim_run_id = NULL, claim_expires_at = NULL,
        receipt = '{}'::jsonb, completed_at = NULL,
        action_version = q.action_version + 1
    WHERE q.thread_id = p_thread_id
      AND q.action_type = 'reply_inbound'
      AND (
          (q.owner = 'dm_manager' AND (q.status <> 'claimed' OR q.claim_expires_at <= NOW()))
          OR (
              q.owner = 'codex_live_worker'
              AND q.status = 'completed'
              AND COALESCE(q.receipt->>'outbound_attempted', 'false') = 'false'
          )
      )
      AND NOT EXISTS (
          SELECT 1
          FROM public.ig_messages sent
          LEFT JOIN public.ig_messages source_message ON source_message.id = q.source_message_id
          WHERE sent.thread_id = q.thread_id
            AND sent.direction = 'out'
            AND (
                sent.alert_id = p_alert_id
                OR (source_message.created_at IS NOT NULL AND sent.created_at >= source_message.created_at)
            )
      )
    RETURNING q.* INTO v_result;

    RETURN v_result;
END;
$function$;

REVOKE ALL ON FUNCTION public.route_paid_meta_live_codex_action(uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.route_paid_meta_live_codex_action(uuid,uuid) TO service_role;
