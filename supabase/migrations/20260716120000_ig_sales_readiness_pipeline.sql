-- Separate relationship engagement from genuine commercial readiness.
-- Outreach can keep filling the funnel, while the Money Queue only contains
-- a named problem, an earned offer moment, or explicit buying intent.

INSERT INTO public.growth_outcome_event_weights (event_type, family, default_score, description)
VALUES
    ('lead_engaged', 'sales', 4, 'The lead is engaged in a real DM conversation, without assumed buying intent.'),
    ('problem_qualified', 'sales', 12, 'The lead personally named a relevant goal plus a real blocker or support need.'),
    ('offer_ready', 'sales', 18, 'The lead acknowledged wanting help, structure, accountability, or coaching.'),
    ('buyer_intent', 'sales', 26, 'The lead explicitly asked for price, details, the link, signup, or a sales call.'),
    ('problem_followup_sent', 'sales', 8, 'One contextual follow-up was sent to a problem-qualified lead.')
ON CONFLICT (event_type) DO UPDATE
SET family = EXCLUDED.family,
    default_score = EXCLUDED.default_score,
    description = EXCLUDED.description,
    active = TRUE,
    updated_at = NOW();

CREATE OR REPLACE FUNCTION public.ig_inbound_has_buyer_intent(p_text TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
    SELECT
        lower(trim(COALESCE(p_text, ''))) ~ '^(how much|price\??|pricing\??|cost\??|what(''s| is) included\??|send (me )?(the )?(link|details)\m)'
        OR lower(COALESCE(p_text, '')) ~ '\m(can|could) you send (me )?(the )?(link|details)\M'
        OR lower(COALESCE(p_text, '')) ~ '\m(can|could|how do|where do) i (join|start|sign up|get (the )?(link|details))\M'
        OR lower(COALESCE(p_text, '')) ~ '\m(i(''m| am)|im) (in|keen|ready)(\M| to (join|start|sign up))'
        OR lower(COALESCE(p_text, '')) ~ '\m(i want|i''d like|i would like|keen|ready) to (join|start|sign up|work with you)\M'
        OR lower(COALESCE(p_text, '')) ~ '\m(coaching|starter coaching|balance|work with you|your (program|coaching))\M.{0,80}\m(price|cost|details|included|inclusions|link|join|sign up|start)\M'
        OR lower(COALESCE(p_text, '')) ~ '\m(price|cost|details|included|inclusions|link|join|sign up)\M.{0,80}\m(coaching|starter coaching|balance|work with you|your (program|coaching))\M';
$$;

CREATE OR REPLACE FUNCTION public.ig_inbound_has_call_intent(p_text TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
    SELECT lower(COALESCE(p_text, '')) ~ '\m(book|schedule) (a )?(call|chat)\M'
        OR lower(COALESCE(p_text, '')) ~ '\m(can|could|should) we (call|chat|talk)\M'
        OR lower(COALESCE(p_text, '')) ~ '\m(can|could) i (call|phone|talk to) (you|u)\M'
        OR lower(COALESCE(p_text, '')) ~ '\m(i want|i''d like|i would like|keen) to (call|chat|talk)\M'
        OR lower(COALESCE(p_text, '')) ~ '\m(phone call|video call|discovery call)\M';
$$;

CREATE OR REPLACE FUNCTION public.ig_inbound_has_problem_signal(p_text TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
    SELECT lower(COALESCE(p_text, '')) ~ '\m(train|training|workout|gym|food|meal|nutrition|weight|fat|muscle|strength|fitness|energy|routine|consistent|consistency|accountability|exercise|pilates|running|cardio|health|body|program)\M'
       AND lower(COALESCE(p_text, '')) ~ '\m(struggl|stuck|hard|difficult|dropping|falling|inconsistent|need help|want to|trying to|can''t|cannot|too tired|low energy|burnt out|plateau|better results|focused program|routine)';
$$;

CREATE OR REPLACE FUNCTION public.ig_qualifier_has_relevant_problem(p_qualifier JSONB)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
    WITH facts AS (
        SELECT lower(concat_ws(' ',
            p_qualifier->'facts'->>'current_state',
            p_qualifier->'facts'->>'motivation',
            p_qualifier->'facts'->>'history_blockers')) AS all_facts,
            lower(COALESCE(p_qualifier->'facts'->>'current_state', '')) AS current_state,
            NULLIF(trim(COALESCE(p_qualifier->'facts'->>'motivation', '')), '') IS NOT NULL AS has_motivation,
            NULLIF(trim(COALESCE(p_qualifier->'facts'->>'history_blockers', '')), '') IS NOT NULL AS has_blocker,
            lower(COALESCE(p_qualifier->'behavior_profile'->>'primary_need', 'unknown')) AS primary_need
    )
    SELECT primary_need <> 'unknown'
       AND all_facts ~ '\m(train|training|workout|gym|food|meal|nutrition|weight|fat|muscle|strength|fitness|energy|routine|consistent|consistency|accountability|exercise|pilates|running|cardio|health|body)\M'
       AND (has_motivation OR has_blocker OR current_state ~ '\m(struggl|stuck|hard|difficult|drop|fall|inconsisten|need|want|goal|trying|low energy|burnt out|pain|recover|plateau|results?)')
       AND NOT (
           all_facts ~ '\m(my clients?|my business|who to coach|as a coach|as a practitioner|with clients?)\M'
           AND all_facts !~ '\m(i|my)\M.{0,30}\m(struggl|need|want|goal|training|food|weight|energy|routine)\M'
       )
    FROM facts;
$$;

CREATE OR REPLACE FUNCTION public.ig_commercial_stage(p_qualifier JSONB)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
DECLARE
    v_stage TEXT := lower(COALESCE(p_qualifier->>'commercial_stage', ''));
    v_readiness TEXT := lower(COALESCE(p_qualifier->'behavior_profile'->>'sales_readiness', 'rapport'));
    v_need TEXT := lower(COALESCE(p_qualifier->'behavior_profile'->>'primary_need', 'unknown'));
    v_replies INTEGER := CASE
        WHEN COALESCE(p_qualifier->>'meaningful_lead_reply_count', '') ~ '^[0-9]+$'
            THEN (p_qualifier->>'meaningful_lead_reply_count')::INTEGER
        ELSE 0 END;
    v_has_problem BOOLEAN := public.ig_qualifier_has_relevant_problem(p_qualifier);
BEGIN
    IF lower(COALESCE(p_qualifier->>'stage', '')) = 'lost' OR v_readiness = 'not_now' THEN
        RETURN 'engaged';
    END IF;
    IF v_stage = 'buyer_intent' THEN RETURN 'buyer_intent'; END IF;
    IF NOT v_has_problem THEN RETURN 'engaged'; END IF;
    IF v_stage IN ('problem_qualified', 'offer_ready') THEN RETURN v_stage; END IF;
    IF v_readiness = 'link_ready' THEN RETURN 'buyer_intent'; END IF;
    IF v_replies >= 3 AND v_need <> 'unknown' AND v_has_problem AND v_readiness = 'bridge_ready' THEN
        RETURN 'offer_ready';
    END IF;
    IF v_replies >= 3 AND v_need <> 'unknown' AND v_has_problem THEN
        RETURN 'problem_qualified';
    END IF;
    RETURN 'engaged';
END;
$$;

-- Give existing active leads a conservative commercial stage. This does not
-- send anything or manufacture buyer intent from old warmth scores.
UPDATE public.ig_threads t
SET qualifier = COALESCE(t.qualifier, '{}'::JSONB) || jsonb_build_object(
        'commercial_stage', public.ig_commercial_stage(COALESCE(t.qualifier, '{}'::JSONB)),
        'commercial_reason', CASE public.ig_commercial_stage(COALESCE(t.qualifier, '{}'::JSONB))
            WHEN 'buyer_intent' THEN 'Existing explicit link-ready evidence.'
            WHEN 'offer_ready' THEN 'Existing help need and earned bridge evidence.'
            WHEN 'problem_qualified' THEN 'Existing relevant need plus problem evidence.'
            ELSE 'Engaged conversation; no qualified sales evidence yet.' END
    )
WHERE lower(COALESCE(t.channel, '')) = 'instagram'
  AND t.linked_user_id IS NULL
  AND t.lead_stage NOT IN ('in_app', 'paying', 'churned');

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

    -- The legacy sync used single keywords such as "chat", "details", and
    -- "how does it work", which created false commercial events. Keep only
    -- events whose source inbound passes the strict phrase-level checks.
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
    v_false_events_removed := v_false_events_removed + v_stage_events_removed;

    RETURN jsonb_build_object('engaged', v_engaged, 'problem_qualified', v_problem,
        'offer_ready', v_offer, 'buyer_intent', v_buyer,
        'false_events_removed', v_false_events_removed);
END;
$$;

CREATE OR REPLACE FUNCTION public.record_ig_money_event(
    p_thread_id UUID,
    p_event_type TEXT,
    p_source_message_id UUID DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'::JSONB,
    p_occurred_at TIMESTAMPTZ DEFAULT NOW()
)
RETURNS public.growth_outcome_events
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_thread public.ig_threads%ROWTYPE;
    v_weight public.growth_outcome_event_weights%ROWTYPE;
    v_event public.growth_outcome_events%ROWTYPE;
    v_key_suffix TEXT;
BEGIN
    IF p_event_type NOT IN (
        'warm_lead_identified', 'problem_identified', 'coaching_details_requested',
        'coaching_pitched', 'checkout_sent', 'coaching_followup_sent',
        'checkout_followup_sent', 'problem_followup_sent', 'call_requested',
        'call_booked', 'subscription_started'
    ) THEN RAISE EXCEPTION 'unsupported Instagram money event'; END IF;

    SELECT * INTO v_thread FROM public.ig_threads WHERE id = p_thread_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Instagram thread not found'; END IF;
    SELECT * INTO v_weight FROM public.growth_outcome_event_weights WHERE event_type = p_event_type;
    v_key_suffix := COALESCE(p_source_message_id::TEXT,
        NULLIF(p_metadata->>'idempotency_key', ''),
        to_char(COALESCE(p_occurred_at, NOW()), 'YYYYMMDD'));

    INSERT INTO public.growth_outcome_events (
        event_key, event_type, event_family, source_system, bot_account,
        lead_key, from_ig_user_id, from_username, ig_thread_id, ig_message_id,
        client_id, score, attribution, raw_payload, occurred_at
    ) VALUES (
        'ig-money:' || p_thread_id::TEXT || ':' || p_event_type || ':' || v_key_suffix,
        p_event_type, COALESCE(v_weight.family, 'sales'), 'ig_dm_manager',
        v_thread.coach_id::TEXT, public.ig_next_action_subject_key(v_thread.id, v_thread.ig_username),
        v_thread.subscriber_id, v_thread.ig_username, v_thread.id, p_source_message_id,
        v_thread.linked_user_id, COALESCE(v_weight.default_score, 0),
        jsonb_build_object('channel', 'instagram', 'funnel', 'dm_first'),
        COALESCE(p_metadata, '{}'::JSONB), COALESCE(p_occurred_at, NOW())
    )
    ON CONFLICT (event_key) DO UPDATE
    SET raw_payload = public.growth_outcome_events.raw_payload || EXCLUDED.raw_payload,
        updated_at = NOW()
    RETURNING * INTO v_event;
    RETURN v_event;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_ig_money_queue(
    p_limit INTEGER DEFAULT 100,
    p_run_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_queued INTEGER := 0;
    v_cancelled INTEGER := 0;
    v_row RECORD;
BEGIN
    PERFORM public.sync_ig_money_funnel_events();
    PERFORM public.sync_ig_sales_pipeline_events();

    UPDATE public.ig_next_actions q
    SET status = 'cancelled', completed_at = NOW(),
        receipt = COALESCE(q.receipt, '{}'::JSONB) || jsonb_build_object(
            'cancelled_reason', 'lead no longer has a qualified commercial next step',
            'cancelled_at', NOW(), 'run_id', p_run_id
        )
    FROM public.ig_threads t
    WHERE q.thread_id = t.id
      AND (q.status IN ('ready', 'waiting', 'cooldown')
           OR (q.status = 'claimed' AND q.claim_expires_at <= NOW()))
      AND q.owner = 'dm_manager'
      AND q.action_type IN ('close_sale', 'book_call', 'send_checkout', 'reactivation')
      AND (
          t.linked_user_id IS NOT NULL OR t.lead_stage IN ('in_app', 'paying', 'churned')
          OR (
              q.reason->>'source' = 'ig_messages_inbound'
              AND NOT EXISTS (
                  SELECT 1 FROM public.ig_messages m
                  WHERE m.id = q.source_message_id
                    AND ((q.action_type = 'book_call' AND public.ig_inbound_has_call_intent(m.text))
                      OR (q.action_type <> 'book_call' AND public.ig_inbound_has_buyer_intent(m.text)))
              )
          )
      );
    GET DIAGNOSTICS v_cancelled = ROW_COUNT;

    FOR v_row IN
        WITH latest AS (
            SELECT t.*, public.ig_commercial_stage(t.qualifier) AS commercial_stage,
                li.id AS inbound_id, li.created_at AS inbound_at, li.text AS inbound_text,
                lo.id AS outbound_id, lo.created_at AS outbound_at, lo.text AS outbound_text
            FROM public.ig_threads t
            LEFT JOIN LATERAL (
                SELECT m.id, m.created_at, m.text FROM public.ig_messages m
                WHERE m.thread_id = t.id AND lower(COALESCE(m.direction, '')) = 'in'
                ORDER BY m.created_at DESC LIMIT 1
            ) li ON TRUE
            LEFT JOIN LATERAL (
                SELECT m.id, m.created_at, m.text FROM public.ig_messages m
                WHERE m.thread_id = t.id AND lower(COALESCE(m.direction, '')) = 'out'
                ORDER BY m.created_at DESC LIMIT 1
            ) lo ON TRUE
            WHERE lower(COALESCE(t.channel, '')) = 'instagram'
              AND t.linked_user_id IS NULL
              AND t.lead_stage NOT IN ('in_app', 'paying', 'churned')
        ), candidates AS (
            SELECT l.*,
                CASE
                    WHEN public.ig_message_has_coaching_checkout_link(l.outbound_text) THEN 'checkout_followup'
                    WHEN lower(COALESCE(l.outbound_text, '')) LIKE '%starter coaching%' THEN 'offer_followup'
                    WHEN l.commercial_stage = 'buyer_intent' THEN 'buyer_intent'
                    WHEN l.commercial_stage = 'offer_ready' THEN 'offer_ready'
                    WHEN l.commercial_stage = 'problem_qualified' THEN 'problem_qualified'
                END AS queue_stage
            FROM latest l
            WHERE l.outbound_at IS NOT NULL
              AND l.outbound_at >= NOW() - INTERVAL '7 days'
              AND l.outbound_at <= NOW() - CASE
                    WHEN l.commercial_stage = 'problem_qualified' THEN INTERVAL '48 hours'
                    ELSE INTERVAL '24 hours' END
              AND (l.inbound_at IS NULL OR l.outbound_at > l.inbound_at)
              AND (
                  public.ig_message_has_coaching_checkout_link(l.outbound_text)
                  OR lower(COALESCE(l.outbound_text, '')) LIKE '%starter coaching%'
                  OR (l.commercial_stage = 'buyer_intent' AND public.ig_inbound_has_buyer_intent(l.inbound_text))
                  OR (l.commercial_stage IN ('problem_qualified', 'offer_ready')
                      AND public.ig_inbound_has_problem_signal(l.inbound_text))
              )
        )
        , eligible AS (
            SELECT c.* FROM candidates c
            WHERE NOT EXISTS (
                SELECT 1 FROM public.growth_outcome_events e
                WHERE e.ig_thread_id = c.id
                  AND e.event_type = CASE c.queue_stage
                      WHEN 'checkout_followup' THEN 'checkout_followup_sent'
                      WHEN 'offer_followup' THEN 'coaching_followup_sent'
                      WHEN 'problem_qualified' THEN 'problem_followup_sent'
                      WHEN 'offer_ready' THEN 'coaching_pitched'
                      ELSE 'checkout_sent' END
                  AND e.occurred_at >= c.outbound_at
            )
        ), ranked AS (
            SELECT e.*, row_number() OVER (
                PARTITION BY e.queue_stage ORDER BY e.outbound_at ASC
            ) AS stage_rank
            FROM eligible e
        )
        SELECT r.* FROM ranked r
        WHERE r.queue_stage <> 'problem_qualified' OR r.stage_rank <= 3
        ORDER BY CASE r.queue_stage
            WHEN 'checkout_followup' THEN 1 WHEN 'buyer_intent' THEN 2
            WHEN 'offer_followup' THEN 3 WHEN 'offer_ready' THEN 4 ELSE 5 END,
            r.outbound_at ASC
        LIMIT LEAST(GREATEST(COALESCE(p_limit, 100), 1), 250)
    LOOP
        PERFORM public.upsert_ig_next_action(
            v_row.id, v_row.ig_username, COALESCE(v_row.lead_stage, 'qualifying'),
            'dm_manager',
            CASE WHEN v_row.queue_stage IN ('buyer_intent', 'offer_ready') THEN 'close_sale' ELSE 'reactivation' END,
            CASE v_row.queue_stage
                WHEN 'checkout_followup' THEN 930 WHEN 'buyer_intent' THEN 925
                WHEN 'offer_followup' THEN 910 WHEN 'offer_ready' THEN 890 ELSE 740 END,
            NOW(), NOW(),
            jsonb_build_object(
                'source', 'money_queue', 'commercial_stage', v_row.queue_stage,
                'why', CASE v_row.queue_stage
                    WHEN 'checkout_followup' THEN 'Checkout sent 24h+ ago; one contextual follow-up is available'
                    WHEN 'offer_followup' THEN 'Starter Coaching offered 24h+ ago; one contextual follow-up is available'
                    WHEN 'buyer_intent' THEN 'Explicit buying intent needs a direct DM close'
                    WHEN 'offer_ready' THEN 'Lead acknowledged a coaching need; inspect for an earned offer bridge'
                    ELSE 'Relevant goal and blocker are known; inspect for one natural progression, never a blind pitch' END,
                'last_outbound_at', v_row.outbound_at, 'run_id', p_run_id
            ), v_row.outbound_id, FALSE
        );
        v_queued := v_queued + 1;
    END LOOP;

    RETURN jsonb_build_object('queued_candidates', v_queued, 'cancelled', v_cancelled, 'run_id', p_run_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_ig_warm_lead_scorecard(p_days INTEGER DEFAULT 30)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_days INTEGER := LEAST(GREATEST(COALESCE(p_days, 30), 1), 365);
    v_result JSONB;
BEGIN
    IF auth.role() <> 'service_role'
       AND NOT EXISTS (SELECT 1 FROM public.admin_users a WHERE a.user_id = auth.uid()) THEN
        RAISE EXCEPTION 'admin access required';
    END IF;

    WITH current_counts AS (
        SELECT
            count(*) FILTER (WHERE commercial_stage = 'engaged') AS engaged_now,
            count(*) FILTER (WHERE commercial_stage = 'problem_qualified') AS problem_qualified_now,
            count(*) FILTER (WHERE commercial_stage = 'offer_ready') AS offer_ready_now,
            count(*) FILTER (WHERE commercial_stage = 'buyer_intent') AS buyer_intent_now
        FROM (
            SELECT public.ig_commercial_stage(qualifier) AS commercial_stage
            FROM public.ig_threads
            WHERE lower(COALESCE(channel,'')) = 'instagram'
              AND linked_user_id IS NULL AND lead_stage NOT IN ('in_app','paying','churned')
        ) staged
    ), event_counts AS (
        SELECT
            count(DISTINCT ig_thread_id) FILTER (WHERE event_type = 'lead_engaged') AS engaged,
            count(DISTINCT ig_thread_id) FILTER (WHERE event_type = 'problem_qualified') AS problem_qualified,
            count(DISTINCT ig_thread_id) FILTER (WHERE event_type = 'offer_ready') AS offer_ready,
            count(DISTINCT ig_thread_id) FILTER (WHERE event_type = 'buyer_intent') AS buyer_intent,
            count(DISTINCT ig_thread_id) FILTER (WHERE event_type = 'coaching_pitched') AS pitched,
            count(DISTINCT ig_thread_id) FILTER (WHERE event_type = 'checkout_sent') AS checkout_sent,
            count(DISTINCT COALESCE(ig_thread_id::TEXT, client_id::TEXT, event_key)) FILTER (WHERE event_type = 'call_booked') AS call_booked,
            count(DISTINCT COALESCE(ig_thread_id::TEXT, client_id::TEXT, event_key)) FILTER (WHERE event_type = 'subscription_started') AS paid
        FROM public.growth_outcome_events
        WHERE occurred_at >= NOW() - make_interval(days => v_days)
    ), queue_count AS (
        SELECT count(*) AS due_now FROM public.ig_next_actions q
        WHERE q.owner = 'dm_manager' AND q.status IN ('ready','claimed') AND q.due_at <= NOW()
          AND (q.action_type IN ('close_sale','book_call','send_checkout','reactivation')
               OR (q.action_type = 'reply_inbound' AND q.priority >= 900))
    )
    SELECT jsonb_build_object(
        'days', v_days,
        'engaged_now', c.engaged_now,
        'problem_qualified_now', c.problem_qualified_now,
        'offer_ready_now', c.offer_ready_now,
        'buyer_intent_now', c.buyer_intent_now,
        'sales_ready_now', c.problem_qualified_now + c.offer_ready_now + c.buyer_intent_now,
        'warm_now', c.problem_qualified_now + c.offer_ready_now + c.buyer_intent_now,
        'problem_known_now', c.problem_qualified_now,
        'due_now', q.due_now,
        'engaged', e.engaged, 'problem_qualified', e.problem_qualified,
        'offer_ready', e.offer_ready, 'buyer_intent', e.buyer_intent,
        'pitched', e.pitched, 'checkout_sent', e.checkout_sent,
        'call_booked', e.call_booked, 'paid', e.paid,
        'qualified_to_pitch_pct', CASE WHEN e.problem_qualified > 0 THEN round(100.0 * e.pitched / e.problem_qualified, 1) ELSE 0 END,
        'warm_to_pitch_pct', CASE WHEN e.problem_qualified > 0 THEN round(100.0 * e.pitched / e.problem_qualified, 1) ELSE 0 END,
        'pitch_to_checkout_pct', CASE WHEN e.pitched > 0 THEN round(100.0 * e.checkout_sent / e.pitched, 1) ELSE 0 END,
        'checkout_to_paid_pct', CASE WHEN e.checkout_sent > 0 THEN round(100.0 * e.paid / e.checkout_sent, 1) ELSE 0 END
    ) INTO v_result
    FROM current_counts c CROSS JOIN event_counts e CROSS JOIN queue_count q;
    RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_ig_acquisition_capacity()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_due INTEGER;
    v_mode TEXT;
    v_multiplier NUMERIC;
BEGIN
    IF auth.role() <> 'service_role'
       AND NOT EXISTS (SELECT 1 FROM public.admin_users a WHERE a.user_id = auth.uid()) THEN
        RAISE EXCEPTION 'admin access required';
    END IF;
    SELECT count(*) INTO v_due
    FROM public.ig_next_actions q
    WHERE q.owner = 'dm_manager'
      AND q.status IN ('ready', 'claimed')
      AND q.due_at <= NOW()
      AND (q.action_type IN ('close_sale', 'book_call', 'send_checkout', 'reactivation')
           OR (q.action_type = 'reply_inbound' AND q.priority >= 900));

    v_mode := CASE WHEN v_due >= 16 THEN 'paused' WHEN v_due >= 6 THEN 'half' ELSE 'normal' END;
    v_multiplier := CASE v_mode WHEN 'paused' THEN 0 WHEN 'half' THEN 0.5 ELSE 1 END;
    RETURN jsonb_build_object(
        'due_money_actions', v_due, 'mode', v_mode, 'multiplier', v_multiplier,
        'reason', CASE v_mode
            WHEN 'paused' THEN '16+ qualified commercial actions are due; pause proactive acquisition'
            WHEN 'half' THEN '6-15 qualified commercial actions are due; run proactive acquisition at half volume'
            ELSE '0-5 qualified commercial actions are due; normal proactive acquisition volume' END
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_ig_sales_pipeline(p_limit INTEGER DEFAULT 50)
RETURNS TABLE (
    thread_id UUID, ig_username TEXT, profile_name TEXT, commercial_stage TEXT,
    commercial_reason TEXT, primary_need TEXT, meaningful_replies INTEGER,
    last_inbound_at TIMESTAMPTZ, last_outbound_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF auth.role() <> 'service_role'
       AND NOT EXISTS (SELECT 1 FROM public.admin_users a WHERE a.user_id = auth.uid()) THEN
        RAISE EXCEPTION 'admin access required';
    END IF;
    RETURN QUERY
    SELECT t.id, t.ig_username, t.profile_name,
        public.ig_commercial_stage(t.qualifier), t.qualifier->>'commercial_reason',
        t.qualifier->'behavior_profile'->>'primary_need',
        COALESCE(NULLIF(t.qualifier->>'meaningful_lead_reply_count', '')::INTEGER, 0),
        t.last_inbound_at, t.last_outbound_at
    FROM public.ig_threads t
    WHERE lower(COALESCE(t.channel, '')) = 'instagram'
      AND t.linked_user_id IS NULL AND t.lead_stage NOT IN ('in_app','paying','churned')
    ORDER BY CASE public.ig_commercial_stage(t.qualifier)
        WHEN 'buyer_intent' THEN 1 WHEN 'offer_ready' THEN 2
        WHEN 'problem_qualified' THEN 3 ELSE 4 END,
        t.last_inbound_at DESC NULLS LAST
    LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200);
END;
$$;

CREATE OR REPLACE FUNCTION public.route_ig_inbound_to_next_action()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_thread public.ig_threads%ROWTYPE;
    v_action_type TEXT := 'reply_inbound';
    v_priority INTEGER := 800;
    v_lead_state TEXT;
    v_why TEXT := 'Inbound Instagram DM needs a reply';
BEGIN
    IF lower(COALESCE(NEW.direction, '')) <> 'in' THEN RETURN NEW; END IF;
    SELECT * INTO v_thread FROM public.ig_threads WHERE id = NEW.thread_id;
    IF NOT FOUND OR lower(COALESCE(v_thread.channel, '')) <> 'instagram' THEN RETURN NEW; END IF;
    v_lead_state := CASE WHEN v_thread.linked_user_id IS NOT NULL
        OR v_thread.lead_stage IN ('in_app', 'paying') THEN 'client'
        ELSE COALESCE(NULLIF(v_thread.lead_stage, ''), 'new') END;

    IF public.ig_inbound_has_call_intent(NEW.text) THEN
        v_action_type := 'book_call'; v_priority := 1000; v_why := 'Lead explicitly asked for a sales call';
    ELSIF public.ig_inbound_has_buyer_intent(NEW.text) THEN
        v_action_type := 'close_sale'; v_priority := 950; v_why := 'Lead explicitly asked for price, details, signup, or the coaching link';
    ELSIF public.ig_commercial_stage(v_thread.qualifier) IN ('offer_ready', 'buyer_intent') THEN
        v_priority := 850; v_why := 'Fresh reply from an offer-ready lead; continue naturally and re-read before any pitch';
    END IF;

    PERFORM public.upsert_ig_next_action(
        NEW.thread_id, v_thread.ig_username, v_lead_state, 'dm_manager',
        v_action_type, v_priority, NOW(), NOW(),
        jsonb_build_object('source', 'ig_messages_inbound', 'why', v_why,
            'commercial_stage', CASE WHEN v_action_type = 'book_call' THEN 'buyer_intent'
                WHEN v_action_type = 'close_sale' THEN 'buyer_intent'
                ELSE public.ig_commercial_stage(v_thread.qualifier) END,
            'message_preview', left(COALESCE(NEW.text, ''), 300)),
        NEW.id, TRUE
    );
    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.ig_inbound_has_buyer_intent(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ig_inbound_has_call_intent(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ig_inbound_has_problem_signal(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ig_qualifier_has_relevant_problem(JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ig_commercial_stage(JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_ig_sales_pipeline_events() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_ig_sales_pipeline(INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ig_inbound_has_buyer_intent(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.ig_inbound_has_call_intent(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.ig_inbound_has_problem_signal(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.ig_qualifier_has_relevant_problem(JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.ig_commercial_stage(JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.sync_ig_sales_pipeline_events() TO service_role;
GRANT EXECUTE ON FUNCTION public.get_ig_sales_pipeline(INTEGER) TO authenticated, service_role;

COMMENT ON FUNCTION public.ig_commercial_stage(JSONB) IS
    'Conservative sales stage: engaged, problem_qualified, offer_ready, or buyer_intent.';
COMMENT ON FUNCTION public.get_ig_sales_pipeline(INTEGER) IS
    'Ranks active Instagram leads by genuine commercial readiness, not reply warmth.';

SELECT public.sync_ig_sales_pipeline_events();
SELECT public.refresh_ig_money_queue(100, 'sales-readiness-migration');
