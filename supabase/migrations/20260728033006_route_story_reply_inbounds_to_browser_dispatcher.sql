-- Inbound replies to Shannon's own Instagram Stories need the native Story
-- frame visible in Direct. Route those exact messages to the browser
-- dispatcher instead of the generic API draft/send lanes. Keep one current
-- controller owner and preserve manual, safety, suppression, and Needs You
-- holds.
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

    IF FOUND AND (
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
        'why', 'Inbound reply to Shannon''s Story requires the native Story frame',
        'cooldown_scope', 'dm',
        'browser_story_reply_required', TRUE,
        'browser_dispatch_required', TRUE,
        'browser_dispatch_reason', 'inbound_story_reply_native_context',
        'native_story_context_required', TRUE,
        'browser_send_allowed', NOT v_linked_client,
        'linked_client', v_linked_client,
        'source_alert_id', p_source_alert_id,
        'story_id', nullif(trim(coalesce(p_story_id, '')), ''),
        'story_url', nullif(trim(coalesce(p_story_url, '')), ''),
        'story_context', nullif(left(coalesce(p_story_context, ''), 6000), ''),
        'routed_at', v_now
    );

    IF FOUND THEN
        UPDATE public.ig_next_actions
        SET owner = 'browser_dispatcher',
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
            'browser_dispatcher',
            'reply_inbound',
            980,
            v_now,
            v_now,
            v_reason,
            v_source.id,
            TRUE
        );
    END IF;

    RETURN jsonb_build_object(
        'outcome',
        CASE
            WHEN v_action.id IS NOT NULL
                 AND v_action.owner = 'browser_dispatcher'
                 AND v_action.action_type = 'reply_inbound'
            THEN 'browser_dispatch_already_active'
            ELSE 'browser_dispatch_queued'
        END,
        'action_id', v_result.id,
        'owner', v_result.owner,
        'status', v_result.status,
        'latest_message_id', v_source.id,
        'linked_client', v_linked_client,
        'browser_send_allowed', NOT v_linked_client,
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
) IS 'Atomically routes the latest inbound reply to Shannon''s Instagram Story to the native browser dispatcher while preserving manual, safety, suppression, and Needs You holds.';
