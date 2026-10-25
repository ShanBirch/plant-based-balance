-- Run in a transaction and roll back. No native sender or persisted messages.
do $$
declare uid uuid:=gen_random_uuid(); cid uuid; tid uuid:=gen_random_uuid(); eid uuid; consent uuid:=gen_random_uuid();
 latest uuid:=gen_random_uuid(); token uuid:=gen_random_uuid(); a ig_next_actions; result jsonb; enrollment uuid; eventid uuid;
 program_id uuid; program_stamp timestamptz:=now(); move_id uuid; request_id uuid; original_schedule jsonb; today date:=(now() at time zone 'Australia/Brisbane')::date;
 review jsonb:='{"full_thread_reviewed":true,"native_identity_verified":true,"independent_holds_checked":true,"no_duplicate_verified":true,"app_context_reviewed":true,"cross_channel_contact_reviewed":true,"reviewed_by":"rollback_test"}';
 move_review jsonb:='{"full_thread_reviewed":true,"explicit_move_request":true,"target_date_confirmed":true,"schedule_safety_reviewed":true,"independent_holds_checked":true,"reviewed_by":"rollback_test"}';
begin
 insert into auth.users(id,email) values(uid,'onboarding-rollback-'||uid||'@example.invalid');
 insert into users(id,email,name,onboarding_complete,is_test_account,last_login)
 values(uid,'onboarding-rollback-'||uid||'@example.invalid','Internal onboarding test',true,false,now())
 on conflict(id) do update set onboarding_complete=true,is_test_account=false,last_login=now();
 insert into coach_clients(coach_id,client_id,status,assigned_at)
 values('00a6605e-8edb-4917-85ba-24a23f179059',uid,'active',now())
 on conflict(coach_id,client_id) do update set status='active',ended_at=null returning id into cid;
 insert into ig_threads(id,coach_id,ig_username,profile_name,channel,linked_user_id,subscriber_id,custom_data)
 values(tid,'00a6605e-8edb-4917-85ba-24a23f179059','internal_onboarding_test','Internal onboarding test','instagram',uid,'internal_test:'||tid,'{}');
 insert into ig_messages(id,thread_id,direction,text,source) values(consent,tid,'in','Yes, reminders on these days would help','internal_rollback_test');
 insert into client_onboarding_support_events(relationship_id,thread_id,timezone,kind,due_at,expires_at)
 values(cid,tid,'Australia/Brisbane','setup_check',now()-interval '5 minutes',now()+interval '1 hour') returning id into eid;
 if not client_onboarding_support_allowed(eid) then raise exception 'Eligible exact linked client rejected'; end if;
 begin
 perform prepare_client_onboarding_support(eid,'How did setup go?',consent,review);
 raise exception 'Unanswered inbound was ignored';
 exception when raise_exception then if sqlerrm='Unanswered inbound was ignored' then raise; end if; end;
 insert into ig_messages(id,thread_id,direction,text,source,created_at)
 values(latest,tid,'out','Your setup is ready','internal_rollback_test',now()+interval '1 second');
 delete from ig_next_actions where thread_id=tid;
 begin
 perform prepare_client_onboarding_support(eid,'How did setup go?',latest,'{}');
 raise exception 'Missing live review was accepted';
 exception when raise_exception then if sqlerrm='Missing live review was accepted' then raise; end if; end;
 result:=prepare_client_onboarding_support(eid,'How did setup go?',latest,review);
 if result->>'queued' is distinct from 'true' then raise exception 'Onboarding event did not queue'; end if;
 select * into a from ig_next_actions where thread_id=tid;
 if not ig_client_onboarding_support_eligible(a) then raise exception 'Exact reviewed event rejected'; end if;
 if reserve_client_onboarding_support(eid,a.id,token,'nonexistent_run','nonexistent_tab') then raise exception 'Native lease bypassed'; end if;
 if record_client_onboarding_support(eid,token,'sent','{"native_verified":true}') then raise exception 'Unattempted delivery reported sent'; end if;
 update ig_threads set custom_data='{"human_takeover":true}' where id=tid;
 if client_onboarding_support_allowed(eid) or ig_client_onboarding_support_eligible(a) then raise exception 'Manual hold bypassed'; end if;
 update ig_threads set custom_data='{}' where id=tid;
 update users set is_test_account=true where id=uid;
 if client_onboarding_support_allowed(eid) then raise exception 'Test account bypassed'; end if;
 update users set is_test_account=false where id=uid;
 insert into ig_messages(thread_id,direction,text,source,created_at)
 values(tid,'in','Actually I need help','internal_rollback_test',now()+interval '2 seconds');
 if ig_client_onboarding_support_eligible(a) then raise exception 'New inbound did not invalidate proactive event'; end if;
 update client_onboarding_support_events set status='reserved',attempted_at=now()-interval '11 minutes',claim_token=token where id=eid;
 perform refresh_client_onboarding_support();
 if (select status from client_onboarding_support_events where id=eid)<>'uncertain' then raise exception 'Crash did not become no-repeat uncertainty'; end if;
 if (select count(*) from workout_accountability where thread_id=tid)<>0 then raise exception 'Support assumed reminder consent'; end if;

 enrollment:=configure_workout_accountability(tid,consent,'Australia/Brisbane',
 jsonb_build_array(jsonb_build_object('weekday',extract(isodow from (now() at time zone 'Australia/Brisbane'))::int,'time','17:00','session_name','Controlled Session')),
 (now() at time zone 'Australia/Brisbane')::date,(now() at time zone 'Australia/Brisbane')::date+28,
 '{"full_thread_reviewed":true,"explicit_reminder_consent":true,"schedule_agreed":true,"independent_holds_checked":true,"reviewed_by":"rollback_test"}');
 perform refresh_workout_accountability();
 perform refresh_workout_accountability();
 if (select count(*) from workout_accountability_events where enrollment_id=enrollment)<>3 then raise exception 'Refresh is not idempotent'; end if;
 select id into eventid from workout_accountability_events where enrollment_id=enrollment and kind='before';
 if (select (due_at at time zone 'Australia/Brisbane')::time from workout_accountability_events where id=eventid)<>time '08:00' then raise exception 'Afternoon session did not get a morning reminder'; end if;
 update workout_accountability_events set local_date=local_date+7 where id=eventid;
 if workout_accountability_phase_eligible(eventid) then raise exception 'Week two still sends morning prompts'; end if;
 select id into eventid from workout_accountability_events where enrollment_id=enrollment and kind='logged';
 update workout_accountability_events set local_date=local_date+14 where id=eventid;
 if workout_accountability_phase_eligible(eventid) then raise exception 'Week three still sends routine logged prompts'; end if;
 update workout_accountability_events set local_date=local_date-14,expires_at=now()-interval '1 second' where id=eventid;
 perform refresh_workout_accountability();
 if (select status from workout_accountability_events where id=eventid)<>'skipped' then raise exception 'No logged session became false delivery failure'; end if;
 select jsonb_agg(jsonb_build_object('day',day,'workout',case when ordinality=extract(isodow from today)
 then '{"name":"Controlled Session","type":"inline","exercises":[{"name":"Test squat","sets":1,"reps":"6"}]}'::jsonb
 else '{"name":"Rest Day","type":"rest","exercises":[]}'::jsonb end) order by ordinality)
 into original_schedule from unnest(array['Mon','Tue','Wed','Thu','Fri','Sat','Sun']) with ordinality d(day,ordinality);
 insert into custom_workout_programs(user_id,program_name,weekly_schedule,is_active,start_date,updated_at)
 values(uid,'Rollback test program',original_schedule,true,today,program_stamp) returning id into program_id;
 select id into request_id from ig_messages where thread_id=tid and direction='in' order by created_at desc,id desc limit 1;
 result:=move_workout_accountability_session(enrollment,request_id,today,today+1,'17:00',
 case when extract(isodow from today)=7 then 'weekly' else 'this_week' end,program_stamp,move_review);
 move_id:=(result->>'id')::uuid;
 if result->'after_program'=original_schedule or result->'after_reminders'=result->'before_reminders' then raise exception 'Move did not update actual app and reminders'; end if;
 if (move_workout_accountability_session(enrollment,request_id,today,today+1,'17:00','weekly',program_stamp,move_review)->>'id')::uuid<>move_id then raise exception 'Move retry was not idempotent'; end if;
 update workout_accountability_moves set status='applied',restore_after=now()-interval '1 second' where id=move_id;
 perform restore_workout_accountability_moves();
 if (select weekly_schedule from custom_workout_programs where id=program_id)<>original_schedule
 or (select status from workout_accountability_moves where id=move_id)<>'restored' then raise exception 'Temporary move did not restore the usual week'; end if;
 request_id:=gen_random_uuid();
 insert into ig_messages(id,thread_id,direction,text,source,created_at)
 values(request_id,tid,'in','Move this session to tomorrow please','internal_rollback_test',now()+interval '5 seconds');
 select updated_at into program_stamp from custom_workout_programs where id=program_id;
 result:=move_workout_accountability_session(enrollment,request_id,today,today+1,'17:00','weekly',program_stamp,move_review);
 move_id:=(result->>'id')::uuid;
 update custom_workout_programs set updated_at=clock_timestamp(),program_name='Later human edit' where id=program_id;
 update workout_accountability_moves set status='applied',restore_after=now()-interval '1 second' where id=move_id;
 perform restore_workout_accountability_moves();
 if (select status from workout_accountability_moves where id=move_id)<>'held'
 or (select program_name from custom_workout_programs where id=program_id)<>'Later human edit' then raise exception 'Restore overwrote a later human edit'; end if;
 if has_table_privilege('anon','client_onboarding_support_events','SELECT') or has_function_privilege('authenticated','public.client_onboarding_support_due()','EXECUTE')
 then raise exception 'Private onboarding queue is publicly accessible'; end if;
end $$;
