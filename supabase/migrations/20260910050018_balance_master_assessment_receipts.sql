-- Required Master actions have a server-validated submission receipt, separate from drafts.
create table public.balance_master_submissions (
 user_id uuid not null references public.users(id) on delete cascade,
 week integer not null check (week between 1 and 10),
 title text not null,
 snapshot jsonb not null,
 evidence jsonb not null default '{}'::jsonb,
 submitted_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 primary key(user_id,week)
);
alter table public.balance_master_submissions enable row level security;
revoke all on public.balance_master_submissions from anon,authenticated;
grant select on public.balance_master_submissions to authenticated;
grant all on public.balance_master_submissions to service_role;
create policy master_submission_read on public.balance_master_submissions for select to authenticated using (
 (select auth.uid()) = user_id or exists (select 1 from public.coach_clients cc where cc.client_id=user_id and cc.coach_id=(select auth.uid()) and cc.status='active')
 or exists (select 1 from public.admin_users a where a.user_id=(select auth.uid()) and a.role='super_admin')
);
create policy master_projects_coach_read on public.balance_master_projects for select to authenticated using (
 exists (select 1 from public.coach_clients cc where cc.client_id=user_id and cc.coach_id=(select auth.uid()) and cc.status='active')
 or exists (select 1 from public.admin_users a where a.user_id=(select auth.uid()) and a.role='super_admin')
);
create policy reflection_admin_read on public.lesson_reflections for select to authenticated using (
 exists (select 1 from public.admin_users a where a.user_id=(select auth.uid()) and a.role='super_admin')
);
revoke insert,update on public.balance_master_projects from authenticated;
create schema if not exists balance_private;
revoke all on schema balance_private from public;
grant usage on schema balance_private to authenticated;

create or replace function balance_private.save_master(p_data jsonb,p_week integer default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 v_user uuid := auth.uid(); v_old jsonb; v_data jsonb; v_definition jsonb;
 v_definitions jsonb := '{"0":{"title":"Know the muscles you train","answers":[0,1],"lessons":["body-1-1","body-1-2"]},"1":{"title":"Understand compound lifts","answers":[2,0],"lessons":["body-2-1","body-2-3","body-3-1","body-3-2","body-4-1","body-4-2","body-4-3","body-4-5"]},"2":{"title":"Choose exercises for your muscles","answers":[1,0],"lessons":["body-5-3","workouts-1-3","workouts-3-4"]},"3":{"title":"Set your training dose","answers":[1,2],"lessons":["body-5-1","body-5-2","workouts-1-1","workouts-1-2","workouts-2-3"]},"4":{"title":"Build your workout program","answers":[1,2],"lessons":["workouts-1-4","workouts-2-4","workouts-2-5","workouts-3-5"]},"5":{"title":"Fit cardio and recovery into your plan","answers":[1,2],"lessons":["workouts-4-2","workouts-4-5","workouts-5-3"]},"6":{"title":"Learn how to build a meal","answers":[2,0],"lessons":["fuel-1-1","fuel-2-1","fuel-2-5"]},"7":{"title":"Check variety and essential nutrients","answers":[0,1],"lessons":["fuel-3-1","fuel-3-5"]},"8":{"title":"Design one week of meals","answers":[1,2],"lessons":["fuel-4-1","fuel-4-2","fuel-4-3","fuel-4-4"]},"9":{"title":"Review and adjust your plans","answers":[0,1],"lessons":["fuel-5-1","fuel-5-2"]}}'::jsonb;
 v_stage text; v_key text; v_id text; v_started timestamptz; v_week integer;
 v_i integer; v_n integer; v_w jsonb; v_m jsonb; v_ex jsonb; v_p jsonb; v_template record;
 v_receipts jsonb := '{}'::jsonb; v_row record; v_snapshot jsonb; v_names jsonb := '{}'::jsonb;
begin
 if v_user is null then raise exception 'Sign in to save your work.'; end if;
 if p_data is null or jsonb_typeof(p_data)<>'object' or octet_length(p_data::text)>400000 then raise exception 'Invalid course draft.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(v_user::text, 791));
 select data into v_old from public.balance_master_projects where user_id=v_user for update;
 v_old:=coalesce(v_old,'{}'::jsonb);
 v_data:=p_data || jsonb_build_object('completedStages',coalesce(v_old->'completedStages','{}'::jsonb),'submittedAt',coalesce(v_old->'submittedAt','{}'::jsonb),'assessmentVersion',3);
 if p_week is not null then
  if p_week not between 1 and 10 then raise exception 'Invalid course week.'; end if;
  v_stage:=(p_week-1)::text;
  v_definition:=v_definitions->v_stage;
  select started_at into v_started from public.balance_course_enrollments where user_id=v_user and course_id='master';
  if v_started is null or now()<v_started+(p_week-1)*interval '7 days' then raise exception 'This Master week has not opened yet.'; end if;
  -- Quiz facts come from the database, never from a browser completion checkbox.
  for v_id in select jsonb_array_elements_text(v_definition->'lessons') loop
   if not exists(select 1 from public.lesson_completions where user_id=v_user and lesson_id=v_id and score_percentage=100 and games_played>0)
    then raise exception 'Complete this week''s lesson quizzes before submitting.'; end if;
   if not exists(select 1 from public.lesson_reflections where user_id=v_user and lesson_id=v_id and length(trim(reflection_text))>=3)
    then raise exception 'Save a reflection for every lesson quiz in this week.'; end if;
  end loop;
  for v_i in 0..1 loop
   if coalesce(v_data#>>array['answers',v_stage||'-'||v_i], '')<>v_definition#>>array['answers',v_i::text]
    then raise exception 'Answer both weekly knowledge checks correctly.'; end if;
  end loop;
  if length(trim(coalesce(v_data#>>array['quizReflections',v_stage],'')))<3 then raise exception 'Write what you learned and how you will use it.'; end if;
  if p_week not in (5,9) and length(trim(coalesce(v_data#>>array['reflections',v_stage],'')))<3 then raise exception 'Finish this week''s practical answer.'; end if;
  if p_week=2 then
   foreach v_key in array array['squat','hinge','push','pull'] loop
    select id,created_at,data->>'form_check_video_url' as video into v_row from public.coach_alerts
     where client_id=v_user and data->>'is_form_check'='true' and data->>'form_check_workout_name'='Balance Master: '||v_key
     and data->>'form_check_video_url' like 'https://%' order by created_at desc limit 1;
    if not found then
     select id,created_at,substring(message from '\[video: (https://[^]]+)\]') as video into v_row from public.nudges
      where sender_id=v_user and nudge_type='form_check' and ('Workout: Balance Master: '||v_key)=any(string_to_array(message,E'\n'))
      and message ~ '\[video: https://' order by created_at desc limit 1;
    end if;
    if not found then raise exception 'Successfully submit all four compound lift videos first.'; end if;
    v_receipts:=v_receipts||jsonb_build_object(v_key,jsonb_build_object('id',v_row.id,'submittedAt',v_row.created_at,'video',v_row.video));
   end loop;
  end if;
  if p_week=5 then
   v_w:=v_data->'workout';
   foreach v_key in array array['split','splitReason','goal','constraints','coverage','progression'] loop
    if length(trim(coalesce(v_w->>v_key,'')))<3 then raise exception 'Finish your split, reasoning, goal, recovery, coverage and progression.'; end if;
   end loop;
   if jsonb_typeof(v_w->'days') is distinct from 'array' or jsonb_array_length(v_w->'days')<>7 or jsonb_typeof(v_w->'dayReasons') is distinct from 'array' or jsonb_array_length(v_w->'dayReasons')<>7 then raise exception 'Plan and explain all seven days.'; end if;
   v_n:=0;
   for v_i in 0..6 loop
    if length(trim(coalesce(v_w#>>array['dayReasons',v_i::text],'')))<3 then raise exception 'Explain each training and recovery day.'; end if;
    v_id:=v_w#>>array['days',v_i::text];
    if v_id='rest' then continue; end if;
    select id,template_name,template_data into v_template from public.workouts where id::text=v_id and user_id=v_user and workout_type='custom_template';
    if not found then raise exception 'Choose your own saved workout for every training day.'; end if;
    if jsonb_typeof(v_template.template_data->'exercises') is distinct from 'array' or jsonb_array_length(v_template.template_data->'exercises')=0 then raise exception 'Add exercises to each saved workout.'; end if;
    v_names:=v_names||jsonb_build_object(v_id,jsonb_build_object('name',v_template.template_name,'exercises',v_template.template_data->'exercises'));
    for v_n in 0..jsonb_array_length(v_template.template_data->'exercises')-1 loop
     v_ex:=v_template.template_data->'exercises'->v_n;
     v_p:=v_w#>array['prescriptions',v_id,v_n::text];
     if coalesce(v_p->>'exercise','')<>coalesce(case when jsonb_typeof(v_ex)='string' then v_ex#>>'{}' else coalesce(v_ex->>'name',v_ex->>'exercise',v_ex->>'exercise_name') end,'Exercise') then raise exception 'Refresh and prescribe the current exercises in your workout.'; end if;
     if coalesce(v_p->>'sets','') !~ '^([1-9]|1[0-9]|20)$' or length(trim(coalesce(v_p->>'reps','')))=0 or length(trim(coalesce(v_p->>'rest','')))=0 or length(trim(coalesce(v_p->>'effort','')))<3 then raise exception 'Add sets, reps, rest and effort for every exercise.'; end if;
    end loop;
   end loop;
   if not exists(select 1 from jsonb_array_elements_text(v_w->'days') d where d<>'rest') then raise exception 'Build at least one training day.'; end if;
  end if;
  if p_week=9 then
   v_m:=v_data->'meal';
   foreach v_key in array array['needs','shopping','prep','backup'] loop
    if length(trim(coalesce(v_m->>v_key,'')))<3 then raise exception 'Finish dietary needs, shopping, preparation and a backup meal.'; end if;
   end loop;
   if jsonb_typeof(v_m->'days') is distinct from 'array' or jsonb_array_length(v_m->'days')<>7 then raise exception 'Plan seven days of meals.'; end if;
   for v_i in 0..6 loop
    foreach v_key in array array['breakfast','lunch','dinner'] loop
     if length(trim(coalesce(v_m#>>array['days',v_i::text,v_key],'')))<3 then raise exception 'Finish breakfast, lunch and dinner for all seven days.'; end if;
    end loop;
   end loop;
  end if;
  v_data:=jsonb_set(v_data,array['completedStages',v_stage],'true'::jsonb);
  v_data:=jsonb_set(v_data,array['submittedAt',v_stage],to_jsonb(now()));
  v_snapshot:=jsonb_build_object('reflection',v_data#>array['reflections',v_stage],'quizReflection',v_data#>array['quizReflections',v_stage],'answers',v_data->'answers');
  if p_week=5 then v_snapshot:=v_snapshot||jsonb_build_object('workout',v_w,'workouts',v_names); end if;
  if p_week=9 then v_snapshot:=v_snapshot||jsonb_build_object('meal',v_m); end if;
  insert into public.balance_master_submissions(user_id,week,title,snapshot,evidence) values(v_user,p_week,v_definition->>'title',v_snapshot,jsonb_build_object('lifts',v_receipts,'lessonIds',v_definition->'lessons'))
  on conflict(user_id,week) do update set snapshot=excluded.snapshot,evidence=excluded.evidence,updated_at=now();
 end if;
 insert into public.balance_master_projects(user_id,data,updated_at) values(v_user,v_data,now()) on conflict(user_id) do update set data=excluded.data,updated_at=now();
 return jsonb_build_object('data',v_data);
end;
$$;
revoke all on function balance_private.save_master(jsonb,integer) from public,anon;
grant execute on function balance_private.save_master(jsonb,integer) to authenticated;
create or replace function public.save_balance_master_assessment(p_data jsonb,p_week integer default null) returns jsonb
 language sql security invoker set search_path='' as $$ select balance_private.save_master(p_data,p_week); $$;
revoke all on function public.save_balance_master_assessment(jsonb,integer) from public,anon;
grant execute on function public.save_balance_master_assessment(jsonb,integer) to authenticated;
comment on table public.balance_master_submissions is 'Verified required Master actions, recorded atomically with the learner project. Drafts never create receipts. Video submission is not technique approval.';
