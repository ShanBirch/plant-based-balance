-- Shannon, 3 November 2026: Joanne and new outreach clients only. Reuse the
-- existing five-minute materialiser and sole native sender, not a second sender.
create table public.missed_workout_followup (
 user_id uuid primary key references public.users(id),
 enrollment_id uuid not null unique references public.workout_accountability(id),
 program_id uuid not null references public.custom_workout_programs(id),
 enabled boolean not null default true,
 starts_at timestamptz not null default now(),
 authority_review jsonb not null,
 created_at timestamptz not null default now()
);
alter table public.missed_workout_followup enable row level security;
revoke all on public.missed_workout_followup from public,anon,authenticated;
grant all on public.missed_workout_followup to service_role;

create function public.missed_workout_followup_selected(p_enrollment uuid) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from missed_workout_followup f
 join workout_accountability e on e.id=f.enrollment_id and e.user_id=f.user_id
 join custom_workout_programs p on p.id=f.program_id and p.user_id=f.user_id and p.is_active
 where e.id=p_enrollment and f.enabled and now()>=f.starts_at
 and organic_outreach_cohort_allowed(f.user_id) and workout_accountability_allowed(e.id)
 -- New choices never resurrect older consent. Both-off/after-session-off wins.
 and not exists(select 1 from coaching_support_preferences s where s.user_id=f.user_id and not s.after_session));
$$;

-- Count attempted optional workout contacts, not just successful sends, across
-- enrollment revisions. Human outbounds/read receipts never reset the streak.
-- Exclude this exact event so the third reserved send remains ownable.
create function public.missed_workout_unanswered_count(p_enrollment uuid,p_event uuid default null) returns integer
language sql stable security definer set search_path=public,pg_temp as $$
 select count(*)::integer from workout_accountability_events v
 join workout_accountability e on e.id=v.enrollment_id
 join missed_workout_followup f on f.user_id=e.user_id
 where f.enrollment_id=p_enrollment and v.id is distinct from p_event
 and v.attempted_at is not null
 and v.attempted_at>coalesce((select max(m.created_at) from ig_messages m
 join ig_threads t on t.id=m.thread_id where t.linked_user_id=f.user_id and m.direction='in'),'-infinity'::timestamptz);
$$;

-- An absent log is an offer to help, never evidence they actually skipped it.
-- Check the current app calendar on each eligibility/read/ownership boundary.
create function public.missed_workout_event_eligible(p_event uuid) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from workout_accountability_events v
 join workout_accountability e on e.id=v.enrollment_id
 join missed_workout_followup f on f.enrollment_id=e.id
 join custom_workout_programs p on p.id=f.program_id and p.user_id=e.user_id and p.is_active
 where v.id=p_event and v.kind='evening' and missed_workout_followup_selected(e.id)
 and v.local_date=(now() at time zone e.timezone)::date
 and v.due_at>=f.starts_at and v.enrollment_version=e.version
 and jsonb_typeof(p.weekly_schedule)='array'
 and exists(select 1 from jsonb_array_elements(p.weekly_schedule) day
 join jsonb_array_elements(e.schedule) slot on slot->>'session_name'=day->'workout'->>'name'
 where lower(left(day->>'day',3))=(array['mon','tue','wed','thu','fri','sat','sun'])[extract(isodow from v.local_date)::int]
 and (slot->>'weekday')::int=extract(isodow from v.local_date)
 and slot->>'session_name'=v.session_name
 and lower(coalesce(day->'workout'->>'type','rest')) not in ('rest','recovery','yoga')
 and lower(coalesce(day->'workout'->>'name','')) not in ('rest','rest day','recovery','yoga')
 and (nullif(day->>'time','') is null or day->>'time'=slot->>'time'))
 -- Even partial/other logged activity should be reviewed rather than chased.
 and not exists(select 1 from workouts w where w.user_id=e.user_id and w.workout_date=v.local_date and w.workout_type='history')
 and not exists(select 1 from workout_accountability_events other where other.enrollment_id=e.id
 and other.local_date=v.local_date and other.kind in ('logged','evening') and other.id<>v.id and other.attempted_at is not null));
$$;

create function public.configure_missed_workout_followup(p_enrollment uuid,p_program uuid,p_review jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare e workout_accountability; p custom_workout_programs; f missed_workout_followup; target_due timestamptz; d date;
begin
 select * into e from workout_accountability where id=p_enrollment for update;
 select * into p from custom_workout_programs where id=p_program and user_id=e.user_id and is_active;
 if e.id is null or p.id is null or not organic_outreach_cohort_allowed(e.user_id)
 or not workout_accountability_allowed(e.id) then raise exception 'Verified active new-cohort enrollment and saved program required'; end if;
 if not coalesce(p_review @> '{"shannon_authorized":true,"exact_identity_verified":true,"current_program_reviewed":true,"support_choices_reviewed":true,"independent_holds_checked":true}',false)
 or nullif(p_review->>'reviewed_by','') is null then raise exception 'Exact current source review required'; end if;
 if exists(select 1 from coaching_support_preferences s where s.user_id=e.user_id and not s.after_session) then raise exception 'Saved support choice excludes missed-workout follow-up'; end if;
 insert into missed_workout_followup(user_id,enrollment_id,program_id,authority_review)
 values(e.user_id,e.id,p.id,p_review)
 on conflict(user_id) do update set enrollment_id=excluded.enrollment_id,program_id=excluded.program_id,
 authority_review=excluded.authority_review,enabled=true
 -- Preserve starts_at and all attempt history; reconfiguration cannot reset cap.
 returning * into f;
 -- Adjust only an untouched future event, never a queued/attempted/expired one.
 d:=(now() at time zone e.timezone)::date;
 select greatest((d+time '19:30') at time zone e.timezone,
 (d+(slot->>'time')::time) at time zone e.timezone+interval '90 minutes') into target_due
 from jsonb_array_elements(e.schedule) slot where (slot->>'weekday')::int=extract(isodow from d);
 if target_due>now() then
  update workout_accountability_events set due_at=target_due where enrollment_id=e.id
  and local_date=d and kind='evening' and status='pending' and attempted_at is null and action_id is null and due_at>now();
 end if;
 return to_jsonb(f);
end;
$$;

-- A policy row also disables the legacy evening permission, including when
-- withdrawn. Historical members without a row keep their existing arrangements.
create or replace function public.app_support_event_selected(p_enrollment uuid,p_kind text) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
 select case when p_kind='evening' and exists(select 1 from missed_workout_followup f where f.enrollment_id=p_enrollment)
 then missed_workout_followup_selected(p_enrollment)
 else exists(select 1 from workout_accountability e where e.id=p_enrollment and
 ((e.consent_source='instagram_inbound' and not (organic_outreach_cohort_allowed(e.user_id)
   and exists(select 1 from coaching_support_preferences s where s.user_id=e.user_id)))
 or (e.consent_source='app_preferences' and exists(select 1 from coaching_support_preferences s
 where s.user_id=e.user_id and s.revision=e.app_consent_revision and s.consent_version='support_choices_20261101_v1'
 and ((p_kind='before' and s.morning_training) or (p_kind='logged' and s.after_session)))))) end;
$$;

create or replace function public.workout_accountability_phase_eligible(p_event uuid) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from workout_accountability_events v join workout_accountability e on e.id=v.enrollment_id
 where v.id=p_event and (v.kind='evening' or (v.kind='before' and v.local_date<e.starts_on+7)
 or (v.kind='logged' and v.local_date<e.starts_on+14))
 and (not exists(select 1 from missed_workout_followup f where f.enrollment_id=e.id)
 or (missed_workout_unanswered_count(e.id,v.id)<3
 and (v.kind<>'evening' or missed_workout_event_eligible(v.id)))));
$$;

-- Serialize the last-moment budget check. A failed/uncertain attempt consumes
-- one place too. Selection alone cannot race two workers past the ceiling.
create function public.guard_missed_workout_attempt() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare f missed_workout_followup;
begin
 if new.attempted_at is null or (tg_op='UPDATE' and old.attempted_at is not null) then return new; end if;
 select * into f from missed_workout_followup where enrollment_id=new.enrollment_id for update;
 if f.user_id is null then return new; end if;
 if missed_workout_unanswered_count(new.enrollment_id,new.id)>=3 then raise exception 'Three unanswered workout contacts; await a real member reply'; end if;
 if new.kind='evening' and not missed_workout_event_eligible(new.id) then raise exception 'Missed-workout purpose is no longer eligible'; end if;
 return new;
end;
$$;
create trigger missed_workout_attempt_budget before insert or update of attempted_at on public.workout_accountability_events
 for each row execute function public.guard_missed_workout_attempt();

-- Require explicit fresh review at preparation, in addition to ordinary
-- native identity, exact source/version, claims, holds and no-repeat checks.
do $$ declare definition text; needle text; begin
 select pg_get_functiondef('public.prepare_workout_accountability(uuid,text,uuid,jsonb)'::regprocedure) into definition;
 needle:=' if p_final_text is null or length(trim(p_final_text)) not between 1 and 500';
 if position(needle in definition)=0 then raise exception 'Preparation contract changed; review before installation'; end if;
 definition:=replace(definition,needle,$patch$
 if v.kind='evening' and exists(select 1 from missed_workout_followup f where f.enrollment_id=e.id) then
  if not coalesce(p_review @> '{"app_context_reviewed":true,"opt_out_reviewed":true,"live_conversation_reviewed":true,"cross_channel_contact_reviewed":true,"no_completion_reported":true,"not_in_progress":true,"purpose_not_already_covered":true}',false)
  or nullif(p_review->>'reviewed_by','') is null then raise exception 'Fresh app, conversation, purpose and cross-channel review required'; end if;
 end if;
 if p_final_text is null or length(trim(p_final_text)) not between 1 and 500$patch$);
 execute definition;
end $$;

-- Existing clients retain 20:00. This new lane uses 19:30 in the member's
-- verified timezone, never earlier than 90 minutes after their planned start.
do $$ declare definition text; needle text; begin
 select pg_get_functiondef('public.refresh_workout_accountability()'::regprocedure) into definition;
 needle:='evening_at:=greatest((d+time ''20:00'') at time zone e.timezone,workout_at+interval ''90 minutes'');';
 if position(needle in definition)=0 then raise exception 'Materialiser timing contract changed'; end if;
 definition:=replace(definition,needle,$patch$evening_at:=greatest((d+case when exists(select 1 from missed_workout_followup f where f.enrollment_id=e.id)
 then time '19:30' else time '20:00' end) at time zone e.timezone,workout_at+interval '90 minutes');$patch$);
 execute definition;
end $$;

do $$ declare f regprocedure; begin
 for f in select oid::regprocedure from pg_proc where pronamespace='public'::regnamespace
 and proname in ('missed_workout_followup_selected','missed_workout_unanswered_count','missed_workout_event_eligible',
 'configure_missed_workout_followup','guard_missed_workout_attempt','workout_accountability_phase_eligible') loop
 execute format('revoke all on function %s from public,anon,authenticated',f);
 execute format('grant execute on function %s to service_role',f);
 end loop;
end $$;
