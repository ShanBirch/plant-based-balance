-- One reviewed native-only inbound in Shannon's finite 21-person catch-up.
-- Retain actual native identity/source evidence; never create a subscriber or
-- canonical inbound message merely to satisfy the ordinary reply claim.
CREATE OR REPLACE FUNCTION public.ig_exact_native_owed_reply_eligible(a public.ig_next_actions)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY INVOKER
SET search_path=public,pg_temp AS $function$
BEGIN
 IF a.ig_username IS DISTINCT FROM 'forster.alice'
 OR a.owner IS DISTINCT FROM 'dm_manager' OR a.action_type IS DISTINCT FROM 'reply_inbound'
 OR a.thread_id IS NOT NULL OR a.source_message_id IS NOT NULL
 OR a.reason->>'policy' IS DISTINCT FROM 'native_only_owed_reply_20261025_v1'
 OR a.reason->>'authorization_source_chat' IS DISTINCT FROM '01a170d1-9ce1-7600-abb1-c4317adb4642'
 OR a.reason->>'explicit_user_authorization' IS DISTINCT FROM 'true'
 OR a.reason->>'native_account' IS DISTINCT FROM 'shan_n_sunny'
 OR a.reason->>'native_conversation_id' IS DISTINCT FROM '340282366841710301244259776334285016989'
 OR a.reason->>'native_direct_id' IS DISTINCT FROM '116842643039768'
 OR a.reason->>'native_source_story_id' IS DISTINCT FROM '3715640373089060623'
 OR a.reason->>'native_source_text' IS DISTINCT FROM 'coco babyyyyy such a cutie'
 OR a.reason->>'native_source_local_time' IS DISTINCT FROM '2025-09-07T00:31+10:00'
 OR a.reason->>'native_source_key' IS DISTINCT FROM 'forster.alice:116842643039768:3715640373089060623:20250907T0031'
 OR a.reason->>'full_thread_reviewed' IS DISTINCT FROM 'true'
 OR a.reason->>'native_identity_verified' IS DISTINCT FROM 'true'
 OR a.reason->>'independent_holds_checked' IS DISTINCT FROM 'true'
 OR a.reason->>'native_pending_inbound' IS DISTINCT FROM 'true'
 OR a.reason->>'no_later_native_reply' IS DISTINCT FROM 'true'
 OR a.reason->>'native_following_verified' IS DISTINCT FROM 'true'
 OR nullif(btrim(a.reason->>'native_evidence_ref'),'') IS NULL
 OR nullif(btrim(a.reason->>'canonical_gate_ref'),'') IS NULL
 OR nullif(btrim(a.reason->>'authorization_request_id'),'') IS NULL
 OR coalesce(a.reason->>'run_id','') !~ '^balance-reactive-'
 OR coalesce(length(btrim(a.reason->>'final_text')),0) NOT BETWEEN 1 AND 160
 OR nullif(a.reason->>'native_reviewed_at','') IS NULL
 OR (a.reason->>'native_reviewed_at')::timestamptz NOT BETWEEN now()-interval '5 minutes' AND now()+interval '30 seconds'
 OR nullif(a.reason->>'authorization_expires_at','') IS NULL
 OR (a.reason->>'authorization_expires_at')::timestamptz NOT BETWEEN now()+interval '1 second' AND now()+interval '24 hours'
 THEN RETURN false; END IF;
 IF coalesce(a.receipt,'{}')<>'{}'::jsonb
 OR EXISTS(SELECT 1 FROM public.ig_threads t WHERE lower(t.ig_username)=a.ig_username
   OR lower(t.custom_data#>>'{instagram_graph,username}')=a.ig_username
   OR lower(t.custom_data#>>'{instagram_graph,ig_username}')=a.ig_username)
 OR EXISTS(SELECT 1 FROM public.ig_personal_contacts p WHERE lower(p.ig_username)=a.ig_username)
 OR EXISTS(SELECT 1 FROM public.ig_next_actions x WHERE x.id<>a.id AND lower(x.ig_username)=a.ig_username
   AND (x.status IN ('ready','waiting','needs_you','blocked','claimed')
     OR (x.action_type IN ('reply_inbound','story_reply','welcome_follower','reactivation')
       AND (x.receipt ? 'attempt_reserved_at' OR x.receipt->>'native_verified'='true' OR x.receipt->>'no_repeat'='true'))))
 OR EXISTS(SELECT 1 FROM public.ig_next_action_receipts h WHERE lower(h.ig_username)=a.ig_username
   AND h.action_type IN ('reply_inbound','story_reply','welcome_follower','reactivation')
   AND (h.receipt ? 'attempt_reserved_at' OR h.receipt->>'native_verified'='true' OR h.receipt->>'no_repeat'='true'))
 THEN RETURN false; END IF;
 RETURN true;
EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN RETURN false;
END $function$;

CREATE OR REPLACE FUNCTION public.claim_ig_exact_native_owed_reply(
 p_action_id uuid,p_action_version integer,p_run_id text,p_tab_id text,p_final_text text)
RETURNS public.ig_next_actions LANGUAGE plpgsql SECURITY INVOKER
SET search_path=public,pg_temp AS $function$
DECLARE a public.ig_next_actions; result public.ig_next_actions;
BEGIN
 SELECT * INTO a FROM public.ig_next_actions WHERE id=p_action_id FOR UPDATE;
 IF NOT FOUND OR a.action_version<>p_action_version OR a.status<>'ready'
 OR a.due_at>now() OR a.safe_after>now()
 OR NOT public.ig_exact_native_owed_reply_eligible(a)
 OR a.reason->>'run_id' IS DISTINCT FROM p_run_id
 OR a.reason->>'final_text' IS DISTINCT FROM p_final_text
 OR NOT public.ig_browser_surface_owned(p_run_id,'meta_business_suite')
 OR NOT EXISTS(SELECT 1 FROM public.ig_browser_shift_runs r WHERE r.run_id=p_run_id
   AND r.browser_binding->>'tab_id'=p_tab_id
   AND r.browser_binding->>'kind'='meta_business_suite'
   AND r.browser_binding->>'account'='shan_n_sunny'
   AND r.browser_binding->>'page_id'='561122130919678'
   AND r.lane IN ('missed_dm_audit','reactive_dm'))
 THEN RAISE EXCEPTION 'exact native owed reply not freshly eligible or owned'; END IF;
 UPDATE public.ig_next_actions SET status='claimed',claim_owner='dm_manager',
 claim_token=gen_random_uuid(),claim_run_id=p_run_id,
 claim_expires_at=least(now()+interval '300 seconds',
   (SELECT lease_expires_at FROM public.ig_browser_shift_runs WHERE run_id=p_run_id))
 WHERE id=a.id RETURNING * INTO result;
 RETURN result;
END $function$;

CREATE OR REPLACE FUNCTION public.reserve_ig_exact_native_owed_reply(
 p_action_id uuid,p_action_version integer,p_claim_token uuid,p_run_id text,p_tab_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER
SET search_path=public,pg_temp AS $function$
DECLARE a public.ig_next_actions; reserved_at timestamptz:=clock_timestamp();
BEGIN
 SELECT * INTO a FROM public.ig_next_actions WHERE id=p_action_id FOR UPDATE;
 IF NOT FOUND OR a.action_version<>p_action_version OR a.claim_token IS DISTINCT FROM p_claim_token
 OR NOT public.ig_exact_native_owed_reply_eligible(a)
 OR a.reason->>'run_id' IS DISTINCT FROM p_run_id
 OR NOT public.ig_browser_action_owned(p_run_id,'meta_business_suite',p_tab_id,
   p_action_id,p_action_version,p_claim_token,NULL)
 OR NOT EXISTS(SELECT 1 FROM public.ig_browser_shift_runs r WHERE r.run_id=p_run_id
   AND r.browser_binding->>'tab_id'=p_tab_id
   AND r.browser_binding->>'kind'='meta_business_suite'
   AND r.browser_binding->>'account'='shan_n_sunny'
   AND r.browser_binding->>'page_id'='561122130919678'
   AND r.lane IN ('missed_dm_audit','reactive_dm'))
 THEN RAISE EXCEPTION 'exact native reservation rejected; never retry reserved tuple'; END IF;
 UPDATE public.ig_next_actions SET receipt=jsonb_build_object(
   'policy','native_only_owed_reply_20261025_v1','attempt_reserved_at',reserved_at,
   'native_source_key',a.reason->>'native_source_key','reservation_version',1,
   'no_repeat',true,'outbound_attempted',true,'native_send_attempted',false,
   'final_text',a.reason->>'final_text','run_id',p_run_id,'action_version',p_action_version,
   'original_claim_token',p_claim_token,'canonical_status','pending') WHERE id=a.id;
 RETURN jsonb_build_object('reserved',true,'reserved_at',reserved_at,'no_repeat',true);
END $function$;

REVOKE ALL ON FUNCTION public.ig_exact_native_owed_reply_eligible(public.ig_next_actions),
 public.claim_ig_exact_native_owed_reply(uuid,integer,text,text,text),
 public.reserve_ig_exact_native_owed_reply(uuid,integer,uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ig_exact_native_owed_reply_eligible(public.ig_next_actions),
 public.claim_ig_exact_native_owed_reply(uuid,integer,text,text,text),
 public.reserve_ig_exact_native_owed_reply(uuid,integer,uuid,text,text) TO service_role;
