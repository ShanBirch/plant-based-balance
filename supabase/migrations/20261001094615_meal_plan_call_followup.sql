-- One gift opportunity per verified identity. Only the existing browser operator
-- sends; refreshing this queue does not send messages or change person holds.
CREATE TABLE public.ig_meal_plan_followups (
 person_key text PRIMARY KEY,
 thread_id uuid NOT NULL REFERENCES public.ig_threads(id),
 invitation_message_id uuid NOT NULL REFERENCES public.ig_messages(id),
 due_at timestamptz NOT NULL,
 status text NOT NULL DEFAULT 'waiting' CHECK(status IN
 ('waiting','reserved','offer_sent','delivered','cancelled','uncertain')),
 action_id uuid,
 reserved_claim_token uuid,
 reserved_run_id text,
 receipt jsonb NOT NULL DEFAULT '{}'::jsonb,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ig_meal_plan_followups ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ig_meal_plan_followups FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.ig_meal_plan_followups TO service_role;

CREATE FUNCTION public.ig_meal_plan_person_key(p_thread_id uuid) RETURNS text
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public,pg_temp AS $$
 SELECT CASE
 WHEN nullif(trim(t.custom_data->>'email'),'') IS NOT NULL
 THEN 'email:'||lower(trim(t.custom_data->>'email'))
 WHEN t.channel='instagram' AND nullif(trim(t.ig_username),'') IS NOT NULL
 THEN public.ig_next_action_subject_key(t.id,t.ig_username)
 ELSE coalesce(t.channel,'unknown')||':'||coalesce(nullif(t.subscriber_id,''),t.id::text) END
 FROM public.ig_threads t WHERE t.id=p_thread_id;
$$;

-- Structured checks supplement the operator's fresh full-thread/native review.
CREATE FUNCTION public.ig_meal_plan_block_reason(p_thread_id uuid,p_source_id uuid)
RETURNS text LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE t public.ig_threads%ROWTYPE; m public.ig_messages%ROWTYPE; k text;
BEGIN
 SELECT * INTO t FROM public.ig_threads WHERE id=p_thread_id;
 IF NOT FOUND THEN RETURN 'missing_thread'; END IF;
 SELECT * INTO m FROM public.ig_messages WHERE id=p_source_id AND thread_id=t.id AND direction='out';
 IF NOT FOUND THEN RETURN 'missing_delivered_invitation'; END IF;
 IF t.channel NOT IN ('instagram','facebook','messenger','manychat_facebook','whatsapp','manychat_whatsapp')
 OR t.channel IS NULL THEN RETURN 'unsupported_channel'; END IF;
 IF t.linked_user_id IS NOT NULL OR t.lead_stage IN ('in_app','paying','churned','client','closed','not_now','declined')
 OR nullif(t.custom_data->>'linked_client_id','') IS NOT NULL
 OR nullif(t.custom_data->>'linked_user_id','') IS NOT NULL THEN RETURN 'client_or_closed'; END IF;
 FOREACH k IN ARRAY ARRAY['manual_only','manual_review_only','manual_takeover','manual_ig_required',
 'customer_service_manual_only','friend_manual_only','needs_you_always','needs_you_required',
 'permanent_needs_you','permanent_needs_you_draft_only','needs_you_permanent_person_override',
 'no_ai_send','no_ai_schedule','do_not_auto_send','do_not_follow_up','codex_ai_opt_out',
 'ai_automation_opt_out','operator_human_requested','auto_reply_paused_by_shannon',
 'auto_send_stopped','blocked_by_shannon','browser_hard_exclusion','known_client',
 'internal_account','fake_account','proactive_offer_followup_suppressed'] LOOP
  IF lower(coalesce(t.custom_data->>k,'false')) IN ('true','1','yes') THEN RETURN 'hold:'||k; END IF;
 END LOOP;
 IF nullif(t.custom_data->>'merged_into_thread_id','') IS NOT NULL
 OR nullif(t.custom_data->>'merged_into_ig_thread_id','') IS NOT NULL
 OR nullif(t.custom_data->>'automation_blocked_reason','') IS NOT NULL
 OR nullif(t.custom_data->>'operator_lock','') IS NOT NULL THEN RETURN 'ownership_or_merge_hold'; END IF;
 IF coalesce(t.custom_data->>'conversation_owner','') NOT IN ('','dm_manager','browser_dispatcher','codex_live_worker')
 THEN RETURN 'other_conversation_owner'; END IF;
 IF lower(coalesce(t.profile_name,'')) ~ '^(nat|shane minahan|arunima( sharma)?|dani minahan)$'
 THEN RETURN 'protected_person'; END IF;
 IF EXISTS(SELECT 1 FROM public.balance_bookings b WHERE b.status='confirmed' AND
 (b.metadata->>'ig_thread_id'=t.id::text
 OR (nullif(t.custom_data->>'email','') IS NOT NULL AND lower(b.email)=lower(t.custom_data->>'email'))
 OR (nullif(t.custom_data->>'phone','') IS NOT NULL AND
 regexp_replace(b.phone,'[^0-9]','','g')=regexp_replace(t.custom_data->>'phone','[^0-9]','','g'))))
 THEN RETURN 'already_booked'; END IF;
 IF EXISTS(SELECT 1 FROM public.growth_outcome_events e WHERE
 (e.ig_thread_id=t.id OR e.lead_key=public.ig_meal_plan_person_key(t.id))
 AND e.event_status='confirmed' AND e.event_type IN ('call_booked','subscription_started','purchase','paid','founders_pass_purchased'))
 OR EXISTS(SELECT 1 FROM public.founders_pass_purchases p WHERE p.status='paid'
 AND nullif(t.custom_data->>'email','') IS NOT NULL AND lower(p.email)=lower(t.custom_data->>'email'))
 THEN RETURN 'booking_or_purchase_receipt'; END IF;
 IF EXISTS(SELECT 1 FROM public.ig_messages newer WHERE newer.thread_id=t.id
 AND (newer.created_at,newer.id)>(m.created_at,m.id)) THEN RETURN 'conversation_changed'; END IF;
 IF EXISTS(SELECT 1 FROM public.ig_next_actions q WHERE q.thread_id=t.id AND
 (q.status IN ('needs_you','blocked') OR q.owner='manual')) THEN RETURN 'action_hold'; END IF;
 RETURN NULL;
END $$;

CREATE FUNCTION public.register_ig_meal_plan_followup(p_thread_id uuid,p_invitation_message_id uuid,
 p_review jsonb DEFAULT '{}'::jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE m public.ig_messages%ROWTYPE; why text; key text; n int;
BEGIN
 SELECT * INTO m FROM public.ig_messages WHERE id=p_invitation_message_id AND thread_id=p_thread_id AND direction='out';
 IF NOT FOUND THEN RETURN jsonb_build_object('registered',false,'reason','missing_invitation'); END IF;
 -- Historic backlog is excluded. This includes yesterday's current lead cohort.
 IF m.created_at<'2026-09-29 14:00:00+00' OR m.created_at>now()
 THEN RETURN jsonb_build_object('registered',false,'reason','outside_current_cohort'); END IF;
 IF coalesce(m.text,'') !~ 'https://plantbased-balance[.]org/book([?/[:space:]]|$)'
 AND NOT coalesce((p_review->>'call_invitation_verified'='true'
 AND nullif(p_review->>'reviewed_by','') IS NOT NULL
 AND (p_review->>'reviewed_at')::timestamptz BETWEEN now()-interval '5 minutes' AND now()+interval '30 seconds'),false)
 THEN RETURN jsonb_build_object('registered',false,'reason','invitation_review_required'); END IF;
 why:=public.ig_meal_plan_block_reason(p_thread_id,m.id);
 IF why IS NOT NULL THEN RETURN jsonb_build_object('registered',false,'reason',why); END IF;
 key:=public.ig_meal_plan_person_key(p_thread_id);
 INSERT INTO public.ig_meal_plan_followups(person_key,thread_id,invitation_message_id,due_at,receipt)
 VALUES(key,p_thread_id,m.id,m.created_at+interval '24 hours',jsonb_build_object('invitation_review',p_review))
 ON CONFLICT(person_key) DO UPDATE SET thread_id=excluded.thread_id,
 invitation_message_id=excluded.invitation_message_id,due_at=excluded.due_at,
 status='waiting',action_id=NULL,updated_at=now(),
 receipt=ig_meal_plan_followups.receipt||excluded.receipt
 WHERE ig_meal_plan_followups.status IN ('waiting','cancelled')
 AND ig_meal_plan_followups.reserved_claim_token IS NULL
 AND ig_meal_plan_followups.invitation_message_id<>excluded.invitation_message_id;
 GET DIAGNOSTICS n=ROW_COUNT;
 RETURN jsonb_build_object('registered',n=1,'person_key',key,'due_at',m.created_at+interval '24 hours');
END $$;

CREATE FUNCTION public.refresh_ig_meal_plan_followups(p_limit int DEFAULT 50) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE r record; q public.ig_next_actions%ROWTYPE; n int:=0; why text;
BEGIN
 -- Discover only actual booking URLs, never inferred warmth or a keyword "call".
 FOR r IN SELECT m.id,m.thread_id FROM public.ig_messages m WHERE m.direction='out'
 AND m.created_at>=greatest('2026-09-29 14:00:00+00'::timestamptz,now()-interval '7 days')
 AND m.text ~ 'https://plantbased-balance[.]org/book([?/[:space:]]|$)'
 ORDER BY m.created_at DESC LIMIT 200 LOOP
  PERFORM public.register_ig_meal_plan_followup(r.thread_id,r.id);
 END LOOP;
 FOR r IN SELECT f.*,t.ig_username,t.lead_stage FROM public.ig_meal_plan_followups f
 JOIN public.ig_threads t ON t.id=f.thread_id WHERE f.status='waiting' AND f.due_at<=now()
 ORDER BY f.due_at LIMIT least(greatest(p_limit,1),100) FOR UPDATE OF f SKIP LOCKED LOOP
  why:=public.ig_meal_plan_block_reason(r.thread_id,r.invitation_message_id);
  IF why IS NOT NULL THEN
   UPDATE public.ig_meal_plan_followups SET status='cancelled',updated_at=now(),
    receipt=receipt||jsonb_build_object('cancelled_reason',why) WHERE person_key=r.person_key;
   CONTINUE;
  END IF;
  -- Do not replace any pending sales/support/reactive job, even of the same type.
  IF EXISTS(SELECT 1 FROM public.ig_next_actions a WHERE a.thread_id=r.thread_id
   AND a.status IN ('ready','waiting','claimed','needs_you','blocked')
   AND a.reason->>'policy' IS DISTINCT FROM 'meal_plan_call_followup_v1') THEN CONTINUE; END IF;
  q:=public.upsert_ig_next_action(r.thread_id,r.ig_username,r.lead_stage,'dm_manager','close_sale',650,
    r.due_at,r.due_at,jsonb_build_object('policy','meal_plan_call_followup_v1',
    'source','verified_call_invitation','person_key',r.person_key,'gift_offer_only',true,
    'pdf_url','https://plantbased-balance.org/assets/guides/Balance-seven-day-plant-based-meal-plan.pdf'),
    r.invitation_message_id,false);
  IF q.reason->>'policy'='meal_plan_call_followup_v1' THEN
   UPDATE public.ig_meal_plan_followups SET action_id=q.id,updated_at=now() WHERE person_key=r.person_key;
   n:=n+1;
  END IF;
 END LOOP;
 RETURN jsonb_build_object('queued',n,'waiting',(SELECT count(*) FROM public.ig_meal_plan_followups WHERE status='waiting'),
 'due',(SELECT count(*) FROM public.ig_meal_plan_followups WHERE status='waiting' AND due_at<=now()));
END $$;

CREATE FUNCTION public.ig_meal_plan_action_eligible(p_action_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public,pg_temp AS $$
 SELECT EXISTS(SELECT 1 FROM public.ig_next_actions q JOIN public.ig_meal_plan_followups f ON f.action_id=q.id
 WHERE q.id=p_action_id AND q.reason->>'policy'='meal_plan_call_followup_v1'
 AND f.thread_id=q.thread_id AND f.invitation_message_id=q.source_message_id AND f.due_at<=now()
 AND (f.status='waiting' OR (f.status='reserved' AND f.reserved_claim_token=q.claim_token AND f.reserved_run_id=q.claim_run_id))
 AND public.ig_meal_plan_block_reason(q.thread_id,q.source_message_id) IS NULL);
$$;

-- These are review candidates, never automatic eligibility from keyword matches.
CREATE FUNCTION public.ig_meal_plan_review_candidates(p_limit int DEFAULT 50)
RETURNS TABLE(thread_id uuid,invitation_message_id uuid,invitation_text text,created_at timestamptz)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public,pg_temp AS $$
 SELECT t.id,m.id,m.text,m.created_at FROM public.ig_threads t
 JOIN LATERAL (SELECT x.* FROM public.ig_messages x WHERE x.thread_id=t.id
 ORDER BY x.created_at DESC,x.id DESC LIMIT 1) m ON m.direction='out'
 WHERE m.created_at>=greatest('2026-09-29 14:00:00+00'::timestamptz,now()-interval '7 days')
 AND coalesce(m.text,'') ~* '(call|consultation|booking)'
 AND public.ig_meal_plan_block_reason(t.id,m.id) IS NULL
 AND NOT EXISTS(SELECT 1 FROM public.ig_meal_plan_followups f WHERE
 f.person_key=public.ig_meal_plan_person_key(t.id) AND
 (f.invitation_message_id=m.id OR f.reserved_claim_token IS NOT NULL))
 ORDER BY m.created_at LIMIT least(greatest(p_limit,1),100);
$$;

-- Native send-time proof now also revalidates this narrow gift opportunity.
CREATE OR REPLACE FUNCTION public.ig_browser_action_owned(p_run_id text,p_surface text,p_tab_id text,p_action_id uuid,p_action_version integer,p_claim_token uuid,p_source_message_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public,pg_temp AS $$
 SELECT public.ig_browser_surface_owned(p_run_id,p_surface) AND EXISTS(
 SELECT 1 FROM public.ig_browser_shift_runs r JOIN public.ig_next_actions a ON a.claim_run_id=r.run_id
 WHERE r.run_id=p_run_id AND r.browser_binding->>'tab_id'=p_tab_id
 AND a.id=p_action_id AND a.action_version=p_action_version AND a.claim_token=p_claim_token
 AND a.source_message_id IS NOT DISTINCT FROM p_source_message_id
 AND a.status='claimed' AND a.claim_expires_at>now()
 AND (a.reason->>'policy' IS DISTINCT FROM 'meal_plan_call_followup_v1' OR public.ig_meal_plan_action_eligible(a.id))
 AND ((p_surface='meta_business_suite' AND a.action_type IN ('reply_inbound','close_sale'))
 OR (p_surface='instagram' AND a.action_type IN ('discovery_follow','feed_engagement','story_reply','reply_external_comment','welcome_follower'))));
$$;

CREATE FUNCTION public.reserve_ig_meal_plan_offer(p_action_id uuid,p_claim_token uuid,p_run_id text,
 p_review jsonb) RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE q public.ig_next_actions%ROWTYPE; n int;
BEGIN
 SELECT * INTO q FROM public.ig_next_actions WHERE id=p_action_id AND status='claimed'
 AND claim_token=p_claim_token AND claim_run_id=p_run_id AND claim_expires_at>now();
 IF NOT FOUND OR NOT public.ig_browser_surface_owned(p_run_id,'meta_business_suite')
 OR NOT public.ig_meal_plan_action_eligible(p_action_id) THEN RETURN false; END IF;
 IF NOT coalesce(p_review @> '{"native_identity_verified":true,"full_thread_reviewed":true,"booking_purchase_checked":true,"no_decline_or_space_request":true}',false)
 OR coalesce(p_review->>'final_text','')=''
 OR NOT coalesce((p_review->>'reviewed_at')::timestamptz BETWEEN now()-interval '5 minutes' AND now()+interval '30 seconds',false)
 THEN RETURN false; END IF;
 UPDATE public.ig_meal_plan_followups SET status='reserved',reserved_claim_token=p_claim_token,
 reserved_run_id=p_run_id,receipt=receipt||jsonb_build_object('offer_review',p_review,'reserved_at',now()),updated_at=now()
 WHERE action_id=p_action_id AND status='waiting';
 GET DIAGNOSTICS n=ROW_COUNT;
 RETURN n=1;
END $$;

CREATE FUNCTION public.record_ig_meal_plan_offer(p_action_id uuid,p_claim_token uuid,p_outcome text,p_receipt jsonb)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE n int;
BEGIN
 IF p_outcome NOT IN ('offer_sent','uncertain','cancelled') THEN RAISE EXCEPTION 'invalid outcome'; END IF;
 IF p_outcome='offer_sent' AND NOT coalesce(p_receipt @> '{"native_verified":true}',false)
 THEN RAISE EXCEPTION 'native delivery proof required'; END IF;
 UPDATE public.ig_meal_plan_followups SET status=p_outcome,receipt=receipt||p_receipt,updated_at=now()
 WHERE action_id=p_action_id AND reserved_claim_token=p_claim_token AND status='reserved';
 GET DIAGNOSTICS n=ROW_COUNT; RETURN n=1;
END $$;

CREATE FUNCTION public.reserve_ig_meal_plan_delivery(p_thread_id uuid,p_action_id uuid,
 p_claim_token uuid,p_run_id text,p_review jsonb) RETURNS boolean
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE q public.ig_next_actions%ROWTYPE; n int;
BEGIN
 SELECT * INTO q FROM public.ig_next_actions WHERE id=p_action_id AND thread_id=p_thread_id
 AND action_type='reply_inbound' AND status='claimed' AND claim_token=p_claim_token
 AND claim_run_id=p_run_id AND claim_expires_at>now();
 IF NOT FOUND OR NOT public.ig_browser_surface_owned(p_run_id,'meta_business_suite')
 OR NOT EXISTS(SELECT 1 FROM public.ig_messages m WHERE m.id=q.source_message_id AND m.direction='in'
 AND m.thread_id=p_thread_id AND NOT EXISTS(SELECT 1 FROM public.ig_messages later WHERE later.thread_id=p_thread_id
 AND (later.created_at,later.id)>(m.created_at,m.id))) THEN RETURN false; END IF;
 IF NOT coalesce(p_review @> '{"meal_plan_accepted":true,"native_identity_verified":true,"full_thread_reviewed":true}',false)
 OR NOT coalesce((p_review->>'reviewed_at')::timestamptz BETWEEN now()-interval '5 minutes' AND now()+interval '30 seconds',false)
 THEN RETURN false; END IF;
 UPDATE public.ig_meal_plan_followups SET receipt=receipt||jsonb_build_object(
 'pdf_delivery_attempted_at',now(),'pdf_action_id',q.id,'pdf_claim_token',p_claim_token,
 'pdf_source_inbound_id',q.source_message_id,'pdf_review',p_review),updated_at=now()
 WHERE person_key=public.ig_meal_plan_person_key(p_thread_id) AND status='offer_sent'
 AND NOT receipt ? 'pdf_delivery_attempted_at';
 GET DIAGNOSTICS n=ROW_COUNT; RETURN n=1;
END $$;

CREATE FUNCTION public.record_ig_meal_plan_delivery(p_thread_id uuid,p_claim_token uuid,
 p_outcome text,p_receipt jsonb) RETURNS boolean
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE n int;
BEGIN
 IF p_outcome NOT IN ('delivered','uncertain') THEN RAISE EXCEPTION 'invalid delivery outcome'; END IF;
 IF p_outcome='delivered' AND NOT coalesce(p_receipt @> '{"native_verified":true}',false)
 THEN RAISE EXCEPTION 'native delivery proof required'; END IF;
 UPDATE public.ig_meal_plan_followups SET status=p_outcome,receipt=receipt||p_receipt,updated_at=now()
 WHERE person_key=public.ig_meal_plan_person_key(p_thread_id) AND status='offer_sent'
 AND receipt->>'pdf_claim_token'=p_claim_token::text;
 GET DIAGNOSTICS n=ROW_COUNT; RETURN n=1;
END $$;

REVOKE ALL ON FUNCTION public.ig_meal_plan_person_key(uuid),public.ig_meal_plan_block_reason(uuid,uuid),
 public.register_ig_meal_plan_followup(uuid,uuid,jsonb),public.refresh_ig_meal_plan_followups(int),
 public.ig_meal_plan_action_eligible(uuid),public.reserve_ig_meal_plan_offer(uuid,uuid,text,jsonb),
 public.record_ig_meal_plan_offer(uuid,uuid,text,jsonb),public.ig_meal_plan_review_candidates(int),
 public.reserve_ig_meal_plan_delivery(uuid,uuid,uuid,text,jsonb),
 public.record_ig_meal_plan_delivery(uuid,uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ig_meal_plan_person_key(uuid),public.ig_meal_plan_block_reason(uuid,uuid),
 public.register_ig_meal_plan_followup(uuid,uuid,jsonb),public.refresh_ig_meal_plan_followups(int),
 public.ig_meal_plan_action_eligible(uuid),public.reserve_ig_meal_plan_offer(uuid,uuid,text,jsonb),
 public.record_ig_meal_plan_offer(uuid,uuid,text,jsonb),public.ig_meal_plan_review_candidates(int),
 public.reserve_ig_meal_plan_delivery(uuid,uuid,uuid,text,jsonb),
 public.record_ig_meal_plan_delivery(uuid,uuid,text,jsonb) TO service_role;
