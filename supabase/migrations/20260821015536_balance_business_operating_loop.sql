-- Balance business operating loop
--
-- One source-backed scorecard joins acquisition, sales, delivery, autonomy,
-- and shipped work. The daily worker persists the snapshot and sends Shannon
-- one compact phone notification with the current constraint and next move.

CREATE TABLE IF NOT EXISTS public.balance_business_changes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    commit_sha TEXT,
    area TEXT NOT NULL,
    summary TEXT NOT NULL,
    expected_metric TEXT,
    status TEXT NOT NULL DEFAULT 'shipped',
    source TEXT NOT NULL DEFAULT 'codex',
    metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT balance_business_changes_area_not_blank CHECK (length(trim(area)) > 0),
    CONSTRAINT balance_business_changes_summary_not_blank CHECK (length(trim(summary)) > 0),
    CONSTRAINT balance_business_changes_status_check CHECK (status IN ('shipped', 'validated', 'rolled_back', 'superseded'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_balance_business_changes_commit_summary
    ON public.balance_business_changes (COALESCE(commit_sha, ''), summary);

CREATE INDEX IF NOT EXISTS idx_balance_business_changes_occurred_at
    ON public.balance_business_changes (occurred_at DESC);

ALTER TABLE public.balance_business_changes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read Balance business changes" ON public.balance_business_changes;
CREATE POLICY "Admins can read Balance business changes"
    ON public.balance_business_changes
    FOR SELECT
    TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.admin_users au WHERE au.user_id = (SELECT auth.uid())
    ));

REVOKE ALL ON TABLE public.balance_business_changes FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.balance_business_changes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.balance_business_changes TO service_role;

CREATE TABLE IF NOT EXISTS public.balance_business_scorecards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scorecard_date DATE NOT NULL,
    window_days INTEGER NOT NULL DEFAULT 7 CHECK (window_days BETWEEN 1 AND 90),
    window_start TIMESTAMPTZ NOT NULL,
    window_end TIMESTAMPTZ NOT NULL,
    release_ref TEXT,
    metrics JSONB NOT NULL DEFAULT '{}'::JSONB,
    data_quality JSONB NOT NULL DEFAULT '{}'::JSONB,
    primary_constraint TEXT NOT NULL,
    next_action TEXT NOT NULL,
    recent_changes JSONB NOT NULL DEFAULT '[]'::JSONB,
    notification_attempted_at TIMESTAMPTZ,
    notification_sent_at TIMESTAMPTZ,
    notification_status TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT balance_business_scorecards_window CHECK (window_end > window_start),
    CONSTRAINT balance_business_scorecards_constraint_not_blank CHECK (length(trim(primary_constraint)) > 0),
    CONSTRAINT balance_business_scorecards_next_action_not_blank CHECK (length(trim(next_action)) > 0),
    UNIQUE (scorecard_date)
);

CREATE INDEX IF NOT EXISTS idx_balance_business_scorecards_created_at
    ON public.balance_business_scorecards (created_at DESC);

ALTER TABLE public.balance_business_scorecards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read Balance business scorecards" ON public.balance_business_scorecards;
CREATE POLICY "Admins can read Balance business scorecards"
    ON public.balance_business_scorecards
    FOR SELECT
    TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.admin_users au WHERE au.user_id = (SELECT auth.uid())
    ));

REVOKE ALL ON TABLE public.balance_business_scorecards FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.balance_business_scorecards TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.balance_business_scorecards TO service_role;

CREATE OR REPLACE FUNCTION public.get_balance_business_scorecard(p_days INTEGER DEFAULT 7)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_days INTEGER := LEAST(GREATEST(COALESCE(p_days, 7), 1), 90);
    v_now TIMESTAMPTZ := NOW();
    v_start TIMESTAMPTZ;
    v_previous_start TIMESTAMPTZ;
    v_current JSONB;
    v_previous JSONB;
    v_data_quality JSONB;
    v_recent_changes JSONB;
    v_constraint TEXT;
    v_next_action TEXT;
    v_current_paid INTEGER;
    v_current_checkouts INTEGER;
    v_current_pitches INTEGER;
    v_current_problem_qualified INTEGER;
    v_current_paid_meta_leads INTEGER;
    v_current_progress_pct NUMERIC;
    v_current_autonomy_pct NUMERIC;
BEGIN
    IF COALESCE((SELECT auth.jwt()->>'role'), '') <> 'service_role'
       AND NOT EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = (SELECT auth.uid())) THEN
        RAISE EXCEPTION 'admin access required';
    END IF;

    v_start := v_now - make_interval(days => v_days);
    v_previous_start := v_now - make_interval(days => v_days * 2);

    WITH windows AS (
        SELECT 'current'::TEXT AS period, v_start AS starts_at, v_now AS ends_at
        UNION ALL
        SELECT 'previous', v_previous_start, v_start
    ), funnel AS (
        SELECT
            w.period,
            count(DISTINCT e.ig_thread_id) FILTER (WHERE e.event_type = 'lead_engaged') AS leads_engaged,
            count(DISTINCT e.ig_thread_id) FILTER (
                WHERE e.event_type = 'lead_engaged'
                  AND COALESCE(t.custom_data->>'acquisition_mode', '') = 'paid_meta'
            ) AS paid_meta_leads,
            count(DISTINCT e.ig_thread_id) FILTER (WHERE e.event_type = 'problem_qualified') AS problem_qualified,
            count(DISTINCT e.ig_thread_id) FILTER (WHERE e.event_type = 'offer_ready') AS offer_ready,
            count(DISTINCT e.ig_thread_id) FILTER (WHERE e.event_type = 'buyer_intent') AS buyer_intent,
            count(DISTINCT e.ig_thread_id) FILTER (WHERE e.event_type = 'coaching_pitched') AS coaching_pitched,
            count(DISTINCT e.ig_thread_id) FILTER (WHERE e.event_type = 'checkout_sent') AS checkout_sent,
            count(*) FILTER (WHERE e.ig_thread_id IS NOT NULL AND COALESCE(t.custom_data->>'acquisition_mode', '') = '') AS missing_attribution_events
        FROM windows w
        LEFT JOIN public.growth_outcome_events e
          ON e.occurred_at >= w.starts_at AND e.occurred_at < w.ends_at
         AND e.event_type IN (
            'lead_engaged', 'problem_qualified', 'offer_ready', 'buyer_intent',
            'coaching_pitched', 'checkout_sent'
         )
        LEFT JOIN public.ig_threads t ON t.id = e.ig_thread_id
        GROUP BY w.period
    ), sales AS (
        SELECT
            w.period,
            count(fp.id) FILTER (WHERE fp.status IN ('paid', 'complete', 'completed', 'succeeded')) AS founders_sales,
            COALESCE(sum(fp.amount_minor) FILTER (WHERE fp.status IN ('paid', 'complete', 'completed', 'succeeded')), 0) AS founders_revenue_minor
        FROM windows w
        LEFT JOIN public.founders_pass_purchases fp
          ON fp.purchased_at >= w.starts_at AND fp.purchased_at < w.ends_at
        GROUP BY w.period
    ), audience AS (
        SELECT
            w.period,
            count(DISTINCT u.id) FILTER (WHERE u.created_at >= w.starts_at AND u.created_at < w.ends_at) AS new_users,
            count(DISTINCT u.id) FILTER (WHERE u.last_login >= w.starts_at AND u.last_login < w.ends_at) AS active_users
        FROM windows w
        LEFT JOIN public.users u ON COALESCE(u.is_test_account, FALSE) = FALSE
        GROUP BY w.period
    ), delivery AS (
        SELECT
            w.period,
            count(DISTINCT cc.client_id) AS active_clients,
            count(DISTINCT cc.client_id) FILTER (WHERE
                EXISTS (
                    SELECT 1 FROM public.workouts wo
                    WHERE wo.user_id = cc.client_id
                      AND wo.created_at >= w.starts_at AND wo.created_at < w.ends_at
                ) OR EXISTS (
                    SELECT 1 FROM public.weekly_goals wg
                    WHERE wg.user_id = cc.client_id
                      AND wg.updated_at >= w.starts_at AND wg.updated_at < w.ends_at
                ) OR EXISTS (
                    SELECT 1 FROM public.daily_checkins dc
                    WHERE dc.user_id = cc.client_id
                      AND dc.created_at >= w.starts_at AND dc.created_at < w.ends_at
                ) OR EXISTS (
                    SELECT 1 FROM public.pb_history pb
                    WHERE pb.user_id = cc.client_id
                      AND pb.achieved_at >= w.starts_at AND pb.achieved_at < w.ends_at
                )
            ) AS clients_with_progress_signal
        FROM windows w
        LEFT JOIN public.coach_clients cc ON cc.status = 'active'
        GROUP BY w.period
    ), automation AS (
        SELECT
            w.period,
            count(*) FILTER (
                WHERE r.terminal_status = 'completed' AND COALESCE(r.owner, '') <> 'manual'
            ) AS automated_completed,
            count(*) FILTER (
                WHERE r.terminal_status = 'needs_you' OR (r.terminal_status = 'completed' AND r.owner = 'manual')
            ) AS human_required,
            count(*) FILTER (WHERE r.terminal_status = 'waiting') AS waiting_receipts
        FROM windows w
        LEFT JOIN public.ig_next_action_receipts r
          ON r.completed_at >= w.starts_at AND r.completed_at < w.ends_at
        GROUP BY w.period
    ), content AS (
        SELECT
            w.period,
            count(cp.id) FILTER (WHERE COALESCE(cp.status, '') NOT IN ('deleted', 'failed')) AS posts_published
        FROM windows w
        LEFT JOIN public.content_platform_posts cp
          ON cp.posted_at >= w.starts_at AND cp.posted_at < w.ends_at
        GROUP BY w.period
    ), combined AS (
        SELECT
            w.period,
            f.leads_engaged,
            f.paid_meta_leads,
            f.problem_qualified,
            f.offer_ready,
            f.buyer_intent,
            f.coaching_pitched,
            f.checkout_sent,
            s.founders_sales,
            s.founders_revenue_minor,
            a.new_users,
            a.active_users,
            d.active_clients,
            d.clients_with_progress_signal,
            round(100.0 * d.clients_with_progress_signal / NULLIF(d.active_clients, 0), 1) AS client_progress_coverage_pct,
            au.automated_completed,
            au.human_required,
            au.waiting_receipts,
            round(100.0 * au.automated_completed / NULLIF(au.automated_completed + au.human_required, 0), 1) AS autonomy_pct,
            c.posts_published,
            f.missing_attribution_events,
            round(100.0 * f.coaching_pitched / NULLIF(f.problem_qualified, 0), 1) AS qualified_to_pitch_pct,
            round(100.0 * f.checkout_sent / NULLIF(f.coaching_pitched, 0), 1) AS pitch_to_checkout_pct,
            round(100.0 * s.founders_sales / NULLIF(f.checkout_sent, 0), 1) AS checkout_to_paid_pct
        FROM windows w
        JOIN funnel f USING (period)
        JOIN sales s USING (period)
        JOIN audience a USING (period)
        JOIN delivery d USING (period)
        JOIN automation au USING (period)
        JOIN content c USING (period)
    )
    SELECT
        to_jsonb(c) - 'period',
        to_jsonb(p) - 'period'
    INTO v_current, v_previous
    FROM combined c
    JOIN combined p ON p.period = 'previous'
    WHERE c.period = 'current';

    v_current := COALESCE(v_current, '{}'::JSONB);
    v_previous := COALESCE(v_previous, '{}'::JSONB);
    v_current_paid := COALESCE((v_current->>'founders_sales')::INTEGER, 0);
    v_current_checkouts := COALESCE((v_current->>'checkout_sent')::INTEGER, 0);
    v_current_pitches := COALESCE((v_current->>'coaching_pitched')::INTEGER, 0);
    v_current_problem_qualified := COALESCE((v_current->>'problem_qualified')::INTEGER, 0);
    v_current_paid_meta_leads := COALESCE((v_current->>'paid_meta_leads')::INTEGER, 0);
    v_current_progress_pct := COALESCE((v_current->>'client_progress_coverage_pct')::NUMERIC, 0);
    v_current_autonomy_pct := COALESCE((v_current->>'autonomy_pct')::NUMERIC, 0);

    v_data_quality := jsonb_build_object(
        'ad_spend', jsonb_build_object(
            'status', 'missing_source',
            'impact', 'CAC and profit cannot be calculated until Meta ad spend is connected'
        ),
        'revenue', jsonb_build_object(
            'status', 'partial',
            'scope', 'Founders Pass one-time purchases are exact; recurring subscription value is not summed'
        ),
        'client_results', jsonb_build_object(
            'status', CASE WHEN v_current_progress_pct >= 60 THEN 'usable' ELSE 'thin' END,
            'coverage_pct', v_current_progress_pct,
            'definition', 'Active clients with a workout, Weekly Goal update, check-in, or PB in the window'
        ),
        'attribution', jsonb_build_object(
            'status', CASE WHEN COALESCE((v_current->>'missing_attribution_events')::INTEGER, 0) = 0 THEN 'usable' ELSE 'partial' END,
            'missing_events', COALESCE((v_current->>'missing_attribution_events')::INTEGER, 0)
        ),
        'freshness', jsonb_build_object(
            'growth_events_at', (SELECT max(occurred_at) FROM public.growth_outcome_events),
            'purchases_at', (SELECT max(purchased_at) FROM public.founders_pass_purchases),
            'automation_receipts_at', (SELECT max(completed_at) FROM public.ig_next_action_receipts)
        )
    );

    IF v_current_paid = 0 AND v_current_checkouts > 0 THEN
        v_constraint := 'checkout_conversion';
        v_next_action := 'Review the exact checkout handoffs and remove the biggest trust, offer, or payment blocker before increasing ad volume.';
    ELSIF v_current_paid = 0 AND v_current_pitches > 0 AND v_current_checkouts = 0 THEN
        v_constraint := 'checkout_handoff';
        v_next_action := 'Improve the transition from a matched coaching offer to an explicit checkout handoff, then verify the next real link send.';
    ELSIF v_current_paid = 0 AND v_current_problem_qualified > 0 AND v_current_pitches = 0 THEN
        v_constraint := 'offer_progression';
        v_next_action := 'Move qualified leads from a known goal and blocker into a clear matched Balance offer without adding more discovery questions.';
    ELSIF v_current_paid = 0 AND v_current_paid_meta_leads = 0 THEN
        v_constraint := 'paid_acquisition';
        v_next_action := 'Finish the paid Meta launch and verify that attributed ad conversations reach the live sales worker.';
    ELSIF v_current_paid > 0 AND v_data_quality->'ad_spend'->>'status' <> 'usable' THEN
        v_constraint := 'unit_economics_visibility';
        v_next_action := 'Connect Meta ad spend so confirmed sales can be turned into CAC, contribution margin, and a scale or stop decision.';
    ELSIF v_current_progress_pct < 60 THEN
        v_constraint := 'client_results';
        v_next_action := 'Increase measurable weekly client progress coverage before scaling acquisition further.';
    ELSIF v_current_autonomy_pct < 80 THEN
        v_constraint := 'automation_reliability';
        v_next_action := 'Reduce the largest repeat Needs You category while preserving safety and canonical delivery proof.';
    ELSE
        v_constraint := 'scale_acquisition';
        v_next_action := 'Keep delivery quality stable and increase the best verified acquisition source one controlled step.';
    END IF;

    SELECT COALESCE(jsonb_agg(to_jsonb(changes) ORDER BY changes.occurred_at DESC), '[]'::JSONB)
    INTO v_recent_changes
    FROM (
        SELECT id, occurred_at, commit_sha, area, summary, expected_metric, status, source
        FROM public.balance_business_changes
        WHERE occurred_at >= v_previous_start
        ORDER BY occurred_at DESC
        LIMIT 12
    ) changes;

    RETURN jsonb_build_object(
        'generated_at', v_now,
        'timezone', 'Australia/Brisbane',
        'window_days', v_days,
        'window_start', v_start,
        'window_end', v_now,
        'primary_constraint', v_constraint,
        'next_action', v_next_action,
        'current', v_current,
        'previous', v_previous,
        'data_quality', v_data_quality,
        'recent_changes', COALESCE(v_recent_changes, '[]'::JSONB)
    );
END;
$$;

REVOKE ALL ON FUNCTION public.get_balance_business_scorecard(INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_balance_business_scorecard(INTEGER) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.record_balance_business_scorecard(
    p_days INTEGER DEFAULT 7,
    p_release_ref TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_scorecard JSONB;
    v_row public.balance_business_scorecards%ROWTYPE;
    v_scorecard_date DATE := (NOW() AT TIME ZONE 'Australia/Brisbane')::DATE;
BEGIN
    IF COALESCE((SELECT auth.jwt()->>'role'), '') <> 'service_role' THEN
        RAISE EXCEPTION 'service role required';
    END IF;

    v_scorecard := public.get_balance_business_scorecard(p_days);

    INSERT INTO public.balance_business_scorecards (
        scorecard_date,
        window_days,
        window_start,
        window_end,
        release_ref,
        metrics,
        data_quality,
        primary_constraint,
        next_action,
        recent_changes,
        updated_at
    ) VALUES (
        v_scorecard_date,
        (v_scorecard->>'window_days')::INTEGER,
        (v_scorecard->>'window_start')::TIMESTAMPTZ,
        (v_scorecard->>'window_end')::TIMESTAMPTZ,
        NULLIF(trim(p_release_ref), ''),
        jsonb_build_object('current', v_scorecard->'current', 'previous', v_scorecard->'previous'),
        v_scorecard->'data_quality',
        v_scorecard->>'primary_constraint',
        v_scorecard->>'next_action',
        v_scorecard->'recent_changes',
        NOW()
    )
    ON CONFLICT (scorecard_date) DO UPDATE SET
        window_days = EXCLUDED.window_days,
        window_start = EXCLUDED.window_start,
        window_end = EXCLUDED.window_end,
        release_ref = COALESCE(EXCLUDED.release_ref, public.balance_business_scorecards.release_ref),
        metrics = EXCLUDED.metrics,
        data_quality = EXCLUDED.data_quality,
        primary_constraint = EXCLUDED.primary_constraint,
        next_action = EXCLUDED.next_action,
        recent_changes = EXCLUDED.recent_changes,
        updated_at = NOW()
    RETURNING * INTO v_row;

    RETURN to_jsonb(v_row);
END;
$$;

REVOKE ALL ON FUNCTION public.record_balance_business_scorecard(INTEGER, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_balance_business_scorecard(INTEGER, TEXT) TO service_role;

CREATE OR REPLACE FUNCTION public.record_balance_business_change(
    p_area TEXT,
    p_summary TEXT,
    p_expected_metric TEXT DEFAULT NULL,
    p_commit_sha TEXT DEFAULT NULL,
    p_status TEXT DEFAULT 'shipped',
    p_source TEXT DEFAULT 'codex',
    p_metadata JSONB DEFAULT '{}'::JSONB
)
RETURNS public.balance_business_changes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_row public.balance_business_changes%ROWTYPE;
BEGIN
    IF COALESCE((SELECT auth.jwt()->>'role'), '') <> 'service_role' THEN
        RAISE EXCEPTION 'service role required';
    END IF;
    IF length(trim(COALESCE(p_area, ''))) = 0 OR length(trim(COALESCE(p_summary, ''))) = 0 THEN
        RAISE EXCEPTION 'area and summary are required';
    END IF;

    INSERT INTO public.balance_business_changes (
        commit_sha, area, summary, expected_metric, status, source, metadata
    ) VALUES (
        NULLIF(trim(p_commit_sha), ''),
        trim(p_area),
        trim(p_summary),
        NULLIF(trim(p_expected_metric), ''),
        COALESCE(NULLIF(trim(p_status), ''), 'shipped'),
        COALESCE(NULLIF(trim(p_source), ''), 'codex'),
        COALESCE(p_metadata, '{}'::JSONB)
    )
    ON CONFLICT ((COALESCE(commit_sha, '')), summary) DO UPDATE SET
        area = EXCLUDED.area,
        expected_metric = EXCLUDED.expected_metric,
        status = EXCLUDED.status,
        source = EXCLUDED.source,
        metadata = public.balance_business_changes.metadata || EXCLUDED.metadata
    RETURNING * INTO v_row;

    RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.record_balance_business_change(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_balance_business_change(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB)
    TO service_role;

COMMENT ON TABLE public.balance_business_changes IS
    'Durable shipped-work ledger used by the Balance business operating loop to connect changes to expected metrics.';
COMMENT ON TABLE public.balance_business_scorecards IS
    'Daily source-backed Balance business snapshots: acquisition, sales, delivery, autonomy, data quality, and next constraint.';
COMMENT ON FUNCTION public.get_balance_business_scorecard(INTEGER) IS
    'Returns the live current-vs-previous Balance operating scorecard for an authenticated admin or service worker.';
