-- Prospective nested test. Existing ABC assignments and exposures stay untouched.
create table public.balance_challenge_approach_experiments (
 id text primary key, opened_at timestamptz not null default clock_timestamp(),
 enabled boolean not null default true,
 policy_revision text not null
);
insert into public.balance_challenge_approach_experiments(id,policy_revision)
 values('group_a_approach_20261030','challenge_approach_20261030_v1');
create table public.balance_challenge_approach_assignments (
 assignment_id uuid primary key references public.balance_challenge_timing_assignments(id),
 experiment_id text not null references public.balance_challenge_approach_experiments(id),
 subvariant text not null check(subvariant in ('A1_direct_challenge','A2_fitness_first')),
 source_message_id uuid not null references public.ig_messages(id),
 review jsonb not null, assigned_at timestamptz not null default clock_timestamp()
);
alter table public.balance_challenge_approach_experiments enable row level security;
alter table public.balance_challenge_approach_assignments enable row level security;
revoke all on public.balance_challenge_approach_experiments, public.balance_challenge_approach_assignments from public,anon,authenticated;
grant all on public.balance_challenge_approach_experiments, public.balance_challenge_approach_assignments to service_role;

create function public.balance_challenge_approach_context(p_thread_id uuid)
returns jsonb language sql stable security invoker set search_path=public,pg_temp as $$
 select jsonb_build_object('experiment',e.id,'enabled',e.enabled,'opened_at',e.opened_at,
 'policy_revision',e.policy_revision,'assignment',to_jsonb(s)-'review',
 'eligible_parent',coalesce(a.variant='A' and a.assigned_at>=e.opened_at
 and not exists(select 1 from balance_challenge_timing_events v where v.assignment_id=a.id
 and v.kind in ('training_opened','invited','timing_override'))
 and (balance_challenge_timing_context(p_thread_id)->>'conversation_number')::int=1,false))
 from balance_challenge_approach_experiments e
 left join balance_challenge_timing_assignments a on a.id=(balance_challenge_timing_context(p_thread_id)->'assignment'->>'id')::uuid
 left join balance_challenge_approach_assignments s on s.assignment_id=a.id
 where e.id='group_a_approach_20261030';
$$;

create function public.assign_balance_challenge_approach(p_thread_id uuid,p_source_message_id uuid,p_review jsonb)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare a balance_challenge_timing_assignments; e balance_challenge_approach_experiments;
 s balance_challenge_approach_assignments; k text; chosen text;
begin
 select * into e from balance_challenge_approach_experiments where id='group_a_approach_20261030' for update;
 select * into a from balance_challenge_timing_assignments where id=(balance_challenge_timing_context(p_thread_id)->'assignment'->>'id')::uuid for update;
 select * into s from balance_challenge_approach_assignments where assignment_id=a.id;
 if s.assignment_id is not null then return to_jsonb(s); end if;
 if not e.enabled or not coalesce((balance_challenge_approach_context(p_thread_id)->>'eligible_parent')::boolean,false)
 then raise exception 'New unexposed Group A first conversation required'; end if;
 if not free_coaching_thread_allowed(p_thread_id)
 or exists(select 1 from ig_threads where id=p_thread_id and (linked_user_id is not null or custom_data->>'acquisition_mode'='paid_meta'))
 or not coalesce((balance_coaching_challenge_status('consistency_20261025')->>'open')::boolean,false)
 then raise exception 'Preserve holds, client/paid lanes and intake capacity'; end if;
 if not exists(select 1 from ig_messages where id=p_source_message_id and thread_id=a.thread_id and direction='in' and created_at>=e.opened_at)
 or (select id from ig_messages where thread_id=a.thread_id and direction='in' order by created_at desc,id desc limit 1) is distinct from p_source_message_id
 then raise exception 'Current exact prospective inbound required'; end if;
 foreach k in array array['full_thread_reviewed','organic_business','independent_holds_checked','no_prior_exposure','not_person_led_fitness','not_internal_test'] loop
  if p_review->k is distinct from 'true'::jsonb then raise exception 'Actual eligibility review required: %',k; end if;
 end loop;
 if nullif(trim(p_review->>'reviewed_by'),'') is null then raise exception 'Reviewer required'; end if;
 chosen:=case when (('x'||substr(md5(e.id||':'||a.identity_key),1,8))::bit(32)::bigint % 2)=0
 then 'A1_direct_challenge' else 'A2_fitness_first' end;
 insert into balance_challenge_approach_assignments(assignment_id,experiment_id,subvariant,source_message_id,review)
 values(a.id,e.id,chosen,p_source_message_id,p_review) returning * into s;
 return to_jsonb(s);
end $$;

-- Additional claim gate, not a replacement for source/hold/lease/native gates.
create function public.balance_challenge_approach_claim_allowed(p_thread_id uuid,p_source_message_id uuid,p_review jsonb)
returns boolean language plpgsql stable security invoker set search_path=public,pg_temp as $$
declare ctx jsonb; sid uuid; arm text; first_at timestamptz;
begin
 if coalesce(p_review->>'trainingPivot','false')<>'true' and p_review->>'disposition' is distinct from 'invite_challenge' then return true; end if;
 ctx:=balance_challenge_approach_context(p_thread_id);
 if ctx->'assignment' is null or ctx->'assignment'='null'::jsonb then
  if p_review->>'approachSubvariant' is not null then return false; end if;
  return not coalesce((ctx->>'eligible_parent')::boolean,false) or not coalesce((ctx->>'enabled')::boolean,false);
 end if;
 sid:=(ctx->'assignment'->>'assignment_id')::uuid; arm:=ctx->'assignment'->>'subvariant';
 if p_review->>'approachSubvariant' is distinct from arm then return false; end if;
 select min(m.created_at) into first_at from balance_challenge_timing_events v join ig_messages m on m.id=v.message_id
 where v.assignment_id=sid and v.kind='training_opened';
 if first_at is null then
  return case arm when 'A1_direct_challenge' then p_review->>'disposition'='invite_challenge'
    else p_review->>'disposition'='continue' and p_review->'trainingPivot'='true'::jsonb end;
 end if;
 if arm='A2_fitness_first' and p_review->>'disposition'='invite_challenge' then
  return p_review->'fitnessResponseWelcomed'='true'::jsonb and exists(select 1 from ig_messages
   where id=p_source_message_id and thread_id=p_thread_id and direction='in' and created_at>first_at);
 end if;
 return true;
end $$;

create function public.balance_challenge_approach_report()
returns jsonb language sql stable security invoker set search_path=public,pg_temp as $$
 with people as (
 select s.*,a.thread_id,a.variant,
 (select min(m.created_at) from balance_challenge_timing_events v join ig_messages m on m.id=v.message_id
 where v.assignment_id=a.id and v.kind='training_opened' and m.created_at>=s.assigned_at) exposed_at
 from balance_challenge_approach_assignments s join balance_challenge_timing_assignments a on a.id=s.assignment_id
 where s.experiment_id='group_a_approach_20261030'
 ), per_person as (
 select p.*,
 exists(select 1 from ig_messages m where m.thread_id=p.thread_id and m.direction='in'
 and m.created_at>p.exposed_at and m.created_at<=p.exposed_at+interval '48 hours') replied_48h,
 exists(select 1 from balance_challenge_timing_events v join ig_messages m on m.id=v.message_id
 where v.assignment_id=p.assignment_id and v.kind='interested'
 and m.created_at>p.exposed_at and m.created_at<=p.exposed_at+interval '48 hours') interested_48h,
 exists(select 1 from balance_challenge_timing_events v join ig_messages m on m.id=v.message_id
 where v.assignment_id=p.assignment_id and v.kind='invited' and m.created_at>=p.exposed_at) invited,
 exists(select 1 from balance_coaching_challenge_enrolments n where n.thread_id=p.thread_id
 and n.intake_id='consistency_20261025' and n.accepted_at>=p.exposed_at and n.accepted_at<=p.exposed_at+interval '7 days') accepted_7d,
 exists(select 1 from balance_challenge_timing_events v join ig_messages m on m.id=v.message_id where v.assignment_id=p.assignment_id
 and v.kind='fitness_topic_rejected' and m.created_at>p.exposed_at and m.created_at<=p.exposed_at+interval '48 hours') fitness_topic_rejected,
 exists(select 1 from balance_challenge_timing_events v join ig_messages m on m.id=v.message_id where v.assignment_id=p.assignment_id
 and v.kind='sales_intent_concern' and m.created_at>p.exposed_at and m.created_at<=p.exposed_at+interval '48 hours') sales_intent_concern,
 exists(select 1 from balance_challenge_timing_events v join ig_messages m on m.id=v.message_id where v.assignment_id=p.assignment_id
 and v.kind='offer_declined' and m.created_at>p.exposed_at and m.created_at<=p.exposed_at+interval '48 hours') offer_declined,
 exists(select 1 from balance_challenge_timing_events v join ig_messages m on m.id=v.message_id where v.assignment_id=p.assignment_id
 and v.kind='already_supported' and m.created_at>p.exposed_at and m.created_at<=p.exposed_at+interval '48 hours') already_supported
 from people p
 ), totals as (
 select arm.subvariant,count(p.assignment_id) assigned,count(p.exposed_at) exposed,
 count(p.assignment_id) filter(where p.exposed_at<=now()-interval '48 hours') mature_48h,
 count(p.assignment_id) filter(where p.exposed_at>now()-interval '48 hours') pending_48h,
 count(p.assignment_id) filter(where p.exposed_at<=now()-interval '48 hours' and p.replied_48h) replied_mature_48h,
 count(p.assignment_id) filter(where p.exposed_at<=now()-interval '48 hours' and p.interested_48h) interested_mature_48h,
 count(p.assignment_id) filter(where p.invited) invited,
 count(p.assignment_id) filter(where p.exposed_at<=now()-interval '7 days') mature_7d,
 count(p.assignment_id) filter(where p.exposed_at<=now()-interval '7 days' and p.accepted_7d) accepted_mature_7d,
 count(p.assignment_id) filter(where p.exposed_at<=now()-interval '48 hours' and p.fitness_topic_rejected) fitness_topic_rejected_mature_48h,
 count(p.assignment_id) filter(where p.exposed_at<=now()-interval '48 hours' and p.sales_intent_concern) sales_intent_concern_mature_48h,
 count(p.assignment_id) filter(where p.exposed_at<=now()-interval '48 hours' and p.offer_declined) offer_declined_mature_48h,
 count(p.assignment_id) filter(where p.exposed_at<=now()-interval '48 hours' and p.already_supported) already_supported_mature_48h
 from (values('A1_direct_challenge'),('A2_fitness_first')) arm(subvariant)
 left join per_person p using(subvariant) group by arm.subvariant
 ) select jsonb_build_object('experiment','group_a_approach_20261030','parent_group','A',
 'groups',jsonb_agg(to_jsonb(t) order by subvariant),
 'interpretation','Prospective Group A only. Primary explicit challenge interest within 48h of first delivered approach, with equal mature windows. Replies are not interest. Small intake may remain inconclusive. Categories overlap; missing reviews are unknown. Do not pool nested A1/A2 into the old pure timing comparison.') from totals t;
$$;
revoke all on function public.balance_challenge_approach_context(uuid),public.assign_balance_challenge_approach(uuid,uuid,jsonb),public.balance_challenge_approach_claim_allowed(uuid,uuid,jsonb),public.balance_challenge_approach_report() from public,anon,authenticated;
grant execute on function public.balance_challenge_approach_context(uuid),public.assign_balance_challenge_approach(uuid,uuid,jsonb),public.balance_challenge_approach_claim_allowed(uuid,uuid,jsonb),public.balance_challenge_approach_report() to service_role;

CREATE OR REPLACE FUNCTION public.record_balance_challenge_timing_event(p_thread_id uuid, p_kind text, p_message_id uuid, p_review jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare a balance_challenge_timing_assignments; m ig_messages; ctx jsonb; nested balance_challenge_approach_assignments; first_open uuid;
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
 select * into nested from balance_challenge_approach_assignments where assignment_id=a.id;
 if nested.assignment_id is not null and p_kind in ('training_opened','invited') then
  if p_review->>'approach_subvariant' is distinct from nested.subvariant
   or p_review->>'policy_revision' is distinct from 'challenge_approach_20261030_v1'
   or m.created_at<nested.assigned_at then raise exception 'Exact nested arm, revision and prospective delivery required'; end if;
  select v.message_id into first_open from balance_challenge_timing_events v
   where v.assignment_id=a.id and v.kind='training_opened' order by v.recorded_at limit 1;
  if p_kind='training_opened' and first_open is not null and first_open<>p_message_id
   then raise exception 'Preserve first nested exposure; do not retest'; end if;
  if nested.subvariant='A1_direct_challenge' then
   if p_review->'invitation_in_same_message' is distinct from 'true'::jsonb
     or (p_kind='invited' and first_open is distinct from p_message_id)
   then raise exception 'A1 uses one direct invitation as first exposure'; end if;
  else
   if p_kind='training_opened' and p_review->'invitation_in_same_message' is distinct from 'false'::jsonb
   then raise exception 'A2 opens fitness without an invitation'; end if;
   if p_kind='invited' and (p_review->'fitness_response_welcomed' is distinct from 'true'::jsonb
    or not exists(select 1 from ig_messages i join ig_messages o on o.id=first_open
     where i.id=(p_review->>'fitness_response_message_id')::uuid and i.thread_id=a.thread_id
     and i.direction='in' and i.created_at>o.created_at and i.created_at<m.created_at))
   then raise exception 'A2 invitation needs actual subsequent welcoming fitness response'; end if;
  end if;
 end if;
 if p_kind in ('training_opened','invited') then
  if m.direction<>'out' then raise exception 'Delivered outbound required'; end if;
  if p_review->'native_delivery_verified' is distinct from 'true'::jsonb then raise exception 'Native delivery verification required'; end if;
  if not (ctx->>'training_due')::boolean and not exists(select 1 from balance_challenge_timing_events where assignment_id=a.id and kind='timing_override')
  then raise exception 'Assigned conversation has not been reached'; end if;
 elsif p_kind in ('fitness_topic_rejected','sales_intent_concern','offer_declined','already_supported') then
  if m.direction<>'in' then raise exception 'Actual inbound evidence required'; end if;
  if nullif(trim(p_review->>'evidence_quote'),'') is null
     or coalesce(position(p_review->>'evidence_quote' in m.text),0)=0
     or nullif(trim(p_review->>'policy_revision'),'') is null
  then raise exception 'Exact inbound quote and exposure policy revision required'; end if;
  if not exists(select 1 from balance_challenge_timing_events v join ig_messages o on o.id=v.message_id
    where v.assignment_id=a.id and v.message_id=(p_review->>'exposure_message_id')::uuid
      and v.kind in ('training_opened','invited') and o.direction='out' and o.created_at<m.created_at
      and coalesce(v.review->>'policy_revision','legacy_unversioned')=p_review->>'policy_revision'
      and (p_kind<>'offer_declined' or v.kind='invited'))
  then raise exception 'Exact earlier delivered exposure required; offer decline requires invitation'; end if;
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
end $function$
;

