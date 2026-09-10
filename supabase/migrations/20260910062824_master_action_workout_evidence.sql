-- Preserve only the linked, verified workouts in the action snapshot. Unselected draft prescriptions remain in the project.
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
      v_snapshot:=case when v_key='workouts' then jsonb_build_object('prescriptions',(select coalesce(jsonb_object_agg(linked.id,v_plan#>array['prescriptions',linked.id]),'{}'::jsonb) from jsonb_object_keys(v_names) as linked(id))) else jsonb_build_object('days',v_plan->'days','coverage',v_plan->'coverage') end;
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
