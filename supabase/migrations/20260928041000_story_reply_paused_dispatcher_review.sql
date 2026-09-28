-- Browser dispatch is paused. Preserve Story context, but put replies in a visible manual queue.
-- The existing RPC name is retained for webhook compatibility.
CREATE OR REPLACE FUNCTION public.route_story_reply_inbound_to_browser_dispatcher(
    p_thread_id UUID,
    p_source_message_id UUID,
    p_source_alert_id UUID DEFAULT NULL,
    p_story_id TEXT DEFAULT NULL,
    p_story_url TEXT DEFAULT NULL,
    p_story_context TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_thread public.ig_threads%ROWTYPE;
    v_source public.ig_messages%ROWTYPE;
    v_latest public.ig_messages%ROWTYPE;
    v_action public.ig_next_actions%ROWTYPE;
    v_result public.ig_next_actions%ROWTYPE;
    v_now TIMESTAMPTZ := NOW();
    v_linked_client BOOLEAN := FALSE;
    v_lead_state TEXT;
    v_reason JSONB;
BEGIN
    SELECT * INTO v_thread
    FROM public.ig_threads
    WHERE id = p_thread_id
    FOR UPDATE;

    IF NOT FOUND OR lower(coalesce(v_thread.channel, '')) <> 'instagram' THEN
        RETURN jsonb_build_object('outcome', 'thread_not_found');
    END IF;

    SELECT * INTO v_source
    FROM public.ig_messages
    WHERE id = p_source_message_id
      AND thread_id = p_thread_id;

    IF NOT FOUND OR lower(coalesce(v_source.direction, '')) <> 'in' THEN
        RETURN jsonb_build_object('outcome', 'invalid_story_reply_source');
    END IF;

    IF lower(coalesce(v_source.source, '')) <> 'meta_ig_story_reply'
       AND position('[IG_STORY_REPLY_CONTEXT]' IN coalesce(v_source.text, '')) = 0 THEN
        RETURN jsonb_build_object('outcome', 'source_is_not_story_reply');
    END IF;

    SELECT * INTO v_latest
    FROM public.ig_messages
    WHERE thread_id = p_thread_id
    ORDER BY created_at DESC, id DESC
    LIMIT 1;

    IF v_latest.id IS DISTINCT FROM v_source.id THEN
        RETURN jsonb_build_object(
            'outcome', 'story_reply_source_is_stale',
            'latest_message_id', v_latest.id
        );
    END IF;

    IF lower(coalesce(v_thread.custom_data ->> 'manual_only', 'false')) = 'true'
       OR lower(coalesce(v_thread.custom_data ->> 'manual_review_only', 'false')) = 'true'
       OR lower(coalesce(v_thread.custom_data ->> 'friend_manual_only', 'false')) = 'true'
       OR lower(coalesce(v_thread.custom_data ->> 'do_not_follow_up', 'false')) = 'true'
       OR lower(coalesce(v_thread.custom_data ->> 'blocked_by_shannon', 'false')) = 'true'
       OR lower(coalesce(v_thread.custom_data ->> 'opt_out', 'false')) = 'true'
       OR lower(coalesce(v_thread.custom_data ->> 'opted_out', 'false')) = 'true'
       OR lower(coalesce(v_thread.custom_data ->> 'ai_automation_opt_out', 'false')) = 'true'
       OR lower(coalesce(v_thread.ig_username, '')) IN ('cavazzanafrancesca', 'lara_lessmann') THEN
        RETURN jsonb_build_object(
            'outcome', 'manual_or_suppression_hold',
            'thread_id', p_thread_id,
            'latest_message_id', v_latest.id
        );
    END IF;

    SELECT * INTO v_action
    FROM public.ig_next_actions
    WHERE thread_id = p_thread_id
    FOR UPDATE;

    -- Never steal a live action claim or operator lock, including another manager.
    IF (v_action.claim_expires_at > v_now AND v_action.claim_token IS NOT NULL)
       OR (coalesce(v_thread.custom_data #>> '{operator_lock,expires_at}', '') <> ''
           AND (v_thread.custom_data #>> '{operator_lock,expires_at}')::timestamptz > v_now) THEN
        RETURN jsonb_build_object('outcome', 'active_claim_preserved', 'action_id', v_action.id);
    END IF;

    IF p_source_alert_id IS NOT NULL THEN
        UPDATE public.coach_alerts
        SET status = 'pending', scheduled_for = NULL, scheduled_reply_text = NULL, scheduled_at = NULL,
            data = coalesce(data, '{}'::jsonb) || jsonb_build_object(
                'operator_queue', 'needs_you', 'needs_you_required', true,
                'needs_shannon_approval', true, 'browser_send_allowed', false,
                'browser_dispatch_required', false, 'browser_dispatch_reason', 'browser_dispatch_paused',
                'notification_required', true, 'notification_reason', 'story_context_requires_manual_review')
        WHERE id = p_source_alert_id AND status IN ('pending', 'scheduled')
          AND data->>'ig_thread_id' = p_thread_id::text
          AND data->>'source_message_id' = p_source_message_id::text;
    END IF;

    IF v_action.id IS NOT NULL AND (
        v_action.owner = 'manual'
        OR v_action.status IN ('needs_you', 'blocked')
    ) THEN
        RETURN jsonb_build_object(
            'outcome', 'existing_hold_preserved',
            'action_id', v_action.id,
            'owner', v_action.owner,
            'status', v_action.status,
            'latest_message_id', v_latest.id
        );
    END IF;

    v_linked_client := v_thread.linked_user_id IS NOT NULL
        OR lower(coalesce(v_thread.lead_stage, '')) IN ('in_app', 'paying');
    v_lead_state := CASE
        WHEN v_linked_client THEN 'client'
        ELSE coalesce(nullif(v_thread.lead_stage, ''), 'new')
    END;
    v_reason := jsonb_build_object(
        'source', 'instagram_story_reply_webhook',
        'why', 'Story reply needs native context; browser dispatcher is paused, so Shannon must review',
        'cooldown_scope', 'dm',
        'browser_story_reply_required', TRUE,
        'browser_dispatch_required', FALSE,
        'browser_dispatch_reason', 'browser_dispatch_paused',
        'operator_queue', 'needs_you', 'needs_you_required', TRUE, 'needs_shannon_approval', TRUE,
        'native_story_context_required', TRUE,
        'browser_send_allowed', FALSE,
        'linked_client', v_linked_client,
        'source_alert_id', p_source_alert_id,
        'story_id', nullif(trim(coalesce(p_story_id, '')), ''),
        'story_url', nullif(trim(coalesce(p_story_url, '')), ''),
        'story_context', nullif(left(coalesce(p_story_context, ''), 6000), ''),
        'routed_at', v_now
    );

    IF v_action.id IS NOT NULL THEN
        UPDATE public.ig_next_actions
        SET owner = 'manual',
            status = 'needs_you',
            action_type = 'reply_inbound',
            priority = greatest(v_action.priority, 980),
            due_at = v_now,
            safe_after = v_now,
            source_message_id = v_source.id,
            reason = coalesce(v_action.reason, '{}'::jsonb) || v_reason,
            claim_owner = NULL,
            claim_token = NULL,
            claim_run_id = NULL,
            claim_expires_at = NULL,
            receipt = '{}'::jsonb,
            completed_at = NULL,
            action_version = v_action.action_version + 1
        WHERE id = v_action.id
        RETURNING * INTO v_result;
    ELSE
        SELECT * INTO v_result
        FROM public.upsert_ig_next_action(
            p_thread_id,
            v_thread.ig_username,
            v_lead_state,
            'manual',
            'reply_inbound',
            980,
            v_now,
            v_now,
            v_reason,
            v_source.id,
            TRUE
        );
    END IF;

    UPDATE public.ig_next_actions SET status = 'needs_you'
    WHERE id = v_result.id RETURNING * INTO v_result;

    RETURN jsonb_build_object(
        'outcome',
        'browser_dispatch_paused_needs_you',
        'action_id', v_result.id,
        'owner', v_result.owner,
        'status', v_result.status,
        'latest_message_id', v_source.id,
        'linked_client', v_linked_client,
        'browser_send_allowed', FALSE,
        'action_version', v_result.action_version
    );
END;
$$;

REVOKE ALL ON FUNCTION public.route_story_reply_inbound_to_browser_dispatcher(
    UUID, UUID, UUID, TEXT, TEXT, TEXT
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.route_story_reply_inbound_to_browser_dispatcher(
    UUID, UUID, UUID, TEXT, TEXT, TEXT
) TO service_role;

COMMENT ON FUNCTION public.route_story_reply_inbound_to_browser_dispatcher(
    UUID, UUID, UUID, TEXT, TEXT, TEXT
) IS 'Preserves native Story context and exposes manual review while browser delivery is paused; never steals live claims.';
