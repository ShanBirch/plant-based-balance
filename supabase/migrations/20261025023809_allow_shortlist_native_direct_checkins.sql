-- One finite user-requested shortlist; no fabricated canonical identity/source.
CREATE OR REPLACE FUNCTION public.ig_shortlist_native_checkin_eligible(a public.ig_next_actions)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY INVOKER
SET search_path TO public, pg_temp AS $function$
BEGIN
 IF a.owner IS DISTINCT FROM 'manual' OR a.action_type IS DISTINCT FROM 'reactivation'
 OR a.thread_id IS NOT NULL OR a.source_message_id IS NOT NULL
 OR a.reason->>'policy' IS DISTINCT FROM 'shortlist_native_direct_20261025_v1'
 OR a.reason->>'campaign' IS DISTINCT FROM 'shortlist_casual_seven_day_v2'
 OR a.reason->>'authorization_source_chat' IS DISTINCT FROM '01a170d1-9ce1-7600-abb1-c4317adb4642'
 OR a.reason->>'explicit_user_authorization' IS DISTINCT FROM 'true'
 OR a.ig_username IS NULL OR NOT (a.ig_username = ANY(ARRAY[
 'sahil__20__','eli3palazzi','williammcnee','klynto80','allanbogut',
 'leah_draper_','nicholashatzz','mariaauchli','gossboss4','paulio86','tammyctaylor_fitness']))
 OR coalesce(a.reason->>'run_id','') !~ '^balance-shortlist-dm-20261025-seg[0-9]+$'
 OR nullif(btrim(a.reason->>'authorization_request_id'),'') IS NULL
 OR coalesce(length(btrim(a.reason->>'final_text')),0) NOT BETWEEN 1 AND 120
 OR a.reason->>'native_account' IS DISTINCT FROM 'shan_n_sunny'
 OR coalesce(a.reason->>'native_conversation_id','') !~ '^[0-9]{5,30}$'
 OR nullif(btrim(a.reason->>'native_display_name'),'') IS NULL
 OR nullif(btrim(a.reason->>'native_evidence_ref'),'') IS NULL
 OR nullif(btrim(a.reason->>'canonical_gate_ref'),'') IS NULL
 THEN RETURN false; END IF;
 IF a.reason->>'full_thread_reviewed' IS DISTINCT FROM 'true'
 OR a.reason->>'native_identity_verified' IS DISTINCT FROM 'true'
 OR a.reason->>'native_following_verified' IS DISTINCT FROM 'true'
 OR a.reason->>'independent_holds_checked' IS DISTINCT FROM 'true'
 OR a.reason->>'canonical_history_empty' IS DISTINCT FROM 'true'
 OR a.reason->>'native_pending_inbound' IS DISTINCT FROM 'false'
 OR nullif(a.reason->>'authorization_expires_at','') IS NULL
 OR (a.reason->>'authorization_expires_at')::timestamptz <= now()
 OR (a.reason->>'authorization_expires_at')::timestamptz > now()+interval '24 hours'
 OR nullif(a.reason->>'native_reviewed_at','') IS NULL
 OR (a.reason->>'native_reviewed_at')::timestamptz < now()-interval '5 minutes'
 OR (a.reason->>'native_reviewed_at')::timestamptz > now()+interval '30 seconds'
 THEN RETURN false; END IF;
 IF a.reason->>'native_latest_direction' = 'empty' THEN
   IF a.reason->>'native_history_empty' IS DISTINCT FROM 'true'
   OR nullif(a.reason->>'native_last_outbound_at','') IS NOT NULL THEN RETURN false; END IF;
 ELSIF a.reason->>'native_latest_direction' = 'out' THEN
   IF a.reason->>'native_history_empty' IS DISTINCT FROM 'false'
   OR nullif(a.reason->>'native_last_outbound_at','') IS NULL
   OR (a.reason->>'native_last_outbound_at')::timestamptz >= now()-interval '7 days'
   THEN RETURN false; END IF;
 ELSE RETURN false; END IF;
 -- A newly discovered canonical identity forces a fresh review using the
 -- existing canonical-thread path. Native IDs are never inserted as subscribers.
 IF EXISTS(SELECT 1 FROM public.ig_threads t WHERE lower(t.ig_username)=a.ig_username
 OR lower(t.custom_data#>>'{instagram_graph,username}')=a.ig_username
 OR lower(t.custom_data#>>'{instagram_graph,ig_username}')=a.ig_username)
 OR EXISTS(SELECT 1 FROM public.ig_personal_contacts p WHERE lower(p.ig_username)=a.ig_username)
 OR EXISTS(SELECT 1 FROM public.ig_next_actions other WHERE other.id<>a.id
   AND lower(other.ig_username)=a.ig_username
   AND (other.status IN ('ready','waiting','needs_you','blocked','claimed')
     OR (other.receipt->>'campaign'='shortlist_casual_seven_day_v2'
       AND (other.receipt ? 'attempt_reserved_at' OR other.receipt->>'native_send_attempted'='true'
            OR other.receipt->>'native_verified'='true'))))
 OR EXISTS(SELECT 1 FROM public.ig_next_action_receipts h WHERE lower(h.ig_username)=a.ig_username
   AND h.receipt->>'campaign'='shortlist_casual_seven_day_v2'
   AND (h.receipt ? 'attempt_reserved_at' OR h.receipt->>'native_send_attempted'='true'
        OR h.receipt->>'native_verified'='true'))
 THEN RETURN false; END IF;
 -- An existing reservation remains owned only by its still-live exact claim;
 -- an expired reservation cannot become a fresh claim or a retry.
 IF a.receipt ? 'attempt_reserved_at' THEN
   RETURN coalesce(a.status='claimed' AND a.claim_expires_at>now()
    AND a.claim_run_id=a.reason->>'run_id'
    AND a.receipt->>'original_claim_token'=a.claim_token::text
    AND a.receipt->>'action_version'=a.action_version::text,false);
 END IF;
 RETURN true;
EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN RETURN false;
END $function$;
REVOKE ALL ON FUNCTION public.ig_shortlist_native_checkin_eligible(public.ig_next_actions) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ig_shortlist_native_checkin_eligible(public.ig_next_actions) TO service_role;

CREATE OR REPLACE FUNCTION public.ig_user_requested_checkin_eligible(a ig_next_actions)
 RETURNS boolean LANGUAGE plpgsql STABLE SECURITY INVOKER
 SET search_path TO public, pg_temp AS $function$
DECLARE t public.ig_threads;
BEGIN
 IF a.reason->>'policy'='shortlist_native_direct_20261025_v1' THEN
   RETURN public.ig_shortlist_native_checkin_eligible(a);
 END IF;
 -- Existing canonical-thread policy remains unchanged.
 IF a.owner <> 'manual' OR a.action_type <> 'reactivation' OR a.reason->>'policy' IS DISTINCT FROM 'user_requested_checkin_v1' OR a.reason->>'explicit_user_authorization' IS DISTINCT FROM 'true' OR nullif(a.reason->>'authorization_request_id','') IS NULL OR nullif(a.reason->>'final_text','') IS NULL OR length(a.reason->>'final_text')>500 THEN RETURN false; END IF;
 IF nullif(a.reason->>'authorization_expires_at','') IS NULL OR (a.reason->>'authorization_expires_at')::timestamptz <= now() OR (a.reason->>'authorization_expires_at')::timestamptz > now()+interval '24 hours' THEN RETURN false; END IF;
 SELECT * INTO t FROM public.ig_threads WHERE id=a.thread_id AND lower(ig_username)=lower(a.ig_username);
 IF NOT FOUND OR coalesce(t.channel,'instagram') <> 'instagram' THEN RETURN false; END IF;
 IF EXISTS(SELECT 1 FROM public.ig_personal_contacts p WHERE lower(p.ig_username)=lower(a.ig_username)) THEN RETURN false; END IF;
 IF EXISTS(SELECT 1 FROM public.ig_threads x WHERE lower(x.ig_username)=lower(a.ig_username) AND (x.custom_data->>'do_not_follow_up'='true' OR x.custom_data->>'blocked_by_shannon'='true' OR x.custom_data->>'manual_review_only'='true' OR x.custom_data->>'friend_manual_only'='true' OR x.custom_data->>'personal_outreach'='true' OR x.custom_data->>'client_community_support_enabled'='false')) THEN RETURN false; END IF;
 RETURN a.reason->>'expected_latest_message_id' = (SELECT m.id::text FROM public.ig_messages m JOIN public.ig_threads x ON x.id=m.thread_id WHERE lower(x.ig_username)=lower(a.ig_username) ORDER BY m.created_at DESC,m.id DESC LIMIT 1);
EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN RETURN false;
END $function$;

CREATE OR REPLACE FUNCTION public.claim_ig_shortlist_native_action(
 p_action_id uuid,p_action_version integer,p_run_id text,p_tab_id text,p_final_text text)
RETURNS public.ig_next_actions LANGUAGE plpgsql SECURITY INVOKER
SET search_path TO public,pg_temp AS $function$
DECLARE a public.ig_next_actions; result public.ig_next_actions;
BEGIN
 SELECT * INTO a FROM public.ig_next_actions WHERE id=p_action_id FOR UPDATE;
 IF NOT FOUND OR a.action_version<>p_action_version OR a.status<>'ready'
 OR a.due_at>now() OR a.safe_after>now() OR a.receipt ? 'attempt_reserved_at'
 OR NOT public.ig_shortlist_native_checkin_eligible(a)
 OR a.reason->>'run_id' IS DISTINCT FROM p_run_id
 OR a.reason->>'final_text' IS DISTINCT FROM p_final_text
 OR NOT public.ig_browser_surface_owned(p_run_id,'instagram')
 OR NOT EXISTS(SELECT 1 FROM public.ig_browser_shift_runs r WHERE r.run_id=p_run_id
   AND r.browser_binding->>'tab_id'=p_tab_id AND r.lane='active_client_instagram_community')
 THEN RAISE EXCEPTION 'shortlist exact native action not eligible or owned'; END IF;
 UPDATE public.ig_next_actions SET status='claimed',claim_owner='manual',
 claim_token=gen_random_uuid(),claim_run_id=p_run_id,claim_expires_at=now()+interval '300 seconds'
 WHERE id=a.id RETURNING * INTO result;
 RETURN result;
END $function$;
REVOKE ALL ON FUNCTION public.claim_ig_shortlist_native_action(uuid,integer,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_ig_shortlist_native_action(uuid,integer,text,text,text) TO service_role;

CREATE OR REPLACE FUNCTION public.reserve_ig_shortlist_native_send(
 p_action_id uuid,p_action_version integer,p_claim_token uuid,p_run_id text,p_tab_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER
SET search_path TO public,pg_temp AS $function$
DECLARE a public.ig_next_actions; reserved_at timestamptz:=clock_timestamp();
BEGIN
 SELECT * INTO a FROM public.ig_next_actions WHERE id=p_action_id FOR UPDATE;
 IF NOT FOUND OR a.action_version<>p_action_version OR a.claim_token IS DISTINCT FROM p_claim_token
 OR a.receipt ? 'attempt_reserved_at' OR NOT public.ig_shortlist_native_checkin_eligible(a)
 OR a.reason->>'run_id' IS DISTINCT FROM p_run_id
 OR NOT public.ig_browser_action_owned(p_run_id,'instagram',p_tab_id,
   p_action_id,p_action_version,p_claim_token,NULL)
 THEN RAISE EXCEPTION 'shortlist reservation rejected; never retry a reserved tuple'; END IF;
 UPDATE public.ig_next_actions SET receipt=coalesce(receipt,'{}')||jsonb_build_object(
  'campaign','shortlist_casual_seven_day_v2','reservation_version',1,
  'attempt_reserved_at',reserved_at,'no_repeat',true,'outbound_attempted',true,
  'native_send_attempted',false,'final_text',a.reason->>'final_text','run_id',p_run_id,
  'original_claim_token',p_claim_token,'action_version',p_action_version,'canonical_status','pending')
 WHERE id=a.id;
 RETURN jsonb_build_object('action_id',a.id,'action_version',a.action_version,
 'reserved_at',reserved_at,'owned',true,'reserved',true,'no_repeat',true);
END $function$;
REVOKE ALL ON FUNCTION public.reserve_ig_shortlist_native_send(uuid,integer,uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_ig_shortlist_native_send(uuid,integer,uuid,text,text) TO service_role;
