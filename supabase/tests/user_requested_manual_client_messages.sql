-- Run with the service role against the configured database. No messages are sent.
-- Select one existing manual-review Instagram thread, and roll back every fixture edit.
begin;
do $test$
declare
 t public.ig_threads;
 a public.ig_next_actions;
 b public.ig_next_actions;
 original_data jsonb;
 hold_key text;
begin
 select * into t from public.ig_threads
 where channel='instagram' and custom_data->>'manual_review_only'='true'
 and nullif(subscriber_id,'') is not null
 and custom_data->>'bot_account'='shan_n_sunny'
 and not exists(select 1 from public.ig_personal_contacts p where lower(p.ig_username)=lower(ig_threads.ig_username))
 order by id limit 1;
 if t.id is null then raise exception 'An existing eligible manual-review fixture is required'; end if;
 original_data:=t.custom_data;
 a:=jsonb_populate_record(null::public.ig_next_actions,jsonb_build_object(
 'id',gen_random_uuid(),'thread_id',t.id,'ig_username',t.ig_username,
 'owner','manual','action_type','reactivation','receipt','{}'::jsonb,
 'source_message_id',(select m.id from public.ig_messages m join public.ig_threads x on x.id=m.thread_id
 where x.id=t.id or lower(x.ig_username)=lower(t.ig_username)
 or (t.linked_user_id is not null and x.linked_user_id=t.linked_user_id)
 order by m.created_at desc,m.id desc limit 1),
 'reason',jsonb_build_object('policy','user_requested_checkin_v1','explicit_user_authorization',true,
 'authorization_request_id','rollback-test-'||gen_random_uuid(),'authorization_evidence_ref','test-only-no-send',
 'authorization_issued_at',now(),'authorization_expires_at',now()+interval '1 hour',
 'final_text','Test-only eligibility check. Never send.',
 'full_thread_reviewed',true,'native_identity_verified',true,'independent_holds_checked',true,
 'page_id','561122130919678','native_account','shan_n_sunny','native_conversation_id','123456789')));
 a.reason:=a.reason||jsonb_build_object('expected_latest_message_id',a.source_message_id);
 update public.ig_threads set custom_data=original_data-'user_requested_messages_enabled' where id=t.id;
 if public.ig_mbs_instagram_requested_message_eligible(a) then raise exception 'Manual hold opened without recipient permission'; end if;
 update public.ig_threads set custom_data=original_data||'{"user_requested_messages_enabled":true}' where id=t.id;
 -- Fixture must otherwise pass all independent holds. This check deliberately fails if it does not.
 if not public.ig_mbs_instagram_requested_message_eligible(a) then raise exception 'Approved request rejected or fixture has an independent hold'; end if;
 if not public.ig_native_reactive_action_eligible(a) then raise exception 'Native requested-message path rejected'; end if;
 b:=a; b.owner:='dm_manager';
 if public.ig_mbs_instagram_requested_message_eligible(b) then raise exception 'Automatic owner accepted'; end if;
 b:=a; b.action_type:='reply_inbound';
 if public.ig_mbs_instagram_requested_message_eligible(b) then raise exception 'Automatic reply accepted'; end if;
 b:=a; b.reason:=b.reason-'explicit_user_authorization';
 if public.ig_mbs_instagram_requested_message_eligible(b) then raise exception 'Missing approval accepted'; end if;
 b:=a; b.reason:=b.reason||jsonb_build_object('authorization_expires_at',now()-interval '1 second');
 if public.ig_mbs_instagram_requested_message_eligible(b) then raise exception 'Expired approval accepted'; end if;
 b:=a; b.reason:=b.reason||jsonb_build_object('expected_latest_message_id',gen_random_uuid());
 if public.ig_mbs_instagram_requested_message_eligible(b) then raise exception 'Stale source accepted'; end if;
 b:=a; b.receipt:='{"no_repeat":true}';
 if public.ig_mbs_instagram_requested_message_eligible(b) then raise exception 'Previously handled request accepted'; end if;
 b:=a; b.receipt:='{"uncertain":true}';
 if public.ig_mbs_instagram_requested_message_eligible(b) then raise exception 'Uncertain delivery accepted'; end if;
 foreach hold_key in array array['manual_only','friend_manual_only','codex_ai_opt_out','ai_automation_opt_out',
 'do_not_follow_up','blocked_by_shannon','human_takeover','personal_outreach'] loop
 update public.ig_threads set custom_data=original_data||jsonb_build_object('user_requested_messages_enabled',true,hold_key,true) where id=t.id;
 if public.ig_mbs_instagram_requested_message_eligible(a) then raise exception 'Independent hold opened: %',hold_key; end if;
 end loop;
 update public.ig_threads set custom_data=original_data||'{"user_requested_messages_enabled":true,"client_community_support_enabled":false}' where id=t.id;
 if public.ig_mbs_instagram_requested_message_eligible(a) then raise exception 'Community opt-out opened'; end if;
 update public.ig_threads set custom_data=original_data||'{"user_requested_messages_enabled":true}' where id=t.id;
 if not exists(select 1 from public.ig_threads where id=t.id and custom_data->>'manual_review_only'='true'
 and auto_send_enabled is not distinct from t.auto_send_enabled
 and custom_data->'auto_reply_paused_by_shannon' is not distinct from original_data->'auto_reply_paused_by_shannon')
 then raise exception 'Automatic reply protections changed'; end if;
end $test$;
rollback;
select 'Passed requested-message eligibility, automatic-reply separation, stale/expired/no-repeat/uncertain and independent holds' as result;
