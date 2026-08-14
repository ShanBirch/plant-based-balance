-- Recover unanswered Instagram/Facebook lead DMs whose API delivery failed or
-- whose approved reply stalled. The API manager gets the first retry; a known
-- non-retryable Graph/window failure or a reply still unanswered after one hour
-- is handed to the native browser dispatcher. Canonical ig_messages remains the
-- delivery truth, so this function never reopens a thread whose latest message
-- is already outbound.

CREATE OR REPLACE FUNCTION public.reconcile_unanswered_dm_delivery_failures(
    p_limit INTEGER DEFAULT 40,
    p_manager_retry_after INTERVAL DEFAULT INTERVAL '2 minutes',
    p_browser_rescue_after INTERVAL DEFAULT INTERVAL '60 minutes'
)
RETURNS TABLE (
    thread_id UUID,
    alert_id UUID,
    action_id UUID,
    source_message_id UUID,
    recovery_owner TEXT,
    recovery_outcome TEXT,
    unanswered_seconds INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_candidate RECORD;
    v_action public.ig_next_actions%ROWTYPE;
    v_result public.ig_next_actions%ROWTYPE;
    v_now TIMESTAMPTZ := clock_timestamp();
    v_owner TEXT;
    v_outcome TEXT;
    v_draft TEXT;
    v_error TEXT;
    v_error_code TEXT;
    v_reason JSONB;
    v_attempts INTEGER;
BEGIN
    FOR v_candidate IN
        WITH latest_message AS (
            SELECT DISTINCT ON (m.thread_id)
                m.thread_id,
                m.id,
                m.direction,
                m.text,
                m.created_at,
                m.alert_id
            FROM public.ig_messages m
            WHERE m.created_at >= v_now - INTERVAL '7 days'
            ORDER BY m.thread_id, m.created_at DESC, m.id DESC
        )
        SELECT
            t.id AS candidate_thread_id,
            t.ig_username,
            COALESCE(NULLIF(t.lead_stage, ''), 'new') AS lead_state,
            lm.id AS inbound_id,
            lm.text AS inbound_text,
            lm.created_at AS inbound_at,
            ca.id AS candidate_alert_id,
            ca.status AS alert_status,
            ca.scheduled_for,
            ca.suggested_message,
            ca.scheduled_reply_text,
            ca.data AS alert_data
        FROM latest_message lm
        JOIN public.ig_threads t ON t.id = lm.thread_id
        JOIN LATERAL (
            SELECT candidate_alert.*
            FROM public.coach_alerts candidate_alert
            WHERE candidate_alert.alert_type IN ('incoming_dm', 'ig_incoming_dm', 'fb_incoming_dm')
              AND (
                  candidate_alert.id = lm.alert_id
                  OR candidate_alert.data->>'ig_thread_id' = t.id::TEXT
              )
              AND candidate_alert.created_at >= lm.created_at - INTERVAL '2 minutes'
            ORDER BY (candidate_alert.id = lm.alert_id) DESC, candidate_alert.created_at DESC
            LIMIT 1
        ) ca ON TRUE
        WHERE lower(COALESCE(lm.direction, '')) = 'in'
          AND lm.created_at <= v_now - GREATEST(p_manager_retry_after, INTERVAL '30 seconds')
          AND t.linked_user_id IS NULL
          AND NULLIF(trim(COALESCE(t.ig_username, '')), '') IS NOT NULL
          AND COALESCE(lm.text, '') !~ '^\[IG_STORY_REPLY_CONTEXT\]'
          AND COALESCE(lm.text, '') !~* '^\[(?:attachment|photo|image|video|audio|voice)[:\]]'
          AND NOT (
              lower(COALESCE(ca.data->>'needs_you_required', 'false')) = 'true'
              OR lower(COALESCE(ca.data->>'needs_shannon_approval', 'false')) = 'true'
              OR lower(COALESCE(ca.data->>'client_manager_review_required', 'false')) = 'true'
              OR lower(COALESCE(ca.data->>'linked_client_manual_review', 'false')) = 'true'
              OR lower(COALESCE(ca.data->>'permanent_needs_you_draft_only', 'false')) = 'true'
              OR lower(COALESCE(ca.data->>'support_exception', 'false')) = 'true'
              OR lower(COALESCE(ca.data->>'native_story_context_required', 'false')) = 'true'
              OR lower(COALESCE(ca.data->>'browser_story_reply_required', 'false')) = 'true'
              OR lower(COALESCE(ca.data->>'operator_queue', '')) IN ('needs_you', 'manual', 'support_operator')
          )
          AND NULLIF(trim(COALESCE(
              ca.scheduled_reply_text,
              ca.suggested_message,
              ca.data->>'draft_text',
              ca.data->>'sent_message'
          )), '') IS NOT NULL
          AND (
              NULLIF(trim(COALESCE(ca.data->>'last_send_error', '')), '') IS NOT NULL
              OR (
                  ca.status = 'scheduled'
                  AND ca.scheduled_for < v_now - INTERVAL '2 minutes'
              )
              OR (
                  ca.status = 'pending'
                  AND lm.created_at <= v_now - GREATEST(p_browser_rescue_after, INTERVAL '10 minutes')
              )
              OR (
                  ca.status = 'sent'
                  AND ca.actioned_at >= lm.created_at
              )
          )
        ORDER BY
            CASE
                WHEN lower(COALESCE(ca.data->'qualifier'->>'commercial_stage', '')) IN ('buyer_intent', 'offer_ready') THEN 0
                ELSE 1
            END,
            lm.created_at ASC
        LIMIT LEAST(GREATEST(COALESCE(p_limit, 40), 1), 100)
    LOOP
        SELECT * INTO v_action
        FROM public.ig_next_actions queued
        WHERE queued.thread_id = v_candidate.candidate_thread_id
        ORDER BY queued.updated_at DESC, queued.created_at DESC
        LIMIT 1
        FOR UPDATE;

        -- A live human/safety hold or an active lease keeps ownership. A browser
        -- rescue already queued for this exact inbound is also left untouched.
        IF FOUND AND (
            v_action.owner = 'manual'
            OR v_action.status IN ('needs_you', 'blocked')
            OR (v_action.status = 'claimed' AND v_action.claim_expires_at > v_now)
            OR lower(COALESCE(v_action.reason->>'native_story_context_required', 'false')) = 'true'
            OR lower(COALESCE(v_action.reason->>'browser_story_reply_required', 'false')) = 'true'
        ) THEN
            CONTINUE;
        END IF;

        IF FOUND
           AND v_action.owner = 'browser_dispatcher'
           AND v_action.action_type = 'reply_inbound'
           AND v_action.source_message_id = v_candidate.inbound_id
           AND v_action.status IN ('ready', 'waiting', 'claimed') THEN
            CONTINUE;
        END IF;

        IF FOUND
           AND v_action.owner = 'dm_manager'
           AND v_action.action_type = 'reply_inbound'
           AND v_action.source_message_id = v_candidate.inbound_id
           AND v_action.status = 'ready'
           AND lower(COALESCE(v_action.reason->>'failed_delivery_rescue', 'false')) = 'true'
           AND v_action.updated_at > v_now - INTERVAL '8 minutes'
           AND v_candidate.inbound_at > v_now - GREATEST(p_browser_rescue_after, INTERVAL '10 minutes') THEN
            CONTINUE;
        END IF;

        v_draft := trim(COALESCE(
            v_candidate.scheduled_reply_text,
            v_candidate.suggested_message,
            v_candidate.alert_data->>'draft_text',
            v_candidate.alert_data->>'sent_message'
        ));
        v_error := trim(COALESCE(v_candidate.alert_data->>'last_send_error', ''));
        v_error_code := lower(trim(COALESCE(v_candidate.alert_data->>'last_send_error_code', '')));

        -- Permanent API/window failures should not waste another Graph attempt.
        -- Everything else receives one API-manager recovery window before the
        -- native browser dispatcher becomes the backstop.
        IF v_candidate.inbound_at <= v_now - GREATEST(p_browser_rescue_after, INTERVAL '10 minutes')
           OR lower(v_error) ~ '(outside (?:the )?allowed window|human agent|instagram graph 403|graph 403|recipient unavailable)'
           OR v_error_code ~ '(outside.*window|human_agent|graph_403|recipient_unavailable)' THEN
            v_owner := 'browser_dispatcher';
            v_outcome := 'browser_rescue_queued';
        ELSE
            v_owner := 'dm_manager';
            v_outcome := 'api_retry_reopened';
        END IF;

        v_attempts := CASE
            WHEN COALESCE(v_candidate.alert_data->>'delivery_rescue_attempts', '') ~ '^\d+$'
                THEN (v_candidate.alert_data->>'delivery_rescue_attempts')::INTEGER
            ELSE 0
        END + 1;
        v_reason := jsonb_build_object(
            'source', 'unanswered_delivery_watchdog',
            'why', 'Latest canonical message is still inbound after a failed or stalled approved reply',
            'cooldown_scope', 'dm',
            'failed_delivery_rescue', TRUE,
            'browser_dispatch_required', v_owner = 'browser_dispatcher',
            'browser_dispatch_reason', CASE WHEN v_owner = 'browser_dispatcher' THEN 'failed_api_reply_rescue' ELSE NULL END,
            'browser_send_allowed', v_owner = 'browser_dispatcher',
            'source_alert_id', v_candidate.candidate_alert_id,
            'source_inbound_id', v_candidate.inbound_id,
            'approved_reply_text', v_draft,
            'last_send_error', NULLIF(v_error, ''),
            'last_send_error_code', NULLIF(v_error_code, ''),
            'recovery_attempt', v_attempts,
            'queued_at', v_now
        );

        UPDATE public.coach_alerts
        SET status = 'pending',
            scheduled_for = NULL,
            scheduled_at = NULL,
            data = COALESCE(data, '{}'::JSONB) || jsonb_build_object(
                'delivery_rescue_required', TRUE,
                'delivery_rescue_owner', v_owner,
                'delivery_rescue_reason', CASE WHEN v_owner = 'browser_dispatcher' THEN 'failed_api_reply_rescue' ELSE 'api_retry_reopened' END,
                'delivery_rescue_attempts', v_attempts,
                'delivery_rescue_queued_at', v_now,
                'delivery_rescue_source_inbound_id', v_candidate.inbound_id,
                'outbound_attempted', FALSE,
                'operator_queue', CASE WHEN v_owner = 'browser_dispatcher' THEN 'browser_dispatcher' ELSE NULL END
            )
        WHERE id = v_candidate.candidate_alert_id;

        IF v_action.id IS NOT NULL THEN
            UPDATE public.ig_next_actions
            SET owner = v_owner,
                status = 'ready',
                action_type = 'reply_inbound',
                priority = GREATEST(v_action.priority, CASE WHEN v_owner = 'browser_dispatcher' THEN 1200 ELSE 1100 END),
                due_at = v_now,
                safe_after = v_now,
                source_message_id = v_candidate.inbound_id,
                reason = COALESCE(v_action.reason, '{}'::JSONB) || v_reason,
                claim_owner = NULL,
                claim_token = NULL,
                claim_run_id = NULL,
                claim_expires_at = NULL,
                action_version = v_action.action_version + 1,
                receipt = COALESCE(v_action.receipt, '{}'::JSONB) || jsonb_build_object(
                    'delivery_rescue_reopened_at', v_now,
                    'delivery_rescue_previous_status', v_action.status,
                    'delivery_rescue_previous_owner', v_action.owner
                ),
                completed_at = NULL,
                updated_at = v_now
            WHERE id = v_action.id
            RETURNING * INTO v_result;
        ELSE
            SELECT * INTO v_result
            FROM public.upsert_ig_next_action(
                v_candidate.candidate_thread_id,
                v_candidate.ig_username,
                v_candidate.lead_state,
                v_owner,
                'reply_inbound',
                CASE WHEN v_owner = 'browser_dispatcher' THEN 1200 ELSE 1100 END,
                v_now,
                v_now,
                v_reason,
                v_candidate.inbound_id,
                TRUE
            );
        END IF;

        thread_id := v_candidate.candidate_thread_id;
        alert_id := v_candidate.candidate_alert_id;
        action_id := v_result.id;
        source_message_id := v_candidate.inbound_id;
        recovery_owner := v_owner;
        recovery_outcome := v_outcome;
        unanswered_seconds := GREATEST(0, EXTRACT(EPOCH FROM (v_now - v_candidate.inbound_at))::INTEGER);
        RETURN NEXT;
    END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.reconcile_unanswered_dm_delivery_failures(INTEGER, INTERVAL, INTERVAL)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_unanswered_dm_delivery_failures(INTEGER, INTERVAL, INTERVAL)
TO service_role;

COMMENT ON FUNCTION public.reconcile_unanswered_dm_delivery_failures(INTEGER, INTERVAL, INTERVAL)
IS 'Reopens canonically unanswered, safe unlinked-lead reply failures for the API manager, then promotes non-retryable or one-hour misses to the native browser dispatcher without duplicating delivered replies.';
