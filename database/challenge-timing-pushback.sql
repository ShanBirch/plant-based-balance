-- Add source-backed pushback categories without changing assignments or legacy receipts.
alter table public.balance_challenge_timing_events drop constraint balance_challenge_timing_events_kind_check;
alter table public.balance_challenge_timing_events add constraint balance_challenge_timing_events_kind_check check(kind in ('training_opened','invited','interested','declined','timing_override','fitness_topic_rejected','sales_intent_concern','offer_declined','already_supported'));

CREATE OR REPLACE FUNCTION public.record_balance_challenge_timing_event(p_thread_id uuid, p_kind text, p_message_id uuid, p_review jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
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

CREATE OR REPLACE FUNCTION public.balance_challenge_timing_report()
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
 with per_person as (
 select a.id,a.variant,a.thread_id,
 exists(select 1 from balance_challenge_timing_events v where v.assignment_id=a.id and kind='fitness_topic_rejected') fitness_topic_rejected,
 exists(select 1 from balance_challenge_timing_events v where v.assignment_id=a.id and kind='sales_intent_concern') sales_intent_concern,
 exists(select 1 from balance_challenge_timing_events v where v.assignment_id=a.id and kind='offer_declined') offer_declined,
 exists(select 1 from balance_challenge_timing_events v where v.assignment_id=a.id and kind='already_supported') already_supported,
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
 count(p.id) filter(where fitness_topic_rejected) fitness_topic_rejected,
 count(p.id) filter(where sales_intent_concern) sales_intent_concern,
 count(p.id) filter(where offer_declined) offer_declined,
 count(p.id) filter(where already_supported) already_supported,
 count(p.id) filter(where not invited) not_yet_invited
 from (values('A'),('B'),('C')) v(variant) left join per_person p using(variant) group by v.variant
 ) select jsonb_build_object('experiment','pre_christmas_timing_20261028','groups',jsonb_agg(to_jsonb(t) order by variant),
 'pushback_cohorts',(select coalesce(jsonb_agg(to_jsonb(c)),'[]'::jsonb) from (
 select a.variant,coalesce(v.review->>'policy_revision','legacy_unversioned') policy_revision,
 v.kind,count(distinct a.id) accounts from balance_challenge_timing_assignments a
 join balance_challenge_timing_events v on v.assignment_id=a.id
 where a.experiment_id='pre_christmas_timing_20261028'
 group by a.variant,coalesce(v.review->>'policy_revision','legacy_unversioned'),v.kind
 order by 1,2,3) c),
 'pushback_measurement',jsonb_build_object('revision','natural_transition_20261030_v1',
 'starts_at',(select min(recorded_at) from balance_challenge_timing_events where kind in ('fitness_topic_rejected','sales_intent_concern','offer_declined','already_supported')),
 'note','Distinct assigned accounts per category; categories can overlap. Legacy declined is invitation refusal, not total pushback. Missing labels are unknown, not evidence of no pushback.'),
 'capacity',balance_coaching_challenge_status('consistency_20261025'),
 'interpretation','Prospective pilot; retain assigned-but-not-invited and overrides. No winner from five remaining places.') from totals t;
$function$
;

