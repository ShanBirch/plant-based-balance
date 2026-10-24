-- Service-only scheduling. The existing MBS operator remains the sole sender.
create table public.workout_accountability (
 id uuid primary key default gen_random_uuid(),
 thread_id uuid not null unique references public.ig_threads(id),
 user_id uuid not null references public.users(id),
 coach_id uuid not null references public.users(id),
 timezone text not null,
 schedule jsonb not null check (jsonb_typeof(schedule)='array'),
 consent_message_id uuid not null references public.ig_messages(id),
 consent_review jsonb not null,
 starts_on date not null,
 ends_on date not null check(ends_on>=starts_on),
 enabled boolean not null default true,
 version integer not null default 1,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table public.workout_accountability_events (
 id uuid primary key default gen_random_uuid(),
 enrollment_id uuid not null references public.workout_accountability(id),
 enrollment_version integer not null,
 local_date date not null,
 session_name text not null,
 kind text not null check(kind in ('before','logged','evening')),
 due_at timestamptz not null,
 expires_at timestamptz not null,
 status text not null default 'pending' check(status in ('pending','queued','reserved','sent','uncertain','skipped','expired','held')),
 action_id uuid,
 action_version integer,
 claim_token uuid,
 expected_message_id uuid,
 attempted_at timestamptz,
 receipt jsonb not null default '{}',
 created_at timestamptz not null default now(),
 unique(enrollment_id,local_date,kind)
);
create index workout_accountability_due on public.workout_accountability_events(due_at) where status in ('pending','queued');
alter table public.workout_accountability enable row level security;
alter table public.workout_accountability_events enable row level security;
revoke all on public.workout_accountability,public.workout_accountability_events from public,anon,authenticated;
grant all on public.workout_accountability,public.workout_accountability_events to service_role;

create function public.workout_accountability_allowed(p_id uuid) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from workout_accountability e join ig_threads t on t.id=e.thread_id
 join users u on u.id=e.user_id where e.id=p_id and e.enabled
 and t.linked_user_id=e.user_id and t.coach_id=e.coach_id
 and t.channel='instagram' and nullif(t.ig_username,'') is not null
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
$$;

create function public.configure_workout_accountability(p_thread_id uuid,p_consent_message_id uuid,
 p_timezone text,p_schedule jsonb,p_starts_on date,p_ends_on date,p_review jsonb) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare t ig_threads; s jsonb; result uuid;
begin
 select * into t from ig_threads where id=p_thread_id for update;
 if t.linked_user_id is null or t.channel<>'instagram' then raise exception 'Verified linked Instagram account required'; end if;
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
 consent_review=excluded.consent_review,starts_on=excluded.starts_on,ends_on=excluded.ends_on,enabled=true,
 version=workout_accountability.version+1,updated_at=now() returning id into result;
 if not workout_accountability_allowed(result) then raise exception 'Existing client/manual/safety hold prevents reminders'; end if;
 update workout_accountability_events set status='skipped',receipt=receipt||'{"reason":"schedule_changed"}' where enrollment_id=result and status in ('pending','queued');
 return result;
end;
$$;

-- Finish Workout writes history; describe a matching logged session, never infer
-- attendance or full programme completion from a calendar visit or elapsed time.
create function public.workout_accountability_logged(p_event_id uuid) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from workout_accountability_events v join workout_accountability e on e.id=v.enrollment_id
 join workouts w on w.user_id=e.user_id and w.workout_date=v.local_date and w.template_name=v.session_name
 where v.id=p_event_id and w.workout_type='history' and w.created_at>=e.created_at
 and (coalesce(w.reps,'')~'[1-9]' or coalesce(w.time_duration,'')~'[1-9]'));
$$;

create function public.refresh_workout_accountability() returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare e workout_accountability; s jsonb; d date; workout_at timestamptz; evening_at timestamptz; n integer:=0;
begin
 -- Once attempted, a crash is uncertain/no-repeat, never a fresh retry.
 update workout_accountability_events set status='uncertain',receipt=receipt||'{"reason":"attempt_requires_reconciliation"}'
 where status='reserved' and attempted_at<now()-interval '10 minutes';
 update workout_accountability_events set status='expired',receipt=receipt||'{"reason":"missed_delivery_window"}'
 where status in ('pending','queued') and expires_at<now();
 for e in select * from workout_accountability where enabled loop
  d:=(now() at time zone e.timezone)::date;
  if d<e.starts_on or d>e.ends_on then continue; end if;
  for s in select value from jsonb_array_elements(e.schedule) where (value->>'weekday')::int=extract(isodow from d) loop
   workout_at:=(d+(s->>'time')::time) at time zone e.timezone;
   evening_at:=greatest((d+time '20:00') at time zone e.timezone,workout_at+interval '90 minutes');
   insert into workout_accountability_events(enrollment_id,enrollment_version,local_date,session_name,kind,due_at,expires_at)
   values(e.id,e.version,d,s->>'session_name','before',workout_at-interval '30 minutes',workout_at+interval '30 minutes'),
    (e.id,e.version,d,s->>'session_name','logged',workout_at-interval '30 minutes',(d+time '22:30') at time zone e.timezone),
    (e.id,e.version,d,s->>'session_name','evening',evening_at,(d+time '22:30') at time zone e.timezone)
   on conflict do nothing;
  end loop;
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
 -- Keep failures visible to Shannon independently of local desktop wake timing.
 insert into coach_alerts(coach_id,client_id,client_name,alert_type,priority,status,title,description,idempotency_key,data)
 select enrolled.coach_id,enrolled.user_id,t.profile_name,'follow_up_review','medium','pending','Workout reminder needs attention',
  'A reminder expired or its delivery is uncertain. Reconcile; do not send a stale reminder or retry an uncertain attempt.',
  'workout_accountability_failure:'||v.id,jsonb_build_object('workout_accountability_event_id',v.id,'delivery_state',v.status,'operator_queue','needs_you')
 from workout_accountability_events v join workout_accountability enrolled on enrolled.id=v.enrollment_id join ig_threads t on t.id=enrolled.thread_id
 where v.status in ('expired','uncertain') on conflict(idempotency_key) where idempotency_key is not null do nothing;
 select count(*) into n from workout_accountability_events v join workout_accountability enrolled on enrolled.id=v.enrollment_id
 where v.status='pending' and v.due_at<=now() and v.expires_at>now() and workout_accountability_allowed(enrolled.id)
 and (v.kind<>'logged' or workout_accountability_logged(v.id));
 return jsonb_build_object('due',n,'sender','existing_meta_business_suite_operator');
end;
$$;

create function public.workout_accountability_due() returns setof jsonb
language sql stable security definer set search_path=public,pg_temp as $$
 select to_jsonb(v)||jsonb_build_object('thread_id',e.thread_id,'user_id',e.user_id,'timezone',e.timezone,'schedule',e.schedule,
 'consent_message_id',e.consent_message_id) from workout_accountability_events v join workout_accountability e on e.id=v.enrollment_id
 where v.status='pending' and v.enrollment_version=e.version and v.due_at<=now() and v.expires_at>now()
 and workout_accountability_allowed(e.id) and (v.kind<>'logged' or workout_accountability_logged(v.id))
 order by v.due_at limit 30;
$$;

create function public.ig_workout_accountability_action_eligible(a public.ig_next_actions) returns boolean
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v workout_accountability_events; e workout_accountability; latest uuid;
begin
 if a.owner<>'manual' or a.action_type<>'reactivation' or a.reason->>'policy' is distinct from 'workout_accountability_v1' then return false; end if;
 select * into v from workout_accountability_events where id=(a.reason->>'event_id')::uuid;
 select * into e from workout_accountability where id=v.enrollment_id;
 if v.id is null or e.id is null or a.thread_id<>e.thread_id or a.id is distinct from v.action_id or a.action_version is distinct from v.action_version
 or v.status not in ('queued','reserved') or v.enrollment_version<>e.version or not workout_accountability_allowed(e.id)
 or now()<v.due_at or now()>v.expires_at then return false; end if;
 if v.status='reserved' and v.claim_token is distinct from a.claim_token then return false; end if;
 select id into latest from ig_messages where thread_id=e.thread_id order by created_at desc,id desc limit 1;
 if latest is distinct from v.expected_message_id then return false; end if;
 if v.kind='logged' then return workout_accountability_logged(v.id); end if;
 return not workout_accountability_logged(v.id);
exception when invalid_text_representation then return false;
end;
$$;

create function public.prepare_workout_accountability(p_event_id uuid,p_final_text text,p_expected_message_id uuid,p_review jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare v workout_accountability_events; e workout_accountability; t ig_threads; a ig_next_actions; latest uuid;
begin
 select * into v from workout_accountability_events where id=p_event_id for update;
 select * into e from workout_accountability where id=v.enrollment_id;
 if v.status is distinct from 'pending' or not workout_accountability_allowed(e.id) or v.enrollment_version<>e.version
 or now()<v.due_at or now()>v.expires_at then raise exception 'Reminder not eligible'; end if;
 if p_final_text is null or length(trim(p_final_text)) not between 1 and 500
 or not coalesce(p_review @> '{"full_thread_reviewed":true,"native_identity_verified":true,"independent_holds_checked":true,"no_duplicate_verified":true}',false)
 then raise exception 'Fresh complete native review required'; end if;
 select * into t from ig_threads where id=e.thread_id;
 select id into latest from ig_messages where thread_id=t.id order by created_at desc,id desc limit 1;
 if latest is null or latest is distinct from p_expected_message_id then raise exception 'Latest conversation changed'; end if;
 if exists(select 1 from ig_messages where id=latest and direction='in') then raise exception 'Answer fresh inbound first'; end if;
 if (v.kind='logged') is distinct from workout_accountability_logged(v.id) then raise exception 'Workout evidence changed'; end if;
 if exists(select 1 from ig_next_actions where thread_id=t.id and (status in ('ready','waiting','needs_you','blocked','claimed')
 or (status='cooldown' and safe_after>now()))) then return jsonb_build_object('queued',false,'reason','existing_action_owns_thread'); end if;
 a:=upsert_ig_next_action(p_thread_id=>t.id,p_ig_username=>t.ig_username,p_lead_state=>'existing_client',p_owner=>'manual',p_action_type=>'reactivation',
 p_priority=>650,p_due_at=>now(),p_reason=>jsonb_build_object('policy','workout_accountability_v1','event_id',v.id,'is_dm',true,
 'cooldown_scope','dm','final_text',p_final_text,'review',p_review,'expected_latest_message_id',latest),p_supersede=>false);
 if a.reason->>'event_id' is distinct from v.id::text then return jsonb_build_object('queued',false,'reason','existing_action_owns_thread'); end if;
 update workout_accountability_events set status='queued',action_id=a.id,action_version=a.action_version,expected_message_id=latest,
 receipt=receipt||jsonb_build_object('final_text',p_final_text,'prepared_at',now()) where id=v.id;
 return jsonb_build_object('queued',true,'action',to_jsonb(a));
end;
$$;

create function public.reserve_workout_accountability(p_event_id uuid,p_action_id uuid,p_claim_token uuid,p_run_id text,p_tab_id text) returns boolean
language plpgsql security definer set search_path=public,pg_temp as $$
declare v workout_accountability_events; a ig_next_actions;
begin
 select * into v from workout_accountability_events where id=p_event_id for update;
 select * into a from ig_next_actions where id=p_action_id;
 if v.status is distinct from 'queued' or v.action_id is distinct from a.id or a.claim_token is distinct from p_claim_token
 or not ig_workout_accountability_action_eligible(a)
 or not ig_browser_action_owned(p_run_id,'meta_business_suite',p_tab_id,a.id,a.action_version,p_claim_token,a.source_message_id) then return false; end if;
 update workout_accountability_events set status='reserved',attempted_at=now(),claim_token=p_claim_token where id=v.id;
 return true;
end;
$$;

create function public.record_workout_accountability(p_event_id uuid,p_claim_token uuid,p_status text,p_receipt jsonb) returns boolean
language plpgsql security definer set search_path=public,pg_temp as $$
declare v workout_accountability_events; e workout_accountability; a ig_next_actions;
begin
 select * into v from workout_accountability_events where id=p_event_id for update;
 if v.status not in ('reserved','uncertain') or v.claim_token is distinct from p_claim_token or p_status not in ('sent','uncertain') then return false; end if;
 select * into e from workout_accountability where id=v.enrollment_id;
 select * into a from ig_next_actions where id=v.action_id;
 if p_status='sent' and (p_receipt->>'native_verified' is distinct from 'true' or not exists(select 1 from ig_messages m
 where m.id=(p_receipt->>'canonical_message_id')::uuid and m.thread_id=e.thread_id and m.direction='out'
 and m.id is distinct from v.expected_message_id and m.text=v.receipt->>'final_text'
 and m.created_at>=v.attempted_at-interval '5 seconds')) then return false; end if;
 update workout_accountability_events set status=p_status,receipt=receipt||p_receipt||jsonb_build_object('recorded_at',now(),'no_repeat',true) where id=v.id;
 return true;
end;
$$;

-- Extend only the existing native surface allow-list. The new predicate checks
-- consent, event/version, current identity, expiry, exact source and reservation.
do $$ declare n text; definition text; needle text; begin
 foreach n in array array['claim_ig_next_actions','ig_browser_action_owned'] loop
  select pg_get_functiondef(oid) into definition from pg_proc where pronamespace='public'::regnamespace and proname=n;
  needle:=case n when 'claim_ig_next_actions' then 'public.ig_mbs_user_requested_checkin_eligible(q)' else 'public.ig_mbs_user_requested_checkin_eligible(a)' end;
  if position(needle in definition)=0 then raise exception 'Existing native ownership contract changed: %',n; end if;
  definition:=replace(definition,needle,'('||needle||' OR public.ig_workout_accountability_action_eligible('||case n when 'claim_ig_next_actions' then 'q' else 'a' end||'))');
  execute definition;
 end loop;
end $$;

do $$ declare f record; begin
 for f in select oid::regprocedure signature from pg_proc where pronamespace='public'::regnamespace and
 (proname like '%workout_accountability%' or proname='ig_workout_accountability_action_eligible') loop
  execute format('revoke all on function %s from public,anon,authenticated',f.signature);
  execute format('grant execute on function %s to service_role',f.signature);
 end loop;
end $$;
select cron.schedule('balance-workout-accountability','*/5 * * * *','select public.refresh_workout_accountability()');
