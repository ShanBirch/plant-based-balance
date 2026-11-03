-- Real source-mapped fixture, fully rolled back; no transport or live sends.
begin;
do $$
declare e workout_accountability; p custom_workout_programs; f missed_workout_followup;
 v workout_accountability_events; ids uuid[]:='{}'; i integer; fixture_source uuid:=gen_random_uuid(); outid uuid:=gen_random_uuid(); result jsonb;
 today date; baseline timestamptz; slot jsonb; expected timestamptz;
begin
 select * into e from workout_accountability where enabled and organic_outreach_cohort_allowed(user_id)
 and workout_accountability_allowed(id) and consent_source='instagram_inbound'
 and not exists(select 1 from coaching_support_preferences s where s.user_id=workout_accountability.user_id) order by created_at limit 1;
 if e.id is null then raise exception 'Source-verified active new-cohort fixture required'; end if;
 select * into p from custom_workout_programs where user_id=e.user_id and is_active order by updated_at desc limit 1;
 if p.id is null then raise exception 'Saved program fixture required'; end if;
 today:=(now() at time zone e.timezone)::date;
 begin
  perform configure_missed_workout_followup(e.id,p.id,'{}');
  raise exception 'Missing authority review accepted';
 exception when raise_exception then if sqlerrm='Missing authority review accepted' then raise; end if; end;
 result:=configure_missed_workout_followup(e.id,p.id,'{"shannon_authorized":true,"exact_identity_verified":true,"current_program_reviewed":true,"support_choices_reviewed":true,"independent_holds_checked":true,"reviewed_by":"rollback_test"}');
 -- Start the synthetic attempt ledger before its fixture reply; never commit.
 update missed_workout_followup set starts_at=now()-interval '1 hour' where user_id=e.user_id returning * into f;
 baseline:=f.starts_at;
 if not missed_workout_followup_selected(e.id) or not app_support_event_selected(e.id,'evening') then raise exception 'New lane not selected'; end if;
 -- Prevent earlier real attempts from influencing the synthetic test streak.
 insert into ig_messages(id,thread_id,direction,text,source,created_at)
 values(fixture_source,e.thread_id,'in','Internal rollback fixture only','internal_rollback_test',now()-interval '30 minutes');
 for i in 1..3 loop
  insert into workout_accountability_events(enrollment_id,enrollment_version,local_date,session_name,kind,due_at,expires_at,attempted_at,status)
  values(e.id,e.version,today+100+i,'Internal budget fixture','before',now(),now()+interval '1 hour',now()-interval '20 minutes'+i*interval '1 minute',case when i=2 then 'uncertain' else 'sent' end)
  returning * into v;
  ids:=array_append(ids,v.id);
 end loop;
 if missed_workout_unanswered_count(e.id)<>3 then raise exception 'Sent/uncertain attempts were not counted'; end if;
 if missed_workout_unanswered_count(e.id,ids[3])<>2 then raise exception 'Third reservation cannot retain ownership'; end if;
 begin
  insert into workout_accountability_events(enrollment_id,enrollment_version,local_date,session_name,kind,due_at,expires_at,attempted_at)
  values(e.id,e.version,today+104,'Internal fourth fixture','before',now(),now()+interval '1 hour',now());
  raise exception 'Fourth unanswered attempt accepted';
 exception when raise_exception then if sqlerrm<>'Three unanswered workout contacts; await a real member reply' then raise; end if; end;
 insert into ig_messages(id,thread_id,direction,text,source,created_at)
 values(outid,e.thread_id,'out','Internal rollback outbound','internal_rollback_test',now());
 if missed_workout_unanswered_count(e.id)<>3 then raise exception 'Human outbound reset silence counter'; end if;
 perform configure_missed_workout_followup(e.id,p.id,'{"shannon_authorized":true,"exact_identity_verified":true,"current_program_reviewed":true,"support_choices_reviewed":true,"independent_holds_checked":true,"reviewed_by":"rollback_test_reconfigure"}');
 if (select starts_at from missed_workout_followup where user_id=e.user_id)<>baseline
 or missed_workout_unanswered_count(e.id)<>3 then raise exception 'Reconfiguration reset the cap'; end if;
 update ig_messages set created_at=now()+interval '1 second' where id=fixture_source;
 if missed_workout_unanswered_count(e.id)<>0 then raise exception 'Genuine later inbound did not reset counter'; end if;
 update missed_workout_followup set enabled=false where user_id=e.user_id;
 if app_support_event_selected(e.id,'evening') then raise exception 'Disabled policy revived legacy evening permission'; end if;
 update missed_workout_followup set enabled=true where user_id=e.user_id;
 update ig_threads set custom_data=custom_data||'{"human_takeover":true}' where id=e.thread_id;
 if missed_workout_followup_selected(e.id) then raise exception 'Manual takeover was bypassed'; end if;
 update ig_threads set custom_data=custom_data-'human_takeover' where id=e.thread_id;
 insert into coaching_support_preferences(user_id,morning_training,after_session,tone,consent_source)
 values(e.user_id,false,false,'gentle','app_onboarding') on conflict(user_id) do update set after_session=false;
 if missed_workout_followup_selected(e.id) then raise exception 'Saved opt-out ignored'; end if;
 -- Remove the synthetic choice (fixture started with no saved choice).
 delete from coaching_support_preferences where user_id=e.user_id;
 -- Materialisation is tested only if today's saved slot is a training day.
 select value into slot from jsonb_array_elements(e.schedule) where (value->>'weekday')::int=extract(isodow from today);
 if slot is not null then
  delete from workout_accountability_events where enrollment_id=e.id and local_date=today and attempted_at is null;
  perform refresh_workout_accountability(); perform refresh_workout_accountability();
  select * into v from workout_accountability_events where enrollment_id=e.id and local_date=today and kind='evening';
  expected:=greatest((today+time '19:30') at time zone e.timezone,(today+(slot->>'time')::time) at time zone e.timezone+interval '90 minutes');
  if v.id is null or v.due_at<>expected then raise exception 'Local 19:30/late-session timing incorrect'; end if;
  if (select count(*) from workout_accountability_events where enrollment_id=e.id and local_date=today and kind='evening')<>1 then raise exception 'Duplicate daily event'; end if;
  delete from workouts where user_id=e.user_id and workout_date=today and workout_type='history';
  if not missed_workout_event_eligible(v.id) then raise exception 'Saved unlogged training day was rejected'; end if;
  insert into workouts(user_id,workout_type,workout_date,template_name,exercise_name,set_number,reps)
  values(e.user_id,'history',today,'Different or partial session','Internal fixture',1,'0');
  if missed_workout_event_eligible(v.id) then raise exception 'Partial/other logged session was chased'; end if;
  delete from workouts where user_id=e.user_id and workout_date=today and workout_type='history';
  update custom_workout_programs set weekly_schedule='[]' where id=p.id;
  if missed_workout_event_eligible(v.id) then raise exception 'Changed/rest calendar was ignored'; end if;
 end if;
 if exists(select 1 from missed_workout_followup x join organic_outreach_existing_client_exclusions old on old.user_id=x.user_id
 where missed_workout_followup_selected(x.enrollment_id)) then raise exception 'Established client exclusion bypassed'; end if;
 if has_table_privilege('authenticated','public.missed_workout_followup','select')
 or has_function_privilege('authenticated','public.configure_missed_workout_followup(uuid,uuid,jsonb)','execute')
 or has_function_privilege('anon','public.missed_workout_unanswered_count(uuid,uuid)','execute') then raise exception 'Private lane exposed publicly'; end if;
 raise notice 'PASS: authority, cohort, budget/uncertainty, third/fourth, real reply, outbound/reconfigure, opt-out/hold, timezone/idempotency, partial logs, calendar edits, privileges';
end $$;
rollback;
