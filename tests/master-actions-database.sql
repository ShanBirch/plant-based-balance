-- Transaction-only integration checks. Existing test video/workout fixtures are reused.
begin;
do $$ begin if not exists(select 1 from public.users where id='2f41a5c1-1e32-4697-9960-8b7d4c0c1c38' and is_test_account=true) then raise exception 'Dedicated QA member missing'; end if; end $$;
delete from public.balance_master_action_submissions where user_id='2f41a5c1-1e32-4697-9960-8b7d4c0c1c38';
select set_config('request.jwt.claims','{"sub":"2f41a5c1-1e32-4697-9960-8b7d4c0c1c38","role":"authenticated"}',true);
set local role authenticated;
do $$
declare d jsonb; r jsonb; first_time timestamptz; failed boolean; original text;
begin
 select data into d from public.balance_master_projects where user_id=auth.uid();
 d:=d-'actionAnswers';
 r:=public.save_balance_master_assessment(d||'{"actionReceipts":{"1:muscles":{"isCurrent":true}}}',null);
 if r#>>'{data,actionReceipts,1:muscles,isCurrent}'='true' then raise exception 'Forged action receipt accepted'; end if;
 if (select count(*) from public.balance_master_action_submissions where week=2 and is_current)<>4 then raise exception 'Actual saved videos not recorded automatically'; end if;
 if (select count(*) from public.balance_master_action_submissions where week=5 and is_current)<>4 then raise exception 'Saved workout evidence not recorded'; end if;
 if exists(select 1 from public.balance_master_action_submissions a cross join lateral jsonb_object_keys(a.snapshot->'prescriptions') p(id) where a.week=5 and a.action_key='workouts' and not (a.evidence->'workouts' ? p.id)) then raise exception 'Unlinked prescriptions leaked into action evidence'; end if;
 d:=d||'{"actionAnswers":{"1":{"muscles":"Squats train my quadriceps and glutes; rows train my back and biceps."}}}';
 r:=public.save_balance_master_assessment(d,null);
 if (select count(*) from public.balance_master_action_submissions where week=1 and is_current)<>1 then raise exception 'Partial completion not independent'; end if;
 select submitted_at into first_time from public.balance_master_action_submissions where week=1 and action_key='muscles';
 perform public.save_balance_master_assessment(d,null);
 if (select submitted_at from public.balance_master_action_submissions where week=1 and action_key='muscles')<>first_time then raise exception 'Original action date changed'; end if;
 d:=jsonb_set(d,'{actionAnswers,1,movements}','"My quadriceps straighten the knee. My biceps bend the elbow."');
 d:=jsonb_set(d,'{actionAnswers,1,examples}','"A goblet squat trains my quadriceps and a curl trains my biceps."');
 r:=public.save_balance_master_assessment(d,1);
 if r#>>'{data,completedStages,0}'<>'true' then raise exception 'Complete action set failed'; end if;
 original:=d#>>'{actionAnswers,1,muscles}';
 r:=public.save_balance_master_assessment(jsonb_set(d,'{actionAnswers,1,muscles}','"short"'),null);
 if r#>>'{data,actionReceipts,1:muscles,isCurrent}'<>'false' or r#>>'{data,completedStages,0}'<>'false' then raise exception 'Incomplete edit left action or week complete'; end if;
 if (select snapshot->>'answer' from public.balance_master_action_submissions where week=1 and action_key='muscles')<>original then raise exception 'Previous evidence was lost'; end if;
 failed:=false;
 begin perform public.save_balance_master_assessment(jsonb_set(d,'{actionAnswers,1,muscles}','"short"'),1); exception when raise_exception then failed:=true; end;
 if not failed then raise exception 'Week accepted an unfinished action'; end if;
 r:=public.save_balance_master_assessment(jsonb_set(d,'{workout,days,0}','"00000000-0000-0000-0000-000000000000"'),null);
 if r#>>'{data,actionReceipts,5:workouts,isCurrent}'='true' or r#>>'{data,actionReceipts,5:schedule,isCurrent}'='true' then raise exception 'Unavailable or unowned workout accepted'; end if;
 if r#>>'{data,actionReceipts,5:split,isCurrent}'<>'true' then raise exception 'Independent split action lost'; end if;
 r:=public.save_balance_master_assessment(jsonb_set(d,'{workout,dayReasons,6}','""'),null);
 if r#>>'{data,actionReceipts,5:day-reasons,isCurrent}'='true' then raise exception 'Missing day reason accepted'; end if;
 r:=public.save_balance_master_assessment(d #- '{meal,days,6,dinner}',null);
 if r#>>'{data,actionReceipts,9:meals,isCurrent}'='true' or r#>>'{data,actionReceipts,9:shopping,isCurrent}'<>'true' then raise exception 'Meal actions not independent'; end if;
 failed:=false;
 begin update public.balance_master_action_submissions set is_current=true; exception when insufficient_privilege then failed:=true; end;
 if not failed then raise exception 'Direct action writes permitted'; end if;
 if exists(select 1 from public.balance_master_action_submissions where user_id<>auth.uid()) then raise exception 'Other member actions visible'; end if;
end $$;
reset role;
-- An unopened week cannot obtain receipts even with prefilled answers and videos.
update public.balance_course_enrollments set started_at=now() where user_id='2f41a5c1-1e32-4697-9960-8b7d4c0c1c38' and course_id='master';
set local role authenticated;
do $$ declare r jsonb; begin
 r:=public.sync_balance_master_actions();
 if exists(select 1 from public.balance_master_action_submissions where week>1 and is_current) then raise exception 'Unopened actions counted'; end if;
end $$;
reset role;
-- The assigned admin can read; an unrelated identity cannot.
select set_config('request.jwt.claims','{"sub":"00a6605e-8edb-4917-85ba-24a23f179059","role":"authenticated"}',true);
set local role authenticated;
do $$ begin if not exists(select 1 from public.balance_master_action_submissions where user_id='2f41a5c1-1e32-4697-9960-8b7d4c0c1c38') then raise exception 'Coach cannot review action records'; end if; end $$;
reset role;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000000","role":"authenticated"}',true);
set local role authenticated;
do $$ begin if exists(select 1 from public.balance_master_action_submissions where user_id='2f41a5c1-1e32-4697-9960-8b7d4c0c1c38') then raise exception 'Unrelated identity can read action records'; end if; end $$;
reset role;
rollback;
