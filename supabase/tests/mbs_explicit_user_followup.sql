BEGIN;
DO $test$
DECLARE fixture public.ig_threads; message public.ig_messages; action public.ig_next_actions; approved jsonb; hold text;
BEGIN
 SELECT * INTO STRICT fixture FROM public.ig_threads WHERE channel='messenger' LIMIT 1;
 fixture.id:=gen_random_uuid(); fixture.subscriber_id:='followup-test-'||fixture.id::text;
 fixture.ig_username:=NULL; fixture.linked_user_id:=NULL;
 fixture.custom_data:='{"manychat_business":{"page_id":"561122130919678"}}'::jsonb;
 INSERT INTO public.ig_threads SELECT fixture.*;
 SELECT * INTO STRICT message FROM public.ig_messages LIMIT 1;
 message.id:=gen_random_uuid(); message.thread_id:=fixture.id;
 INSERT INTO public.ig_messages SELECT message.*;
 action.thread_id:=fixture.id; action.owner:='manual'; action.action_type:='reactivation';
 approved:=jsonb_build_object('policy','user_requested_checkin_v1','explicit_user_authorization',true,
 'authorization_request_id',gen_random_uuid()::text,'authorization_expires_at',now()+interval '1 hour',
 'final_text','What are you hoping to achieve?', 'full_thread_reviewed',true,'native_identity_verified',true,
 'independent_holds_checked',true,'native_conversation_id','verified-test-conversation','page_id','561122130919678',
 'expected_latest_message_id',message.id::text);
 action.reason:=approved;
 ASSERT public.ig_mbs_user_requested_checkin_eligible(action),'authorised Messenger follow-up with null Instagram handle accepted';
 ASSERT NOT public.ig_user_requested_checkin_eligible(action),'Instagram eligibility remains unchanged';
 FOREACH hold IN ARRAY ARRAY['manual_only','manual_review_only','friend_manual_only','codex_ai_opt_out',
 'ai_automation_opt_out','do_not_follow_up','blocked_by_shannon','human_takeover','personal_outreach'] LOOP
  UPDATE public.ig_threads SET custom_data=fixture.custom_data||jsonb_build_object(hold,true) WHERE id=fixture.id;
  ASSERT NOT public.ig_mbs_user_requested_checkin_eligible(action),'independent hold preserved: '||hold;
 END LOOP;
 UPDATE public.ig_threads SET custom_data=fixture.custom_data WHERE id=fixture.id;
 FOREACH hold IN ARRAY ARRAY['explicit_user_authorization','authorization_request_id','authorization_expires_at',
 'final_text','full_thread_reviewed','native_identity_verified','independent_holds_checked','native_conversation_id','page_id','expected_latest_message_id'] LOOP
  action.reason:=approved-hold;
  ASSERT NOT public.ig_mbs_user_requested_checkin_eligible(action),'missing evidence rejected: '||hold;
 END LOOP;
 action.reason:=approved||jsonb_build_object('authorization_expires_at',now()-interval '1 minute');
 ASSERT NOT public.ig_mbs_user_requested_checkin_eligible(action),'expired authority rejected';
 action.reason:=approved||jsonb_build_object('authorization_expires_at',now()+interval '25 hours');
 ASSERT NOT public.ig_mbs_user_requested_checkin_eligible(action),'unbounded authority rejected';
 action.reason:=approved||jsonb_build_object('expected_latest_message_id',gen_random_uuid()::text);
 ASSERT NOT public.ig_mbs_user_requested_checkin_eligible(action),'intervening message rejected';
 action.reason:=approved||'{"page_id":"wrong-page"}'::jsonb;
 ASSERT NOT public.ig_mbs_user_requested_checkin_eligible(action),'wrong page rejected';
 action.reason:=approved; action.action_type:='reply_inbound';
 ASSERT NOT public.ig_mbs_user_requested_checkin_eligible(action),'not disguised as inbound';
 action.action_type:='reactivation';
 UPDATE public.ig_threads SET channel='instagram' WHERE id=fixture.id;
 ASSERT NOT public.ig_mbs_user_requested_checkin_eligible(action),'wrong channel rejected';
 ASSERT position('ig_mbs_user_requested_checkin_eligible(q)' IN pg_get_functiondef('public.claim_ig_next_actions(text,integer,integer,text,uuid[])'::regprocedure))>0,'claim hook installed';
 ASSERT position('ig_mbs_user_requested_checkin_eligible(a)' IN pg_get_functiondef('public.ig_browser_action_owned(text,text,text,uuid,integer,uuid,uuid)'::regprocedure))>0,'action-time ownership hook installed';
 ASSERT NOT has_function_privilege('anon','public.ig_mbs_user_requested_checkin_eligible(public.ig_next_actions)','execute'),'anonymous access denied';
 ASSERT NOT has_function_privilege('authenticated','public.ig_mbs_user_requested_checkin_eligible(public.ig_next_actions)','execute'),'public client access denied';
END $test$;
SELECT 'Messenger follow-up positive and fail-closed checks passed' AS result;
ROLLBACK;
