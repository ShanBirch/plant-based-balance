-- Narrow app-origin consent for the EXISTING event and native ownership path.
alter table public.workout_accountability alter column consent_message_id drop not null;
alter table public.workout_accountability add column consent_source text not null default 'instagram_inbound'
 check(consent_source in ('instagram_inbound','app_preferences'));
alter table public.workout_accountability add column app_consent_revision integer;
alter table public.workout_accountability add column app_program_id uuid references public.custom_workout_programs(id);
alter table public.workout_accountability add column app_program_updated_at timestamptz;
alter table public.workout_accountability add constraint workout_consent_source_exact check(
 (consent_source='instagram_inbound' and consent_message_id is not null and app_consent_revision is null)
 or (consent_source='app_preferences' and consent_message_id is null and app_consent_revision is not null and app_program_id is not null));

create function public.app_support_event_selected(p_enrollment uuid,p_kind text) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from workout_accountability e where e.id=p_enrollment and
 (e.consent_source='instagram_inbound' or exists(select 1 from coaching_support_preferences s
 where s.user_id=e.user_id and s.revision=e.app_consent_revision and s.consent_version='support_choices_20261101_v1'
 and ((p_kind='before' and s.morning_training) or (p_kind='logged' and s.after_session)))));
$$;

create function public.configure_app_support_accountability(p_thread_id uuid,p_program_id uuid,p_consent_revision integer,
 p_timezone text,p_starts_on date,p_ends_on date,p_review jsonb) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare t ig_threads; s coaching_support_preferences; p custom_workout_programs; slots jsonb; result uuid;
begin
 select * into t from ig_threads where id=p_thread_id for update;
 select * into s from coaching_support_preferences where user_id=t.linked_user_id for update;
 select * into p from custom_workout_programs where id=p_program_id and user_id=t.linked_user_id and is_active;
 if t.id is null or t.coach_id is distinct from '00a6605e-8edb-4917-85ba-24a23f179059'::uuid or s.user_id is null or p_consent_revision is null or t.channel is distinct from 'instagram' or nullif(t.ig_username,'') is null or p.id is null
 or s.revision is distinct from p_consent_revision or not (s.morning_training or s.after_session)
 then raise exception 'Exact Instagram identity, active saved program and selected app consent required'; end if;
 if not coalesce(p_review @> '{"full_thread_reviewed":true,"native_identity_verified":true,"independent_holds_checked":true,"app_context_reviewed":true,"no_duplicate_verified":true,"timezone_verified":true}',false)
 or nullif(p_review->>'reviewed_by','') is null then raise exception 'Fresh native/app/source review required'; end if;
 if not exists(select 1 from pg_timezone_names where name=p_timezone) then raise exception 'Verified timezone required'; end if;
 if p_starts_on is null or p_ends_on is null or p_starts_on>p_ends_on or p_ends_on>p_starts_on+90 then raise exception 'Bounded coaching dates required'; end if;
 if exists(select 1 from balance_free_coaching_setups f join balance_free_starters g on g.id=f.grant_id
 where f.thread_id=t.id and (g.revoked_at is not null or p_ends_on>(g.ends_at at time zone p_timezone)::date)) then raise exception 'Cannot extend promised coaching access'; end if;
 -- Read exact days/names from the program; never ask for or invent a new schedule.
 if jsonb_typeof(p.weekly_schedule) is distinct from 'array' then raise exception 'Saved program schedule needs review'; end if;
 select jsonb_agg(jsonb_build_object('weekday',array_position(array['mon','tue','wed','thu','fri','sat','sun'],lower(left(x->>'day',3))),
 'time','08:00','session_name',x->'workout'->>'name') order by array_position(array['mon','tue','wed','thu','fri','sat','sun'],lower(left(x->>'day',3)))) into slots
 from jsonb_array_elements(p.weekly_schedule) x where nullif(x->'workout'->>'name','') is not null
 and lower(coalesce(x->'workout'->>'type','')) not in ('rest','recovery','yoga')
 and lower(x->'workout'->>'name') not in ('rest','rest day','recovery','yoga');
 if slots is null or jsonb_array_length(slots) not between 1 and 7
 or exists(select 1 from jsonb_array_elements(slots) x where x->>'weekday' is null)
 or (select count(distinct x->>'weekday') from jsonb_array_elements(slots) x)<>jsonb_array_length(slots) then raise exception 'Saved training days need review'; end if;
 -- Never replace a healthy inbound-consent enrollment or an in-flight action.
 if exists(select 1 from workout_accountability e where e.thread_id=t.id and e.enabled and e.consent_source='instagram_inbound') then raise exception 'Existing inbound-consent support owns this enrollment'; end if;
 if exists(select 1 from workout_accountability_events v join workout_accountability e on e.id=v.enrollment_id
 where e.thread_id=t.id and v.status in ('queued','reserved','uncertain')) then raise exception 'Reconcile existing event ownership first'; end if;
 select id into result from workout_accountability where thread_id=t.id and enabled and consent_source='app_preferences'
 and app_consent_revision=s.revision and app_program_id=p.id and app_program_updated_at=p.updated_at and timezone=p_timezone
 and schedule=slots and starts_on=p_starts_on and ends_on=p_ends_on;
 if result is not null then
  if not workout_accountability_allowed(result) then raise exception 'Independent support hold'; end if;
  return result;
 end if;
 insert into workout_accountability(thread_id,user_id,coach_id,timezone,schedule,consent_message_id,consent_review,starts_on,ends_on,
 consent_source,app_consent_revision,app_program_id,app_program_updated_at)
 values(t.id,t.linked_user_id,t.coach_id,p_timezone,slots,null,p_review,p_starts_on,p_ends_on,'app_preferences',s.revision,p.id,p.updated_at)
 on conflict(thread_id) do update set timezone=excluded.timezone,schedule=excluded.schedule,consent_message_id=null,
 consent_source='app_preferences',app_consent_revision=s.revision,app_program_id=p.id,app_program_updated_at=p.updated_at,
 consent_review=p_review,starts_on=p_starts_on,ends_on=p_ends_on,enabled=true,version=workout_accountability.version+1,updated_at=now()
 returning id into result;
 if not workout_accountability_allowed(result) then raise exception 'Existing onboarding/client/manual/safety hold prevents support'; end if;
 update workout_accountability_events set status='skipped',receipt=receipt||'{"reason":"app_preferences_changed","no_repeat":true}'
 where enrollment_id=result and status='pending';
 return result;
end;
$$;
revoke all on function public.configure_app_support_accountability(uuid,uuid,integer,text,date,date,jsonb),public.app_support_event_selected(uuid,text) from public,anon,authenticated;
grant execute on function public.configure_app_support_accountability(uuid,uuid,integer,text,date,date,jsonb),public.app_support_event_selected(uuid,text) to service_role;
CREATE OR REPLACE FUNCTION public.configure_workout_accountability(p_thread_id uuid, p_consent_message_id uuid, p_timezone text, p_schedule jsonb, p_starts_on date, p_ends_on date, p_review jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare t ig_threads; s jsonb; result uuid;
begin
 select * into t from ig_threads where id=p_thread_id for update;
 if t.linked_user_id is null or t.channel not in ('instagram','messenger') then raise exception 'Verified linked Instagram account required'; end if;
 if not exists(select 1 from users where id=t.linked_user_id and onboarding_complete and not coalesce(is_test_account,false)) then raise exception 'Verified completed onboarding required'; end if;
 if not exists(select 1 from ig_messages where id=p_consent_message_id and thread_id=t.id and direction='in') then raise exception 'Exact inbound reminder consent required'; end if;
 if not coalesce(p_review @> '{"full_thread_reviewed":true,"explicit_reminder_consent":true,"schedule_agreed":true,"independent_holds_checked":true}',false)
 or nullif(p_review->>'reviewed_by','') is null then raise exception 'Live consent, agreed schedule and independent hold review required'; end if;
 if not exists(select 1 from pg_timezone_names where name=p_timezone) then raise exception 'Valid confirmed timezone required'; end if;
 if p_starts_on is null or p_ends_on is null or p_starts_on>p_ends_on or p_ends_on>p_starts_on+90 then raise exception 'Explicit coaching dates required, maximum 90 days'; end if;
 if p_schedule is null or jsonb_typeof(p_schedule)<>'array' or jsonb_array_length(p_schedule) not between 1 and 7 then raise exception 'One to seven agreed workout slots required'; end if;
 for s in select value from jsonb_array_elements(p_schedule) loop
  if coalesce(s->>'weekday','') !~ '^[1-7]$' or coalesce(s->>'time','') !~ '^[0-2][0-9]:[0-5][0-9]$'
   or s->>'time'<'06:30' or s->>'time'>'20:30'
   or nullif(trim(s->>'session_name'),'') is null then raise exception 'Slots require ISO weekday, 06:30-20:30 time, exact session_name'; end if;
 end loop;
 if (select count(distinct value->>'weekday') from jsonb_array_elements(p_schedule))<>jsonb_array_length(p_schedule) then raise exception 'One agreed session per day maximum'; end if;
 select id into result from workout_accountability where thread_id=t.id and enabled and timezone=p_timezone
 and schedule=p_schedule and consent_message_id=p_consent_message_id and starts_on=p_starts_on and ends_on=p_ends_on;
 if result is not null then
  if not workout_accountability_allowed(result) then raise exception 'Existing client/manual/safety hold prevents reminders'; end if;
  return result;
 end if;
 insert into workout_accountability(thread_id,user_id,coach_id,timezone,schedule,consent_message_id,consent_review,starts_on,ends_on)
 values(t.id,t.linked_user_id,t.coach_id,p_timezone,p_schedule,p_consent_message_id,p_review,p_starts_on,p_ends_on)
 on conflict(thread_id) do update set timezone=excluded.timezone,schedule=excluded.schedule,consent_message_id=excluded.consent_message_id,
 consent_source='instagram_inbound',app_consent_revision=null,app_program_id=null,app_program_updated_at=null,
 consent_review=excluded.consent_review,starts_on=excluded.starts_on,ends_on=excluded.ends_on,enabled=true,
 version=workout_accountability.version+1,updated_at=now() returning id into result;
 if not workout_accountability_allowed(result) then raise exception 'Existing client/manual/safety hold prevents reminders'; end if;
 update workout_accountability_events set status='skipped',receipt=receipt||'{"reason":"schedule_changed"}' where enrollment_id=result and status in ('pending','queued');
 return result;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.ig_workout_accountability_action_eligible(a ig_next_actions)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v workout_accountability_events; e workout_accountability; latest uuid;
begin
 if a.owner<>'manual' or a.action_type<>'reactivation' or a.reason->>'policy' is distinct from 'workout_accountability_v1' then return false; end if;
 select * into v from workout_accountability_events where id=(a.reason->>'event_id')::uuid;
 select * into e from workout_accountability where id=v.enrollment_id;
 if v.id is null or e.id is null or a.thread_id<>e.thread_id or a.id is distinct from v.action_id or a.action_version is distinct from v.action_version
 or not app_support_event_selected(e.id,v.kind) or v.status not in ('queued','reserved') or not workout_accountability_phase_eligible(v.id) or v.enrollment_version<>e.version or not workout_accountability_allowed(e.id)
 or now()<v.due_at or now()>v.expires_at then return false; end if;
 if v.status='reserved' and v.claim_token is distinct from a.claim_token then return false; end if;
 select id into latest from ig_messages where thread_id=e.thread_id order by created_at desc,id desc limit 1;
 if latest is null or latest is distinct from v.expected_message_id then return false; end if;
 if exists(select 1 from ig_messages where id=latest and direction='in') then
  if not workout_acknowledged_inbound_proof(e.thread_id,latest,a.reason->'acknowledged_inbound')
   or not exists(select 1 from ig_next_action_receipts r where r.thread_id=e.thread_id
    and r.action_id::text=a.reason->'acknowledged_inbound'->>'action_id'
    and r.action_version::text=a.reason->'acknowledged_inbound'->>'action_version'
    and r.terminal_status='completed' and r.receipt->>'result'='acknowledged_closed'
    and r.receipt->>'source_message_id'=latest::text
    and r.receipt->'acknowledged_inbound'=a.reason->'acknowledged_inbound')
  then return false; end if;
 end if;
 if v.kind='logged' then return workout_accountability_logged(v.id); end if;
 return not workout_accountability_logged(v.id);
exception when invalid_text_representation then return false;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.prepare_workout_accountability(p_event_id uuid, p_final_text text, p_expected_message_id uuid, p_review jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v workout_accountability_events; e workout_accountability; t ig_threads; a ig_next_actions; latest uuid; closed_action ig_next_actions; closure jsonb;
begin
 select * into v from workout_accountability_events where id=p_event_id for update;
 select * into e from workout_accountability where id=v.enrollment_id;
 if not app_support_event_selected(e.id,v.kind) or v.status is distinct from 'pending' or not workout_accountability_allowed(e.id) or v.enrollment_version<>e.version
 or not workout_accountability_phase_eligible(v.id) or v.attempted_at is not null
 or now()<v.due_at or now()>v.expires_at then raise exception 'Reminder not eligible'; end if;
 if p_final_text is null or length(trim(p_final_text)) not between 1 and 500
 or not coalesce(p_review @> '{"full_thread_reviewed":true,"native_identity_verified":true,"independent_holds_checked":true,"no_duplicate_verified":true}',false)
 then raise exception 'Fresh complete native review required'; end if;
 if e.consent_source='app_preferences' and (not coalesce(p_review @> '{"app_context_reviewed":true,"opt_out_reviewed":true,"live_conversation_reviewed":true}',false)
 or p_review->>'app_consent_revision' is distinct from e.app_consent_revision::text
 or p_review->>'tone' is distinct from (select tone from coaching_support_preferences where user_id=e.user_id)) then raise exception 'Fresh exact app consent, tone, opt-out and live conversation review required'; end if;
 select * into t from ig_threads where id=e.thread_id for update;
 -- Serialize against the shared recipient queue and never replace a healthy owner.
 perform 1 from ig_next_actions where thread_id=t.id for update;
 select id into latest from ig_messages where thread_id=t.id order by created_at desc,id desc limit 1;
 if latest is null or latest is distinct from p_expected_message_id then raise exception 'Latest conversation changed'; end if;
 if exists(select 1 from ig_messages where id=latest and direction='in') then
  closure:=p_review->'acknowledged_inbound';
  if not workout_acknowledged_inbound_proof(t.id,latest,closure) then raise exception 'Answer fresh inbound first'; end if;
  -- Only retire the exact unattempted ready reply covered by this closure.
  select * into closed_action from ig_next_actions where thread_id=t.id and status='ready'
   and action_type='reply_inbound' and owner='dm_manager' and source_message_id=latest
   and claim_token is null and claim_owner is null and claim_run_id is null and claim_expires_at is null
   and coalesce(receipt,'{}')='{}'
   and id::text=closure->>'action_id' and action_version::text=closure->>'action_version'
   and not exists(select 1 from workout_accountability_events other
     where other.action_id=ig_next_actions.id and other.action_version=ig_next_actions.action_version
     and (other.status in ('queued','reserved','uncertain','sent') or other.attempted_at is not null))
   and not exists(select 1 from ig_next_action_receipts r where r.action_id=ig_next_actions.id
     and r.action_version=ig_next_actions.action_version);
  if exists(select 1 from ig_next_actions q where q.thread_id=t.id and q.id is distinct from closed_action.id
   and (q.status in ('ready','waiting','needs_you','blocked','claimed') or (q.status='cooldown' and q.safe_after>now())))
  then return jsonb_build_object('queued',false,'reason','existing_action_owns_thread'); end if;
  if closed_action.id is not null then
   update ig_next_actions set status='completed',completed_at=now(),
    receipt=jsonb_build_object('result','acknowledged_closed','source_message_id',latest,
      'outbound_attempted',false,'no_repeat',true,'acknowledged_inbound',closure)
    where id=closed_action.id;
  elsif not exists(select 1 from ig_next_actions q where q.thread_id=t.id and q.status='completed'
    and q.action_type='reply_inbound' and q.source_message_id=latest
    and q.id::text=closure->>'action_id' and q.action_version::text=closure->>'action_version'
    and q.receipt->>'result'='acknowledged_closed'
    and workout_acknowledged_inbound_proof(t.id,latest,q.receipt->'acknowledged_inbound')) then
   return jsonb_build_object('queued',false,'reason','existing_action_owns_thread');
  end if;
 end if;
 if (v.kind='logged') is distinct from workout_accountability_logged(v.id) then raise exception 'Workout evidence changed'; end if;
 if exists(select 1 from ig_next_actions where thread_id=t.id and (status in ('ready','waiting','needs_you','blocked','claimed')
 or (status='cooldown' and safe_after>now()))) then return jsonb_build_object('queued',false,'reason','existing_action_owns_thread'); end if;
 a:=upsert_ig_next_action(p_thread_id=>t.id,p_ig_username=>t.ig_username,p_lead_state=>'existing_client',p_owner=>'manual',p_action_type=>'reactivation',
 p_priority=>650,p_due_at=>now(),p_reason=>jsonb_build_object('policy','workout_accountability_v1','event_id',v.id,'is_dm',true,
 'cooldown_scope','dm','final_text',p_final_text,'review',p_review,'expected_latest_message_id',latest,'acknowledged_inbound',closure),p_supersede=>false);
 if a.reason->>'event_id' is distinct from v.id::text then return jsonb_build_object('queued',false,'reason','existing_action_owns_thread'); end if;
 update workout_accountability_events set status='queued',action_id=a.id,action_version=a.action_version,expected_message_id=latest,
 receipt=receipt||jsonb_build_object('final_text',p_final_text,'prepared_at',now()) where id=v.id;
 return jsonb_build_object('queued',true,'action',to_jsonb(a));
end;
$function$
;

CREATE OR REPLACE FUNCTION public.refresh_workout_accountability()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare e workout_accountability; s jsonb; d date; workout_at timestamptz; evening_at timestamptz; n integer:=0;
begin
 perform restore_workout_accountability_moves(); perform refresh_client_onboarding_support(); 
 update workout_accountability_events v set status='skipped',receipt=receipt||'{"reason":"support_taper_or_no_logged_session"}'
 where v.status in ('pending','queued') and
 (not app_support_event_selected(v.enrollment_id,v.kind) or not workout_accountability_phase_eligible(v.id) or (v.kind='logged' and v.expires_at<now() and not workout_accountability_logged(v.id)));
 -- Once attempted, a crash is uncertain/no-repeat, never a fresh retry.
 update workout_accountability_events set status='uncertain',receipt=receipt||'{"reason":"attempt_requires_reconciliation"}'
 where status='reserved' and attempted_at<now()-interval '10 minutes';
 update workout_accountability_events set status='expired',receipt=receipt||'{"reason":"missed_delivery_window"}'
 where status in ('pending','queued') and expires_at<now();
 update workout_accountability_events v set status='held',receipt=receipt||'{"reason":"enrollment_changed_or_independent_hold"}'
 from workout_accountability enrolled where enrolled.id=v.enrollment_id and v.status in ('pending','queued')
 and (v.enrollment_version<>enrolled.version or not workout_accountability_allowed(enrolled.id));
 for e in select * from workout_accountability where enabled loop
  d:=(now() at time zone e.timezone)::date;
  if d<e.starts_on or d>e.ends_on then continue; end if;
  for s in select value from jsonb_array_elements(e.schedule) where (value->>'weekday')::int=extract(isodow from d) loop
   workout_at:=(d+(s->>'time')::time) at time zone e.timezone;
   evening_at:=greatest((d+time '20:00') at time zone e.timezone,workout_at+interval '90 minutes');
   insert into workout_accountability_events(enrollment_id,enrollment_version,local_date,session_name,kind,due_at,expires_at)
   select e.id,e.version,d,s->>'session_name',slot.kind,
 case when e.consent_source='app_preferences' and slot.kind='before' then (d+time '08:00') at time zone e.timezone else slot.due_at end,
 case when e.consent_source='app_preferences' and slot.kind='before' then (d+time '10:00') at time zone e.timezone else slot.expires_at end
 from (values
 ('before',greatest((d+time '06:00') at time zone e.timezone,least((d+time '08:00') at time zone e.timezone,workout_at-interval '30 minutes')),least(workout_at+interval '30 minutes',((d+time '08:00') at time zone e.timezone)+interval '2 hours')),
 ('logged',(d+time '06:00') at time zone e.timezone,(d+time '22:30') at time zone e.timezone),
 ('evening',evening_at,(d+time '22:30') at time zone e.timezone)) slot(kind,due_at,expires_at)
 where app_support_event_selected(e.id,slot.kind)
   on conflict do nothing;
  end loop;
  
 update workout_accountability_events v set status='skipped',receipt=receipt||'{"reason":"support_taper"}'
 where v.enrollment_id=e.id and v.status in ('pending','queued') and not workout_accountability_phase_eligible(v.id);
 -- Weekly review is prepared by the sole operator, not an automatic voice send.
  if extract(isodow from d)=6 then
   insert into coach_alerts(coach_id,client_id,client_name,alert_type,priority,status,title,description,idempotency_key,data)
   select e.coach_id,e.user_id,t.profile_name,'follow_up_review','medium','pending','Weekly coaching review due',
    'Consented organic coaching member: review the current week with the weekly-client-checkin skill before composing.',
    'workout_accountability_weekly:'||e.id||':'||date_trunc('week',d)::date,
    jsonb_build_object('workout_accountability_weekly',true,'enrollment_id',e.id,'ig_thread_id',e.thread_id,'operator_queue','needs_you','review_week',date_trunc('week',d)::date)
   from ig_threads t where t.id=e.thread_id and workout_accountability_allowed(e.id)
   on conflict(idempotency_key) where idempotency_key is not null do nothing;
  end if;
 end loop;
 update workout_accountability_events v set status='skipped',receipt=receipt||'{"reason":"matching_workout_logged"}'
 where v.status in ('pending','queued') and v.kind in ('before','evening') and workout_accountability_logged(v.id);
 -- Retire only this exact unattempted event/version, so an expired reminder
 -- cannot occupy the shared recipient queue and block the next real inbound.
 update ig_next_actions a set status='cancelled',completed_at=now(),
 receipt=a.receipt||jsonb_build_object('workout_reminder_retired',true,'no_repeat',true),
 claim_owner=null,claim_token=null,claim_run_id=null,claim_expires_at=null
 from workout_accountability_events v
 where a.id=v.action_id and a.action_version=v.action_version
 and a.reason->>'policy'='workout_accountability_v1' and a.reason->>'event_id'=v.id::text
 and v.status in ('expired','skipped','held') and v.attempted_at is null and a.status in ('ready','waiting','claimed');
 -- Keep failures visible to Shannon independently of local desktop wake timing.
 insert into coach_alerts(coach_id,client_id,client_name,alert_type,priority,status,title,description,idempotency_key,data)
 select enrolled.coach_id,enrolled.user_id,t.profile_name,'follow_up_review','medium','pending','Workout reminder needs attention',
  'A reminder expired or its delivery is uncertain. Reconcile; do not send a stale reminder or retry an uncertain attempt.',
  'workout_accountability_failure:'||v.id,jsonb_build_object('workout_accountability_event_id',v.id,'delivery_state',v.status,'operator_queue','needs_you')
 from workout_accountability_events v join workout_accountability enrolled on enrolled.id=v.enrollment_id join ig_threads t on t.id=enrolled.thread_id
 where v.status in ('expired','uncertain') on conflict(idempotency_key) where idempotency_key is not null do nothing;
 select count(*) into n from workout_accountability_events v join workout_accountability enrolled on enrolled.id=v.enrollment_id
 where v.status='pending' and v.due_at<=now() and v.expires_at>now() and app_support_event_selected(enrolled.id,v.kind) and workout_accountability_allowed(enrolled.id)
 and (v.kind<>'logged' or workout_accountability_logged(v.id));
 return jsonb_build_object('due',n,'sender','existing_meta_business_suite_operator');
end;
$function$
;

CREATE OR REPLACE FUNCTION public.workout_accountability_allowed(p_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
 select exists(select 1 from workout_accountability e join ig_threads t on t.id=e.thread_id
 join users u on u.id=e.user_id where e.id=p_id and e.enabled
 and (e.consent_source='instagram_inbound' or (t.channel='instagram' and exists(select 1 from coaching_support_preferences s join custom_workout_programs p on p.id=e.app_program_id and p.user_id=e.user_id and p.is_active and p.updated_at=e.app_program_updated_at where s.user_id=e.user_id and s.revision=e.app_consent_revision and s.consent_version='support_choices_20261101_v1' and (s.morning_training or s.after_session))))
 and t.linked_user_id=e.user_id and t.coach_id=e.coach_id
 and (t.channel='instagram' and nullif(t.ig_username,'') is not null or t.channel='messenger' and nullif(t.subscriber_id,'') is not null) and free_coaching_thread_allowed(t.id)
 and exists(select 1 from coach_clients c where c.coach_id=e.coach_id and c.client_id=e.user_id and c.status='active' and c.ended_at is null)
 and not exists(select 1 from balance_free_coaching_setups s join balance_free_starters g on g.id=s.grant_id where s.thread_id=t.id and (g.revoked_at is not null or g.ends_at<=now()))
 and coalesce(u.is_test_account,false)=false and u.onboarding_complete is true
 and (now() at time zone e.timezone)::date between e.starts_on and e.ends_on
 and not exists(select 1 from ig_threads x where (x.linked_user_id=e.user_id or lower(x.ig_username)=lower(t.ig_username))
   and exists(select 1 from jsonb_each(coalesce(x.custom_data,'{}')) f
    where f.key in ('manual_only','manual_review_only','friend_manual_only','codex_ai_opt_out','ai_automation_opt_out',
     'do_not_follow_up','blocked_by_shannon','human_takeover','personal_outreach','needs_shannon','safety_hold','authenticity_hold','permanent_needs_you_draft_only',
     'no_ai_send','no_ai_schedule','do_not_auto_send') and (f.value='true'::jsonb or f.value->>'enabled'='true')))
 and not exists(select 1 from ig_threads x where x.linked_user_id=e.user_id and x.custom_data->>'client_community_support_enabled'='false')
 and not exists(select 1 from ig_personal_contacts p where lower(p.ig_username)=lower(t.ig_username))
 and not exists(select 1 from client_memory m where m.client_id=e.user_id and
   (m.preferences->>'manual_only'='true' or m.preferences->>'permanent_needs_you_draft_only'='true'))
 );
$function$
;

CREATE OR REPLACE FUNCTION public.workout_accountability_due()
 RETURNS SETOF jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
 select to_jsonb(v)||jsonb_build_object('thread_id',e.thread_id,'user_id',e.user_id,'timezone',e.timezone,'schedule',e.schedule,
 'consent_message_id',e.consent_message_id,'consent_source',e.consent_source,'app_preferences',(select to_jsonb(s) from coaching_support_preferences s where s.user_id=e.user_id),'program_id',e.app_program_id) from workout_accountability_events v join workout_accountability e on e.id=v.enrollment_id
 where v.status='pending' and v.enrollment_version=e.version and v.due_at<=now() and v.expires_at>now()
 and app_support_event_selected(e.id,v.kind) and workout_accountability_allowed(e.id) and workout_accountability_phase_eligible(v.id) and (v.kind<>'logged' or workout_accountability_logged(v.id))
 order by v.due_at limit 30;
$function$
;

