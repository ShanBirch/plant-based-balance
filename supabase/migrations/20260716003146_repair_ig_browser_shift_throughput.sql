-- Repair the 24-hour Instagram dispatcher after the Story-tray lane was added.
-- The ledger now accepts all eight configured lanes and owns the cumulative
-- interaction count per base shift, so same-lane cursor handoffs cannot leak
-- yesterday's/previous-shift actions into a new 30-minute budget.

ALTER TABLE public.ig_browser_shift_runs
    DROP CONSTRAINT IF EXISTS ig_browser_shift_runs_lane_check;

ALTER TABLE public.ig_browser_shift_runs
    ADD CONSTRAINT ig_browser_shift_runs_lane_check CHECK (lane IN (
        'ranked_story_nurture',
        'follower_notifications',
        'hot_lead_feed_nurture',
        'external_comment_and_mention_replies',
        'story_tray_discovery',
        'plant_based_discovery_follows',
        'missed_dm_audit',
        'active_client_instagram_community'
    ));

ALTER TABLE public.ig_browser_shift_runs
    ADD COLUMN IF NOT EXISTS base_run_id TEXT GENERATED ALWAYS AS (
        regexp_replace(run_id, '([:-])seg[0-9]+$', '')
    ) STORED;

CREATE INDEX IF NOT EXISTS ig_browser_shift_runs_base_run_idx
    ON public.ig_browser_shift_runs (base_run_id, started_at);

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
        CASE
            WHEN v_handoff_found AND v_handoff.next_resume <> '{}'::JSONB THEN v_handoff.next_resume
            WHEN v_handoff_found AND v_handoff.cursor_end <> '{}'::JSONB THEN v_handoff.cursor_end
            WHEN v_handoff_found THEN v_handoff.cursor_current
            ELSE COALESCE(p_cursor_start, '{}'::JSONB)
        END,
        jsonb_build_object('verified_native_actions', v_verified_native_actions),
        v_canonical_ids,
        '{}'::JSONB,
        jsonb_build_object(
            'handoff_from_run_id', CASE WHEN v_handoff_found THEN v_handoff.run_id ELSE NULL END,
            'handoff_from_status', CASE WHEN v_handoff_found THEN v_handoff.status ELSE NULL END,
            'handoff_is_same_base_shift', CASE WHEN v_handoff_found THEN v_handoff.base_run_id = v_base_run_id ELSE FALSE END
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

-- A verified Story reply is terminal. The safe_after timestamp remains useful
-- to the next upsert as cooldown evidence, but the old frame must not become a
-- claimable action again when that timestamp passes. Explicit cooldown results
-- remain claimable later because they represent work that has not been sent.
CREATE OR REPLACE FUNCTION public.complete_ig_next_action(
    p_action_id UUID,
    p_claim_token UUID,
    p_status TEXT DEFAULT 'waiting',
    p_safe_after TIMESTAMPTZ DEFAULT NULL,
    p_receipt JSONB DEFAULT '{}'::JSONB
)
RETURNS public.ig_next_actions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_existing public.ig_next_actions%ROWTYPE;
    v_status TEXT := lower(trim(coalesce(p_status, 'waiting')));
    v_safe_after TIMESTAMPTZ := p_safe_after;
    v_result public.ig_next_actions%ROWTYPE;
BEGIN
    SELECT * INTO v_existing FROM public.ig_next_actions
    WHERE id = p_action_id FOR UPDATE;

    IF NOT FOUND THEN RAISE EXCEPTION 'queue action not found'; END IF;
    IF v_existing.status <> 'claimed'
       OR v_existing.claim_token IS DISTINCT FROM p_claim_token
       OR v_existing.claim_expires_at <= now() THEN
        RAISE EXCEPTION 'queue action is not claimed by this lease';
    END IF;
    IF v_status NOT IN ('waiting', 'cooldown', 'completed', 'cancelled', 'blocked', 'needs_you') THEN
        RAISE EXCEPTION 'invalid completion status';
    END IF;

    IF v_existing.action_type = 'story_reply'
       AND v_status IN ('completed', 'cooldown') THEN
        v_safe_after := greatest(coalesce(v_safe_after, now()), now() + interval '24 hours');
    ELSIF v_existing.action_type = 'feed_engagement'
          AND v_status IN ('completed', 'cooldown') THEN
        v_status := 'cooldown';
        v_safe_after := greatest(coalesce(v_safe_after, now()), now() + interval '7 days');
    END IF;

    UPDATE public.ig_next_actions
    SET status = v_status,
        safe_after = v_safe_after,
        receipt = coalesce(v_existing.receipt, '{}'::jsonb)
            || coalesce(p_receipt, '{}'::jsonb)
            || jsonb_build_object('completed_at', now(), 'claim_run_id', v_existing.claim_run_id),
        claim_owner = NULL, claim_token = NULL, claim_run_id = NULL,
        claim_expires_at = NULL, completed_at = now()
    WHERE id = v_existing.id
    RETURNING * INTO v_result;

    RETURN v_result;
END;
$$;

UPDATE public.ig_next_actions
SET status = 'completed'
WHERE owner = 'story_operator'
  AND action_type = 'story_reply'
  AND status = 'cooldown'
  AND (
      receipt ? 'canonical_message_id'
      OR receipt ->> 'native_receipt_verified' = 'true'
      OR receipt ->> 'outcome' IN ('story_reply_sent_verified', 'sent_verified')
  );

REVOKE ALL ON FUNCTION public.start_ig_browser_shift(TEXT, TEXT, INTEGER, JSONB, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.start_ig_browser_shift(TEXT, TEXT, INTEGER, JSONB, INTEGER) TO service_role;

REVOKE ALL ON FUNCTION public.complete_ig_next_action(UUID, UUID, TEXT, TIMESTAMPTZ, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_ig_next_action(UUID, UUID, TEXT, TIMESTAMPTZ, JSONB) TO service_role;
