-- Additive, service-only intake. Existing promises and sender/worker gates survive.
create table public.balance_coaching_challenge_intakes (
 id text primary key,
 capacity integer not null check(capacity=6),
 duration_days integer not null check(duration_days=28),
 opened_at timestamptz not null default now(),
 enabled boolean not null default true
);
insert into public.balance_coaching_challenge_intakes(id,capacity,duration_days)
values('consistency_20261025',6,28);

create table public.balance_coaching_challenge_enrolments (
 id uuid primary key default gen_random_uuid(),
 intake_id text not null references public.balance_coaching_challenge_intakes(id),
 thread_id uuid not null unique references public.ig_threads(id),
 identity_key text not null,
 acceptance_message_id uuid not null references public.ig_messages(id),
 review jsonb not null,
 accepted_at timestamptz not null default now(),
 unique(intake_id,identity_key)
);
create table public.balance_coaching_challenge_milestones (
 enrolment_id uuid not null references public.balance_coaching_challenge_enrolments(id),
 milestone text not null check(milestone in ('first_workout_completed','week_1_review','week_2_review','week_3_review','week_4_review','paid_agreement','payment_confirmed','withdrawn')),
 source_reference text not null check(length(trim(source_reference))>0),
 summary text not null check(length(trim(summary))>0),
 reviewed_by text not null check(length(trim(reviewed_by))>0),
 recorded_at timestamptz not null default now(),
 primary key(enrolment_id,milestone)
);
alter table public.balance_coaching_challenge_intakes enable row level security;
alter table public.balance_coaching_challenge_enrolments enable row level security;
alter table public.balance_coaching_challenge_milestones enable row level security;
revoke all on public.balance_coaching_challenge_intakes,public.balance_coaching_challenge_enrolments,public.balance_coaching_challenge_milestones from public,anon,authenticated;
grant all on public.balance_coaching_challenge_intakes,public.balance_coaching_challenge_enrolments,public.balance_coaching_challenge_milestones to service_role;

create function public.balance_coaching_challenge_status(p_intake_id text default 'consistency_20261025')
returns jsonb language sql stable security invoker set search_path=public,pg_temp as $$
 select jsonb_build_object('intake_id',i.id,'capacity',i.capacity,'duration_days',i.duration_days,
 'enabled',i.enabled,'accepted',count(e.id),'remaining',greatest(0,i.capacity-count(e.id)),
 'open',i.enabled and count(e.id)<i.capacity,
 'queued',count(j.id),'prepared',count(j.id) filter(where j.status='prepared'),
 'claimed',count(g.claimed_at),'onboarded',count(u.id) filter(where u.onboarding_complete))
 from balance_coaching_challenge_intakes i
 left join balance_coaching_challenge_enrolments e on e.intake_id=i.id
 left join balance_free_coaching_jobs j on j.thread_id=e.thread_id
 left join balance_free_coaching_setups s on s.thread_id=e.thread_id
 left join balance_free_starters g on g.id=s.grant_id
 left join users u on u.id=g.user_id
 where i.id=p_intake_id group by i.id;
$$;

create function public.reserve_balance_coaching_challenge(p_thread_id uuid,p_acceptance_message_id uuid,p_review jsonb)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare i balance_coaching_challenge_intakes; t ig_threads; e balance_coaching_challenge_enrolments; identity text; source_id jsonb;
begin
 -- All reservations take this single lock before checking capacity.
 select * into i from balance_coaching_challenge_intakes where id='consistency_20261025' for update;
 select * into t from ig_threads where id=p_thread_id for update;
 if t.id is null or not free_coaching_thread_allowed(t.id) then raise exception 'Current identity and independent hold review required'; end if;
 select * into e from balance_coaching_challenge_enrolments where thread_id=t.id;
 if e.id is not null then return to_jsonb(e); end if;
 if t.linked_user_id is not null or exists(select 1 from balance_free_starters where thread_id=t.id)
 or exists(select 1 from balance_free_coaching_jobs where thread_id=t.id) then raise exception 'Preserve existing coaching agreements'; end if;
 if not i.enabled or (select count(*) from balance_coaching_challenge_enrolments where intake_id=i.id)>=i.capacity then raise exception 'The six-person challenge intake is full or closed'; end if;
 if not exists(select 1 from ig_messages where id=p_acceptance_message_id and thread_id=t.id and direction='in' and created_at>=i.opened_at)
 then raise exception 'Exact new inbound challenge acceptance required'; end if;
 if coalesce(t.custom_data->>'acquisition_mode','')='paid_meta' then raise exception 'Preserve the paid acquisition offer'; end if;
 if not coalesce(p_review @> '{"full_thread_reviewed":true,"organic_fit_verified":true,"routine_understood":true,"existing_support_understood":true,"help_wanted":true,"terms_disclosed":true,"explicit_challenge_acceptance":true,"independent_holds_checked":true}',false)
 or nullif(trim(p_review->>'reviewed_by'),'') is null
 or nullif(trim(p_review->>'routine_summary'),'') is null
 or nullif(trim(p_review->>'existing_support_summary'),'') is null
 or nullif(trim(p_review->>'help_wanted_summary'),'') is null
 then raise exception 'Reviewed routine, existing support, wanted help and disclosed challenge terms required'; end if;
 if jsonb_typeof(p_review->'source_message_ids') is distinct from 'array' or jsonb_array_length(p_review->'source_message_ids')=0
 then raise exception 'Inbound discovery source evidence required'; end if;
 for source_id in select value from jsonb_array_elements(p_review->'source_message_ids') loop
  if not exists(select 1 from ig_messages where id=(source_id#>>'{}')::uuid and thread_id=t.id and direction='in')
  then raise exception 'Discovery source belongs to another conversation'; end if;
 end loop;
 identity:=t.coach_id::text||':'||case when nullif(trim(t.ig_username),'') is not null then 'ig:'||lower(trim(t.ig_username))
 else t.channel||':'||coalesce(nullif(t.subscriber_id,''),t.id::text) end;
 if exists(select 1 from balance_coaching_challenge_enrolments where intake_id=i.id and identity_key=identity)
 then raise exception 'This person already has a challenge place; reconcile their canonical conversation'; end if;
 insert into balance_coaching_challenge_enrolments(intake_id,thread_id,identity_key,acceptance_message_id,review)
 values(i.id,t.id,identity,p_acceptance_message_id,p_review) returning * into e;
 return to_jsonb(e);
end;
$$;

-- The existing queue cannot silently bypass capacity or turn new enrolments
-- into uncapped month offers. Historical inbound acceptances keep their promises.
create function public.require_balance_challenge_place() returns trigger
language plpgsql security invoker set search_path=public,pg_temp as $$
declare e balance_coaching_challenge_enrolments; opened timestamptz; accepted timestamptz;
begin
 select opened_at into opened from balance_coaching_challenge_intakes where id='consistency_20261025';
 select created_at into accepted from ig_messages where id=new.acceptance_message_id and thread_id=new.thread_id and direction='in';
 select * into e from balance_coaching_challenge_enrolments where thread_id=new.thread_id;
 if e.id is null then
  if accepted>=opened then raise exception 'Reserve a reviewed six-person challenge place before queueing'; end if;
  return new;
 end if;
 if new.acceptance_message_id<>e.acceptance_message_id then raise exception 'Use the exact reserved challenge acceptance'; end if;
 new.input:=new.input||jsonb_build_object('challengeIntakeId',e.intake_id,'challengeEnrolmentId',e.id,'durationDays',28);
 return new;
end;
$$;
create trigger require_balance_challenge_place before insert on public.balance_free_coaching_jobs
for each row execute function public.require_balance_challenge_place();

create function public.tag_balance_challenge_grant() returns trigger
language plpgsql security invoker set search_path=public,pg_temp as $$
declare e balance_coaching_challenge_enrolments;
begin
 select * into e from balance_coaching_challenge_enrolments where thread_id=new.thread_id;
 if e.id is not null then
  if not exists(select 1 from balance_free_coaching_jobs where thread_id=e.thread_id and acceptance_message_id=e.acceptance_message_id)
  then raise exception 'Reserved challenge worker job required'; end if;
  new.setup:=new.setup||jsonb_build_object('challengeIntakeId',e.intake_id,'challengeEnrolmentId',e.id,'durationDays',28);
 end if;
 return new;
end;
$$;
create trigger tag_balance_challenge_grant before insert on public.balance_free_starters
for each row execute function public.tag_balance_challenge_grant();

-- Keep the complete live claim function (including separate-worker checks).
-- Only cohort-tagged new grants differ from the historical calendar month.
do $$ declare definition text; old_duration text; old_end text; begin
 select pg_get_functiondef(oid) into definition from pg_proc
 where pronamespace='public'::regnamespace and proname='claim_balance_free_starter';
 old_duration:='prepared.program->>''program_name'',5,prepared.program->''weekly_schedule''';
 old_end:='interval ''1 month''';
 if position(old_duration in definition)=0 or position(old_end in definition)=0 then raise exception 'Claim duration contract changed; review before applying'; end if;
 definition:=replace(definition,old_duration,'prepared.program->>''program_name'',case when invitation.setup->>''challengeIntakeId''=''consistency_20261025'' then 4 else 5 end,prepared.program->''weekly_schedule''');
 definition:=replace(definition,old_end,'case when invitation.setup->>''challengeIntakeId''=''consistency_20261025'' then interval ''28 days'' else interval ''1 month'' end');
 execute definition;
end $$;

create function public.record_balance_challenge_milestone(p_enrolment_id uuid,p_milestone text,p_source_reference text,p_summary text,p_reviewed_by text)
returns boolean language plpgsql security invoker set search_path=public,pg_temp as $$
begin
 if p_milestone='payment_confirmed' and p_source_reference not like 'stripe:%' then raise exception 'Verified Stripe payment reference required'; end if;
 if p_milestone='paid_agreement' and not exists(
 select 1 from ig_messages m join balance_coaching_challenge_enrolments e on e.thread_id=m.thread_id
 where e.id=p_enrolment_id and m.id::text=p_source_reference and m.direction='in') then raise exception 'Exact inbound paid agreement required'; end if;
 insert into balance_coaching_challenge_milestones(enrolment_id,milestone,source_reference,summary,reviewed_by)
 values(p_enrolment_id,p_milestone,p_source_reference,p_summary,p_reviewed_by) on conflict do nothing;
 return found;
end;
$$;

create view public.balance_coaching_challenge_progress with(security_invoker=true) as
select e.id enrolment_id,e.intake_id,e.thread_id,e.acceptance_message_id,e.accepted_at,
 j.status setup_status,s.notice_status,g.claimed_at,g.starts_at,g.ends_at,u.onboarding_complete,
 (select count(*) from workouts w where w.user_id=g.user_id and w.created_at>=g.starts_at and w.created_at<g.ends_at) logged_set_rows,
 coalesce((select jsonb_object_agg(m.milestone,jsonb_build_object('source_reference',m.source_reference,'summary',m.summary,'reviewed_by',m.reviewed_by,'recorded_at',m.recorded_at))
 from balance_coaching_challenge_milestones m where m.enrolment_id=e.id),'{}'::jsonb) reviewed_milestones
from balance_coaching_challenge_enrolments e
left join balance_free_coaching_jobs j on j.thread_id=e.thread_id
left join balance_free_coaching_setups s on s.thread_id=e.thread_id
left join balance_free_starters g on g.id=s.grant_id
left join users u on u.id=g.user_id;
revoke all on public.balance_coaching_challenge_progress from public,anon,authenticated;
grant select on public.balance_coaching_challenge_progress to service_role;
do $$ declare f record; begin
 for f in select oid::regprocedure signature from pg_proc where pronamespace='public'::regnamespace and proname in
 ('balance_coaching_challenge_status','reserve_balance_coaching_challenge','require_balance_challenge_place','tag_balance_challenge_grant','record_balance_challenge_milestone') loop
 execute format('revoke all on function %s from public,anon,authenticated',f.signature);
 execute format('grant execute on function %s to service_role',f.signature);
 end loop;
end $$;
