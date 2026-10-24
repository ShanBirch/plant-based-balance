-- Controlled fixture only. Execute with __PROGRAM__ replaced by the actual
-- canonical builder output. Every row, trigger and queued side effect rolls back.
begin;
do $$
declare uid uuid; tid uuid:=gen_random_uuid(); acceptance uuid:=gen_random_uuid(); latest uuid:=gen_random_uuid();
 prepared_result jsonb; retry jsonb; grant_row balance_free_starters; v_plan jsonb:='__PROGRAM__'::jsonb;
 notice jsonb; action ig_next_actions; token text; attempt uuid:=gen_random_uuid(); sent uuid:=gen_random_uuid();
 job balance_free_coaching_jobs; queued_job jsonb;
 review jsonb:='{"full_thread_reviewed":true,"explicit_free_month_acceptance":true,"schedule_agreed":true,"equipment_confirmed":true,"no_movement_restrictions_reported":true,"independent_holds_checked":true,"videos_verified":true,"reviewed_by":"transaction_rollback_test"}';
 notice_review jsonb:='{"full_thread_reviewed":true,"native_identity_verified":true,"independent_holds_checked":true,"no_duplicate_verified":true,"answers_latest_turn":true}';
begin
 select u.id into uid from users u where u.is_test_account
 and not exists(select 1 from ig_threads t where t.linked_user_id=u.id)
 and not exists(select 1 from custom_workout_programs p where p.user_id=u.id and p.is_active)
 and not exists(select 1 from balance_free_starters g where g.user_id=u.id)
 and not exists(select 1 from coach_clients c where c.client_id=u.id) limit 1;
 if uid is null then raise exception 'Controlled unlinked test user required'; end if;
 insert into ig_threads(id,coach_id,ig_username,profile_name,channel,subscriber_id,custom_data)
 values(tid,'00a6605e-8edb-4917-85ba-24a23f179059','internal_coached_month_test','Internal coached month test','instagram','internal_test:'||tid,'{}');
 insert into ig_messages(id,thread_id,direction,text,source) values(acceptance,tid,'in','Yes please, Tuesdays and Fridays after work at those times','internal_rollback_test');
 begin
  perform prepare_balance_free_coaching(tid,acceptance,'Australia/Brisbane','[{"weekday":2,"time":"16:30"},{"weekday":5,"time":"17:15"}]','none','Get stronger',30,v_plan,'{}');
  raise exception 'Incomplete consent accepted';
 exception when raise_exception then if sqlerrm='Incomplete consent accepted' then raise; end if; end;
 queued_job:=queue_balance_free_coaching(tid,acceptance,'Australia/Brisbane','[{"weekday":2,"time":"16:30"},{"weekday":5,"time":"17:15"}]','none','Get stronger',30,'none_reported',
 '{"full_thread_reviewed":true,"explicit_free_month_acceptance":true,"schedule_agreed":true,"equipment_confirmed":true,"movement_restrictions_reviewed":true,"independent_holds_checked":true,"reviewed_by":"rollback_test"}');
 update balance_free_coaching_jobs set created_at=now()-interval '100 years' where id=(queued_job->>'id')::uuid;
 perform refresh_free_coaching_jobs();
 if not exists(select 1 from coach_alerts where idempotency_key='free-coaching-job-attention:'||(queued_job->>'id') and status='pending') then raise exception 'Delayed worker handoff was silently lost'; end if;
 begin
  perform claim_balance_free_coaching_job('invalid-null-lease',null);
  raise exception 'Null lease accepted';
 exception when raise_exception then if sqlerrm='Null lease accepted' then raise; end if; end;
 select * into job from claim_balance_free_coaching_job('internal-rollback-worker',300);
 if job.id is distinct from (queued_job->>'id')::uuid then raise exception 'Wrong job claimed'; end if;
 if heartbeat_balance_free_coaching_job(job.id,gen_random_uuid(),'internal-rollback-worker') then raise exception 'Unowned job heartbeat succeeded'; end if;
 if not heartbeat_balance_free_coaching_job(job.id,job.claim_token,'internal-rollback-worker') then raise exception 'Owned lease heartbeat failed'; end if;
 review:=review||jsonb_build_object('setup_job_id',job.id,'setup_claim_token',job.claim_token);
 prepared_result:=prepare_balance_free_coaching(tid,acceptance,'Australia/Brisbane','[{"weekday":2,"time":"16:30"},{"weekday":5,"time":"17:15"}]','none','Get stronger',30,v_plan,review);
 retry:=prepare_balance_free_coaching(tid,acceptance,'Australia/Brisbane','[{"weekday":2,"time":"16:30"},{"weekday":5,"time":"17:15"}]','none','Get stronger',30,v_plan,review);
 if prepared_result->>'id' is distinct from retry->>'id' then raise exception 'Duplicate setup created'; end if;
 select * into grant_row from balance_free_starters where id=(prepared_result->>'grant_id')::uuid;
 if grant_row.user_id is not null or grant_row.starts_at is not null or grant_row.ends_at is not null or grant_row.experience<>'coached_month_v1' then raise exception 'Unclaimed month started early'; end if;
 if finish_balance_free_coaching_job(job.id,gen_random_uuid(),(prepared_result->>'id')::uuid,'prepared','{}') then raise exception 'Unowned job completed'; end if;
 if finish_balance_free_coaching_job(job.id,job.claim_token,(prepared_result->>'id')::uuid,'prepared','{}') then raise exception 'Unverified job completed'; end if;
 if not finish_balance_free_coaching_job(job.id,job.claim_token,(prepared_result->>'id')::uuid,'prepared',
 '{"prepared_plan_verified":true,"calendar_render_verified":true,"videos_verified":true,"invitation_verified":true,"program_suitability_checked":true,"suitability_summary":"Controlled library fixture only; no real person","verification_summary":"Actual prepared plan matched to transaction fixture","visual_proof":"internal-controlled-renderer-fixture"}') then raise exception 'Verified separate-worker job did not complete'; end if;
 if exists(select 1 from coach_alerts where idempotency_key='free-coaching-job-attention:'||job.id and status='pending') then raise exception 'Recovered setup left a stale pending alert'; end if;
 token:=split_part(prepared_result->>'invitation_url','#invite=',2);
 if length(token)<>43 then raise exception 'Invitation format mismatch'; end if;
 insert into ig_messages(id,thread_id,direction,text,source,created_at) values(latest,tid,'out','I will prepare that now','internal_rollback_test',now()+interval '1 second');
 delete from ig_next_actions where thread_id=tid;
 notice:=prepare_free_coaching_ready((prepared_result->>'id')::uuid,'Your program is prepared. Create your profile here: '||(prepared_result->>'invitation_url'),latest,notice_review);
 if notice->>'queued' is distinct from 'true' then raise exception 'Ready notice did not queue'; end if;
 select * into action from ig_next_actions where thread_id=tid;
 if not ig_free_coaching_ready_eligible(action) then raise exception 'Verified setup continuation rejected'; end if;
 update ig_next_actions set status='cancelled' where id=action.id;
 perform refresh_free_coaching_setups();
 if (select notice_status from balance_free_coaching_setups where id=(prepared_result->>'id')::uuid)<>'pending' then raise exception 'Cancelled unattempted notice stranded'; end if;
 notice:=prepare_free_coaching_ready((prepared_result->>'id')::uuid,'Your program is prepared. Create your profile here: '||(prepared_result->>'invitation_url'),latest,notice_review);
 delete from ig_next_actions where thread_id=tid;
 perform refresh_free_coaching_setups();
 if (select notice_status from balance_free_coaching_setups where id=(prepared_result->>'id')::uuid)<>'pending' then raise exception 'Missing unattempted action stranded'; end if;
 notice:=prepare_free_coaching_ready((prepared_result->>'id')::uuid,'Your program is prepared. Create your profile here: '||(prepared_result->>'invitation_url'),latest,notice_review);
 select * into action from ig_next_actions where thread_id=tid;
 update ig_next_actions set status='claimed',claim_owner='internal_rollback_test',claim_token=attempt,claim_run_id='nonexistent_internal_run',claim_expires_at=now()+interval '5 minutes' where id=action.id;
 if reserve_free_coaching_ready((prepared_result->>'id')::uuid,action.id,attempt,'nonexistent_internal_run','nonexistent_tab') then raise exception 'Browser lease bypassed'; end if;
 update ig_threads set custom_data='{"human_takeover":true}' where id=tid;
 if ig_free_coaching_ready_eligible(action) then raise exception 'Human takeover bypassed'; end if;
 update ig_threads set custom_data='{}' where id=tid;
 update balance_free_coaching_setups set notice_status='reserved',attempted_at=now(),claim_token=attempt where id=(prepared_result->>'id')::uuid;
 if record_free_coaching_ready((prepared_result->>'id')::uuid,attempt,'sent',jsonb_build_object('native_verified',true,'canonical_message_id',sent)) then raise exception 'False delivery accepted'; end if;
 if not record_free_coaching_ready((prepared_result->>'id')::uuid,attempt,'uncertain','{}') then raise exception 'Uncertainty lost'; end if;
 if exists(select 1 from free_coaching_setup_due() where id=(prepared_result->>'id')::uuid) then raise exception 'Uncertain message became retryable'; end if;
 insert into ig_messages(id,thread_id,direction,text,source,created_at) values(sent,tid,'out',action.reason->>'final_text','internal_rollback_test',now()+interval '2 seconds');
 if not record_free_coaching_ready((prepared_result->>'id')::uuid,attempt,'sent',jsonb_build_object('native_verified',true,'canonical_message_id',sent)) then raise exception 'Canonical reconciliation failed'; end if;
 if record_free_coaching_ready((prepared_result->>'id')::uuid,attempt,'sent',jsonb_build_object('native_verified',true,'canonical_message_id',sent)) then raise exception 'Duplicate delivery accepted'; end if;
 select * into grant_row from claim_balance_free_starter(uid,encode(extensions.digest(token,'sha256'),'hex'));
 if grant_row.user_id<>uid or grant_row.ends_at<>grant_row.starts_at+interval '1 month' then raise exception 'Month access dates wrong'; end if;
 if not exists(select 1 from balance_free_coaching_setups s join custom_workout_programs p on p.id=s.program_id where s.id=(prepared_result->>'id')::uuid and p.user_id=uid and p.weekly_schedule=v_plan->'weekly_schedule') then raise exception 'Wrong account or plan assigned'; end if;
 if not exists(select 1 from coach_clients where client_id=uid and coach_id='00a6605e-8edb-4917-85ba-24a23f179059' and status='active') then raise exception 'Coaching relationship missing'; end if;
 perform claim_balance_free_starter(uid,encode(extensions.digest(token,'sha256'),'hex'));
 if (select count(*) from custom_workout_programs where user_id=uid and is_active)<>1 then raise exception 'Repeated claim duplicated plan'; end if;
 begin
  perform claim_balance_free_starter(gen_random_uuid(),encode(extensions.digest(token,'sha256'),'hex'));
  raise exception 'Another account stole invitation';
 exception when raise_exception then if sqlerrm='Another account stole invitation' then raise; end if; end;
 update balance_free_starters set ends_at=now()-interval '1 second' where id=grant_row.id;
 begin
  perform claim_balance_free_starter(uid,encode(extensions.digest(token,'sha256'),'hex'));
  raise exception 'Expired invitation reopened';
 exception when raise_exception then if sqlerrm='Expired invitation reopened' then raise; end if; end;
 raise notice 'PASS: acceptance, idempotent preparation, deferred month, exact program/account, claim retry, dates, holds, native lease, delivery readback, uncertainty, no-repeat, expiry';
end $$;
select 'PASS: free coaching transaction checks; all fixtures rolled back' as result;
rollback;
