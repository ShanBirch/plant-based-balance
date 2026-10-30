-- A separately verified check-in-only variant; no invented workout inputs.
create or replace function public.prepare_balance_support_coaching(p_thread_id uuid,p_acceptance_message_id uuid,p_timezone text,p_run_id text,p_review jsonb)
returns jsonb language plpgsql security invoker set search_path=public,extensions,pg_temp as $$
declare t ig_threads; e balance_coaching_challenge_enrolments; j balance_free_coaching_jobs; s balance_free_coaching_setups; g uuid; token text; source_id jsonb;
begin
 select * into t from ig_threads where id=p_thread_id for update;
 if t.id is null or not free_coaching_thread_allowed(t.id) then raise exception 'Current identity and independent holds required'; end if;
 select * into e from balance_coaching_challenge_enrolments where thread_id=t.id and acceptance_message_id=p_acceptance_message_id and intake_id='consistency_20261025';
 if e.id is null then raise exception 'Exact accepted challenge reservation required'; end if;
 if nullif(trim(p_run_id),'') is null or not exists(select 1 from pg_timezone_names where name=p_timezone) then raise exception 'Named worker and confirmed timezone required'; end if;
 if not coalesce(p_review @> '{"full_thread_reviewed":true,"support_only_accepted":true,"preserve_external_training":true,"independent_holds_checked":true,"no_reminder_consent_assumed":true}',false)
 or nullif(trim(p_review->>'reviewed_by'),'') is null or nullif(trim(p_review->>'support_summary'),'') is null
 or jsonb_typeof(p_review->'source_message_ids') is distinct from 'array' or jsonb_array_length(p_review->'source_message_ids')=0
 then raise exception 'Reviewed support-only consent and source evidence required'; end if;
 for source_id in select value from jsonb_array_elements(p_review->'source_message_ids') loop
  if not exists(select 1 from ig_messages where id=(source_id#>>'{}')::uuid and thread_id=t.id and direction='in') then raise exception 'Support source belongs to another conversation'; end if;
 end loop;
 select * into j from balance_free_coaching_jobs where thread_id=t.id for update;
 if j.id is not null then
  if j.input->>'mode' is distinct from 'support_only' or j.acceptance_message_id<>p_acceptance_message_id then raise exception 'Preserve existing setup agreement'; end if;
  if j.status='claimed' and j.claim_run_id=p_run_id and j.claim_expires_at>now() then
   return jsonb_build_object('job',to_jsonb(j),'setup',(select to_jsonb(x) from balance_free_coaching_setups x where x.id=j.setup_id));
  end if;
  if j.status='prepared' then return jsonb_build_object('job',to_jsonb(j),'setup',(select to_jsonb(x) from balance_free_coaching_setups x where x.id=j.setup_id)); end if;
  raise exception 'Existing setup ownership needs reconciliation';
 end if;
 if t.linked_user_id is not null or exists(select 1 from balance_free_starters where thread_id=t.id) then raise exception 'Preserve existing member access'; end if;
 insert into balance_free_coaching_jobs(thread_id,acceptance_message_id,input,review,status,claim_token,claim_run_id,claim_expires_at,attempts)
 values(t.id,p_acceptance_message_id,jsonb_build_object('mode','support_only','timezone',p_timezone,'reservation_id',e.id),p_review,'claimed',gen_random_uuid(),p_run_id,now()+interval '5 minutes',1) returning * into j;
 token:=rtrim(translate(encode(gen_random_bytes(32),'base64'),'+/','-_'),'=');
 insert into balance_free_starters(token_hash,thread_id,workouts_ready,experience,setup)
 values(encode(digest(token,'sha256'),'hex'),t.id,true,'coached_month_v1',jsonb_build_object('supportOnly',true,'timezone',p_timezone,'challengeIntakeId',e.intake_id,'challengeEnrolmentId',e.id,'schedule','[]'::jsonb)) returning id into g;
 insert into balance_free_coaching_setups(thread_id,acceptance_message_id,grant_id,program,review,invitation_url)
 values(t.id,p_acceptance_message_id,g,'{"mode":"support_only","preserve_external_training":true}',p_review,'https://plantbased-balance.org/free-starter.html#invite='||token) returning * into s;
 update balance_free_coaching_jobs set setup_id=s.id where id=j.id returning * into j;
 return jsonb_build_object('job',to_jsonb(j),'setup',to_jsonb(s));
end $$;

create or replace function public.finish_balance_support_coaching(p_job_id uuid,p_claim_token uuid,p_run_id text,p_receipt jsonb)
returns boolean language plpgsql security invoker set search_path=public,pg_temp as $$
declare j balance_free_coaching_jobs;
begin
 select * into j from balance_free_coaching_jobs where id=p_job_id for update;
 if j.id is null or j.input->>'mode' is distinct from 'support_only' or j.status<>'claimed' or j.claim_token is distinct from p_claim_token
 or j.claim_run_id is distinct from p_run_id or j.claim_expires_at<=now() or not free_coaching_thread_allowed(j.thread_id)
 or not coalesce(p_receipt @> '{"support_access_verified":true,"invitation_verified":true,"program_preservation_verified":true,"onboarding_verified":true,"inbox_path_verified":true}',false)
 or nullif(p_receipt->>'verification_summary','') is null or nullif(p_receipt->>'visual_proof','') is null
 or not exists(select 1 from balance_free_coaching_setups s join balance_free_starters g on g.id=s.grant_id where s.id=j.setup_id and s.thread_id=j.thread_id and s.acceptance_message_id=j.acceptance_message_id and s.program->>'mode'='support_only' and g.setup->>'supportOnly'='true') then return false; end if;
 update balance_free_coaching_jobs set status='prepared',receipt=p_receipt,last_error=null,updated_at=now() where id=j.id;
 return true;
end $$;
revoke all on function public.prepare_balance_support_coaching(uuid,uuid,text,text,jsonb),public.finish_balance_support_coaching(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.prepare_balance_support_coaching(uuid,uuid,text,text,jsonb),public.finish_balance_support_coaching(uuid,uuid,text,jsonb) to service_role;

-- The existing claim/send/no-repeat guards still require a prepared worker job.
-- Branch before the programme-assignment path, leaving that path unchanged.
do $$ declare definition text; needle text:=' if invitation.user_id is null then'; begin
 select pg_get_functiondef(oid) into definition from pg_proc where pronamespace='public'::regnamespace and proname='claim_balance_free_starter';
 if position('Support-only worker verification required' in definition)>0 then return; end if;
 if position(needle in definition)=0 then raise exception 'Claim contract changed'; end if;
 execute replace(definition,needle,$branch$
 if invitation.setup->>'supportOnly'='true' then
  select * into t from ig_threads where id=invitation.thread_id for update;
  select * into prepared from balance_free_coaching_setups where grant_id=invitation.id for update;
  if invitation.experience<>'coached_month_v1' or invitation.setup->>'challengeIntakeId' is distinct from 'consistency_20261025'
  or not free_coaching_thread_allowed(t.id) or prepared.program->>'mode' is distinct from 'support_only'
  or not exists(select 1 from balance_coaching_challenge_enrolments e where e.id=(invitation.setup->>'challengeEnrolmentId')::uuid and e.thread_id=t.id and e.acceptance_message_id=prepared.acceptance_message_id)
  or not exists(select 1 from balance_free_coaching_jobs j where j.setup_id=prepared.id and j.status='prepared' and j.input->>'mode'='support_only' and j.receipt->>'program_preservation_verified'='true') then raise exception 'Support-only worker verification required'; end if;
  if invitation.ends_at<=now() then raise exception 'Your four free weeks have ended'; end if;
  if invitation.user_id is null then
   if t.linked_user_id is not null and t.linked_user_id<>p_user_id then raise exception 'Account identity needs review'; end if;
   if exists(select 1 from coach_clients where client_id=p_user_id and coach_id=t.coach_id and status<>'active') then raise exception 'Paused or ended coaching needs individual review'; end if;
   insert into coach_clients(coach_id,client_id,status) values(t.coach_id,p_user_id,'active') on conflict do nothing;
   update balance_free_starters set user_id=p_user_id,claimed_at=now(),starts_at=now(),ends_at=now()+interval '28 days' where id=invitation.id returning * into invitation;
   update ig_threads set linked_user_id=p_user_id,updated_at=now() where id=t.id and linked_user_id is null;
  end if;
  return next invitation;
  return;
 end if;
 if invitation.user_id is null then
 $branch$);
end $$;
