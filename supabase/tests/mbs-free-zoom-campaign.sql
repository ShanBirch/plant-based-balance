-- Read-only predicate checks. No action insertion, claim or native send.
DO $test$
DECLARE a public.ig_next_actions; j jsonb;
BEGIN
 SELECT jsonb_build_object('id',gen_random_uuid(),'owner','manual','action_type','reactivation','thread_id',t.id,
 'reason',jsonb_build_object('policy','user_requested_checkin_v1','authorization_request_id','free-zoom-friday-20261005-shannon',
 'explicit_user_authorization',true,'authorization_expires_at',now()+interval '1 hour','reviewed_at',now(),
 'final_text',repeat('test ',25)||'9 October 8am Queensland time','native_identity_verified',true,
 'full_thread_reviewed',true,'booking_purchase_checked',true,'no_pending_call',true,'no_independent_hold',true,
 'campaign_lead_verified',true,'native_page_id','561122130919678','native_conversation_id','predicate-test-only',
 'native_profile_url','https://www.facebook.com/predicate-test-only','expected_latest_message_id',
 (select id from public.ig_messages where thread_id=t.id order by created_at desc,id desc limit 1))) INTO j
 FROM public.ig_threads t WHERE t.channel='messenger' AND t.linked_user_id IS NULL AND t.auto_send_enabled
 AND EXISTS(select 1 from public.ig_messages m where m.thread_id=t.id) LIMIT 1;
 IF j IS NULL THEN RAISE EXCEPTION 'No read-only fixture available'; END IF;
 a:=jsonb_populate_record(NULL::public.ig_next_actions,j);
 -- The fixture may have independent holds; negative checks must always reject.
 a.reason:=a.reason||jsonb_build_object('no_pending_call',false);
 IF public.ig_mbs_free_zoom_invite_eligible(a) THEN RAISE EXCEPTION 'Pending call allowed'; END IF;
 a.reason:=a.reason||jsonb_build_object('no_pending_call',true,'authorization_request_id','unapproved-campaign');
 IF public.ig_mbs_free_zoom_invite_eligible(a) THEN RAISE EXCEPTION 'Unapproved campaign allowed'; END IF;
 a.reason:=a.reason||jsonb_build_object('authorization_request_id','free-zoom-friday-20261005-shannon','expected_latest_message_id',gen_random_uuid());
 IF public.ig_mbs_free_zoom_invite_eligible(a) THEN RAISE EXCEPTION 'Stale latest message allowed'; END IF;
 a.reason:=a.reason||jsonb_build_object('authorization_expires_at',now()-interval '1 minute');
 IF public.ig_mbs_free_zoom_invite_eligible(a) THEN RAISE EXCEPTION 'Expired authorization allowed'; END IF;
END $test$;
