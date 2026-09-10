-- A saved, complete action receives its own evidence and dates. Unfinished edits retain prior evidence.
create table public.balance_master_action_submissions (
 user_id uuid not null references public.users(id) on delete cascade,
 week integer not null check(week between 1 and 10), action_key text not null, title text not null,
 snapshot jsonb not null, evidence jsonb not null default '{}'::jsonb,
 is_current boolean not null default true,
 submitted_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 primary key(user_id,week,action_key)
);
alter table public.balance_master_action_submissions enable row level security;
revoke all on public.balance_master_action_submissions from anon,authenticated;
grant select on public.balance_master_action_submissions to authenticated;
grant all on public.balance_master_action_submissions to service_role;
create policy master_action_read on public.balance_master_action_submissions for select to authenticated using (
 (select auth.uid())=user_id or exists(select 1 from public.coach_clients cc where cc.client_id=user_id and cc.coach_id=(select auth.uid()) and cc.status='active')
 or exists(select 1 from public.admin_users a where a.user_id=(select auth.uid()) and a.role='super_admin')
);
create or replace function balance_private.record_master_actions(p_data jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 v_user uuid:=auth.uid(); v_data jsonb:=p_data; v_definitions jsonb := '[[{"key":"muscles","title":"Identify the muscles in your workouts","hint":"List your current exercises and the main muscles each one trains.","kind":"written"},{"key":"movements","title":"Match each muscle to its movement","hint":"For the muscles you identified, explain the joint movement or stabilising job they perform.","kind":"written"},{"key":"examples","title":"Give an exercise example for each muscle","hint":"Pair each muscle with an exercise and explain how that exercise trains it.","kind":"written"}],[{"key":"squat","title":"Record your squat","hint":"Send one controlled working set for Shannon to review.","kind":"video"},{"key":"hinge","title":"Record your hinge","hint":"Send one controlled working set for Shannon to review.","kind":"video"},{"key":"push","title":"Record your push","hint":"Send one controlled working set for Shannon to review.","kind":"video"},{"key":"pull","title":"Record your pull","hint":"Send one controlled working set for Shannon to review.","kind":"video"}],[{"key":"selection","title":"Choose exercises for your major muscle groups","hint":"Write an exercise list covering your legs, hips, chest, back, shoulders, arms and trunk.","kind":"written"},{"key":"reasons","title":"Explain your exercise choices","hint":"Explain how those exercises suit your goal, experience, equipment and available time.","kind":"written"},{"key":"alternatives","title":"Choose suitable alternatives","hint":"Give alternatives for your exercises if equipment is unavailable or a movement does not suit your ability. Explain the substitutions.","kind":"written"}],[{"key":"sets-reps","title":"Set the working sets and rep ranges","hint":"Write a sample workout with an exercise, working sets and rep range for every entry.","kind":"written"},{"key":"rest-effort","title":"Choose rest periods and effort targets","hint":"Give each exercise a rest period and effort target, such as how many good repetitions you could still do.","kind":"written"},{"key":"adjustments","title":"Explain when to adjust the work","hint":"Describe when you would increase, maintain or reduce the load or volume, using performance and recovery.","kind":"written"}],[{"key":"split","title":"Choose and explain your muscle split","hint":"Save your split, why it fits, training goal and available time.","kind":"workout"},{"key":"workouts","title":"Build each workout in Balance","hint":"Build and link your workouts, then give every exercise sets, reps, rest and effort.","kind":"workout"},{"key":"schedule","title":"Plan your seven training and recovery days","hint":"Place your saved workouts and rest days across the week and explain muscle coverage.","kind":"workout"},{"key":"day-reasons","title":"Explain every day of your plan","hint":"Explain each training day’s exercise choices and order, each recovery day, and your progression rule.","kind":"workout"}],[{"key":"cardio","title":"Plan cardio and everyday movement","hint":"Add realistic cardio and everyday movement to specific days in your week. Explain how it fits your training.","kind":"written"},{"key":"recovery","title":"Plan recovery days and a sleep routine","hint":"Identify your recovery days and describe a sleep routine you can follow.","kind":"written"},{"key":"poor-recovery","title":"Explain what you will change if recovery is poor","hint":"Describe the signs you will watch and how you would adjust training, activity or your routine.","kind":"written"}],[{"key":"breakfast","title":"Build your breakfast","hint":"List ingredients and practical portions. Explain why these foods and amounts fit your needs.","kind":"written"},{"key":"lunch","title":"Build your lunch","hint":"List ingredients and practical portions. Explain your protein, carbohydrate, vegetables or fruit, and fat choices.","kind":"written"},{"key":"dinner","title":"Build your dinner","hint":"List ingredients and practical portions. Explain how this meal supports your day and fits with your other meals.","kind":"written"}],[{"key":"usual-foods","title":"Review the foods you usually eat","hint":"Describe a normal day or week of food, including the variety and nutrient sources you already have.","kind":"written"},{"key":"gaps","title":"Identify gaps in variety or nutrient sources","hint":"Identify what is missing or limited and any questions you need help with. If coverage is good, explain why.","kind":"written"},{"key":"improvements","title":"Make and explain practical improvements","hint":"Write specific food changes you can make and explain how they address the gaps you identified.","kind":"written"}],[{"key":"meals","title":"Build seven days of meals","hint":"Save breakfast, lunch and dinner for all seven days, with portions and your dietary needs.","kind":"meal"},{"key":"shopping","title":"Create a combined shopping list","hint":"Combine ingredients and quantities across your week and check your pantry.","kind":"meal"},{"key":"prep","title":"Plan your food preparation","hint":"Record when you will shop, prepare meals and use leftovers.","kind":"meal"},{"key":"backup","title":"Choose a busy-day backup","hint":"Save a realistic quick meal or eating-out option.","kind":"meal"}],[{"key":"workout-review","title":"Review your workout program","hint":"Review how your schedule, exercises, training dose and recovery fit your needs. Use your saved week as evidence.","kind":"written"},{"key":"meal-review","title":"Review your meal plan","hint":"Review portions, variety, enjoyment, cost and preparation. Explain what worked or needs adjusting.","kind":"written"},{"key":"next-steps","title":"Decide what to keep, change and monitor","hint":"Explain what you will keep, what you will change and why, and what evidence you will monitor next.","kind":"written"}]]'::jsonb;
 v_started timestamptz; v_week integer; v_def jsonb; v_key text; v_kind text; v_text text;
 v_valid boolean; v_plan jsonb; v_snapshot jsonb; v_evidence jsonb; v_row record;
 v_days_ok boolean; v_workouts_ok boolean; v_training integer; v_i integer; v_n integer;
 v_id text; v_template record; v_ex jsonb; v_p jsonb; v_names jsonb; v_receipts jsonb;
begin
 if v_user is null then raise exception 'Sign in to save your work.'; end if;
 select started_at into v_started from public.balance_course_enrollments where user_id=v_user and course_id='master';
 for v_week in 1..10 loop
  for v_def in select value from jsonb_array_elements(v_definitions->(v_week-1)) loop
   v_key:=v_def->>'key'; v_kind:=v_def->>'kind'; v_valid:=false; v_snapshot:='{}'; v_evidence:='{}';
   if v_started is not null and now()>=v_started+(v_week-1)*interval '7 days' then
    if v_kind='written' then
     v_text:=v_data#>>array['actionAnswers',v_week::text,v_key];
     v_valid:=jsonb_typeof(v_data#>array['actionAnswers',v_week::text,v_key])='string' and length(trim(coalesce(v_text,'')))>=20;
     v_snapshot:=jsonb_build_object('answer',v_text);
    elsif v_kind='video' then
     select id,created_at,data->>'form_check_video_url' as video into v_row from public.coach_alerts
      where client_id=v_user and data->>'is_form_check'='true' and data->>'form_check_workout_name'='Balance Master: '||v_key
      and data->>'form_check_video_url' like 'https://%' order by created_at desc limit 1;
     if not found then
      select id,created_at,substring(message from '\[video: (https://[^]]+)\]') as video into v_row from public.nudges
       where sender_id=v_user and nudge_type='form_check' and ('Workout: Balance Master: '||v_key)=any(string_to_array(message,E'\n'))
       and message ~ '\[video: https://' order by created_at desc limit 1;
     end if;
     v_valid:=found;
     if v_valid then v_evidence:=jsonb_build_object('id',v_row.id,'submittedAt',v_row.created_at,'video',v_row.video); end if;
     v_snapshot:=jsonb_build_object('movement',v_key);
    elsif v_kind='workout' then
     v_plan:=v_data->'workout';
     if v_key='split' then
      v_valid:=true;
      foreach v_text in array array['split','splitReason','goal','constraints'] loop
       v_valid:=v_valid and length(trim(coalesce(v_plan->>v_text,'')))>=3;
       v_snapshot:=v_snapshot||jsonb_build_object(v_text,v_plan->v_text);
      end loop;
     elsif v_key in ('workouts','schedule') then
      v_days_ok:=false; v_workouts_ok:=true; v_training:=0; v_names:='{}';
      if jsonb_typeof(v_plan->'days')='array' and jsonb_array_length(v_plan->'days')=7 then
       v_days_ok:=true;
       for v_i in 0..6 loop
        v_id:=v_plan#>>array['days',v_i::text];
        if v_id='rest' then continue; end if;
        select id,template_name,template_data into v_template from public.workouts where id::text=v_id and user_id=v_user and workout_type='custom_template';
        if not found then v_days_ok:=false; v_workouts_ok:=false; continue; end if;
        v_training:=v_training+1;
        if jsonb_typeof(v_template.template_data->'exercises') is distinct from 'array' or jsonb_array_length(v_template.template_data->'exercises')=0 then v_workouts_ok:=false; continue; end if;
        v_names:=v_names||jsonb_build_object(v_id,jsonb_build_object('name',v_template.template_name,'exercises',v_template.template_data->'exercises'));
        for v_n in 0..jsonb_array_length(v_template.template_data->'exercises')-1 loop
         v_ex:=v_template.template_data->'exercises'->v_n; v_p:=v_plan#>array['prescriptions',v_id,v_n::text];
         if coalesce(v_p->>'exercise','')<>coalesce(case when jsonb_typeof(v_ex)='string' then v_ex#>>'{}' else coalesce(v_ex->>'name',v_ex->>'exercise',v_ex->>'exercise_name') end,'Exercise')
          or coalesce(v_p->>'sets','') !~ '^([1-9]|1[0-9]|20)$' or length(trim(coalesce(v_p->>'reps','')))=0
          or length(trim(coalesce(v_p->>'rest','')))=0 or length(trim(coalesce(v_p->>'effort','')))<3 then v_workouts_ok:=false; end if;
        end loop;
       end loop;
      end if;
      v_valid:=v_days_ok and v_training>0 and case when v_key='workouts' then v_workouts_ok else length(trim(coalesce(v_plan->>'coverage','')))>=3 end;
      v_snapshot:=case when v_key='workouts' then jsonb_build_object('prescriptions',v_plan->'prescriptions') else jsonb_build_object('days',v_plan->'days','coverage',v_plan->'coverage') end;
      v_evidence:=jsonb_build_object('workouts',v_names);
     elsif v_key='day-reasons' then
      v_valid:=false;
      if jsonb_typeof(v_plan->'dayReasons')='array' and jsonb_array_length(v_plan->'dayReasons')=7 then
       v_valid:=length(trim(coalesce(v_plan->>'progression','')))>=3;
       for v_i in 0..6 loop v_valid:=v_valid and length(trim(coalesce(v_plan#>>array['dayReasons',v_i::text],'')))>=3; end loop;
      end if;
      v_snapshot:=jsonb_build_object('dayReasons',v_plan->'dayReasons','progression',v_plan->'progression');
     end if;
    elsif v_kind='meal' then
     v_plan:=v_data->'meal';
     if v_key='meals' then
      if jsonb_typeof(v_plan->'days')='array' and jsonb_array_length(v_plan->'days')=7 then
       v_valid:=length(trim(coalesce(v_plan->>'needs','')))>=3;
       for v_i in 0..6 loop
        foreach v_text in array array['breakfast','lunch','dinner'] loop
         v_valid:=v_valid and length(trim(coalesce(v_plan#>>array['days',v_i::text,v_text],'')))>=3;
        end loop;
       end loop;
      end if;
      v_snapshot:=jsonb_build_object('days',v_plan->'days','needs',v_plan->'needs');
     else
      v_valid:=length(trim(coalesce(v_plan->>v_key,'')))>=3;
      v_snapshot:=jsonb_build_object(v_key,v_plan->v_key);
     end if;
    end if;
   end if;
   if coalesce(v_valid,false) then
    insert into public.balance_master_action_submissions(user_id,week,action_key,title,snapshot,evidence)
     values(v_user,v_week,v_key,v_def->>'title',v_snapshot,v_evidence)
    on conflict(user_id,week,action_key) do update set snapshot=excluded.snapshot,evidence=excluded.evidence,is_current=true,updated_at=now()
     where balance_master_action_submissions.snapshot is distinct from excluded.snapshot
      or balance_master_action_submissions.evidence is distinct from excluded.evidence or not balance_master_action_submissions.is_current;
   else
    update public.balance_master_action_submissions set is_current=false where user_id=v_user and week=v_week and action_key=v_key and is_current;
   end if;
  end loop;
  if (select count(*) from public.balance_master_action_submissions where user_id=v_user and week=v_week and is_current)<jsonb_array_length(v_definitions->(v_week-1))
   or exists(select 1 from public.balance_master_action_submissions a join public.balance_master_submissions s on s.user_id=a.user_id and s.week=a.week where a.user_id=v_user and a.week=v_week and a.updated_at>s.updated_at) then
   v_data:=jsonb_set(v_data,array['completedStages',(v_week-1)::text],'false');
  end if;
 end loop;
 select coalesce(jsonb_object_agg(week::text||':'||action_key,jsonb_build_object('isCurrent',is_current,'submittedAt',submitted_at,'updatedAt',updated_at)),'{}')
  into v_receipts from public.balance_master_action_submissions where user_id=v_user;
 return v_data||jsonb_build_object('actionReceipts',v_receipts);
end;
$$;
revoke all on function balance_private.record_master_actions(jsonb) from public,anon,authenticated;
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
 if p_data is not null and (jsonb_typeof(p_data)<>'object' or octet_length(p_data::text)>400000) then raise exception 'Invalid course draft.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(v_user::text, 791));
 select data into v_old from public.balance_master_projects where user_id=v_user for update;
 v_old:=coalesce(v_old,'{}'::jsonb);
 v_data:=coalesce(p_data,v_old) || jsonb_build_object('completedStages',coalesce(v_old->'completedStages','{}'::jsonb),'submittedAt',coalesce(v_old->'submittedAt','{}'::jsonb),'assessmentVersion',4);
 v_data:=balance_private.record_master_actions(v_data);
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
  if (select count(*) from public.balance_master_action_submissions where user_id=v_user and week=p_week and is_current)<>(case when p_week in (2,5,9) then 4 else 3 end) then raise exception 'Finish and save every required action for this week.'; end if;
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
  v_snapshot:=jsonb_build_object('reflection',v_data#>array['reflections',v_stage],'quizReflection',v_data#>array['quizReflections',v_stage],'answers',v_data->'answers','actionAnswers',v_data#>array['actionAnswers',p_week::text],'assessmentVersion',4);
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

create or replace function public.sync_balance_master_actions() returns jsonb
 language sql security invoker set search_path='' as $$ select balance_private.save_master(null,null); $$;
revoke all on function public.sync_balance_master_actions() from public,anon;
grant execute on function public.sync_balance_master_actions() to authenticated;
comment on table public.balance_master_action_submissions is 'Individual required actions: server-verified saved work, original and latest dates, and evidence. is_current is false when current work no longer satisfies the action. Content and technique still require coach judgment.';
