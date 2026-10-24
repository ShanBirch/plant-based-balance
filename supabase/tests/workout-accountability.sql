-- Run through the authenticated SQL connector. All fixture changes roll back.
begin;
do $$
declare uid uuid; tid uuid:=gen_random_uuid(); consent uuid:=gen_random_uuid(); latest uuid:=gen_random_uuid();
 eid uuid; eventid uuid; action ig_next_actions; result jsonb; token uuid:=gen_random_uuid(); sentid uuid:=gen_random_uuid();
 today date:=(now() at time zone 'Australia/Brisbane')::date; failures integer:=0;
begin
 select u.id into uid from users u where u.is_test_account and u.onboarding_complete
 and not exists(select 1 from ig_threads t where t.linked_user_id=u.id) limit 1;
 if uid is null then raise exception 'A controlled onboarding-complete test user is required'; end if;
 -- Transaction-local fixture only, never visible to a sender or committed.
 update users set is_test_account=false where id=uid;
 insert into ig_threads(id,coach_id,ig_username,profile_name,channel,linked_user_id,subscriber_id,custom_data)
 values(tid,'00a6605e-8edb-4917-85ba-24a23f179059','internal_workout_reminder_test','Internal reminder test','instagram',uid,'internal_test:'||tid,'{}');
 insert into ig_messages(id,thread_id,direction,text,source) values(consent,tid,'in','Yes, reminders on these days would help','internal_rollback_test');
 begin
  perform configure_workout_accountability(tid,consent,'Australia/Brisbane','[]',today,today+30,'{}');
  raise exception 'Incomplete consent was accepted';
 exception when raise_exception then
  if sqlerrm='Incomplete consent was accepted' then raise; end if;
 end;
 eid:=configure_workout_accountability(tid,consent,'Australia/Brisbane',jsonb_build_array(jsonb_build_object(
 'weekday',extract(isodow from today)::int,'time','12:00','session_name','Controlled Test Session')),today,today+30,
 '{"full_thread_reviewed":true,"explicit_reminder_consent":true,"schedule_agreed":true,"independent_holds_checked":true,"reviewed_by":"rollback_test"}');
 if not workout_accountability_allowed(eid) then raise exception 'Consented test enrollment rejected'; end if;
 perform refresh_workout_accountability();
 perform refresh_workout_accountability();
 if (select count(*) from workout_accountability_events where enrollment_id=eid)<>3 then raise exception 'Refresh is not idempotent'; end if;
 select id into eventid from workout_accountability_events where enrollment_id=eid and kind='before';
 update workout_accountability_events set status='pending',due_at=now()-interval '5 minutes',expires_at=now()+interval '30 minutes' where id=eventid;
 begin
  perform prepare_workout_accountability(eventid,'Ready for your workout?',consent,
   '{"full_thread_reviewed":true,"native_identity_verified":true,"independent_holds_checked":true,"no_duplicate_verified":true}');
  raise exception 'Unanswered inbound was ignored';
 exception when raise_exception then
  if sqlerrm='Unanswered inbound was ignored' then raise; end if;
 end;
 insert into ig_messages(id,thread_id,direction,text,source,created_at) values(latest,tid,'out','Your agreed schedule is saved','internal_rollback_test',now()+interval '1 second');
 -- Reconcile the fixture inbound's trigger-created reactive action first.
 delete from ig_next_actions where thread_id=tid;
 result:=prepare_workout_accountability(eventid,'Ready for your workout?',latest,
 '{"full_thread_reviewed":true,"native_identity_verified":true,"independent_holds_checked":true,"no_duplicate_verified":true}');
 if result->>'queued' is distinct from 'true' then raise exception 'Due reminder did not queue'; end if;
 select * into action from ig_next_actions where thread_id=tid;
 if not ig_workout_accountability_action_eligible(action) then raise exception 'Exact queued reminder ineligible'; end if;
 insert into workouts(user_id,workout_type,workout_date,template_name,exercise_name,set_number,reps)
 values(uid,'history',today,'Different Test Session','Test exercise',1,'10');
 if workout_accountability_logged(eventid) then raise exception 'Unrelated workout counted'; end if;
 insert into workouts(user_id,workout_type,workout_date,template_name,exercise_name,set_number,reps)
 values(uid,'history',today,'Controlled Test Session','Test exercise',1,'10');
 if not workout_accountability_logged(eventid) or ig_workout_accountability_action_eligible(action) then raise exception 'Logged workout failed to suppress pre-workout reminder'; end if;
 delete from workouts where user_id=uid and template_name in ('Different Test Session','Controlled Test Session');
 if reserve_workout_accountability(eventid,action.id,token,'nonexistent_internal_run','nonexistent_tab') then raise exception 'Reservation bypassed native lease'; end if;
 update ig_threads set custom_data='{"human_takeover":true}' where id=tid;
 if workout_accountability_allowed(eid) or ig_workout_accountability_action_eligible(action) then raise exception 'Human takeover bypassed'; end if;
 update ig_threads set custom_data='{}' where id=tid;
 update workout_accountability_events set expires_at=now()-interval '1 second' where id=eventid;
 if ig_workout_accountability_action_eligible(action) then raise exception 'Expired reminder send allowed'; end if;
 perform refresh_workout_accountability();
 if (select status from workout_accountability_events where id=eventid)<>'expired' then raise exception 'Missed window not marked'; end if;
 if not exists(select 1 from coach_alerts where idempotency_key='workout_accountability_failure:'||eventid) then raise exception 'Missed reminder silently dropped'; end if;
 update workout_accountability_events set status='reserved',attempted_at=now(),claim_token=token where id=eventid;
 if record_workout_accountability(eventid,token,'sent',jsonb_build_object('native_verified',true,'canonical_message_id',sentid)) then raise exception 'False delivery accepted'; end if;
 if not record_workout_accountability(eventid,token,'uncertain','{"native_verified":false}') then raise exception 'Uncertain attempt not recorded'; end if;
 perform refresh_workout_accountability();
 if (select status from workout_accountability_events where id=eventid)<>'uncertain' then raise exception 'Uncertain attempt became retryable'; end if;
 insert into ig_messages(id,thread_id,direction,text,source,created_at) values(sentid,tid,'out','Ready for your workout?','internal_rollback_test',now()+interval '2 seconds');
 if not record_workout_accountability(eventid,token,'sent',jsonb_build_object('native_verified',true,'canonical_message_id',sentid)) then raise exception 'Canonical reconciliation failed'; end if;
 if record_workout_accountability(eventid,token,'sent',jsonb_build_object('native_verified',true,'canonical_message_id',sentid)) then raise exception 'Delivered attempt was repeated'; end if;
 if ig_workout_accountability_action_eligible(action) then raise exception 'Delivered reminder still eligible'; end if;
 -- Existing unrelated manual/check-in actions cannot be acquired through this policy.
 action.reason:='{"policy":"user_requested_checkin_v1"}';
 if ig_workout_accountability_action_eligible(action) then raise exception 'Unrelated policy accepted'; end if;
 update workout_accountability set enabled=false where id=eid;
 if workout_accountability_allowed(eid) then raise exception 'Revoked enrollment still allowed'; end if;
 raise notice 'PASS: consent, onboarding, idempotency, unanswered inbound, queue, holds, lease, expiry/alerts, false delivery, uncertainty, canonical reconciliation, no-repeat, revocation';
end $$;
rollback;
