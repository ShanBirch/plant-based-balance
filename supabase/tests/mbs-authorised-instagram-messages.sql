-- Controlled database-only fixture. No browser or customer send; all rows roll back.
begin;
do $test$
declare tid uuid:=gen_random_uuid(); mid uuid:=gen_random_uuid(); aid uuid:=gen_random_uuid();
 uid uuid; a ig_next_actions; original jsonb; bad text; rid text:='rollback-mbs-request-'||gen_random_uuid();
 msg uuid; receipt jsonb; username text:='internal_mbs_'||replace(gen_random_uuid()::text,'-','');
begin
 select u.id into uid from users u where u.is_test_account
 and not exists(select 1 from ig_threads t where t.linked_user_id=u.id) limit 1;
 if uid is null then raise exception 'Controlled test user required'; end if;
 insert into ig_threads(id,subscriber_id,ig_username,channel,linked_user_id,custom_data)
 values(tid,'internal_test:'||tid,username,'instagram',uid,'{"bot_account":"shan_n_sunny"}');
 insert into ig_messages(id,thread_id,direction,text,created_at,source)
 values(mid,tid,'out','Prior controlled setup message',now()-interval '1 minute','internal_rollback_test');
 original:=jsonb_build_object('policy','user_requested_checkin_v1','explicit_user_authorization',true,
 'authorization_request_id','rollback:'||aid,'authorization_evidence_ref','controlled human request fixture',
 'authorization_issued_at',now()-interval '30 seconds','authorization_expires_at',now()+interval '1 hour',
 'final_text','Controlled new check-in, never sent','full_thread_reviewed',true,'native_identity_verified',true,
 'independent_holds_checked',true,'native_account','shan_n_sunny','page_id','561122130919678',
 'native_conversation_id','12345678901234567890','expected_latest_message_id',mid);
 a:=jsonb_populate_record(null::ig_next_actions,jsonb_build_object('id',aid,'thread_id',tid,'ig_username',username,
 'owner','manual','action_type','reactivation','source_message_id',mid,'reason',original,'receipt','{}'::jsonb));
 if not ig_mbs_user_requested_checkin_eligible(a) then raise exception 'Linked Instagram manual message rejected'; end if;
 foreach bad in array array['explicit_user_authorization','full_thread_reviewed','native_identity_verified','independent_holds_checked'] loop
  a.reason:=original||jsonb_build_object(bad,false);
  if ig_mbs_user_requested_checkin_eligible(a) then raise exception 'Missing review accepted: %',bad; end if;
 end loop;
 a.reason:=original||jsonb_build_object('authorization_expires_at',now()-interval '1 second');
 if ig_mbs_user_requested_checkin_eligible(a) then raise exception 'Expired request accepted'; end if;
 a.reason:=original||jsonb_build_object('expected_latest_message_id',gen_random_uuid());
 if ig_mbs_user_requested_checkin_eligible(a) then raise exception 'Stale context accepted'; end if;
 a.reason:=original;
 foreach bad in array array['manual_only','manual_review_only','friend_manual_only','codex_ai_opt_out','ai_automation_opt_out','do_not_follow_up','blocked_by_shannon','human_takeover','personal_outreach'] loop
  update ig_threads set custom_data=jsonb_build_object('bot_account','shan_n_sunny',bad,true) where id=tid;
  if ig_mbs_user_requested_checkin_eligible(a) then raise exception 'Hold bypassed: %',bad; end if;
 end loop;
 update ig_threads set custom_data='{"bot_account":"shan_n_sunny"}' where id=tid;
 a.receipt:='{"no_repeat":true}';
 if ig_mbs_user_requested_checkin_eligible(a) then raise exception 'Certain send retry accepted'; end if;
 a.receipt:='{"uncertain":true}';
 if ig_mbs_user_requested_checkin_eligible(a) then raise exception 'Uncertain send retry accepted'; end if;
 a.receipt:='{}';
 update ig_threads set linked_user_id=null,channel='messenger',custom_data='{"manychat_business":{"page_id":"561122130919678"}}' where id=tid;
 if not ig_mbs_user_requested_checkin_eligible(a) then raise exception 'Existing Messenger path regressed'; end if;
 update ig_threads set linked_user_id=uid where id=tid;
 if ig_mbs_user_requested_checkin_eligible(a) then raise exception 'Messenger linked-client restriction changed'; end if;
 update ig_threads set channel='instagram',custom_data='{"bot_account":"shan_n_sunny"}' where id=tid;
 insert into ig_browser_shift_runs(run_id,lane,slot,lease_expires_at,browser_surface,browser_binding)
 values(rid,'missed_dm_audit',1,now()+interval '5 minutes','meta_business_suite','{"tab_id":"controlled-fixture"}');
 select * into a from upsert_ig_next_action(tid,username,'Controlled fixture','manual','reactivation',900,now(),now(),original,mid);
 select * into a from claim_ig_next_actions('manual',1,300,rid,array[tid]);
 if a.id is null or not ig_browser_action_owned(rid,'meta_business_suite','controlled-fixture',a.id,a.action_version,a.claim_token,mid)
 then raise exception 'Exact MBS claim/owned path failed'; end if;
 if ig_browser_action_owned(rid,'meta_business_suite','wrong-tab',a.id,a.action_version,a.claim_token,mid)
 or ig_browser_action_owned(rid,'meta_business_suite','controlled-fixture',a.id,a.action_version,gen_random_uuid(),mid)
 then raise exception 'Foreign claim accepted'; end if;
 update ig_browser_shift_runs set lease_expires_at=now()-interval '1 second' where run_id=rid;
 if ig_browser_action_owned(rid,'meta_business_suite','controlled-fixture',a.id,a.action_version,a.claim_token,mid)
 then raise exception 'Expired surface accepted'; end if;
 update ig_browser_shift_runs set lease_expires_at=now()+interval '5 minutes' where run_id=rid;
 receipt:=jsonb_build_object('native_verified',true,'no_repeat',true,'result','sent_attribution_pending',
 'delivered_text',original->>'final_text','screenshot','controlled-fixture-not-a-real-send.png',
 'claim_run_id',rid,'source_message_id',mid,'sent_at',now(),'authorization_request_id',original->>'authorization_request_id');
 select * into a from complete_ig_next_action(a.id,a.claim_token,'completed',null,receipt);
 msg:=(a.receipt->>'canonical_outbound_message_id')::uuid;
 if msg is null or not exists(select 1 from ig_messages where id=msg and direction='out' and text=original->>'final_text')
 then raise exception 'Manual outbound-source receipt did not reconcile'; end if;
 if (select count(*) from claim_ig_next_actions('manual',1,300,rid,array[tid]))<>0 then raise exception 'Delivered action reclaimed'; end if;
 if has_function_privilege('anon','ig_mbs_instagram_requested_message_eligible(ig_next_actions)','execute')
 or has_function_privilege('authenticated','ig_mbs_instagram_requested_message_eligible(ig_next_actions)','execute')
 then raise exception 'Public function access'; end if;
end $test$;
select 'PASS: linked Instagram explicit request, missing-review/expiry/stale/hold/uncertain rejection, exact MBS claim and ownership, outbound-source receipt, no-repeat and private permissions' as result;
rollback;
