begin;
do $$ begin
 if not exists(select 1 from public.users where id='2f41a5c1-1e32-4697-9960-8b7d4c0c1c38' and is_test_account=true) then raise exception 'Dedicated QA member missing'; end if;
 if not balance_private.master_external_video_valid(jsonb_build_object('platform','Instagram','sentOn',(now() at time zone 'Australia/Brisbane')::date::text))
  or balance_private.master_external_video_valid('{"platform":"","sentOn":"2026-10-08"}')
  or balance_private.master_external_video_valid('{"platform":"Instagram","sentOn":"2099-01-01"}')
  or balance_private.master_external_video_valid('{"platform":"Instagram","sentOn":"2026-02-30"}')
  or balance_private.master_external_video_valid('{"platform":"Instagram","sentOn":true}') then raise exception 'Invalid external record validation'; end if;
end $$;
-- Only the dedicated QA member is changed, and the entire transaction is rolled back.
delete from public.coach_alerts where client_id='2f41a5c1-1e32-4697-9960-8b7d4c0c1c38' and data->>'form_check_workout_name' like 'Balance Master: %';
delete from public.nudges where sender_id='2f41a5c1-1e32-4697-9960-8b7d4c0c1c38' and nudge_type='form_check';
update public.balance_course_enrollments set started_at=now()-interval '70 days' where user_id='2f41a5c1-1e32-4697-9960-8b7d4c0c1c38' and course_id='master';
select set_config('request.jwt.claims','{"sub":"2f41a5c1-1e32-4697-9960-8b7d4c0c1c38","role":"authenticated"}',true);
set local role authenticated;
do $$
declare d jsonb; r jsonb; k text; failed boolean; saved_date timestamptz;
begin
 select data into d from public.balance_master_projects where user_id=auth.uid();
 if d is null then raise exception 'QA Master project missing'; end if;
 d:=d||'{"answers":{"1-0":2,"1-1":0},"quizReflections":{"1":"I will use a controlled working set and apply Shannon feedback."},"externalVideos":{}}';
 r:=public.save_balance_master_assessment(d,null);
 if r#>>'{data,actionReceipts,2:squat,isCurrent}'='true' then raise exception 'Missing video record counted'; end if;
 foreach k in array array['squat','hinge','push'] loop
  d:=jsonb_set(d,array['externalVideos',k],jsonb_build_object('platform','Instagram','sentOn',(now() at time zone 'Australia/Brisbane')::date::text));
 end loop;
 r:=public.save_balance_master_assessment(d,null);
 if (select count(*) from public.balance_master_action_submissions where user_id=auth.uid() and week=2 and is_current)<>3 then raise exception 'Partial video records not independent'; end if;
 failed:=false;
 begin perform public.save_balance_master_assessment(d,2); exception when raise_exception then failed:=true; end;
 if not failed then raise exception 'Partial week accepted'; end if;
 d:=jsonb_set(d,'{externalVideos,pull}',jsonb_build_object('platform','Messenger','sentOn',(now() at time zone 'Australia/Brisbane')::date::text));
 r:=public.save_balance_master_assessment(d,2);
 if r#>>'{data,completedStages,1}' is distinct from 'true' then raise exception 'External videos did not complete week'; end if;
 if (select count(*) from public.balance_master_action_submissions where user_id=auth.uid() and week=2 and is_current and evidence->>'source'='member_reported_external' and evidence->>'deliveryVerified'='false' and evidence->>'coachApproved'='false')<>4 then raise exception 'Self-report provenance lost'; end if;
 select submitted_at into saved_date from public.balance_master_action_submissions where user_id=auth.uid() and week=2 and action_key='pull';
 perform public.save_balance_master_assessment(d,null);
 if saved_date is distinct from (select submitted_at from public.balance_master_action_submissions where user_id=auth.uid() and week=2 and action_key='pull') then raise exception 'Record date changed on resave'; end if;
 d:=jsonb_set(d,'{externalVideos,pull,sentOn}','"2099-01-01"');
 r:=public.save_balance_master_assessment(d,null);
 if r#>>'{data,actionReceipts,2:pull,isCurrent}' is distinct from 'false' or r#>>'{data,completedStages,1}' is distinct from 'false' then raise exception 'Invalid edit left completion in place'; end if;
 if has_function_privilege('authenticated','balance_private.master_external_video_valid(jsonb)','EXECUTE') then raise exception 'Private helper exposed'; end if;
end $$;
reset role;
update public.balance_course_enrollments set started_at=now() where user_id='2f41a5c1-1e32-4697-9960-8b7d4c0c1c38' and course_id='master';
set local role authenticated;
do $$ declare r jsonb; begin
 r:=public.sync_balance_master_actions();
 if exists(select 1 from public.balance_master_action_submissions where user_id=auth.uid() and week=2 and is_current) then raise exception 'Unopened week counted'; end if;
end $$;
reset role;
rollback;
