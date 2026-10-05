-- Only the human-authorized October 9 campaign gains MBS manual delivery.
-- Ordinary Instagram check-ins and reactive delivery keep their existing gates.
CREATE OR REPLACE FUNCTION public.ig_mbs_free_zoom_invite_eligible(a public.ig_next_actions)
RETURNS boolean LANGUAGE plpgsql STABLE
SET search_path = public, pg_temp
AS $function$
DECLARE t public.ig_threads; latest uuid; k text;
BEGIN
 IF a.owner IS DISTINCT FROM 'manual' OR a.action_type IS DISTINCT FROM 'reactivation'
 OR a.reason->>'policy' IS DISTINCT FROM 'user_requested_checkin_v1'
 OR a.reason->>'authorization_request_id' IS DISTINCT FROM 'free-zoom-friday-20261005-shannon'
 OR a.reason->>'explicit_user_authorization' IS DISTINCT FROM 'true'
 OR now() >= timestamptz '2026-10-08 14:00:00+00'
 OR coalesce(length(a.reason->>'final_text'),0) NOT BETWEEN 100 AND 1000
 OR position('9 October' in a.reason->>'final_text')=0
 OR position('8am Queensland time' in a.reason->>'final_text')=0 THEN RETURN false; END IF;
 IF coalesce((a.reason->>'authorization_expires_at')::timestamptz,now()) <= now()
 OR (a.reason->>'authorization_expires_at')::timestamptz > now()+interval '24 hours'
 OR coalesce((a.reason->>'reviewed_at')::timestamptz,now()-interval '1 day') < now()-interval '5 minutes'
 OR (a.reason->>'reviewed_at')::timestamptz > now() THEN RETURN false; END IF;
 FOREACH k IN ARRAY ARRAY['native_identity_verified','full_thread_reviewed','booking_purchase_checked','no_pending_call','no_independent_hold','campaign_lead_verified'] LOOP
  IF a.reason->>k IS DISTINCT FROM 'true' THEN RETURN false; END IF;
 END LOOP;
 IF a.reason->>'native_page_id' IS DISTINCT FROM '561122130919678'
 OR nullif(a.reason->>'native_conversation_id','') IS NULL
 OR nullif(a.reason->>'native_profile_url','') IS NULL THEN RETURN false; END IF;
 SELECT * INTO t FROM public.ig_threads WHERE id=a.thread_id;
 IF NOT FOUND OR t.channel NOT IN ('instagram','messenger') OR t.linked_user_id IS NOT NULL
 OR t.auto_send_enabled IS DISTINCT FROM true THEN RETURN false; END IF;
 IF t.channel='instagram' AND (nullif(t.ig_username,'') IS NULL OR lower(t.ig_username) IS DISTINCT FROM lower(a.ig_username)) THEN RETURN false; END IF;
 IF EXISTS(SELECT 1 FROM public.ig_personal_contacts p WHERE lower(p.ig_username)=lower(t.ig_username)) THEN RETURN false; END IF;
 IF EXISTS(SELECT 1 FROM public.ig_threads x WHERE (x.id=t.id OR (t.subscriber_id IS NOT NULL AND x.subscriber_id=t.subscriber_id) OR (nullif(t.ig_username,'') IS NOT NULL AND lower(x.ig_username)=lower(t.ig_username))) AND (x.linked_user_id IS NOT NULL OR x.custom_data->>'do_not_follow_up'='true' OR x.custom_data->>'blocked_by_shannon'='true' OR x.custom_data->>'manual_review_only'='true' OR x.custom_data->>'friend_manual_only'='true' OR x.custom_data->>'personal_outreach'='true' OR x.custom_data->>'human_takeover'='true' OR x.custom_data->>'client_community_support_enabled'='false')) THEN RETURN false; END IF;
 IF EXISTS(SELECT 1 FROM public.balance_bookings b WHERE b.metadata->>'ig_thread_id'=t.id::text AND b.status NOT IN ('cancelled','canceled')) THEN RETURN false; END IF;
 SELECT id INTO latest FROM public.ig_messages WHERE thread_id=t.id ORDER BY created_at DESC,id DESC LIMIT 1;
 IF a.reason->>'expected_latest_message_id' IS DISTINCT FROM latest::text OR latest IS NULL THEN RETURN false; END IF;
 IF EXISTS(SELECT 1 FROM public.ig_next_actions q WHERE q.id IS DISTINCT FROM a.id AND (q.thread_id=t.id OR (nullif(t.ig_username,'') IS NOT NULL AND lower(q.ig_username)=lower(t.ig_username))) AND (q.reason->>'authorization_request_id'='free-zoom-friday-20261005-shannon' AND (q.status IN ('claimed','completed') OR coalesce(q.receipt,'{}'::jsonb)<>'{}'::jsonb) OR q.receipt->>'no_repeat'='true' AND q.receipt->>'native_verified' IS DISTINCT FROM 'true')) THEN RETURN false; END IF;
 RETURN true;
EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN RETURN false;
END $function$;
REVOKE ALL ON FUNCTION public.ig_mbs_free_zoom_invite_eligible(public.ig_next_actions) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ig_mbs_free_zoom_invite_eligible(public.ig_next_actions) TO service_role;

-- Patch only the two surface predicates; fail on unexpected deployed definitions.
DO $migration$
DECLARE d text; old text; newer text;
BEGIN
 SELECT pg_get_functiondef(oid) INTO STRICT d FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname='claim_ig_next_actions';
 old := '(v_surface=''meta_business_suite'' AND q.action_type IN (''reply_inbound'',''close_sale'',''wait'',''no_action''))';
 newer := '(v_surface=''meta_business_suite'' AND (q.action_type IN (''reply_inbound'',''close_sale'',''wait'',''no_action'') OR public.ig_mbs_free_zoom_invite_eligible(q)))';
 IF position(old in d)=0 THEN RAISE EXCEPTION 'Unexpected claim surface guard'; END IF;
 EXECUTE replace(d,old,newer);
 SELECT pg_get_functiondef(oid) INTO STRICT d FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname='ig_browser_action_owned';
 old := '(p_surface=''meta_business_suite'' AND a.action_type IN (''reply_inbound'',''close_sale''))';
 newer := '(p_surface=''meta_business_suite'' AND (a.action_type IN (''reply_inbound'',''close_sale'') OR public.ig_mbs_free_zoom_invite_eligible(a)))';
 IF position(old in d)=0 THEN RAISE EXCEPTION 'Unexpected ownership surface guard'; END IF;
 EXECUTE replace(d,old,newer);
END $migration$;
