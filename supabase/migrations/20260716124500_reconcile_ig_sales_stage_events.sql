-- Reconcile sales-stage events after tightening commercial problem evidence.
-- The earlier hardening migration recalculated current thread stages; this
-- replacement also removes historical stage events that no longer qualify.

CREATE OR REPLACE FUNCTION public.sync_ig_sales_pipeline_events()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_engaged INTEGER := 0;
    v_problem INTEGER := 0;
    v_offer INTEGER := 0;
    v_buyer INTEGER := 0;
    v_false_events_removed INTEGER := 0;
    v_stage_events_removed INTEGER := 0;
BEGIN
    WITH candidates AS (
        SELECT t.*, public.ig_commercial_stage(t.qualifier) AS commercial_stage
        FROM public.ig_threads t
        WHERE lower(COALESCE(t.channel, '')) = 'instagram'
          AND t.linked_user_id IS NULL
          AND t.lead_stage NOT IN ('in_app', 'paying', 'churned')
    ), inserted AS (
        INSERT INTO public.growth_outcome_events (
            event_key, event_type, event_family, source_system, bot_account,
            lead_key, from_ig_user_id, from_username, ig_thread_id, client_id,
            score, attribution, raw_payload, occurred_at
        )
        SELECT 'ig-sales-stage:' || c.id || ':lead_engaged',
            'lead_engaged', 'sales', 'ig_sales_pipeline', c.coach_id::TEXT,
            public.ig_next_action_subject_key(c.id, c.ig_username), c.subscriber_id,
            c.ig_username, c.id, c.linked_user_id, 4,
            jsonb_build_object('channel', 'instagram', 'funnel', 'dm_first'),
            jsonb_build_object('commercial_stage', c.commercial_stage),
            COALESCE(c.last_inbound_at, c.created_at)
        FROM candidates c
        WHERE COALESCE(NULLIF(c.qualifier->>'meaningful_lead_reply_count', '')::INTEGER, 0) >= 1
        ON CONFLICT (event_key) DO NOTHING RETURNING 1
    ) SELECT count(*) INTO v_engaged FROM inserted;

    WITH candidates AS (
        SELECT t.*, public.ig_commercial_stage(t.qualifier) AS commercial_stage
        FROM public.ig_threads t
        WHERE lower(COALESCE(t.channel, '')) = 'instagram'
          AND t.linked_user_id IS NULL
          AND t.lead_stage NOT IN ('in_app', 'paying', 'churned')
    ), inserted AS (
        INSERT INTO public.growth_outcome_events (
            event_key, event_type, event_family, source_system, bot_account,
            lead_key, from_ig_user_id, from_username, ig_thread_id, client_id,
            score, attribution, raw_payload, occurred_at
        )
        SELECT 'ig-sales-stage:' || c.id || ':' || stage.event_type,
            stage.event_type, 'sales', 'ig_sales_pipeline', c.coach_id::TEXT,
            public.ig_next_action_subject_key(c.id, c.ig_username), c.subscriber_id,
            c.ig_username, c.id, c.linked_user_id, stage.score,
            jsonb_build_object('channel', 'instagram', 'funnel', 'dm_first'),
            jsonb_build_object('commercial_stage', c.commercial_stage,
                'commercial_reason', c.qualifier->>'commercial_reason'),
            COALESCE(c.last_inbound_at, c.created_at)
        FROM candidates c
        CROSS JOIN LATERAL (VALUES
            ('problem_qualified'::TEXT, 12), ('offer_ready'::TEXT, 18), ('buyer_intent'::TEXT, 26)
        ) stage(event_type, score)
        WHERE (c.commercial_stage = 'problem_qualified' AND stage.event_type = 'problem_qualified')
           OR (c.commercial_stage = 'offer_ready' AND stage.event_type IN ('problem_qualified', 'offer_ready'))
           OR (c.commercial_stage = 'buyer_intent' AND stage.event_type IN ('problem_qualified', 'offer_ready', 'buyer_intent'))
        ON CONFLICT (event_key) DO NOTHING RETURNING event_type
    )
    SELECT count(*) FILTER (WHERE event_type = 'problem_qualified'),
           count(*) FILTER (WHERE event_type = 'offer_ready'),
           count(*) FILTER (WHERE event_type = 'buyer_intent')
    INTO v_problem, v_offer, v_buyer FROM inserted;

    DELETE FROM public.growth_outcome_events e
    USING public.ig_messages m
    WHERE e.ig_message_id = m.id
      AND e.source_system = 'ig_money_sync'
      AND (
          (e.event_type = 'coaching_details_requested' AND NOT public.ig_inbound_has_buyer_intent(m.text))
          OR (e.event_type = 'call_requested' AND NOT public.ig_inbound_has_call_intent(m.text))
      );
    GET DIAGNOSTICS v_false_events_removed = ROW_COUNT;

    DELETE FROM public.growth_outcome_events e
    USING public.ig_threads t
    WHERE e.ig_thread_id = t.id
      AND e.source_system = 'ig_sales_pipeline'
      AND e.event_type IN ('problem_qualified', 'offer_ready', 'buyer_intent')
      AND NOT (
          (public.ig_commercial_stage(t.qualifier) = 'problem_qualified' AND e.event_type = 'problem_qualified')
          OR (public.ig_commercial_stage(t.qualifier) = 'offer_ready' AND e.event_type IN ('problem_qualified', 'offer_ready'))
          OR (public.ig_commercial_stage(t.qualifier) = 'buyer_intent' AND e.event_type IN ('problem_qualified', 'offer_ready', 'buyer_intent'))
      );
    GET DIAGNOSTICS v_stage_events_removed = ROW_COUNT;

    RETURN jsonb_build_object(
        'engaged', v_engaged,
        'problem_qualified', v_problem,
        'offer_ready', v_offer,
        'buyer_intent', v_buyer,
        'false_events_removed', v_false_events_removed,
        'stage_events_removed', v_stage_events_removed
    );
END;
$$;

REVOKE ALL ON FUNCTION public.sync_ig_sales_pipeline_events() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_ig_sales_pipeline_events() TO service_role;

SELECT public.sync_ig_sales_pipeline_events();
