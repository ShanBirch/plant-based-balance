-- Read-only measurement, no sender, retrospective allocation or capacity changes.
-- Preserve reviewed transition evidence before the existing action archive runs.
create or replace function public.capture_dm_decisions_review_receipt()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.owner='dm_manager' and new.status='completed'
 and jsonb_typeof(new.reason->'decisions_review')='object'
 and new.reason->'decisions_review'->>'version'='dm_decisions_review_20261029_v1'
 and new.reason->'decisions_review'->>'sourceMessageId'=new.source_message_id::text
 and new.reason->'decisions_review'->>'threadId'=new.thread_id::text
 and new.reason->'decisions_review'->>'sendAuthorized'='false' then
  new.receipt:=coalesce(new.receipt,'{}'::jsonb)||jsonb_build_object(
   'decisions_review',new.reason->'decisions_review',
   'conversation_policy_version',new.reason->>'conversation_policy_version',
   'conversation_review',new.reason->'conversation_review');
 end if;
 return new;
end $$;

-- Reusable exact-source inventory includes current and archived actions. No raw
-- conversation text or usernames are returned; service-only IDs support audits.
create or replace function public.balance_dm_reviewed_turns(p_start timestamptz,p_end timestamptz)
returns table(thread_id uuid,source_message_id uuid,inbound_at timestamptz,
 transition_kind text,review jsonb,outbound_id uuid,outbound_at timestamptz)
language sql stable security invoker set search_path=public,pg_temp as $$
 with receipts as (
  select a.thread_id,a.source_message_id,a.reason->'conversation_review' review,
   a.reason->'decisions_review' decisions,a.receipt,a.status terminal_status,a.updated_at recorded_at
  from ig_next_actions a where a.owner='dm_manager' and a.action_type='reply_inbound'
  union all
  select a.thread_id,null::uuid,a.receipt->'conversation_review',
   a.receipt->'decisions_review',a.receipt,a.terminal_status,a.archived_at
  from ig_next_action_receipts a where a.owner='dm_manager' and a.action_type='reply_inbound'
 ), sources as (
  select r.*,coalesce(r.source_message_id::text,r.decisions->>'sourceMessageId',r.receipt->>'source_message_id') source_id,
   coalesce(r.review->'transition'->>'kind',r.decisions->'transition'->>'kind') kind,
   coalesce(r.review->'transition'->'sourceMessageIds',r.decisions->'transition'->'sourceMessageIds','[]'::jsonb) source_ids
  from receipts r
 ), exact as (
  select s.*,i.id inbound_id,i.created_at inbound_time,o.id delivered_id,o.created_at delivered_at
  from sources s join ig_messages i on i.id::text=s.source_id and i.thread_id=s.thread_id and i.direction='in'
  join ig_threads t on t.id=s.thread_id and t.linked_user_id is null
   and t.custom_data->>'acquisition_mode' is distinct from 'paid_meta'
  left join lateral (
   select m.id,m.created_at from ig_messages m
   where s.terminal_status='completed' and s.receipt->>'native_verified'='true'
   and s.receipt->>'no_repeat'='true'
   and coalesce(s.receipt->>'source_message_id',i.id::text)=i.id::text
   and coalesce(s.receipt->>'reconciliation_required','false')<>'true'
   and coalesce(s.receipt->>'result',s.receipt->>'outcome','') not in ('uncertain','sent_attribution_pending')
   and (select count(distinct alias) from unnest(array[s.receipt->>'canonical_outbound_id',
     s.receipt->>'canonical_outbound_message_id',s.receipt->>'canonical_message_id',
     s.receipt->>'outbound_message_id']) alias where alias is not null)=1
   and m.thread_id=s.thread_id and m.direction='out' and m.created_at>i.created_at
   and m.id::text in (s.receipt->>'canonical_outbound_id',s.receipt->>'canonical_outbound_message_id',
     s.receipt->>'canonical_message_id',s.receipt->>'outbound_message_id')
   order by m.created_at,m.id limit 1
  ) o on true
  where i.created_at>=p_start and i.created_at<p_end and p_end>p_start
   and (s.review->>'lane'='organic_business' or
    (s.decisions->>'version'='dm_decisions_review_20261029_v1'
     and s.decisions->>'threadId'=s.thread_id::text and s.decisions->>'sourceMessageId'=i.id::text))
   and s.source_ids ? i.id::text
   and not exists(select 1 from ig_personal_contacts p where lower(p.ig_username)=lower(t.ig_username))
 ), dedup as (
  select distinct on (e.thread_id,e.inbound_id) e.* from exact e
  order by e.thread_id,e.inbound_id,(e.delivered_id is not null) desc,e.recorded_at desc
 ) select d.thread_id,d.inbound_id,d.inbound_time,d.kind,d.review,d.delivered_id,d.delivered_at from dedup d;
$$;

create or replace function public.balance_person_led_fitness_report(p_start timestamptz,p_end timestamptz)
returns jsonb language sql stable security invoker set search_path=public,pg_temp as $$
 with turns as (
  select * from balance_dm_reviewed_turns(p_start,p_end) where transition_kind='person_led_fitness'
 ), outcomes as (
  select t.*,exists(select 1 from ig_messages m where m.thread_id=t.thread_id and m.direction='in'
    and m.created_at>t.outbound_at and m.created_at<=t.outbound_at+interval '48 hours') replied,
   exists(select 1 from balance_coaching_challenge_enrolments n where n.thread_id=t.thread_id
    and n.intake_id='consistency_20261025' and n.accepted_at>=t.inbound_at
    and n.accepted_at<=t.inbound_at+interval '7 days') accepted,
   exists(select 1 from balance_coaching_challenge_progress n where n.thread_id=t.thread_id
    and n.intake_id='consistency_20261025' and n.accepted_at>=t.inbound_at
    and n.accepted_at<=t.inbound_at+interval '7 days' and n.onboarding_complete) onboarded,
   exists(select 1 from balance_coaching_challenge_enrolments n
    join balance_coaching_challenge_milestones m on m.enrolment_id=n.id
    where n.thread_id=t.thread_id and n.intake_id='consistency_20261025'
    and n.accepted_at>=t.inbound_at and n.accepted_at<=t.inbound_at+interval '7 days'
    and m.milestone='first_workout_completed') first_workout
  from turns t
 ) select jsonb_build_object('lane','person_led_fitness','start',p_start,'end',p_end,
  'reviewed_inbound_turns',count(*),'people',count(distinct thread_id),
  'verified_replies',count(outbound_id),'without_verified_reply',count(*) filter(where outbound_id is null),
  'mature_48h',count(*) filter(where outbound_at<=now()-interval '48 hours'),
  'pending_48h',count(*) filter(where outbound_at>now()-interval '48 hours'),
  'replied_mature_48h',count(*) filter(where outbound_at<=now()-interval '48 hours' and replied),
  'people_mature_7d',count(distinct thread_id) filter(where inbound_at<=now()-interval '7 days'),
  'accepted_people_mature_7d',count(distinct thread_id) filter(where inbound_at<=now()-interval '7 days' and accepted),
  'onboarded_people_mature_7d',count(distinct thread_id) filter(where inbound_at<=now()-interval '7 days' and onboarded),
  'first_workout_people_mature_7d',count(distinct thread_id) filter(where inbound_at<=now()-interval '7 days' and first_workout),
  'interpretation','Observed reviewed person-led fitness, not randomised exposure or buyer intent. Missing/unreviewed context is unknown. Turns and people have separate denominators. Acceptance is within seven days; onboarding/workout are subsequently verified milestones, not necessarily completed within seven days.') from outcomes;
$$;

create or replace function public.balance_challenge_tracking_health()
returns jsonb language sql stable security invoker set search_path=public,pg_temp as $$
 with experiment as (select * from balance_challenge_approach_experiments where id='factorial_abc_20261030'),
 parent as (
  select a.*,
   exists(select 1 from balance_challenge_timing_events v where v.assignment_id=a.id and v.kind in ('training_opened','invited','timing_override')) prior_exposure_or_override,
   exists(select 1 from ig_messages m,experiment e where m.thread_id=a.thread_id and m.direction='in' and m.created_at>=e.opened_at) fresh_inbound,
   exists(select 1 from balance_challenge_approach_assignments s where s.assignment_id=a.id and s.experiment_id='factorial_abc_20261030') approach_assigned
  from balance_challenge_timing_assignments a where a.experiment_id='pre_christmas_timing_20261028'
 ), prospective as (
  select s.*,a.thread_id from balance_challenge_approach_assignments s
  join balance_challenge_timing_assignments a on a.id=s.assignment_id where s.experiment_id='factorial_abc_20261030'
 ), turns as (
  select t.*,s.assignment_id,s.assigned_at from experiment e
  cross join lateral balance_dm_reviewed_turns(e.opened_at,now()) t
  join prospective s on s.thread_id=t.thread_id and t.outbound_at>=s.assigned_at
  where t.transition_kind is distinct from 'person_led_fitness'
 ), gaps as (
  select t.* from turns t where
   (t.review->>'trainingPivot'='true' and not exists(select 1 from balance_challenge_timing_events v where v.assignment_id=t.assignment_id and v.kind='training_opened' and v.message_id=t.outbound_id))
   or (t.review->>'disposition'='invite_challenge' and not exists(select 1 from balance_challenge_timing_events v where v.assignment_id=t.assignment_id and v.kind='invited' and v.message_id=t.outbound_id))
 ), totals as (
  select count(*) parent_assigned,
   count(*) filter(where not prior_exposure_or_override and not approach_assigned and fresh_inbound) unassigned_fresh_sources_need_review,
   count(*) filter(where not prior_exposure_or_override and not approach_assigned and not fresh_inbound) awaiting_fresh_inbound,
   count(*) filter(where prior_exposure_or_override and not approach_assigned) historical_or_override
  from parent
 ) select jsonb_build_object('revision','challenge_tracking_health_20261030_v1','checked_at',now(),
  'enabled',(select enabled from experiment),'opened_at',(select opened_at from experiment),
  'capacity',balance_coaching_challenge_status('consistency_20261025'),
  'parent_cohorts',to_jsonb(t),'approach_assigned',(select count(*) from prospective),
  'verified_exposure_receipt_gaps',(select count(*) from gaps),
  'gap_sources',coalesce((select jsonb_agg(jsonb_build_object('thread_id',thread_id,'source_message_id',source_message_id,'outbound_id',outbound_id)) from gaps),'[]'::jsonb),
  'state',case when exists(select 1 from gaps) then 'receipt_reconciliation_required'
   when not coalesce((balance_coaching_challenge_status('consistency_20261025')->>'open')::boolean,false) then 'capacity_closed'
   when t.unassigned_fresh_sources_need_review>0 then 'eligibility_review_required'
   when not exists(select 1 from prospective) then 'awaiting_eligible_activity' else 'recording' end,
  'person_led_fitness',balance_person_led_fitness_report((select opened_at from experiment),now()),
  'interpretation','Unassigned fresh sources are review candidates, not proven eligible people or lost exposures. Full history may reveal person-led fitness, prior exposure, holds or a genuine closure. Never assign retrospectively, manufacture contacts or resend to fix tracking. Compare equal mature windows and retain zero/pending/unknown cells.') from totals t;
$$;

revoke all on function public.balance_dm_reviewed_turns(timestamptz,timestamptz),
 public.balance_person_led_fitness_report(timestamptz,timestamptz),public.balance_challenge_tracking_health() from public,anon,authenticated;
grant execute on function public.balance_dm_reviewed_turns(timestamptz,timestamptz),
 public.balance_person_led_fitness_report(timestamptz,timestamptz),public.balance_challenge_tracking_health() to service_role;
