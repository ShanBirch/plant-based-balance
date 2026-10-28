-- Service-only, prospective ABC timing pilot. No sender, outreach or access grants.
create table public.balance_challenge_timing_experiments (
 id text primary key, opened_at timestamptz not null default now(),
 enabled boolean not null default true,
 intake_id text not null references public.balance_coaching_challenge_intakes(id)
);
insert into public.balance_challenge_timing_experiments(id,intake_id)
values ('pre_christmas_timing_20261028','consistency_20261025');
create table public.balance_challenge_timing_assignments (
 id uuid primary key default gen_random_uuid(),
 experiment_id text not null references public.balance_challenge_timing_experiments(id),
 thread_id uuid not null references public.ig_threads(id), identity_key text not null,
 variant text not null check(variant in ('A','B','C')),
 target_conversation integer not null check(target_conversation between 1 and 3),
 source_message_id uuid not null references public.ig_messages(id),
 review jsonb not null, assigned_at timestamptz not null default now(),
 unique(experiment_id,identity_key), unique(experiment_id,thread_id),
 check(target_conversation=case variant when 'A' then 1 when 'B' then 2 else 3 end)
);
create table public.balance_challenge_timing_conversations (
 assignment_id uuid not null references public.balance_challenge_timing_assignments(id),
 ordinal integer not null check(ordinal>0),
 source_message_id uuid not null references public.ig_messages(id),
 review jsonb not null, recorded_at timestamptz not null default now(),
 primary key(assignment_id,ordinal), unique(assignment_id,source_message_id)
);
create table public.balance_challenge_timing_events (
 assignment_id uuid not null references public.balance_challenge_timing_assignments(id),
 kind text not null check(kind in ('training_opened','invited','interested','declined','timing_override')),
 message_id uuid not null references public.ig_messages(id),
 review jsonb not null, recorded_at timestamptz not null default now(),
 primary key(assignment_id,kind,message_id)
);
create unique index balance_timing_one_invitation on public.balance_challenge_timing_events(assignment_id)
 where kind='invited';
alter table public.balance_challenge_timing_experiments enable row level security;
alter table public.balance_challenge_timing_assignments enable row level security;
alter table public.balance_challenge_timing_events enable row level security;
alter table public.balance_challenge_timing_conversations enable row level security;
revoke all on public.balance_challenge_timing_conversations from public,anon,authenticated;
grant all on public.balance_challenge_timing_conversations to service_role;
revoke all on public.balance_challenge_timing_experiments,public.balance_challenge_timing_assignments,public.balance_challenge_timing_events from public,anon,authenticated;
grant all on public.balance_challenge_timing_experiments,public.balance_challenge_timing_assignments,public.balance_challenge_timing_events to service_role;

create function public.assign_balance_challenge_timing(p_thread_id uuid,p_source_message_id uuid,p_review jsonb)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare t ig_threads; e balance_challenge_timing_experiments; a balance_challenge_timing_assignments;
 identity text; chosen integer; k text; opener uuid;
begin
 select * into e from balance_challenge_timing_experiments where id='pre_christmas_timing_20261028' for update;
 select * into t from ig_threads where id=p_thread_id;
 if t.id is null or t.channel<>'instagram' or nullif(trim(t.ig_username),'') is null then raise exception 'Verified Instagram identity required'; end if;
 identity := coalesce(t.coach_id::text,'')||':instagram:'||lower(t.ig_username);
 select * into a from balance_challenge_timing_assignments where experiment_id=e.id and identity_key=identity;
 if a.id is not null then return to_jsonb(a); end if;
 if not e.enabled or not coalesce((balance_coaching_challenge_status(e.intake_id)->>'open')::boolean,false) then raise exception 'Timing pilot closed: preserve intake capacity'; end if;
 if t.linked_user_id is not null or not free_coaching_thread_allowed(t.id)
 or exists(select 1 from balance_free_starters s where s.thread_id=t.id)
 or exists(select 1 from balance_free_coaching_jobs j where j.thread_id=t.id)
 or t.custom_data->>'acquisition_mode'='paid_meta' then raise exception 'Preserve client, paid, historical and hold lanes'; end if;
 if not exists(select 1 from ig_messages where id=p_source_message_id and thread_id=t.id and direction='in'
 and created_at>=e.opened_at) then raise exception 'Fresh prospective inbound source required'; end if;
 select o.id into opener from ig_messages o join ig_messages i on i.id=p_source_message_id
 where o.thread_id=t.id and o.direction='out'
 and o.created_at<i.created_at order by o.created_at desc,o.id desc limit 1;
 if opener is null then raise exception 'This pilot requires a real outbound opener and reciprocal inbound'; end if;
 if exists(select 1 from ig_messages where thread_id=t.id and direction='in' and created_at<e.opened_at)
 then raise exception 'Pre-existing reciprocal history is not a fresh timing cohort'; end if;
 if (select id from ig_messages where thread_id=t.id and direction='in' order by created_at desc,id desc limit 1)<>p_source_message_id
 then raise exception 'Current source required'; end if;
 foreach k in array array['full_thread_reviewed','organic_business','reciprocal','no_prior_offer','no_prior_fitness_pivot','independent_holds_checked','not_internal_test'] loop
  if p_review->k is distinct from 'true'::jsonb then raise exception 'Actual eligibility review required: %',k; end if;
 end loop;
 if nullif(trim(p_review->>'reviewed_by'),'') is null then raise exception 'Reviewer required'; end if;
 -- Hash allocation is independent of the operator's judgement of lead quality.
 chosen := (('x'||substr(md5(e.id||':'||identity),1,8))::bit(32)::bigint % 3)::integer+1;
 insert into balance_challenge_timing_assignments(experiment_id,thread_id,identity_key,variant,target_conversation,source_message_id,review)
 values(e.id,t.id,identity,(array['A','B','C'])[chosen],chosen,p_source_message_id,p_review) returning * into a;
 insert into balance_challenge_timing_conversations(assignment_id,ordinal,source_message_id,review)
 values(a.id,1,p_source_message_id,p_review||jsonb_build_object('opener_message_id',opener));
 return to_jsonb(a);
end $$;

create function public.balance_challenge_timing_context(p_thread_id uuid)
returns jsonb language sql stable security invoker set search_path=public,pg_temp as $$
 with assignment as (
 select a.* from balance_challenge_timing_assignments a
 join balance_challenge_timing_experiments e on e.id=a.experiment_id
 join ig_threads t on t.id=p_thread_id
 where a.experiment_id='pre_christmas_timing_20261028'
 and a.identity_key=coalesce(t.coach_id::text,'')||':instagram:'||lower(t.ig_username)
 ) select jsonb_build_object('assignment',to_jsonb(a)-'review',
 'conversation_number',(select count(*) from balance_challenge_timing_conversations c where c.assignment_id=a.id),
 'training_due',(select count(*) from balance_challenge_timing_conversations c where c.assignment_id=a.id)>=a.target_conversation,
 'events',(select coalesce(jsonb_agg(to_jsonb(v) order by recorded_at),'[]'::jsonb) from balance_challenge_timing_events v where v.assignment_id=a.id))
 from assignment a;
$$;

create function public.record_balance_challenge_timing_conversation(p_thread_id uuid,p_source_message_id uuid,p_review jsonb)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare a balance_challenge_timing_assignments; m ig_messages; prior_at timestamptz; n integer;
begin
 select * into a from balance_challenge_timing_assignments where id=
 (balance_challenge_timing_context(p_thread_id)->'assignment'->>'id')::uuid for update;
 if a.id is null then raise exception 'Existing assignment required'; end if;
 if exists(select 1 from balance_challenge_timing_conversations where assignment_id=a.id and source_message_id=p_source_message_id)
 then return balance_challenge_timing_context(p_thread_id); end if;
 select * into m from ig_messages where id=p_source_message_id and thread_id=a.thread_id and direction='in';
 select max(i.created_at) into prior_at from balance_challenge_timing_conversations c join ig_messages i on i.id=c.source_message_id where c.assignment_id=a.id;
 if m.id is null or m.created_at<=prior_at then raise exception 'Later exact inbound required'; end if;
 if p_review->'full_thread_reviewed' is distinct from 'true'::jsonb
 or p_review->'new_conversation_verified' is distinct from 'true'::jsonb
 or coalesce(p_review->>'boundary_reason','') not in ('new_story_exchange','separate_returning_exchange')
 or nullif(trim(p_review->>'summary'),'') is null or nullif(trim(p_review->>'reviewed_by'),'') is null
 then raise exception 'Actual new conversation review required; neither message count nor elapsed time suffices'; end if;
 if not exists(select 1 from ig_messages i where i.id=(p_review->>'previous_conversation_end_message_id')::uuid
 and i.thread_id=a.thread_id and i.created_at>=prior_at and i.created_at<m.created_at)
 then raise exception 'Exact prior conversation boundary evidence required'; end if;
 if not exists(select 1 from ig_messages o where o.id=coalesce(p_review->>'opener_message_id',p_review->>'story_opener_message_id')::uuid
 and o.thread_id=a.thread_id and o.direction='out'
 and (p_review->>'boundary_reason'<>'new_story_exchange' or o.text ilike 'replied to their story%')
 and o.created_at>=(select created_at from ig_messages where id=(p_review->>'previous_conversation_end_message_id')::uuid)
 and o.created_at>prior_at and o.created_at<m.created_at)
 or exists(select 1 from balance_challenge_timing_conversations c where c.assignment_id=a.id
 and coalesce(c.review->>'opener_message_id',c.review->>'story_opener_message_id')=coalesce(p_review->>'opener_message_id',p_review->>'story_opener_message_id'))
 then raise exception 'Distinct later delivered opener plus actual reply required'; end if;
 select count(*)+1 into n from balance_challenge_timing_conversations where assignment_id=a.id;
 insert into balance_challenge_timing_conversations values(a.id,n,p_source_message_id,p_review,now());
 return balance_challenge_timing_context(p_thread_id);
end $$;

create function public.record_balance_challenge_timing_event(p_thread_id uuid,p_kind text,p_message_id uuid,p_review jsonb)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare a balance_challenge_timing_assignments; m ig_messages; ctx jsonb;
begin
 ctx:=balance_challenge_timing_context(p_thread_id);
 select * into a from balance_challenge_timing_assignments where id=(ctx->'assignment'->>'id')::uuid for update;
 select * into m from ig_messages where id=p_message_id;
 if a.id is null or m.thread_id is distinct from a.thread_id
 or m.created_at<(select created_at from ig_messages where id=a.source_message_id)
 or (m.direction='out' and m.created_at<a.assigned_at)
 then raise exception 'Assignment and exact post-assignment canonical message required'; end if;
 if p_review->'full_thread_reviewed' is distinct from 'true'::jsonb or nullif(trim(p_review->>'summary'),'') is null
 or nullif(trim(p_review->>'reviewed_by'),'') is null then raise exception 'Meaning reviewed with evidence required'; end if;
 if p_kind in ('training_opened','invited') then
  if m.direction<>'out' then raise exception 'Delivered outbound required'; end if;
  if p_review->'native_delivery_verified' is distinct from 'true'::jsonb then raise exception 'Native delivery verification required'; end if;
  if not (ctx->>'training_due')::boolean and not exists(select 1 from balance_challenge_timing_events where assignment_id=a.id and kind='timing_override')
  then raise exception 'Assigned conversation has not been reached'; end if;
 elsif p_kind in ('interested','declined','timing_override') then
  if m.direction<>'in' then raise exception 'Actual inbound evidence required'; end if;
  if p_kind in ('interested','declined') and not exists(select 1 from balance_challenge_timing_events v join ig_messages i on i.id=v.message_id
    where v.assignment_id=a.id and v.kind='invited' and i.created_at<m.created_at)
  then raise exception 'Response must follow a delivered invitation'; end if;
 else raise exception 'Unsupported experiment event'; end if;
 if p_kind='invited' and not exists(select 1 from balance_challenge_timing_events where assignment_id=a.id and kind='training_opened')
 then raise exception 'Record actual training opening first'; end if;
 insert into balance_challenge_timing_events values(a.id,p_kind,p_message_id,p_review,now())
 on conflict (assignment_id,kind,message_id) do nothing;
 return jsonb_build_object('recorded',true,'assignment_id',a.id,'kind',p_kind,'message_id',p_message_id);
end $$;

create function public.balance_challenge_timing_report()
returns jsonb language sql stable security invoker set search_path=public,pg_temp as $$
 with per_person as (
 select a.id,a.variant,a.thread_id,
 exists(select 1 from balance_challenge_timing_events v where v.assignment_id=a.id and kind='training_opened') training,
 exists(select 1 from balance_challenge_timing_events v where v.assignment_id=a.id and kind='invited') invited,
 exists(select 1 from balance_challenge_timing_events v where v.assignment_id=a.id and kind='interested') interested,
 exists(select 1 from balance_challenge_timing_events v where v.assignment_id=a.id and kind='declined') declined,
 exists(select 1 from balance_challenge_timing_events v where v.assignment_id=a.id and kind='timing_override') override,
 exists(select 1 from balance_coaching_challenge_enrolments e where e.thread_id=a.thread_id and e.intake_id='consistency_20261025' and e.accepted_at>=a.assigned_at) accepted,
 exists(select 1 from balance_coaching_challenge_progress p where p.thread_id=a.thread_id and p.intake_id='consistency_20261025' and p.accepted_at>=a.assigned_at and p.onboarding_complete) onboarded
 from balance_challenge_timing_assignments a where a.experiment_id='pre_christmas_timing_20261028'
 ), totals as (
 select v.variant,count(p.id) assigned,count(p.id) filter(where training) training_opened,
 count(p.id) filter(where invited) invited,count(p.id) filter(where interested) interested,
 count(p.id) filter(where declined) declined,count(p.id) filter(where override) timing_overrides,
 count(p.id) filter(where accepted) accepted,count(p.id) filter(where onboarded) onboarded,
 count(p.id) filter(where not invited) not_yet_invited
 from (values('A'),('B'),('C')) v(variant) left join per_person p using(variant) group by v.variant
 ) select jsonb_build_object('experiment','pre_christmas_timing_20261028','groups',jsonb_agg(to_jsonb(t) order by variant),
 'capacity',balance_coaching_challenge_status('consistency_20261025'),
 'interpretation','Prospective pilot; retain assigned-but-not-invited and overrides. No winner from five remaining places.') from totals t;
$$;
revoke all on function public.assign_balance_challenge_timing(uuid,uuid,jsonb),public.balance_challenge_timing_context(uuid),public.record_balance_challenge_timing_event(uuid,text,uuid,jsonb),public.balance_challenge_timing_report() from public,anon,authenticated;
grant execute on function public.assign_balance_challenge_timing(uuid,uuid,jsonb),public.balance_challenge_timing_context(uuid),public.record_balance_challenge_timing_event(uuid,text,uuid,jsonb),public.balance_challenge_timing_report() to service_role;
revoke all on function public.record_balance_challenge_timing_conversation(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.record_balance_challenge_timing_conversation(uuid,uuid,jsonb) to service_role;
