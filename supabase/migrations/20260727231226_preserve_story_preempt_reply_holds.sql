-- Keep the first migration's exact inbound-pre-emption implementation behind
-- a guarded entry point. A Story sighting must not erase a DM manager's
-- completed review receipt or a source alert's explicit review/safety hold.
ALTER FUNCTION public.prioritize_story_viewer_unanswered_inbound(UUID, UUID, TEXT)
    RENAME TO prioritize_story_viewer_unanswered_inbound_unchecked;

REVOKE ALL ON FUNCTION public.prioritize_story_viewer_unanswered_inbound_unchecked(UUID, UUID, TEXT)
    FROM PUBLIC, anon, authenticated, service_role;

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
    v_action public.ig_next_actions%ROWTYPE;
    v_hold_alert_id UUID;
    v_hold_code TEXT;
BEGIN
    SELECT * INTO v_action
    FROM public.ig_next_actions
    WHERE thread_id = p_thread_id
    FOR UPDATE;

    IF FOUND
       AND v_action.owner = 'dm_manager'
       AND v_action.status IN ('waiting', 'completed', 'cancelled')
       AND coalesce(v_action.receipt, '{}'::jsonb) <> '{}'::jsonb THEN
        RETURN jsonb_build_object(
            'outcome', 'dm_manager_review_hold_preserved',
            'action_id', v_action.id,
            'status', v_action.status,
            'latest_message_id', v_action.source_message_id,
            'status_reason', v_action.receipt ->> 'status_reason'
        );
    END IF;

    SELECT ca.id, ca.data ->> 'last_send_error_code'
    INTO v_hold_alert_id, v_hold_code
    FROM public.coach_alerts ca
    WHERE ca.data ->> 'ig_thread_id' = p_thread_id::text
      AND ca.status IN ('pending', 'scheduled')
      AND (
          nullif(trim(coalesce(ca.data ->> 'last_send_error_code', '')), '') IS NOT NULL
          OR lower(coalesce(ca.data ->> 'needs_you_required', 'false')) = 'true'
          OR lower(coalesce(ca.data ->> 'needs_shannon_approval', 'false')) = 'true'
          OR lower(coalesce(ca.data ->> 'manual_review_required', 'false')) = 'true'
          OR lower(coalesce(ca.data ->> 'safety_hold', 'false')) = 'true'
          OR lower(coalesce(ca.data ->> 'media_hold', 'false')) = 'true'
          OR lower(coalesce(ca.data ->> 'authenticity_hold', 'false')) = 'true'
          OR lower(coalesce(ca.data ->> 'personal_boundary_hold', 'false')) = 'true'
      )
    ORDER BY ca.created_at DESC
    LIMIT 1;

    IF FOUND THEN
        RETURN jsonb_build_object(
            'outcome', 'source_alert_hold_preserved',
            'action_id', v_action.id,
            'alert_id', v_hold_alert_id,
            'hold_code', v_hold_code,
            'latest_message_id', v_action.source_message_id
        );
    END IF;

    RETURN public.prioritize_story_viewer_unanswered_inbound_unchecked(
        p_thread_id,
        p_observed_message_id,
        p_run_id
    );
END;
$$;

REVOKE ALL ON FUNCTION public.prioritize_story_viewer_unanswered_inbound(UUID, UUID, TEXT)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prioritize_story_viewer_unanswered_inbound(UUID, UUID, TEXT)
    TO service_role;

COMMENT ON FUNCTION public.prioritize_story_viewer_unanswered_inbound(UUID, UUID, TEXT)
IS 'Prioritizes a Story-discovered unanswered inbound only when no prior DM-manager review receipt or source-alert hold must be preserved.';
