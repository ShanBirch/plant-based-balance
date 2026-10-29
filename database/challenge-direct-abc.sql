-- Supersede the nested Group A split, preserving every assignment and receipt.
update public.balance_challenge_approach_experiments set enabled=false where id='group_a_approach_20261030';
insert into public.balance_challenge_approach_experiments(id,policy_revision)
 values('direct_challenge_abc_20261030','direct_challenge_abc_20261030_v1');

create function public.balance_direct_challenge_context(p_thread_id uuid)
returns jsonb language sql stable security invoker set search_path=public,pg_temp as $$
 select jsonb_build_object('experiment',e.id,'enabled',e.enabled,'opened_at',e.opened_at,
 'policy_revision',e.policy_revision,'approach','direct_challenge',
 'timing',public.balance_challenge_timing_context(p_thread_id),
 'instruction','A/B/C retain first/second/third reciprocal conversation timing. At the due natural opportunity invite directly to the free challenge, without a gym/goal qualifier. No new subassignment. Record exact delivered invitation and revision; preserve past exposure and refusals.')
 from balance_challenge_approach_experiments e where e.id='direct_challenge_abc_20261030';
$$;

create function public.balance_direct_challenge_claim_allowed(p_thread_id uuid,p_source_message_id uuid,p_review jsonb)
returns boolean language plpgsql stable security invoker set search_path=public,pg_temp as $$
declare ctx jsonb; aid uuid; active boolean;
begin
 select enabled into active from balance_challenge_approach_experiments where id='direct_challenge_abc_20261030';
 if p_review->>'approachSubvariant' is not null then return false; end if; -- stale A1/A2 plan
 ctx:=balance_challenge_timing_context(p_thread_id); aid:=(ctx->'assignment'->>'id')::uuid;
 if not coalesce(active,false) then return p_review->>'challengeApproach' is distinct from 'direct_challenge'; end if;
 if p_review->>'challengeApproach'='direct_challenge' then
  return aid is not null and p_review->>'disposition'='invite_challenge'
   and nullif(trim(p_review->>'directChallengeReason'),'') is not null
   and exists(select 1 from ig_messages where id=p_source_message_id and thread_id=p_thread_id and direction='in')
   and not exists(select 1 from balance_challenge_timing_events where assignment_id=aid and kind='invited')
   and (coalesce((ctx->>'training_due')::boolean,false) or exists(select 1 from balance_challenge_timing_events where assignment_id=aid and kind='timing_override'));
 end if;
 if aid is not null and not exists(select 1 from balance_challenge_timing_events where assignment_id=aid and kind='invited') then
  if p_review->>'disposition'='invite_challenge' or p_review->'trainingPivot'='true'::jsonb then return false; end if;
 end if;
 return true; -- ordinary conversation, direct answers and support retain existing guards
end $$;

create function public.balance_direct_challenge_report()
returns jsonb language sql stable security invoker set search_path=public,pg_temp as $$
 with exposure as (
 select a.id,a.variant,a.thread_id,a.assigned_at,m.created_at exposed_at,
 case when a.assigned_at<(select opened_at from balance_challenge_approach_experiments where id='direct_challenge_abc_20261030')
 then 'existing_assignment' else 'new_assignment' end assignment_cohort,
 exists(select 1 from balance_challenge_timing_events old join ig_messages o on o.id=old.message_id
 where old.assignment_id=a.id and old.kind='training_opened' and o.created_at<m.created_at) prior_fitness_exposure,
 exists(select 1 from balance_challenge_timing_events old where old.assignment_id=a.id and old.kind='timing_override') timing_override
 from balance_challenge_timing_assignments a join balance_challenge_timing_events v on v.assignment_id=a.id and v.kind='invited'
 join ig_messages m on m.id=v.message_id where a.experiment_id='pre_christmas_timing_20261028'
 and v.review->>'policy_revision'='direct_challenge_abc_20261030_v1'
 ), outcomes as (
 select p.*,
 exists(select 1 from ig_messages m where m.thread_id=p.thread_id and m.direction='in' and m.created_at>p.exposed_at and m.created_at<=p.exposed_at+interval '48 hours') replied,
 exists(select 1 from balance_challenge_timing_events v join ig_messages m on m.id=v.message_id where v.assignment_id=p.id and v.kind='interested' and m.created_at>p.exposed_at and m.created_at<=p.exposed_at+interval '48 hours') interested,
 exists(select 1 from balance_coaching_challenge_enrolments n where n.thread_id=p.thread_id and n.intake_id='consistency_20261025' and n.accepted_at>=p.exposed_at and n.accepted_at<=p.exposed_at+interval '7 days') accepted,
 exists(select 1 from balance_challenge_timing_events v join ig_messages m on m.id=v.message_id where v.assignment_id=p.id and v.kind='fitness_topic_rejected' and m.created_at>p.exposed_at and m.created_at<=p.exposed_at+interval '48 hours') fitness_topic_rejected,
 exists(select 1 from balance_challenge_timing_events v join ig_messages m on m.id=v.message_id where v.assignment_id=p.id and v.kind='sales_intent_concern' and m.created_at>p.exposed_at and m.created_at<=p.exposed_at+interval '48 hours') sales_intent_concern,
 exists(select 1 from balance_challenge_timing_events v join ig_messages m on m.id=v.message_id where v.assignment_id=p.id and v.kind='offer_declined' and m.created_at>p.exposed_at and m.created_at<=p.exposed_at+interval '48 hours') offer_declined,
 exists(select 1 from balance_challenge_timing_events v join ig_messages m on m.id=v.message_id where v.assignment_id=p.id and v.kind='already_supported' and m.created_at>p.exposed_at and m.created_at<=p.exposed_at+interval '48 hours') already_supported
 from exposure p
 ), layers as (
 select variant,assignment_cohort,prior_fitness_exposure,timing_override,count(*) exposed,
 count(*) filter(where exposed_at<=now()-interval '48 hours') mature_48h,
 count(*) filter(where exposed_at>now()-interval '48 hours') pending_48h,
 count(*) filter(where exposed_at<=now()-interval '48 hours' and replied) replied_mature_48h,
 count(*) filter(where exposed_at<=now()-interval '48 hours' and interested) interested_mature_48h,
 count(*) filter(where exposed_at<=now()-interval '48 hours' and fitness_topic_rejected) fitness_topic_rejected_mature_48h,
 count(*) filter(where exposed_at<=now()-interval '48 hours' and sales_intent_concern) sales_intent_concern_mature_48h,
 count(*) filter(where exposed_at<=now()-interval '48 hours' and offer_declined) offer_declined_mature_48h,
 count(*) filter(where exposed_at<=now()-interval '48 hours' and already_supported) already_supported_mature_48h,
 count(*) filter(where exposed_at<=now()-interval '7 days') mature_7d,
 count(*) filter(where exposed_at<=now()-interval '7 days' and accepted) accepted_mature_7d
 from outcomes group by variant,assignment_cohort,prior_fitness_exposure,timing_override
 ) select jsonb_build_object('approach','direct_challenge','policy_revision','direct_challenge_abc_20261030_v1',
 'layers',coalesce(jsonb_agg(to_jsonb(l) order by variant,assignment_cohort,prior_fitness_exposure,timing_override),'[]'::jsonb),
 'interpretation','All timing arms use direct challenge invitations. Keep same-revision A/B/C and equal mature windows; separate existing assignments, prior fitness exposure and person-led overrides. Historical fitness-first is observational, not a concurrent randomised approach control. Retain the parent assignment/uninvited denominators and all four pushback categories; missing reviews are unknown.') from layers l;
$$;
revoke all on function public.balance_direct_challenge_context(uuid),public.balance_direct_challenge_claim_allowed(uuid,uuid,jsonb),public.balance_direct_challenge_report() from public,anon,authenticated;
grant execute on function public.balance_direct_challenge_context(uuid),public.balance_direct_challenge_claim_allowed(uuid,uuid,jsonb),public.balance_direct_challenge_report() to service_role;

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
 if p_kind in ('training_opened','invited') and (
  m.created_at>=(select opened_at from balance_challenge_approach_experiments where id='direct_challenge_abc_20261030' and enabled)
  or p_review->>'policy_revision'='direct_challenge_abc_20261030_v1') then
  if p_review->>'policy_revision' is distinct from 'direct_challenge_abc_20261030_v1'
   or p_review->>'challenge_approach' is distinct from 'direct_challenge'
   or p_review->'invitation_in_same_message' is distinct from 'true'::jsonb
   or m.created_at<(select opened_at from balance_challenge_approach_experiments where id='direct_challenge_abc_20261030')
  then raise exception 'New ABC exposures require actual direct invitation, current revision and prospective delivery'; end if;
 end if;
 select * into nested from balance_challenge_approach_assignments where assignment_id=a.id;
 if nested.assignment_id is not null and exists(select 1 from balance_challenge_approach_experiments where id=nested.experiment_id and enabled) and p_kind in ('training_opened','invited') then
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

