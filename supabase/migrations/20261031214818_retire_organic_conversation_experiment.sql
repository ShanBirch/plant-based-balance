-- Shannon authorised prospective experiment retirement, 1 November 2026 Brisbane.
-- Historical assignments, exposures, receipts and reports are never deleted/relabelled.
update public.balance_challenge_timing_experiments set enabled=false where id='pre_christmas_timing_20261028';
update public.balance_challenge_approach_experiments set enabled=false where id in ('factorial_abc_20261030','direct_challenge_abc_20261030','group_a_approach_20261030');

CREATE OR REPLACE FUNCTION public.balance_challenge_approach_claim_allowed(p_thread_id uuid, p_source_message_id uuid, p_review jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare ctx jsonb; sid uuid; arm text; first_at timestamptz;
begin
 -- Retirement removes only experimental allocation/timing, never delivery ownership.
 if not exists(select 1 from balance_challenge_timing_experiments where id='pre_christmas_timing_20261028' and enabled)
 and not exists(select 1 from balance_challenge_approach_experiments where id='factorial_abc_20261030' and enabled) then
  if coalesce(p_review->>'trainingPivot','false')='true' or p_review->>'disposition'='invite_challenge' then
   return free_coaching_thread_allowed(p_thread_id)
    and exists(select 1 from ig_messages where id=p_source_message_id and thread_id=p_thread_id and direction='in')
    and (select id from ig_messages where thread_id=p_thread_id and direction='in' order by created_at desc,id desc limit 1)=p_source_message_id;
  end if;
  return true;
 end if;
 if coalesce(p_review->>'trainingPivot','false')<>'true' and p_review->>'disposition' is distinct from 'invite_challenge' then return true; end if;
 ctx:=balance_challenge_approach_context(p_thread_id);
 if ctx->'assignment' is null or ctx->'assignment'='null'::jsonb then
  if p_review->>'approachSubvariant' is not null then return false; end if;
  return not coalesce((ctx->>'eligible_parent')::boolean,false) or not coalesce((ctx->>'enabled')::boolean,false);
 end if;
 sid:=(ctx->'assignment'->>'assignment_id')::uuid; arm:=ctx->'assignment'->>'subvariant';
 if p_review->>'approachSubvariant' is distinct from arm then return false; end if;
 if not coalesce((balance_challenge_timing_context(p_thread_id)->>'training_due')::boolean,false)
  and not exists(select 1 from balance_challenge_timing_events where assignment_id=sid and kind='timing_override') then return false; end if;
 select min(m.created_at) into first_at from balance_challenge_timing_events v join ig_messages m on m.id=v.message_id
 where v.assignment_id=sid and v.kind='training_opened';
 if exists(select 1 from balance_challenge_timing_events where assignment_id=sid and kind='invited') and p_review->>'disposition'='invite_challenge' then return false; end if;
 if first_at is null then
  return case arm when 'direct_challenge' then p_review->>'disposition'='invite_challenge'
    and p_review->'rapportReviewed'='true'::jsonb
    and nullif(trim(p_review->>'directChallengeReason'),'') is not null
    and exists(select 1 from balance_challenge_timing_conversations c
      join ig_messages first_in on first_in.id=c.source_message_id
      join ig_messages reply on reply.id=p_source_message_id and reply.direction='in' and reply.thread_id=p_thread_id
      join ig_messages chat on chat.thread_id=p_thread_id and chat.direction='out'
       and chat.created_at>first_in.created_at and chat.created_at<reply.created_at
      where c.assignment_id=sid and c.ordinal=(select max(ordinal) from balance_challenge_timing_conversations where assignment_id=sid))
    else p_review->>'disposition'='continue' and p_review->'trainingPivot'='true'::jsonb end;
 end if;
 if arm='fitness_first' and p_review->>'disposition'='invite_challenge' then
  return p_review->'fitnessResponseWelcomed'='true'::jsonb and exists(select 1 from ig_messages
   where id=p_source_message_id and thread_id=p_thread_id and direction='in' and created_at>first_at);
 end if;
 return true;
end $function$
;

CREATE OR REPLACE FUNCTION public.balance_direct_challenge_claim_allowed(p_thread_id uuid, p_source_message_id uuid, p_review jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare ctx jsonb; aid uuid; active boolean;
begin
 -- Retirement removes only experimental allocation/timing, never delivery ownership.
 if not exists(select 1 from balance_challenge_timing_experiments where id='pre_christmas_timing_20261028' and enabled)
 and not exists(select 1 from balance_challenge_approach_experiments where id='factorial_abc_20261030' and enabled) then
  if coalesce(p_review->>'trainingPivot','false')='true' or p_review->>'disposition'='invite_challenge' then
   return free_coaching_thread_allowed(p_thread_id)
    and exists(select 1 from ig_messages where id=p_source_message_id and thread_id=p_thread_id and direction='in')
    and (select id from ig_messages where thread_id=p_thread_id and direction='in' order by created_at desc,id desc limit 1)=p_source_message_id;
  end if;
  return true;
 end if;
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
end $function$
;

CREATE OR REPLACE FUNCTION public.balance_challenge_timing_context(p_thread_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
 with assignment as (
 select a.* from balance_challenge_timing_assignments a
 join balance_challenge_timing_experiments e on e.id=a.experiment_id
 join ig_threads t on t.id=p_thread_id
 where a.experiment_id='pre_christmas_timing_20261028'
 and a.identity_key=coalesce(t.coach_id::text,'')||':instagram:'||lower(t.ig_username)
 ) select jsonb_build_object('assignment',to_jsonb(a)-'review',
 'conversation_number',(select count(*) from balance_challenge_timing_conversations c where c.assignment_id=a.id),
 'experiment_enforcement',coalesce((select enabled from balance_challenge_timing_experiments where id=a.experiment_id),false),
 'historical_training_due',(select count(*) from balance_challenge_timing_conversations c where c.assignment_id=a.id)>=a.target_conversation,
 'training_due',not coalesce((select enabled from balance_challenge_timing_experiments where id=a.experiment_id),false) or (select count(*) from balance_challenge_timing_conversations c where c.assignment_id=a.id)>=a.target_conversation,
 'events',(select coalesce(jsonb_agg(to_jsonb(v) order by recorded_at),'[]'::jsonb) from balance_challenge_timing_events v where v.assignment_id=a.id))
 from assignment a;
$function$
;

CREATE OR REPLACE FUNCTION public.balance_challenge_approach_context(p_thread_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
 select jsonb_build_object('experiment',e.id,'enabled',e.enabled,'opened_at',e.opened_at,
 'policy_revision',e.policy_revision,'assignment',to_jsonb(s)-'review',
 'experiment_enforcement',e.enabled,'eligible_parent',coalesce(e.enabled and a.variant in ('A','B','C')
 and not exists(select 1 from balance_challenge_timing_events v where v.assignment_id=a.id
 and v.kind in ('training_opened','invited','timing_override')),false))
 from balance_challenge_approach_experiments e
 left join balance_challenge_timing_assignments a on a.id=(balance_challenge_timing_context(p_thread_id)->'assignment'->>'id')::uuid
 left join balance_challenge_approach_assignments s on s.assignment_id=a.id and s.experiment_id=e.id
 where e.id='factorial_abc_20261030';
$function$
;

CREATE OR REPLACE FUNCTION public.record_balance_challenge_timing_conversation(p_thread_id uuid, p_source_message_id uuid, p_review jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare a balance_challenge_timing_assignments; m ig_messages; prior_at timestamptz; n integer;
begin
 if not exists(select 1 from balance_challenge_timing_experiments where id='pre_christmas_timing_20261028' and enabled) then
  raise exception 'Experiment retired: preserve historical conversation records; use natural-policy completion receipts';
 end if;
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
end $function$
;

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
 if p_kind in ('training_opened','invited','timing_override')
 and m.created_at>='2026-10-31T21:47:32.382975Z'::timestamptz
 and not exists(select 1 from balance_challenge_timing_experiments where id='pre_christmas_timing_20261028' and enabled) then
  raise exception 'Experiment retired: new activity belongs in natural-policy completion receipts';
 end if;
 if a.id is null or m.thread_id is distinct from a.thread_id
 or m.created_at<(select created_at from ig_messages where id=a.source_message_id)
 or (m.direction='out' and m.created_at<a.assigned_at)
 then raise exception 'Assignment and exact post-assignment canonical message required'; end if;
 if p_review->'full_thread_reviewed' is distinct from 'true'::jsonb or nullif(trim(p_review->>'summary'),'') is null
 or nullif(trim(p_review->>'reviewed_by'),'') is null then raise exception 'Meaning reviewed with evidence required'; end if;
 select * into nested from balance_challenge_approach_assignments where assignment_id=a.id;
 if nested.experiment_id='factorial_abc_20261030' and p_kind in ('training_opened','invited') then
  if p_review->>'approach_subvariant' is distinct from nested.subvariant
   or p_review->>'policy_revision' is distinct from 'factorial_abc_20261030_v1'
   or m.created_at<nested.assigned_at then raise exception 'Exact nested arm, revision and prospective delivery required'; end if;
  select v.message_id into first_open from balance_challenge_timing_events v
   where v.assignment_id=a.id and v.kind='training_opened' order by v.recorded_at limit 1;
  if p_kind='training_opened' and first_open is not null and first_open<>p_message_id
   then raise exception 'Preserve first nested exposure; do not retest'; end if;
  if nested.subvariant='direct_challenge' then
   if p_review->'rapport_reviewed' is distinct from 'true'::jsonb or p_review->'invitation_in_same_message' is distinct from 'true'::jsonb
     or (p_kind='invited' and first_open is distinct from p_message_id)
   then raise exception 'Direct approach uses one invitation as first exposure'; end if;
  else
   if p_kind='training_opened' and p_review->'invitation_in_same_message' is distinct from 'false'::jsonb
   then raise exception 'Fitness-first opens training without invitation'; end if;
   if p_kind='invited' and (p_review->'fitness_response_welcomed' is distinct from 'true'::jsonb
    or not exists(select 1 from ig_messages i join ig_messages o on o.id=first_open
     where i.id=(p_review->>'fitness_response_message_id')::uuid and i.thread_id=a.thread_id
     and i.direction='in' and i.created_at>o.created_at and i.created_at<m.created_at))
   then raise exception 'Fitness-first invitation needs actual subsequent welcoming fitness response'; end if;
  end if;
 end if;
 if p_review->>'policy_revision'='factorial_abc_20261030_v1' and nested.experiment_id is distinct from 'factorial_abc_20261030' then raise exception 'Prospective approach assignment required for current test exposure'; end if;
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
