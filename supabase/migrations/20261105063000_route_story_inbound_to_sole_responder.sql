-- Queue inbound Story replies for native review without authorizing a send.
CREATE OR REPLACE FUNCTION public.route_story_reply_inbound_to_browser_dispatcher(p_thread_id uuid, p_source_message_id uuid, p_source_alert_id uuid DEFAULT NULL::uuid, p_story_id text DEFAULT NULL::text, p_story_url text DEFAULT NULL::text, p_story_context text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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

    IF v_thread.auto_send_enabled IS DISTINCT FROM TRUE
       OR v_action.status IN ('completed', 'uncertain')
          AND v_action.source_message_id = v_source.id
       OR v_action.receipt @> '{"no_repeat":true}'::jsonb
          AND v_action.source_message_id = v_source.id THEN
        RETURN jsonb_build_object('outcome', 'existing_hold_preserved', 'action_id', v_action.id);
    END IF;

    v_linked_client := v_thread.linked_user_id IS NOT NULL
        OR lower(coalesce(v_thread.lead_stage, '')) IN ('in_app', 'paying');
    IF v_linked_client THEN
        RETURN jsonb_build_object('outcome', 'manual_or_suppression_hold');
    END IF;

    v_lead_state := CASE
        WHEN v_linked_client THEN 'client'
        ELSE coalesce(nullif(v_thread.lead_stage, ''), 'new')
    END;
    v_reason := jsonb_build_object(
        'source', 'instagram_story_reply_webhook',
        'why', 'Story reply queued for native context review by the sole reactive responder',
        'cooldown_scope', 'dm',
        'browser_story_reply_required', TRUE,
        'browser_dispatch_required', FALSE,
        'browser_dispatch_reason', 'sole_native_reactive_review',
        'operator_queue', 'dm_manager', 'needs_you_required', FALSE, 'needs_shannon_approval', FALSE,
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
        SET owner = 'dm_manager',
            status = 'ready',
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
            'dm_manager',
            'reply_inbound',
            980,
            v_now,
            v_now,
            v_reason,
            v_source.id,
            TRUE
        );
    END IF;

    IF p_source_alert_id IS NOT NULL THEN
        UPDATE public.coach_alerts
        SET status = 'pending', scheduled_for = NULL, scheduled_reply_text = NULL, scheduled_at = NULL,
            data = coalesce(data, '{}'::jsonb) || v_reason
        WHERE id = p_source_alert_id AND status IN ('pending', 'scheduled')
          AND data->>'ig_thread_id' = p_thread_id::text
          AND data->>'source_message_id' = p_source_message_id::text;
    END IF;

    RETURN jsonb_build_object(
        'outcome',
        'browser_dispatch_queued',
        'action_id', v_result.id,
        'owner', v_result.owner,
        'status', v_result.status,
        'latest_message_id', v_source.id,
        'linked_client', v_linked_client,
        'browser_send_allowed', FALSE,
        'action_version', v_result.action_version
    );
END;
$function$
