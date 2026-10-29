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
 'group_a_approach',public.balance_challenge_approach_report(),
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
 'interpretation','Prospective pilot; retain assigned-but-not-invited and overrides. New Group A has a nested approach test: report A1/A2 separately, not a clean pooled timing comparison with B/C. Small intake may remain inconclusive.') from totals t;
$function$
;
