-- A fast dispatcher handoff; only the separate leased setup worker builds.
create table public.balance_free_coaching_jobs (
 id uuid primary key default gen_random_uuid(),
 thread_id uuid not null unique references public.ig_threads(id),
 acceptance_message_id uuid not null references public.ig_messages(id),
 input jsonb not null,
 review jsonb not null,
 status text not null default 'queued' check(status in ('queued','claimed','prepared','needs_you','cancelled')),
 claim_token uuid,
 claim_run_id text,
 claim_expires_at timestamptz,
 attempts integer not null default 0,
 setup_id uuid references public.balance_free_coaching_setups(id),
 receipt jsonb not null default '{}',
 last_error text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.balance_free_coaching_jobs enable row level security;
revoke all on public.balance_free_coaching_jobs from public,anon,authenticated;
grant all on public.balance_free_coaching_jobs to service_role;

create function public.queue_balance_free_coaching(p_thread_id uuid,p_acceptance_message_id uuid,p_timezone text,
 p_schedule jsonb,p_equipment text,p_goal text,p_session_minutes integer,p_movement_restrictions text,p_review jsonb)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare t ig_threads; existing balance_free_coaching_jobs; result balance_free_coaching_jobs; slot jsonb;
begin
 select * into t from ig_threads where id=p_thread_id for update;
 if t.id is null or not free_coaching_thread_allowed(t.id) then raise exception 'Current identity and independent hold review required'; end if;
 select * into existing from balance_free_coaching_jobs where thread_id=t.id;
 if existing.id is not null then return to_jsonb(existing); end if;
 if t.linked_user_id is not null or exists(select 1 from balance_free_starters where thread_id=t.id) then raise exception 'Preserve existing member programs and starter agreements'; end if;
 if not exists(select 1 from ig_messages where id=p_acceptance_message_id and thread_id=t.id and direction='in') then raise exception 'Exact inbound acceptance required'; end if;
 if not coalesce(p_review @> '{"full_thread_reviewed":true,"explicit_free_month_acceptance":true,"schedule_agreed":true,"equipment_confirmed":true,"movement_restrictions_reviewed":true,"independent_holds_checked":true}',false)
 or nullif(p_review->>'reviewed_by','') is null then raise exception 'Reviewed acceptance, availability and equipment required'; end if;
 if not exists(select 1 from pg_timezone_names where name=p_timezone) or p_equipment is null or p_equipment not in ('gym','dumbbells','bands','none')
 or nullif(trim(p_goal),'') is null or p_session_minutes is null or p_session_minutes not between 10 and 60 or nullif(trim(p_movement_restrictions),'') is null
 then raise exception 'Confirmed timezone, goal, equipment, duration and restriction context required'; end if;
 if jsonb_typeof(p_schedule) is distinct from 'array' or jsonb_array_length(p_schedule) not between 1 and 6 then raise exception 'One to six agreed workout slots required'; end if;
 if (select count(distinct value->>'weekday') from jsonb_array_elements(p_schedule))<>jsonb_array_length(p_schedule) then raise exception 'Duplicate workout day'; end if;
 for slot in select value from jsonb_array_elements(p_schedule) loop
  if coalesce(slot->>'weekday','') !~ '^[1-7]$' or coalesce(slot->>'time','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then raise exception 'Valid agreed weekday and local time required'; end if;
 end loop;
 insert into balance_free_coaching_jobs(thread_id,acceptance_message_id,input,review)
 values(t.id,p_acceptance_message_id,jsonb_build_object('timezone',p_timezone,'schedule',p_schedule,'equipment',p_equipment,
 'goal',p_goal,'sessionMinutes',p_session_minutes,'movementRestrictions',p_movement_restrictions),p_review) returning * into result;
 insert into coach_alerts(coach_id,client_name,alert_type,priority,title,description,status,data,idempotency_key)
 values(t.coach_id,t.profile_name,'new_user_onboarding','medium','Coaching setup handed to worker',
 'Accepted offer and agreed availability saved. The separate setup worker owns preparation; Messenger remains available.','dismissed',
 jsonb_build_object('free_coaching_job_id',result.id,'thread_id',t.id,'acceptance_message_id',p_acceptance_message_id),'free-coaching-job:'||result.id);
 return to_jsonb(result);
end;
$$;

create function public.claim_balance_free_coaching_job(p_run_id text,p_lease_seconds integer default 300)
returns setof public.balance_free_coaching_jobs language plpgsql security invoker set search_path=public,pg_temp as $$
begin
 if nullif(trim(p_run_id),'') is null or p_lease_seconds is null or p_lease_seconds not between 60 and 900 then raise exception 'Bounded named worker lease required'; end if;
 return query with candidate as (
 select j.id from balance_free_coaching_jobs j where (j.status='queued' or (j.status='claimed' and j.claim_expires_at<now()))
 and j.attempts<3 and free_coaching_thread_allowed(j.thread_id) order by j.created_at for update skip locked limit 1
 ) update balance_free_coaching_jobs j set status='claimed',claim_token=gen_random_uuid(),claim_run_id=p_run_id,
 claim_expires_at=now()+make_interval(secs=>p_lease_seconds),attempts=j.attempts+1,updated_at=now()
 from candidate c where j.id=c.id returning j.*;
end;
$$;

create function public.heartbeat_balance_free_coaching_job(p_job_id uuid,p_claim_token uuid,p_run_id text)
returns boolean language plpgsql security invoker set search_path=public,pg_temp as $$
begin
 update balance_free_coaching_jobs set claim_expires_at=now()+interval '5 minutes',updated_at=now()
 where id=p_job_id and status='claimed' and claim_token=p_claim_token and claim_run_id=p_run_id and claim_expires_at>now();
 return found;
end;
$$;

create function public.finish_balance_free_coaching_job(p_job_id uuid,p_claim_token uuid,p_setup_id uuid,p_status text,p_receipt jsonb)
returns boolean language plpgsql security invoker set search_path=public,pg_temp as $$
declare j balance_free_coaching_jobs; s balance_free_coaching_setups; t ig_threads;
begin
 select * into j from balance_free_coaching_jobs where id=p_job_id for update;
 if j.id is null or j.status is distinct from 'claimed' or j.claim_token is distinct from p_claim_token or j.claim_expires_at<=now()
 or p_status not in ('prepared','needs_you','cancelled') then return false; end if;
 select * into t from ig_threads where id=j.thread_id;
 if p_status='prepared' then
  select * into s from balance_free_coaching_setups where id=p_setup_id;
  if s.id is null or s.thread_id<>j.thread_id or s.acceptance_message_id<>j.acceptance_message_id or not free_coaching_thread_allowed(j.thread_id)
  or not coalesce(p_receipt @> '{"prepared_plan_verified":true,"calendar_render_verified":true,"videos_verified":true,"invitation_verified":true,"program_suitability_checked":true}',false)
  or nullif(p_receipt->>'suitability_summary','') is null
  or nullif(p_receipt->>'verification_summary','') is null or nullif(p_receipt->>'visual_proof','') is null then return false; end if;
 end if;
 update balance_free_coaching_jobs set status=p_status,setup_id=p_setup_id,receipt=receipt||p_receipt,
 last_error=case when p_status='needs_you' then p_receipt->>'error' else null end,updated_at=now() where id=j.id;
 if p_status='prepared' then
  update coach_alerts set status='dismissed',actioned_at=now() where idempotency_key='free-coaching-job-attention:'||j.id and status='pending';
 end if;
 if p_status='needs_you' then
  insert into coach_alerts(coach_id,client_name,alert_type,priority,title,description,status,data,idempotency_key)
  values(t.coach_id,t.profile_name,'follow_up_review','medium','Coaching setup needs attention',
   coalesce(p_receipt->>'error','The setup worker needs an individual review before marking this ready.'),'pending',
   jsonb_build_object('free_coaching_job_id',j.id,'thread_id',t.id,'acceptance_message_id',j.acceptance_message_id,'operator_queue','needs_you','receipt',p_receipt),'free-coaching-job-attention:'||j.id)
  on conflict(idempotency_key) where idempotency_key is not null do nothing;
 end if;
 return true;
end;
$$;

-- The existing prepare API remains service-only and additionally requires the
-- worker's live lease. The dispatcher cannot accidentally do preparation inline.
do $$ declare definition text; needle text; begin
 select pg_get_functiondef(oid) into definition from pg_proc where pronamespace='public'::regnamespace and proname='prepare_balance_free_coaching';
 needle:=' select * into existing from balance_free_coaching_setups where thread_id=t.id;';
 if position(needle in definition)=0 then raise exception 'Setup preparation contract changed'; end if;
 execute replace(definition,needle,$gate$
 perform 1 from balance_free_coaching_jobs j where j.id=(p_review->>'setup_job_id')::uuid
 and j.thread_id=t.id and j.acceptance_message_id=p_acceptance_message_id and j.status='claimed'
 and j.claim_token=(p_review->>'setup_claim_token')::uuid and j.claim_expires_at>now()
 and j.input->'schedule'=p_schedule and j.input->>'timezone'=p_timezone and j.input->>'equipment'=p_equipment
 and j.input->>'goal'=p_goal and (j.input->>'sessionMinutes')::int=p_session_minutes
 and j.input->>'movementRestrictions'='none_reported' for update;
 if not found then raise exception 'Live separate setup-worker claim required'; end if;
 select * into existing from balance_free_coaching_setups where thread_id=t.id;
 $gate$);
end $$;

create or replace function public.free_coaching_setup_due() returns setof public.balance_free_coaching_setups
language sql stable security invoker set search_path=public,pg_temp as $$
 select s.* from balance_free_coaching_setups s join balance_free_starters g on g.id=s.grant_id
 join balance_free_coaching_jobs j on j.setup_id=s.id and j.status='prepared'
 where s.notice_status='pending' and s.attempted_at is null and g.revoked_at is null and g.claim_before>now()
 and free_coaching_thread_allowed(s.thread_id) order by s.created_at limit 10;
$$;
do $$ declare definition text; needle text; begin
 select pg_get_functiondef(oid) into definition from pg_proc where pronamespace='public'::regnamespace and proname='prepare_free_coaching_ready';
 needle:=' select * into t from ig_threads where id=s.thread_id;';
 if position(needle in definition)=0 then raise exception 'Ready notice contract changed'; end if;
 execute replace(definition,needle,$gate$
 if not exists(select 1 from balance_free_coaching_jobs where setup_id=s.id and status='prepared') then raise exception 'Separate worker verification is not complete'; end if;
 select * into t from ig_threads where id=s.thread_id;
 $gate$);
end $$;

-- A prepared row alone is not enough: both claim and send require the separate
-- worker's completed verification receipt.
do $$ declare definition text; needle text; begin
 select pg_get_functiondef(oid) into definition from pg_proc where pronamespace='public'::regnamespace and proname='ig_free_coaching_ready_eligible';
 needle:=' select * into g from balance_free_starters where id=s.grant_id;';
 if position(needle in definition)=0 then raise exception 'Notice eligibility contract changed'; end if;
 execute replace(definition,needle,$gate$
 if not exists(select 1 from balance_free_coaching_jobs where setup_id=s.id and status='prepared') then return false; end if;
 select * into g from balance_free_starters where id=s.grant_id;
 $gate$);
 select pg_get_functiondef(oid) into definition from pg_proc where pronamespace='public'::regnamespace and proname='claim_balance_free_starter';
 needle:='   if prepared.id is null or not free_coaching_thread_allowed(t.id) then';
 if position(needle in definition)=0 then raise exception 'Claim preparation contract changed'; end if;
 execute replace(definition,needle,$gate$
   if not exists(select 1 from balance_free_coaching_jobs where setup_id=prepared.id and status='prepared') then raise exception 'Separate setup worker verification required'; end if;
   if prepared.id is null or not free_coaching_thread_allowed(t.id) then
 $gate$);
end $$;

create function public.refresh_free_coaching_jobs() returns void language plpgsql security invoker set search_path=public,pg_temp as $$
begin
 update balance_free_coaching_jobs set status='needs_you',last_error='Setup worker lease expired after three attempts',updated_at=now()
 where status='claimed' and claim_expires_at<=now() and attempts>=3;
 insert into coach_alerts(coach_id,client_name,alert_type,priority,title,description,status,data,idempotency_key)
 select t.coach_id,t.profile_name,'follow_up_review','medium','Coaching setup is waiting',
 coalesce(j.last_error,'Accepted coaching setup has been waiting for the separate worker for over 30 minutes.'),'pending',
 jsonb_build_object('free_coaching_job_id',j.id,'thread_id',j.thread_id,'operator_queue','needs_you'),'free-coaching-job-attention:'||j.id
 from balance_free_coaching_jobs j join ig_threads t on t.id=j.thread_id
 where j.status='needs_you' or (j.status in ('queued','claimed') and j.created_at<now()-interval '30 minutes')
 on conflict(idempotency_key) where idempotency_key is not null do nothing;
end;
$$;
do $$ declare f record; begin
 for f in select oid::regprocedure signature from pg_proc where pronamespace='public'::regnamespace and proname in
 ('queue_balance_free_coaching','claim_balance_free_coaching_job','heartbeat_balance_free_coaching_job','finish_balance_free_coaching_job','refresh_free_coaching_jobs') loop
 execute format('revoke all on function %s from public,anon,authenticated',f.signature);
 execute format('grant execute on function %s to service_role',f.signature);
 end loop;
end $$;
select cron.schedule('balance-free-coaching-jobs','*/5 * * * *','select public.refresh_free_coaching_jobs()');
