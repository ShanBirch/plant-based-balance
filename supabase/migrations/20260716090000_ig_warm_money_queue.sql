-- Revenue-first instrumentation and work routing for warm Instagram leads.
--
-- This deliberately reuses ig_next_actions: there must still be only one
-- operational instruction per person. It never sends a DM; operators claim
-- and complete the surfaced work through the existing lease workflow.

INSERT INTO public.growth_outcome_event_weights (event_type, family, default_score, description)
VALUES
    ('warm_lead_identified', 'sales', 8, 'A DM relationship has enough evidence to be considered warm.'),
    ('problem_identified', 'sales', 10, 'The lead described a concrete problem, goal, or blocker.'),
    ('coaching_details_requested', 'sales', 18, 'The lead asked how coaching, price, or inclusions work.'),
    ('coaching_pitched', 'sales', 20, 'Starter Coaching was offered in the DM conversation.'),
    ('checkout_sent', 'sales', 30, 'The Starter Coaching checkout link was sent.'),
    ('coaching_followup_sent', 'sales', 10, 'A single relevant follow-up was sent after the offer.'),
    ('checkout_followup_sent', 'sales', 15, 'A single relevant follow-up was sent after checkout.'),
    ('call_requested', 'sales', 22, 'The lead asked to talk it through on a call.'),
    ('call_booked', 'sales', 40, 'A sales call was booked.'),
    ('subscription_started', 'revenue', 100, 'A Stripe subscription became active or trialing.')
ON CONFLICT (event_type) DO UPDATE
SET family = EXCLUDED.family,
    default_score = EXCLUDED.default_score,
    description = EXCLUDED.description,
    active = TRUE,
    updated_at = NOW();

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
        'checkout_followup_sent', 'call_requested', 'call_booked',
        'subscription_started'
    ) THEN
        RAISE EXCEPTION 'unsupported Instagram money event';
    END IF;

    SELECT * INTO v_thread FROM public.ig_threads WHERE id = p_thread_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Instagram thread not found'; END IF;
    SELECT * INTO v_weight FROM public.growth_outcome_event_weights WHERE event_type = p_event_type;

    v_key_suffix := COALESCE(
        p_source_message_id::TEXT,
        NULLIF(p_metadata->>'idempotency_key', ''),
        to_char(COALESCE(p_occurred_at, NOW()), 'YYYYMMDD')
    );

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

-- Backfill deterministic funnel milestones from conversation facts. Repeated
-- calls are safe because every derived event has a stable event key.
CREATE OR REPLACE FUNCTION public.sync_ig_money_funnel_events()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_warm INTEGER := 0;
    v_problem INTEGER := 0;
    v_pitch INTEGER := 0;
    v_checkout INTEGER := 0;
    v_details INTEGER := 0;
    v_call INTEGER := 0;
    v_booked INTEGER := 0;
BEGIN
    WITH inserted AS (
        INSERT INTO public.growth_outcome_events (
            event_key, event_type, event_family, source_system, bot_account,
            lead_key, from_ig_user_id, from_username, ig_thread_id, client_id,
            score, attribution, raw_payload, occurred_at
        )
        SELECT 'ig-money:' || t.id || ':warm_lead_identified:derived',
            'warm_lead_identified', 'sales', 'ig_money_sync', t.coach_id::TEXT,
            public.ig_next_action_subject_key(t.id, t.ig_username), t.subscriber_id,
            t.ig_username, t.id, t.linked_user_id, 8,
            jsonb_build_object('channel', 'instagram', 'funnel', 'dm_first'),
            jsonb_build_object('warmth', t.qualifier->>'warmth_label'),
            COALESCE(t.last_inbound_at, t.created_at)
        FROM public.ig_threads t
        WHERE lower(COALESCE(t.channel, '')) = 'instagram'
          AND COALESCE(t.qualifier->>'warmth_label', '') IN ('warm', 'hot')
          AND COALESCE(NULLIF(t.qualifier->>'meaningful_lead_reply_count', '')::INTEGER, 0) >= 2
        ON CONFLICT (event_key) DO NOTHING RETURNING 1
    ) SELECT count(*) INTO v_warm FROM inserted;

    WITH inserted AS (
        INSERT INTO public.growth_outcome_events (
            event_key, event_type, event_family, source_system, bot_account,
            lead_key, from_ig_user_id, from_username, ig_thread_id, client_id,
            score, attribution, raw_payload, occurred_at
        )
        SELECT 'ig-money:' || t.id || ':problem_identified:derived',
            'problem_identified', 'sales', 'ig_money_sync', t.coach_id::TEXT,
            public.ig_next_action_subject_key(t.id, t.ig_username), t.subscriber_id,
            t.ig_username, t.id, t.linked_user_id, 10,
            jsonb_build_object('channel', 'instagram', 'funnel', 'dm_first'),
            jsonb_build_object('facts', t.qualifier->'facts'),
            COALESCE(t.last_inbound_at, t.created_at)
        FROM public.ig_threads t
        WHERE NULLIF(trim(COALESCE(t.qualifier->'facts'->>'current_state', '')), '') IS NOT NULL
           OR NULLIF(trim(COALESCE(t.qualifier->'facts'->>'motivation', '')), '') IS NOT NULL
           OR NULLIF(trim(COALESCE(t.qualifier->'facts'->>'history_blockers', '')), '') IS NOT NULL
        ON CONFLICT (event_key) DO NOTHING RETURNING 1
    ) SELECT count(*) INTO v_problem FROM inserted;

    WITH candidates AS (
        SELECT DISTINCT ON (m.thread_id) m.id, m.thread_id, m.created_at
        FROM public.ig_messages m
        WHERE lower(COALESCE(m.direction, '')) = 'out'
          AND lower(COALESCE(m.text, '')) LIKE '%starter coaching%'
        ORDER BY m.thread_id, m.created_at
    ), inserted AS (
        INSERT INTO public.growth_outcome_events (
            event_key, event_type, event_family, source_system, bot_account,
            lead_key, from_ig_user_id, from_username, ig_thread_id, ig_message_id,
            client_id, score, attribution, occurred_at
        )
        SELECT 'ig-money:' || t.id || ':coaching_pitched:' || c.id,
            'coaching_pitched', 'sales', 'ig_money_sync', t.coach_id::TEXT,
            public.ig_next_action_subject_key(t.id, t.ig_username), t.subscriber_id,
            t.ig_username, t.id, c.id, t.linked_user_id, 20,
            jsonb_build_object('channel', 'instagram', 'funnel', 'dm_first'), c.created_at
        FROM candidates c JOIN public.ig_threads t ON t.id = c.thread_id
        ON CONFLICT (event_key) DO NOTHING RETURNING 1
    ) SELECT count(*) INTO v_pitch FROM inserted;

    WITH candidates AS (
        SELECT DISTINCT ON (m.thread_id) m.id, m.thread_id, m.created_at
        FROM public.ig_messages m
        WHERE lower(COALESCE(m.direction, '')) = 'out'
          AND lower(COALESCE(m.text, '')) LIKE '%future-balance.netlify.app/coaching.html%'
        ORDER BY m.thread_id, m.created_at
    ), inserted AS (
        INSERT INTO public.growth_outcome_events (
            event_key, event_type, event_family, source_system, bot_account,
            lead_key, from_ig_user_id, from_username, ig_thread_id, ig_message_id,
            client_id, score, attribution, occurred_at
        )
        SELECT 'ig-money:' || t.id || ':checkout_sent:' || c.id,
            'checkout_sent', 'sales', 'ig_money_sync', t.coach_id::TEXT,
            public.ig_next_action_subject_key(t.id, t.ig_username), t.subscriber_id,
            t.ig_username, t.id, c.id, t.linked_user_id, 30,
            jsonb_build_object('channel', 'instagram', 'funnel', 'dm_first'), c.created_at
        FROM candidates c JOIN public.ig_threads t ON t.id = c.thread_id
        ON CONFLICT (event_key) DO NOTHING RETURNING 1
    ) SELECT count(*) INTO v_checkout FROM inserted;

    WITH candidates AS (
        SELECT DISTINCT ON (m.thread_id) m.id, m.thread_id, m.created_at
        FROM public.ig_messages m
        WHERE lower(COALESCE(m.direction, '')) = 'in'
          AND lower(COALESCE(m.text, '')) ~ '\m(price|cost|how much|details|included|inclusions|how does.*work)\M'
        ORDER BY m.thread_id, m.created_at
    ), inserted AS (
        INSERT INTO public.growth_outcome_events (
            event_key, event_type, event_family, source_system, bot_account,
            lead_key, from_ig_user_id, from_username, ig_thread_id, ig_message_id,
            client_id, score, attribution, occurred_at
        )
        SELECT 'ig-money:' || t.id || ':coaching_details_requested:' || c.id,
            'coaching_details_requested', 'sales', 'ig_money_sync', t.coach_id::TEXT,
            public.ig_next_action_subject_key(t.id, t.ig_username), t.subscriber_id,
            t.ig_username, t.id, c.id, t.linked_user_id, 18,
            jsonb_build_object('channel', 'instagram', 'funnel', 'dm_first'), c.created_at
        FROM candidates c JOIN public.ig_threads t ON t.id = c.thread_id
        ON CONFLICT (event_key) DO NOTHING RETURNING 1
    ) SELECT count(*) INTO v_details FROM inserted;

    WITH candidates AS (
        SELECT DISTINCT ON (m.thread_id) m.id, m.thread_id, m.created_at
        FROM public.ig_messages m
        WHERE lower(COALESCE(m.direction, '')) = 'in'
          AND lower(COALESCE(m.text, '')) ~ '\m(call|booking|book|talk it through|chat)\M'
        ORDER BY m.thread_id, m.created_at
    ), inserted AS (
        INSERT INTO public.growth_outcome_events (
            event_key, event_type, event_family, source_system, bot_account,
            lead_key, from_ig_user_id, from_username, ig_thread_id, ig_message_id,
            client_id, score, attribution, occurred_at
        )
        SELECT 'ig-money:' || t.id || ':call_requested:' || c.id,
            'call_requested', 'sales', 'ig_money_sync', t.coach_id::TEXT,
            public.ig_next_action_subject_key(t.id, t.ig_username), t.subscriber_id,
            t.ig_username, t.id, c.id, t.linked_user_id, 22,
            jsonb_build_object('channel', 'instagram', 'funnel', 'dm_first'), c.created_at
        FROM candidates c JOIN public.ig_threads t ON t.id = c.thread_id
        ON CONFLICT (event_key) DO NOTHING RETURNING 1
    ) SELECT count(*) INTO v_call FROM inserted;

    WITH inserted AS (
        INSERT INTO public.growth_outcome_events (
            event_key, event_type, event_family, source_system, source_key,
            email, email_key, score, attribution, raw_payload, occurred_at
        )
        SELECT 'balance-booking:' || b.id || ':call_booked',
            'call_booked', 'sales', 'balance_booking', b.id::TEXT,
            b.email, lower(trim(COALESCE(b.email, ''))), 40,
            jsonb_build_object('source', COALESCE(b.metadata->>'source', 'booking_page')),
            jsonb_build_object('call_type', b.call_type, 'status', b.status), b.created_at
        FROM public.balance_bookings b
        WHERE b.status = 'confirmed'
        ON CONFLICT (event_key) DO NOTHING RETURNING 1
    ) SELECT count(*) INTO v_booked FROM inserted;

    RETURN jsonb_build_object('warm', v_warm, 'problem', v_problem,
        'pitch', v_pitch, 'checkout', v_checkout, 'details', v_details,
        'call', v_call, 'booked', v_booked);
END;
$$;

-- Surface only explicit commercial next steps:
--   1. checkout was sent and has had no reply for 24 hours;
--   2. Starter Coaching was pitched and has had no reply for 24 hours; or
--   3. the qualifier reached commitment and the conversation paused.
-- General warm conversations are intentionally not turned into follow-up spam.
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

    UPDATE public.ig_next_actions q
    SET status = 'cancelled', completed_at = NOW(),
        receipt = COALESCE(q.receipt, '{}'::JSONB) || jsonb_build_object(
            'cancelled_reason', 'lead no longer eligible for sales follow-up',
            'cancelled_at', NOW(), 'run_id', p_run_id
        )
    FROM public.ig_threads t
    WHERE q.thread_id = t.id
      AND q.reason->>'source' = 'money_queue'
      AND q.status IN ('ready', 'waiting', 'cooldown')
      AND (t.linked_user_id IS NOT NULL OR t.lead_stage IN ('in_app', 'paying', 'churned'));
    GET DIAGNOSTICS v_cancelled = ROW_COUNT;

    FOR v_row IN
        WITH latest AS (
            SELECT t.*,
                li.id AS inbound_id, li.created_at AS inbound_at,
                lo.id AS outbound_id, lo.created_at AS outbound_at, lo.text AS outbound_text
            FROM public.ig_threads t
            LEFT JOIN LATERAL (
                SELECT m.id, m.created_at FROM public.ig_messages m
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
              AND COALESCE(t.qualifier->>'warmth_label', '') IN ('warm', 'hot')
              AND COALESCE(NULLIF(t.qualifier->>'meaningful_lead_reply_count', '')::INTEGER, 0) >= 2
        ), candidates AS (
            SELECT l.*,
                CASE
                    WHEN lower(COALESCE(l.outbound_text, '')) LIKE '%future-balance.netlify.app/coaching.html%' THEN 'checkout_followup'
                    WHEN lower(COALESCE(l.outbound_text, '')) LIKE '%starter coaching%' THEN 'offer_followup'
                    WHEN COALESCE(l.qualifier->>'stage', '') = 'commitment' THEN 'offer_ready'
                END AS commercial_stage
            FROM latest l
            WHERE l.outbound_at IS NOT NULL
              AND l.outbound_at >= NOW() - INTERVAL '7 days'
              AND l.outbound_at <= NOW() - INTERVAL '24 hours'
              AND (l.inbound_at IS NULL OR l.outbound_at > l.inbound_at)
              AND (
                  lower(COALESCE(l.outbound_text, '')) LIKE '%future-balance.netlify.app/coaching.html%'
                  OR lower(COALESCE(l.outbound_text, '')) LIKE '%starter coaching%'
                  OR COALESCE(l.qualifier->>'stage', '') = 'commitment'
              )
        )
        SELECT c.* FROM candidates c
        WHERE NOT EXISTS (
            SELECT 1 FROM public.growth_outcome_events e
            WHERE e.ig_thread_id = c.id
              AND e.event_type = CASE c.commercial_stage
                  WHEN 'checkout_followup' THEN 'checkout_followup_sent'
                  WHEN 'offer_followup' THEN 'coaching_followup_sent'
                  ELSE 'coaching_pitched'
              END
              AND e.occurred_at >= c.outbound_at
        )
        ORDER BY CASE c.commercial_stage
            WHEN 'checkout_followup' THEN 1 WHEN 'offer_followup' THEN 2 ELSE 3 END,
            c.outbound_at ASC
        LIMIT LEAST(GREATEST(COALESCE(p_limit, 100), 1), 250)
    LOOP
        PERFORM public.upsert_ig_next_action(
            v_row.id, v_row.ig_username, COALESCE(v_row.lead_stage, 'qualifying'),
            'dm_manager',
            CASE WHEN v_row.commercial_stage = 'offer_ready' THEN 'close_sale' ELSE 'reactivation' END,
            CASE v_row.commercial_stage WHEN 'checkout_followup' THEN 930 WHEN 'offer_followup' THEN 910 ELSE 890 END,
            NOW(), NOW(),
            jsonb_build_object(
                'source', 'money_queue', 'commercial_stage', v_row.commercial_stage,
                'why', CASE v_row.commercial_stage
                    WHEN 'checkout_followup' THEN 'Checkout sent 24h+ ago with no reply; one follow-up due'
                    WHEN 'offer_followup' THEN 'Starter Coaching pitched 24h+ ago with no reply; one follow-up due'
                    ELSE 'Warm lead reached commitment; a DM close is the next step'
                END,
                'last_outbound_at', v_row.outbound_at, 'run_id', p_run_id
            ), v_row.outbound_id, FALSE
        );
        v_queued := v_queued + 1;
    END LOOP;

    RETURN jsonb_build_object('queued_candidates', v_queued, 'cancelled', v_cancelled, 'run_id', p_run_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_ig_money_queue(p_limit INTEGER DEFAULT 20)
RETURNS TABLE (
    action_id UUID, thread_id UUID, ig_username TEXT, profile_name TEXT,
    action_type TEXT, commercial_stage TEXT, priority INTEGER, due_at TIMESTAMPTZ,
    warmth_label TEXT, qualifier_stage TEXT, why TEXT,
    last_inbound_at TIMESTAMPTZ, last_outbound_at TIMESTAMPTZ,
    inbound_preview TEXT, outbound_preview TEXT
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
    SELECT q.id, q.thread_id, t.ig_username, t.profile_name,
        q.action_type, q.reason->>'commercial_stage', q.priority, q.due_at,
        t.qualifier->>'warmth_label', t.qualifier->>'stage', q.reason->>'why',
        t.last_inbound_at, t.last_outbound_at,
        left(COALESCE(li.text, ''), 240), left(COALESCE(lo.text, ''), 240)
    FROM public.ig_next_actions q
    JOIN public.ig_threads t ON t.id = q.thread_id
    LEFT JOIN LATERAL (
        SELECT m.text FROM public.ig_messages m WHERE m.thread_id = t.id
          AND lower(COALESCE(m.direction, '')) = 'in' ORDER BY m.created_at DESC LIMIT 1
    ) li ON TRUE
    LEFT JOIN LATERAL (
        SELECT m.text FROM public.ig_messages m WHERE m.thread_id = t.id
          AND lower(COALESCE(m.direction, '')) = 'out' ORDER BY m.created_at DESC LIMIT 1
    ) lo ON TRUE
    WHERE q.owner = 'dm_manager'
      AND q.status IN ('ready', 'claimed')
      AND q.due_at <= NOW()
      AND (q.action_type IN ('close_sale', 'book_call', 'send_checkout', 'reactivation')
           OR (q.action_type = 'reply_inbound' AND q.priority >= 900))
    ORDER BY q.priority DESC, q.due_at ASC
    LIMIT LEAST(GREATEST(COALESCE(p_limit, 20), 1), 100);
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
            WHEN 'paused' THEN '16+ revenue actions are due; pause proactive acquisition'
            WHEN 'half' THEN '6-15 revenue actions are due; run proactive acquisition at half volume'
            ELSE '0-5 revenue actions are due; normal proactive acquisition volume'
        END
    );
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
            count(*) FILTER (WHERE linked_user_id IS NULL AND lead_stage NOT IN ('in_app','paying','churned')
                AND qualifier->>'warmth_label' IN ('warm','hot')) AS warm_now,
            count(*) FILTER (WHERE linked_user_id IS NULL AND lead_stage NOT IN ('in_app','paying','churned')
                AND qualifier->>'warmth_label' IN ('warm','hot')
                AND NULLIF(trim(COALESCE(qualifier->'facts'->>'current_state','')), '') IS NOT NULL) AS problem_known_now,
            count(*) FILTER (WHERE linked_user_id IS NULL AND lead_stage NOT IN ('in_app','paying','churned')
                AND qualifier->>'stage' IN ('commitment','pitched')) AS offer_ready_now
        FROM public.ig_threads
        WHERE lower(COALESCE(channel,'')) = 'instagram'
    ), event_counts AS (
        SELECT
            count(DISTINCT ig_thread_id) FILTER (WHERE event_type = 'warm_lead_identified') AS warmed,
            count(DISTINCT ig_thread_id) FILTER (WHERE event_type = 'problem_identified') AS problems,
            count(DISTINCT ig_thread_id) FILTER (WHERE event_type = 'coaching_details_requested') AS details_requested,
            count(DISTINCT ig_thread_id) FILTER (WHERE event_type = 'coaching_pitched') AS pitched,
            count(DISTINCT ig_thread_id) FILTER (WHERE event_type = 'checkout_sent') AS checkout_sent,
            count(DISTINCT ig_thread_id) FILTER (WHERE event_type = 'call_requested') AS call_requested,
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
        'days', v_days, 'warm_now', c.warm_now, 'problem_known_now', c.problem_known_now,
        'offer_ready_now', c.offer_ready_now, 'due_now', q.due_now,
        'warmed', e.warmed, 'problems', e.problems, 'details_requested', e.details_requested,
        'pitched', e.pitched, 'checkout_sent', e.checkout_sent,
        'call_requested', e.call_requested, 'call_booked', e.call_booked, 'paid', e.paid,
        'warm_to_pitch_pct', CASE WHEN e.warmed > 0 THEN round(100.0 * e.pitched / e.warmed, 1) ELSE 0 END,
        'pitch_to_checkout_pct', CASE WHEN e.pitched > 0 THEN round(100.0 * e.checkout_sent / e.pitched, 1) ELSE 0 END,
        'checkout_to_paid_pct', CASE WHEN e.checkout_sent > 0 THEN round(100.0 * e.paid / e.checkout_sent, 1) ELSE 0 END
    ) INTO v_result
    FROM current_counts c CROSS JOIN event_counts e CROSS JOIN queue_count q;

    RETURN v_result;
END;
$$;

-- Improve inbound routing with the DM-first offer: calls are an escalation,
-- while price/details/readiness stays in the DM close lane.
CREATE OR REPLACE FUNCTION public.route_ig_inbound_to_next_action()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_thread public.ig_threads%ROWTYPE;
    v_text TEXT := lower(trim(COALESCE(NEW.text, '')));
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

    IF v_text ~ '\m(book|booking|call|phone|talk it through)\M' THEN
        v_action_type := 'book_call'; v_priority := 1000; v_why := 'Lead explicitly asked for a call';
    ELSIF v_text ~ '\m(price|cost|how much|details|included|inclusions|sign up|signup|join|start|link|ready|coaching)\M' THEN
        v_action_type := 'close_sale'; v_priority := 950; v_why := 'Inbound Starter Coaching buying intent';
    ELSIF COALESCE(v_thread.qualifier->>'warmth_label', '') IN ('warm','hot')
       AND COALESCE(NULLIF(v_thread.qualifier->>'meaningful_lead_reply_count', '')::INTEGER, 0) >= 3
       AND NULLIF(trim(COALESCE(v_thread.qualifier->'facts'->>'current_state','')), '') IS NOT NULL THEN
        v_action_type := 'close_sale'; v_priority := 920; v_why := 'Warm lead replied with enough problem context to progress the DM close';
    END IF;

    PERFORM public.upsert_ig_next_action(
        NEW.thread_id, v_thread.ig_username, v_lead_state, 'dm_manager',
        v_action_type, v_priority, NOW(), NOW(),
        jsonb_build_object('source', 'ig_messages_inbound', 'why', v_why,
            'commercial_stage', CASE WHEN v_action_type = 'book_call' THEN 'call_requested'
                WHEN v_action_type = 'close_sale' THEN 'live_close' ELSE NULL END,
            'message_preview', left(COALESCE(NEW.text, ''), 300)),
        NEW.id, TRUE
    );
    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.record_ig_money_event(UUID, TEXT, UUID, JSONB, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_ig_money_funnel_events() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.refresh_ig_money_queue(INTEGER, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_ig_money_queue(INTEGER) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_ig_acquisition_capacity() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_ig_warm_lead_scorecard(INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_ig_money_event(UUID, TEXT, UUID, JSONB, TIMESTAMPTZ) TO service_role;
GRANT EXECUTE ON FUNCTION public.sync_ig_money_funnel_events() TO service_role;
GRANT EXECUTE ON FUNCTION public.refresh_ig_money_queue(INTEGER, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_ig_money_queue(INTEGER) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_ig_acquisition_capacity() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_ig_warm_lead_scorecard(INTEGER) TO authenticated, service_role;

COMMENT ON FUNCTION public.refresh_ig_money_queue(INTEGER, TEXT) IS
    'Surfaces selective, due commercial follow-ups without sending them.';
COMMENT ON FUNCTION public.get_ig_acquisition_capacity() IS
    'Revenue-work gate: 0-5 normal, 6-15 half acquisition volume, 16+ paused.';

-- Populate analytics only. This does not refresh the action queue or send DMs.
SELECT public.sync_ig_money_funnel_events();
