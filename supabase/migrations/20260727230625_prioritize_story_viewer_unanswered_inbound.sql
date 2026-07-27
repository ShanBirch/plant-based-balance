-- A Story lane can discover a conversation before its queued inbound reply is
-- worked. Atomically make that exact latest inbound the relationship's next
-- action without allowing the browser to become a second conversational
-- sender. The DM manager retains reply ownership and its full-thread safety
-- review; linked-client/manual/safety holds remain intact.
CREATE OR REPLACE FUNCTION public.prioritize_story_viewer_unanswered_inbound(
    p_thread_id UUID,
    p_observed_message_id UUID DEFAULT NULL,
    p_run_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_thread public.ig_threads%ROWTYPE;
    v_latest public.ig_messages%ROWTYPE;
    v_action public.ig_next_actions%ROWTYPE;
    v_result public.ig_next_actions%ROWTYPE;
    v_now TIMESTAMPTZ := NOW();
    v_action_type TEXT := 'reply_inbound';
    v_priority INTEGER := 900;
    v_lead_state TEXT;
BEGIN
    SELECT * INTO v_thread
    FROM public.ig_threads
    WHERE id = p_thread_id
    FOR UPDATE;

    IF NOT FOUND OR lower(coalesce(v_thread.channel, '')) <> 'instagram' THEN
        RETURN jsonb_build_object('outcome', 'thread_not_found');
    END IF;

    SELECT * INTO v_latest
    FROM public.ig_messages
    WHERE thread_id = p_thread_id
    ORDER BY created_at DESC, id DESC
    LIMIT 1;

    IF NOT FOUND OR lower(coalesce(v_latest.direction, '')) <> 'in' THEN
        RETURN jsonb_build_object('outcome', 'no_unanswered_inbound');
    END IF;

    IF p_observed_message_id IS NOT NULL AND v_latest.id IS DISTINCT FROM p_observed_message_id THEN
        RETURN jsonb_build_object(
            'outcome', 'observed_message_is_stale',
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
       OR lower(coalesce(v_thread.custom_data ->> 'ai_automation_opt_out', 'false')) = 'true' THEN
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

    IF FOUND AND v_action.owner = 'browser_dispatcher'
       AND v_action.action_type = 'reply_inbound'
       AND v_action.status IN ('ready', 'waiting', 'claimed') THEN
        RETURN jsonb_build_object(
            'outcome', 'browser_handoff_already_active',
            'action_id', v_action.id,
            'latest_message_id', v_latest.id
        );
    END IF;

    IF FOUND AND v_action.owner IN ('manual')
       OR (FOUND AND v_action.status IN ('needs_you', 'blocked')) THEN
        RETURN jsonb_build_object(
            'outcome', 'existing_hold_preserved',
            'action_id', v_action.id,
            'owner', v_action.owner,
            'status', v_action.status,
            'latest_message_id', v_latest.id
        );
    END IF;

    IF FOUND AND v_action.owner = 'dm_manager'
       AND v_action.status = 'claimed'
       AND v_action.claim_expires_at > v_now THEN
        RETURN jsonb_build_object(
            'outcome', 'dm_manager_already_claimed',
            'action_id', v_action.id,
            'latest_message_id', v_latest.id
        );
    END IF;

    IF lower(trim(coalesce(v_latest.text, ''))) ~ '\m(book|booking|call|chat)\M' THEN
        v_action_type := 'book_call';
        v_priority := 1000;
    ELSIF lower(trim(coalesce(v_latest.text, ''))) ~ '\m(price|cost|how much|sign up|signup|join|start|link|ready|coaching)\M' THEN
        v_action_type := 'close_sale';
        v_priority := 950;
    END IF;

    v_lead_state := CASE
        WHEN v_thread.linked_user_id IS NOT NULL OR v_thread.lead_stage IN ('in_app', 'paying') THEN 'client'
        ELSE coalesce(nullif(v_thread.lead_stage, ''), 'new')
    END;

    IF FOUND THEN
        UPDATE public.ig_next_actions
        SET owner = 'dm_manager',
            status = 'ready',
            action_type = v_action_type,
            priority = greatest(v_action.priority, v_priority),
            due_at = v_now,
            safe_after = v_now,
            source_message_id = v_latest.id,
            reason = coalesce(v_action.reason, '{}'::jsonb) || jsonb_build_object(
                'story_viewer_unanswered_preempt', true,
                'story_viewer_preempted_at', v_now,
                'story_viewer_dispatch_run_id', nullif(trim(coalesce(p_run_id, '')), ''),
                'source', 'story_viewer_native_unanswered_check',
                'why', 'Story viewer has an unanswered latest Instagram message'
            ),
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
            v_action_type,
            v_priority,
            v_now,
            v_now,
            jsonb_build_object(
                'story_viewer_unanswered_preempt', true,
                'story_viewer_preempted_at', v_now,
                'story_viewer_dispatch_run_id', nullif(trim(coalesce(p_run_id, '')), ''),
                'source', 'story_viewer_native_unanswered_check',
                'why', 'Story viewer has an unanswered latest Instagram message'
            ),
            v_latest.id,
            TRUE
        );
    END IF;

    RETURN jsonb_build_object(
        'outcome', 'dm_manager_prioritized',
        'action_id', v_result.id,
        'action_type', v_result.action_type,
        'owner', v_result.owner,
        'status', v_result.status,
        'latest_message_id', v_latest.id,
        'linked_client', v_thread.linked_user_id IS NOT NULL,
        'action_version', v_result.action_version
    );
END;
$$;

REVOKE ALL ON FUNCTION public.prioritize_story_viewer_unanswered_inbound(UUID, UUID, TEXT)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prioritize_story_viewer_unanswered_inbound(UUID, UUID, TEXT)
    TO service_role;

COMMENT ON FUNCTION public.prioritize_story_viewer_unanswered_inbound(UUID, UUID, TEXT)
IS 'Pre-empts a proactive Story touch when native Instagram reveals an unanswered latest inbound, preserving one DM-manager reply owner and all manual/client safety gates.';
