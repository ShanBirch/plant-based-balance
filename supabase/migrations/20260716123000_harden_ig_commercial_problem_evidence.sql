-- Tighten the initial sales-readiness backfill: a relationship, business, or
-- peer-coach problem is not a Balance coaching problem, and an old qualified
-- fact must not turn a new casual message into a follow-up.

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
    IF v_replies >= 3 AND v_need <> 'unknown' AND v_readiness = 'bridge_ready' THEN RETURN 'offer_ready'; END IF;
    IF v_replies >= 3 AND v_need <> 'unknown' THEN RETURN 'problem_qualified'; END IF;
    RETURN 'engaged';
END;
$$;

UPDATE public.ig_threads t
SET qualifier = COALESCE(t.qualifier, '{}'::JSONB) || jsonb_build_object(
        'commercial_stage', public.ig_commercial_stage(COALESCE(t.qualifier, '{}'::JSONB)),
        'commercial_reason', CASE public.ig_commercial_stage(COALESCE(t.qualifier, '{}'::JSONB))
            WHEN 'buyer_intent' THEN 'Existing explicit link-ready evidence.'
            WHEN 'offer_ready' THEN 'Existing relevant problem plus earned help evidence.'
            WHEN 'problem_qualified' THEN 'Existing relevant personal goal plus blocker.'
            ELSE 'Engaged conversation; no qualified personal coaching problem yet.' END
    )
WHERE lower(COALESCE(t.channel, '')) = 'instagram'
  AND t.linked_user_id IS NULL
  AND t.lead_stage NOT IN ('in_app', 'paying', 'churned');

DO $$
DECLARE
    v_definition TEXT;
    v_updated TEXT;
BEGIN
    SELECT pg_get_functiondef('public.refresh_ig_money_queue(integer,text)'::REGPROCEDURE)
    INTO v_definition;
    v_updated := replace(v_definition,
        'q.status IN (''ready'', ''waiting'', ''cooldown'')',
        '(q.status IN (''ready'', ''waiting'', ''cooldown'') OR (q.status = ''claimed'' AND q.claim_expires_at <= NOW()))');
    v_updated := replace(v_updated,
        'li.id AS inbound_id, li.created_at AS inbound_at,',
        'li.id AS inbound_id, li.created_at AS inbound_at, li.text AS inbound_text,');
    v_updated := replace(v_updated,
        'SELECT m.id, m.created_at FROM public.ig_messages m',
        'SELECT m.id, m.created_at, m.text FROM public.ig_messages m');
    v_updated := replace(v_updated,
        'OR l.commercial_stage IN (''problem_qualified'', ''offer_ready'', ''buyer_intent'')',
        'OR (l.commercial_stage = ''buyer_intent'' AND public.ig_inbound_has_buyer_intent(l.inbound_text)) OR (l.commercial_stage IN (''problem_qualified'', ''offer_ready'') AND public.ig_inbound_has_problem_signal(l.inbound_text))');
    IF v_updated = v_definition THEN
        RAISE EXCEPTION 'refresh_ig_money_queue hardening targets were not found';
    END IF;
    EXECUTE v_updated;
END;
$$;

-- Remove old queue rows whose latest live context does not support the stored
-- commercial action. An active, unexpired lease is left alone.
UPDATE public.ig_next_actions q
SET status = 'cancelled', completed_at = NOW(),
    receipt = COALESCE(q.receipt, '{}'::JSONB) || jsonb_build_object(
        'cancelled_reason', 'latest live context is not a qualified commercial moment',
        'cancelled_at', NOW(), 'hardening', 'commercial_problem_evidence'
    )
WHERE q.owner = 'dm_manager'
  AND (q.status IN ('ready', 'waiting', 'cooldown')
       OR (q.status = 'claimed' AND q.claim_expires_at <= NOW()))
  AND q.action_type IN ('close_sale', 'book_call', 'send_checkout', 'reactivation')
  AND (
      (q.reason->>'source' = 'ig_messages_inbound' AND NOT EXISTS (
          SELECT 1 FROM public.ig_messages m WHERE m.id = q.source_message_id
            AND ((q.action_type = 'book_call' AND public.ig_inbound_has_call_intent(m.text))
              OR (q.action_type <> 'book_call' AND public.ig_inbound_has_buyer_intent(m.text)))
      ))
      OR (q.reason->>'source' = 'money_queue'
          AND COALESCE(q.reason->>'commercial_stage', '') IN ('problem_qualified', 'offer_ready', 'buyer_intent')
          AND NOT EXISTS (
              SELECT 1 FROM public.ig_messages m
              WHERE m.thread_id = q.thread_id
                AND lower(COALESCE(m.direction, '')) = 'in'
                AND m.created_at = (SELECT max(mi.created_at) FROM public.ig_messages mi
                    WHERE mi.thread_id = q.thread_id AND lower(COALESCE(mi.direction, '')) = 'in')
                AND ((q.reason->>'commercial_stage' = 'buyer_intent' AND public.ig_inbound_has_buyer_intent(m.text))
                  OR (q.reason->>'commercial_stage' IN ('problem_qualified', 'offer_ready') AND public.ig_inbound_has_problem_signal(m.text)))
          ))
  );

REVOKE ALL ON FUNCTION public.ig_inbound_has_problem_signal(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ig_qualifier_has_relevant_problem(JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ig_inbound_has_problem_signal(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.ig_qualifier_has_relevant_problem(JSONB) TO service_role;

SELECT public.sync_ig_sales_pipeline_events();
SELECT public.refresh_ig_money_queue(100, 'commercial-problem-hardening');
