-- Keep durable lane cursors separate from cross-lane next_resume pointers.
-- A completed segment's next_resume normally names the following rotation
-- lane, so using it as the next same-lane cursor silently skipped browser work
-- and also carried stale interaction counts into a new base shift.

CREATE OR REPLACE FUNCTION public.start_ig_browser_shift(
    p_run_id TEXT,
    p_lane TEXT,
    p_slot INTEGER,
    p_cursor_start JSONB DEFAULT '{}'::JSONB,
    p_lease_seconds INTEGER DEFAULT 2100
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_run public.ig_browser_shift_runs%ROWTYPE;
    v_active public.ig_browser_shift_runs%ROWTYPE;
    v_handoff public.ig_browser_shift_runs%ROWTYPE;
    v_handoff_found BOOLEAN := FALSE;
    v_base_run_id TEXT := regexp_replace(trim(coalesce(p_run_id, '')), '([:-])seg[0-9]+$', '');
    v_verified_native_actions INTEGER := 0;
    v_canonical_ids JSONB := '[]'::JSONB;
    v_lane_cursor JSONB := '{}'::JSONB;
    v_lease_seconds INTEGER := LEAST(GREATEST(COALESCE(p_lease_seconds, 2100), 300), 3600);
BEGIN
    IF NULLIF(trim(coalesce(p_run_id, '')), '') IS NULL THEN
        RAISE EXCEPTION 'run id is required';
    END IF;
    IF p_lane NOT IN (
        'ranked_story_nurture',
        'follower_notifications',
        'hot_lead_feed_nurture',
        'external_comment_and_mention_replies',
        'story_tray_discovery',
        'plant_based_discovery_follows',
        'missed_dm_audit',
        'active_client_instagram_community'
    ) THEN
        RAISE EXCEPTION 'invalid Instagram browser lane';
    END IF;
    IF p_slot IS NULL OR p_slot < 0 OR p_slot > 7 THEN
        RAISE EXCEPTION 'invalid Instagram browser slot';
    END IF;
    IF jsonb_typeof(COALESCE(p_cursor_start, '{}'::JSONB)) <> 'object' THEN
        RAISE EXCEPTION 'cursor_start must be a JSON object';
    END IF;

    PERFORM pg_advisory_xact_lock(hashtextextended('ig_browser_shift_dispatcher', 0));

    SELECT * INTO v_run
    FROM public.ig_browser_shift_runs
    WHERE run_id = trim(p_run_id)
    FOR UPDATE;

    IF FOUND THEN
        RETURN jsonb_build_object(
            'acquired', v_run.status = 'running' AND v_run.lease_expires_at > NOW(),
            'idempotent', TRUE,
            'run', to_jsonb(v_run),
            'shift_state', jsonb_build_object(
                'base_run_id', v_run.base_run_id,
                'verified_native_actions', COALESCE((v_run.counts ->> 'verified_native_actions')::INTEGER, 0),
                'canonical_ids', v_run.canonical_ids
            )
        );
    END IF;

    UPDATE public.ig_browser_shift_runs
    SET
        status = 'interrupted',
        ended_at = COALESCE(ended_at, NOW()),
        receipt = receipt || jsonb_build_object(
            'interrupted_reason', 'lease_expired_before_finalization',
            'interrupted_at', NOW()
        )
    WHERE status = 'running'
      AND lease_expires_at <= NOW();

    SELECT * INTO v_active
    FROM public.ig_browser_shift_runs
    WHERE status = 'running'
      AND lease_expires_at > NOW()
    LIMIT 1;

    IF FOUND THEN
        RETURN jsonb_build_object(
            'acquired', FALSE,
            'reason', 'active_shift_lease',
            'active_run', to_jsonb(v_active)
        );
    END IF;

    SELECT * INTO v_handoff
    FROM public.ig_browser_shift_runs
    WHERE lane = p_lane
    ORDER BY started_at DESC
    LIMIT 1;
    v_handoff_found := FOUND;

    v_lane_cursor := CASE
        WHEN v_handoff_found
             AND v_handoff.status IN ('partial', 'blocked', 'interrupted')
             AND COALESCE(v_handoff.next_resume ->> 'lane', p_lane) = p_lane
             AND v_handoff.next_resume <> '{}'::JSONB
            THEN v_handoff.next_resume
        WHEN v_handoff_found
             AND v_handoff.cursor_end ->> 'lane' = p_lane
            THEN v_handoff.cursor_end
        WHEN v_handoff_found
             AND v_handoff.cursor_current ->> 'lane' = p_lane
            THEN v_handoff.cursor_current
        ELSE COALESCE(p_cursor_start, '{}'::JSONB)
    END;

    v_lane_cursor := (
        COALESCE(v_lane_cursor, '{}'::JSONB)
        - 'verified_native_actions'
        - 'interaction_budget_remaining'
        - 'canonical_ids'
    ) || jsonb_build_object('lane', p_lane, 'slot', p_slot);

    SELECT COALESCE(MAX(
        CASE
            WHEN (counts ->> 'verified_native_actions') ~ '^[0-9]+$'
                THEN (counts ->> 'verified_native_actions')::INTEGER
            ELSE 0
        END
    ), 0)
    INTO v_verified_native_actions
    FROM public.ig_browser_shift_runs
    WHERE base_run_id = v_base_run_id;

    SELECT COALESCE(jsonb_agg(DISTINCT action_item), '[]'::JSONB)
    INTO v_canonical_ids
    FROM public.ig_browser_shift_runs r
    CROSS JOIN LATERAL jsonb_array_elements(r.canonical_ids) AS action_items(action_item)
    WHERE r.base_run_id = v_base_run_id;

    v_verified_native_actions := GREATEST(
        v_verified_native_actions,
        jsonb_array_length(v_canonical_ids)
    );

    INSERT INTO public.ig_browser_shift_runs (
        run_id,
        lane,
        slot,
        lease_expires_at,
        cursor_start,
        cursor_current,
        counts,
        canonical_ids,
        next_resume,
        receipt
    ) VALUES (
        trim(p_run_id),
        p_lane,
        p_slot,
        NOW() + make_interval(secs => v_lease_seconds),
        COALESCE(p_cursor_start, '{}'::JSONB),
        v_lane_cursor,
        jsonb_build_object('verified_native_actions', v_verified_native_actions),
        v_canonical_ids,
        '{}'::JSONB,
        jsonb_build_object(
            'handoff_from_run_id', CASE WHEN v_handoff_found THEN v_handoff.run_id ELSE NULL END,
            'handoff_from_status', CASE WHEN v_handoff_found THEN v_handoff.status ELSE NULL END,
            'handoff_is_same_base_shift', CASE WHEN v_handoff_found THEN v_handoff.base_run_id = v_base_run_id ELSE FALSE END,
            'lane_cursor_source', CASE
                WHEN v_handoff_found
                     AND v_handoff.status IN ('partial', 'blocked', 'interrupted')
                     AND COALESCE(v_handoff.next_resume ->> 'lane', p_lane) = p_lane
                     AND v_handoff.next_resume <> '{}'::JSONB THEN 'same_lane_partial_next_resume'
                WHEN v_handoff_found AND v_handoff.cursor_end ->> 'lane' = p_lane THEN 'same_lane_cursor_end'
                WHEN v_handoff_found AND v_handoff.cursor_current ->> 'lane' = p_lane THEN 'same_lane_cursor_current'
                ELSE 'provided_cursor_start'
            END
        )
    )
    RETURNING * INTO v_run;

    RETURN jsonb_build_object(
        'acquired', TRUE,
        'idempotent', FALSE,
        'run', to_jsonb(v_run),
        'handoff', CASE WHEN v_handoff.id IS NULL THEN NULL ELSE to_jsonb(v_handoff) END,
        'shift_state', jsonb_build_object(
            'base_run_id', v_base_run_id,
            'verified_native_actions', v_verified_native_actions,
            'canonical_ids', v_canonical_ids
        )
    );
END;
$$;

-- Correct a just-started segment only when no heartbeat/action has happened.
-- This repairs the in-flight shift that exposed the cross-lane handoff bug
-- without overwriting live operator progress.
WITH replacement AS (
    SELECT
        running.id,
        (
            COALESCE(previous.cursor_end, previous.cursor_current, running.cursor_start, '{}'::JSONB)
            - 'verified_native_actions'
            - 'interaction_budget_remaining'
            - 'canonical_ids'
        ) || jsonb_build_object('lane', running.lane, 'slot', running.slot) AS corrected_cursor
    FROM public.ig_browser_shift_runs running
    LEFT JOIN LATERAL (
        SELECT prior.cursor_end, prior.cursor_current
        FROM public.ig_browser_shift_runs prior
        WHERE prior.lane = running.lane
          AND prior.id <> running.id
          AND prior.started_at < running.started_at
        ORDER BY prior.started_at DESC
        LIMIT 1
    ) previous ON TRUE
    WHERE running.status = 'running'
      AND running.heartbeat_at = running.started_at
      AND COALESCE((running.counts ->> 'verified_native_actions')::INTEGER, 0) = 0
      AND running.canonical_ids = '[]'::JSONB
      AND running.cursor_current ->> 'lane' IS DISTINCT FROM running.lane
)
UPDATE public.ig_browser_shift_runs running
SET
    cursor_current = replacement.corrected_cursor,
    receipt = running.receipt || jsonb_build_object(
        'cross_lane_cursor_repaired_at', NOW(),
        'cross_lane_cursor_repaired', TRUE
    )
FROM replacement
WHERE running.id = replacement.id;

REVOKE ALL ON FUNCTION public.start_ig_browser_shift(TEXT, TEXT, INTEGER, JSONB, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.start_ig_browser_shift(TEXT, TEXT, INTEGER, JSONB, INTEGER) TO service_role;
