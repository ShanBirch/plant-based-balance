-- Run with the repair SQL prepended. The final sentinel exception rolls back
-- all definitions and fixture changes. A successful run MUST report WORKOUT_FIXTURE_PASS.
do $test$
declare
 t uuid:='18cf8236-f4e6-4fce-9b9b-2827e908fa53';
 s uuid:='6afe5871-fb7c-4c49-a1a4-abbaf48c597a';
 v uuid:='3cf77501-41fa-4da1-a9f2-375078b3dd1f';
 a ig_next_actions; q ig_next_actions; proof jsonb; review jsonb; result jsonb;
 state text; n bigint; newer uuid; original_text text;
begin
 perform 1 from ig_threads where id=t for update;
 select * into a from ig_next_actions where thread_id=t for update;
 assert a.action_type='reply_inbound' and a.status='ready' and a.source_message_id=s and a.receipt='{}', 'fixture source changed';
 assert not exists(select 1 from ig_messages where thread_id=t and (created_at,id)>(select created_at,id from ig_messages where id=s)), 'fixture latest changed';
 select count(*) into n from ig_messages where thread_id=t;
 update workout_accountability_events set status='pending',due_at=now()-interval '1 minute',expires_at=now()+interval '1 hour' where id=v;
 proof:=jsonb_build_object('classification','acknowledged_closed','native_identity_verified',true,'full_thread_reviewed',true,
  'native_reaction_verified',true,'reaction_suitable',true,'no_open_turn',true,'no_repeat',true,
  'source_message_id',s,'thread_id',t,'source_text',(select text from ig_messages where id=s),
  'action_id',a.id,'action_version',a.action_version,'reviewed_by','controlled_fixture',
  'native_evidence','fixture-only-never-delivery','reaction','heart','reviewed_at',now());
 review:='{"full_thread_reviewed":true,"native_identity_verified":true,"independent_holds_checked":true,"no_duplicate_verified":true}';
 assert workout_acknowledged_inbound_proof(t,s,proof), 'complete proof accepted';
 assert not workout_acknowledged_inbound_proof(t,s,proof-'native_reaction_verified'), 'missing native proof rejected';
 assert not workout_acknowledged_inbound_proof(t,s,proof||'{"source_message_id":"wrong"}'), 'wrong source rejected';
 assert not workout_acknowledged_inbound_proof(t,s,proof||'{"source_text":"different"}'), 'wrong text rejected';
 assert not workout_acknowledged_inbound_proof(t,s,proof||'{"reviewed_at":"invalid"}'), 'malformed timestamp rejected';
 begin
  perform prepare_workout_accountability(v,'fixture',s,review);
  raise exception 'missing proof unexpectedly passed';
 exception when raise_exception then
  if sqlerrm<>'Answer fresh inbound first' then raise; end if;
 end;
 review:=review||jsonb_build_object('acknowledged_inbound',proof);
 foreach state in array array['waiting','needs_you','blocked','claimed','cooldown'] loop
  update ig_next_actions set status=state,safe_after=now()+interval '1 hour', claim_owner=case when state='claimed' then 'fixture' end, claim_token=case when state='claimed' then gen_random_uuid() end, claim_expires_at=case when state='claimed' then now()+interval '1 hour' end where id=a.id;
  result:=prepare_workout_accountability(v,'fixture',s,review);
  assert result->>'queued'='false', 'healthy competing status preserved: '||state;
  assert (select status=state from ig_next_actions where id=a.id), 'no silent status override';
 end loop;
 update ig_next_actions set status='ready',receipt='{"outbound_attempted":true}' where id=a.id;
 result:=prepare_workout_accountability(v,'fixture',s,review);
 assert result->>'queued'='false', 'attempt receipt preserved';
 update ig_next_actions set receipt='{}',claim_token=gen_random_uuid() where id=a.id;
 -- Clearing the simulated attempt archives it; remove only this fixture artifact.
 delete from ig_next_action_receipts where action_id=a.id and action_version=a.action_version and receipt='{"outbound_attempted":true}'::jsonb;
 result:=prepare_workout_accountability(v,'fixture',s,review);
 assert result->>'queued'='false', 'claimed tuple preserved';
 update ig_next_actions set claim_token=null where id=a.id;
 result:=prepare_workout_accountability(v,'fixture',s,review);
 assert result->>'queued'='true', 'reviewed closer queues';
 select * into q from ig_next_actions where id=a.id;
 assert q.action_version=a.action_version+1 and q.action_type='reactivation', 'focused action successor';
 assert exists(select 1 from ig_next_action_receipts where action_id=a.id and action_version=a.action_version
  and terminal_status='completed' and receipt->>'result'='acknowledged_closed'
  and receipt->>'outbound_attempted'='false'), 'exact closure archived without fake outbound';
 assert ig_workout_accountability_action_eligible(q), 'matching closure eligible';
 q.reason:=q.reason||jsonb_build_object('acknowledged_inbound',proof||'{"reaction":"changed"}');
 assert not ig_workout_accountability_action_eligible(q), 'unarchived proof rejected';
 select * into q from ig_next_actions where id=a.id;
 assert not reserve_workout_accountability(v,a.id,gen_random_uuid(),'fixture-no-lease','fixture'), 'reservation ownership preserved';
 update workout_accountability_events set status='sent',attempted_at=now() where id=v;
 assert not ig_workout_accountability_action_eligible(q), 'sent event no-repeat';
 begin
  perform prepare_workout_accountability(v,'fixture',s,review);
  raise exception 'attempted event unexpectedly passed';
 exception when raise_exception then
  if sqlerrm<>'Reminder not eligible' then raise; end if;
 end;
 update workout_accountability_events set status='queued',attempted_at=null where id=v;
 select text into original_text from ig_messages where id=s;
 update ig_messages set text='Thanks, but my knee hurts. What should I do?' where id=s;
 assert not ig_workout_accountability_action_eligible(q), 'substantive changed source protected';
 update ig_messages set text=original_text where id=s;
 insert into ig_messages(thread_id,direction,text,created_at,source)
 values(t,'in','Controlled fresh substantive inbound fixture',now(),'controlled_fixture') returning id into newer;
 assert not ig_workout_accountability_action_eligible(q), 'newer inbound invalidates eligibility';
 assert not workout_acknowledged_inbound_proof(t,s,proof), 'old closure cannot cover newer inbound';
 assert (select count(*)=n+1 from ig_messages where thread_id=t), 'no outbound fabricated';
 raise exception 'WORKOUT_FIXTURE_PASS: exact proof, queue reconciliation, competing statuses, attempts, ownership, no-repeat, fresh substantive inbound; ALL ROLLED BACK';
end $test$;
