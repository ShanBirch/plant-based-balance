-- Durable handoff and single-owner lease for the 24-hour Instagram browser
-- dispatcher. Per-person work remains in ig_next_actions; this table records
-- shift-level progress so a later run can safely resume a lane.

CREATE TABLE public.ig_browser_shift_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id TEXT NOT NULL UNIQUE,
    lane TEXT NOT NULL,
    slot SMALLINT NOT NULL,
    status TEXT NOT NULL DEFAULT 'running',
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    heartbeat_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    lease_expires_at TIMESTAMPTZ NOT NULL,
    cursor_start JSONB NOT NULL DEFAULT '{}'::JSONB,
    cursor_current JSONB NOT NULL DEFAULT '{}'::JSONB,
    cursor_end JSONB NOT NULL DEFAULT '{}'::JSONB,
    counts JSONB NOT NULL DEFAULT '{}'::JSONB,
    last_surface JSONB NOT NULL DEFAULT '{}'::JSONB,
    canonical_ids JSONB NOT NULL DEFAULT '[]'::JSONB,
    uncertain_actions JSONB NOT NULL DEFAULT '[]'::JSONB,
    block_evidence JSONB NOT NULL DEFAULT '[]'::JSONB,
    next_resume JSONB NOT NULL DEFAULT '{}'::JSONB,
    receipt JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ig_browser_shift_runs_run_id_not_blank CHECK (length(trim(run_id)) > 0),
    CONSTRAINT ig_browser_shift_runs_lane_check CHECK (lane IN (
        'ranked_story_nurture',
        'follower_notifications',
        'hot_lead_feed_nurture',
        'external_comment_and_mention_replies',
        'plant_based_discovery_follows',
        'missed_dm_audit',
        'active_client_instagram_community'
    )),
    CONSTRAINT ig_browser_shift_runs_slot_check CHECK (slot BETWEEN 0 AND 7),
    CONSTRAINT ig_browser_shift_runs_status_check CHECK (status IN (
        'running', 'completed', 'partial', 'blocked', 'interrupted'
    )),
    CONSTRAINT ig_browser_shift_runs_json_shapes_check CHECK (
        jsonb_typeof(cursor_start) = 'object'
        AND jsonb_typeof(cursor_current) = 'object'
        AND jsonb_typeof(cursor_end) = 'object'
        AND jsonb_typeof(counts) = 'object'
        AND jsonb_typeof(last_surface) = 'object'
        AND jsonb_typeof(canonical_ids) = 'array'
        AND jsonb_typeof(uncertain_actions) = 'array'
        AND jsonb_typeof(block_evidence) = 'array'
        AND jsonb_typeof(next_resume) = 'object'
        AND jsonb_typeof(receipt) = 'object'
    )
);

CREATE UNIQUE INDEX ig_browser_shift_runs_one_running_idx
    ON public.ig_browser_shift_runs ((TRUE))
    WHERE status = 'running';

CREATE INDEX ig_browser_shift_runs_lane_handoff_idx
    ON public.ig_browser_shift_runs (lane, started_at DESC);

CREATE INDEX ig_browser_shift_runs_lease_idx
    ON public.ig_browser_shift_runs (lease_expires_at)
    WHERE status = 'running';

DROP TRIGGER IF EXISTS trg_ig_browser_shift_runs_updated_at ON public.ig_browser_shift_runs;
CREATE TRIGGER trg_ig_browser_shift_runs_updated_at
    BEFORE UPDATE ON public.ig_browser_shift_runs
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.ig_browser_shift_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.ig_browser_shift_runs FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.ig_browser_shift_runs TO service_role;

-- Acquire the single dispatcher lease and return the most recent same-lane
-- handoff in the same transaction. An expired owner is marked interrupted
-- before a new run is admitted. Repeating the same run_id is idempotent.
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
            'run', to_jsonb(v_run)
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

    INSERT INTO public.ig_browser_shift_runs (
        run_id,
        lane,
        slot,
        lease_expires_at,
        cursor_start,
        cursor_current,
        next_resume,
        receipt
    ) VALUES (
        trim(p_run_id),
        p_lane,
        p_slot,
        NOW() + make_interval(secs => v_lease_seconds),
        COALESCE(p_cursor_start, '{}'::JSONB),
        CASE
            WHEN FOUND AND v_handoff.next_resume <> '{}'::JSONB THEN v_handoff.next_resume
            WHEN FOUND AND v_handoff.cursor_end <> '{}'::JSONB THEN v_handoff.cursor_end
            WHEN FOUND THEN v_handoff.cursor_current
            ELSE COALESCE(p_cursor_start, '{}'::JSONB)
        END,
        '{}'::JSONB,
        jsonb_build_object(
            'handoff_from_run_id', CASE WHEN FOUND THEN v_handoff.run_id ELSE NULL END,
            'handoff_from_status', CASE WHEN FOUND THEN v_handoff.status ELSE NULL END
        )
    )
    RETURNING * INTO v_run;

    RETURN jsonb_build_object(
        'acquired', TRUE,
        'idempotent', FALSE,
        'run', to_jsonb(v_run),
        'handoff', CASE WHEN v_handoff.id IS NULL THEN NULL ELSE to_jsonb(v_handoff) END
    );
END;
$$;

-- Write the full current checkpoint after each inspected person/native action.
-- Array and object fields are snapshots, not append-only fragments, which
-- keeps retry behavior deterministic.
CREATE OR REPLACE FUNCTION public.heartbeat_ig_browser_shift(
    p_run_id TEXT,
    p_cursor_current JSONB DEFAULT NULL,
    p_counts JSONB DEFAULT NULL,
    p_last_surface JSONB DEFAULT NULL,
    p_canonical_ids JSONB DEFAULT NULL,
    p_uncertain_actions JSONB DEFAULT NULL,
    p_block_evidence JSONB DEFAULT NULL,
    p_next_resume JSONB DEFAULT NULL,
    p_lease_seconds INTEGER DEFAULT 2100
)
RETURNS public.ig_browser_shift_runs
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_result public.ig_browser_shift_runs%ROWTYPE;
    v_lease_seconds INTEGER := LEAST(GREATEST(COALESCE(p_lease_seconds, 2100), 300), 3600);
BEGIN
    IF p_cursor_current IS NOT NULL AND jsonb_typeof(p_cursor_current) <> 'object'
       OR p_counts IS NOT NULL AND jsonb_typeof(p_counts) <> 'object'
       OR p_last_surface IS NOT NULL AND jsonb_typeof(p_last_surface) <> 'object'
       OR p_canonical_ids IS NOT NULL AND jsonb_typeof(p_canonical_ids) <> 'array'
       OR p_uncertain_actions IS NOT NULL AND jsonb_typeof(p_uncertain_actions) <> 'array'
       OR p_block_evidence IS NOT NULL AND jsonb_typeof(p_block_evidence) <> 'array'
       OR p_next_resume IS NOT NULL AND jsonb_typeof(p_next_resume) <> 'object' THEN
        RAISE EXCEPTION 'invalid Instagram browser checkpoint JSON shape';
    END IF;

    UPDATE public.ig_browser_shift_runs
    SET
        heartbeat_at = NOW(),
        lease_expires_at = NOW() + make_interval(secs => v_lease_seconds),
        cursor_current = COALESCE(p_cursor_current, cursor_current),
        counts = COALESCE(p_counts, counts),
        last_surface = COALESCE(p_last_surface, last_surface),
        canonical_ids = COALESCE(p_canonical_ids, canonical_ids),
        uncertain_actions = COALESCE(p_uncertain_actions, uncertain_actions),
        block_evidence = COALESCE(p_block_evidence, block_evidence),
        next_resume = COALESCE(p_next_resume, next_resume)
    WHERE run_id = trim(p_run_id)
      AND status = 'running'
      AND lease_expires_at > NOW()
    RETURNING * INTO v_result;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Instagram browser shift lease is missing or expired';
    END IF;
    RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.finish_ig_browser_shift(
    p_run_id TEXT,
    p_status TEXT,
    p_cursor_end JSONB DEFAULT '{}'::JSONB,
    p_counts JSONB DEFAULT '{}'::JSONB,
    p_canonical_ids JSONB DEFAULT '[]'::JSONB,
    p_uncertain_actions JSONB DEFAULT '[]'::JSONB,
    p_block_evidence JSONB DEFAULT '[]'::JSONB,
    p_next_resume JSONB DEFAULT '{}'::JSONB,
    p_receipt JSONB DEFAULT '{}'::JSONB
)
RETURNS public.ig_browser_shift_runs
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_status TEXT := lower(trim(coalesce(p_status, 'partial')));
    v_result public.ig_browser_shift_runs%ROWTYPE;
BEGIN
    IF v_status NOT IN ('completed', 'partial', 'blocked') THEN
        RAISE EXCEPTION 'invalid Instagram browser final status';
    END IF;
    IF jsonb_typeof(COALESCE(p_cursor_end, '{}'::JSONB)) <> 'object'
       OR jsonb_typeof(COALESCE(p_counts, '{}'::JSONB)) <> 'object'
       OR jsonb_typeof(COALESCE(p_canonical_ids, '[]'::JSONB)) <> 'array'
       OR jsonb_typeof(COALESCE(p_uncertain_actions, '[]'::JSONB)) <> 'array'
       OR jsonb_typeof(COALESCE(p_block_evidence, '[]'::JSONB)) <> 'array'
       OR jsonb_typeof(COALESCE(p_next_resume, '{}'::JSONB)) <> 'object'
       OR jsonb_typeof(COALESCE(p_receipt, '{}'::JSONB)) <> 'object' THEN
        RAISE EXCEPTION 'invalid Instagram browser final receipt JSON shape';
    END IF;

    UPDATE public.ig_browser_shift_runs
    SET
        status = v_status,
        ended_at = NOW(),
        heartbeat_at = NOW(),
        cursor_current = COALESCE(p_cursor_end, '{}'::JSONB),
        cursor_end = COALESCE(p_cursor_end, '{}'::JSONB),
        counts = COALESCE(p_counts, '{}'::JSONB),
        canonical_ids = COALESCE(p_canonical_ids, '[]'::JSONB),
        uncertain_actions = COALESCE(p_uncertain_actions, '[]'::JSONB),
        block_evidence = COALESCE(p_block_evidence, '[]'::JSONB),
        next_resume = COALESCE(p_next_resume, '{}'::JSONB),
        receipt = receipt || COALESCE(p_receipt, '{}'::JSONB)
            || jsonb_build_object('finalized_at', NOW())
    WHERE run_id = trim(p_run_id)
      AND status = 'running'
    RETURNING * INTO v_result;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Instagram browser shift is not owned by this running run id';
    END IF;
    RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_ig_browser_shift_handoff(p_lane TEXT)
RETURNS public.ig_browser_shift_runs
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
    SELECT r
    FROM public.ig_browser_shift_runs r
    WHERE r.lane = p_lane
    ORDER BY r.started_at DESC
    LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.start_ig_browser_shift(TEXT, TEXT, INTEGER, JSONB, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.heartbeat_ig_browser_shift(TEXT, JSONB, JSONB, JSONB, JSONB, JSONB, JSONB, JSONB, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finish_ig_browser_shift(TEXT, TEXT, JSONB, JSONB, JSONB, JSONB, JSONB, JSONB, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_ig_browser_shift_handoff(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.start_ig_browser_shift(TEXT, TEXT, INTEGER, JSONB, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.heartbeat_ig_browser_shift(TEXT, JSONB, JSONB, JSONB, JSONB, JSONB, JSONB, JSONB, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.finish_ig_browser_shift(TEXT, TEXT, JSONB, JSONB, JSONB, JSONB, JSONB, JSONB, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_ig_browser_shift_handoff(TEXT) TO service_role;

COMMENT ON TABLE public.ig_browser_shift_runs IS
    'Server-only shift ledger and global browser lease for the 24-hour Instagram dispatcher.';
