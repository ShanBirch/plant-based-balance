-- Run as service/admin. All controlled fixtures roll back; never send a message.
begin;
do $$
declare tid uuid:=gen_random_uuid(); src uuid:=gen_random_uuid(); outbound uuid:=gen_random_uuid();
 a jsonb; again jsonb; ctx jsonb; review jsonb; expected_failure boolean; coach uuid;
 next_source uuid:=gen_random_uuid(); boundary_review jsonb; opener uuid:=gen_random_uuid(); next_opener uuid:=gen_random_uuid();
 direct_opener uuid:=gen_random_uuid(); direct_reply uuid:=gen_random_uuid();
begin
 select coach_id into coach from ig_threads where coach_id is not null limit 1;
 insert into ig_threads(id,subscriber_id,coach_id,ig_username,channel,custom_data) values(tid,'controlled_'||tid::text,coach,'controlled_timing_fixture_'||replace(tid::text,'-',''),'instagram','{"acquisition_mode":"organic_outreach"}');
 insert into ig_messages(id,thread_id,direction,text,created_at) values(opener,tid,'out','replied to their story (story media attached) Controlled fixture',clock_timestamp());
 insert into ig_messages(id,thread_id,direction,text,created_at) values(src,tid,'in','Controlled reciprocal fixture',clock_timestamp());
 review:='{"full_thread_reviewed":true,"organic_business":true,"reciprocal":true,"no_prior_offer":true,"no_prior_fitness_pivot":true,"independent_holds_checked":true,"not_internal_test":true,"reviewed_by":"transaction-only controlled fixture"}';
 a:=assign_balance_challenge_timing(tid,src,review);
 again:=assign_balance_challenge_timing(tid,src,review);
 assert a->>'id'=again->>'id','assignment must be idempotent';
 assert a->>'variant' in ('A','B','C'),'valid variant';
 ctx:=balance_challenge_timing_context(tid);
 assert (ctx->>'conversation_number')::int=1,'first inbound is session one';
 assert (ctx->>'training_due')::boolean=((a->>'target_conversation')::int=1),'timing gate';
 insert into ig_messages(id,thread_id,direction,text,created_at) values(outbound,tid,'out','Controlled training opening',clock_timestamp());
 expected_failure:=false;
 begin perform record_balance_challenge_timing_event(tid,'training_opened',src,'{"full_thread_reviewed":true,"summary":"fixture","reviewed_by":"fixture","native_delivery_verified":true}');
 exception when others then expected_failure:=true; end;
 assert expected_failure,'inbound cannot count as delivered training opening';
 if (a->>'target_conversation')::int>1 then
  expected_failure:=false;
  begin perform record_balance_challenge_timing_event(tid,'training_opened',outbound,'{"full_thread_reviewed":true,"summary":"fixture","reviewed_by":"fixture","native_delivery_verified":true}');
  exception when others then expected_failure:=true; end;
  assert expected_failure,'B/C cannot silently get early exposure';
 end if;
 -- Direct lead interest is a documented override, not reassignment or withheld help.
 perform record_balance_challenge_timing_event(tid,'timing_override',src,'{"full_thread_reviewed":true,"summary":"Controlled direct request override","reviewed_by":"fixture"}');
 perform record_balance_challenge_timing_event(tid,'training_opened',outbound,'{"full_thread_reviewed":true,"summary":"Controlled opening","reviewed_by":"fixture","native_delivery_verified":true}');
 perform record_balance_challenge_timing_event(tid,'invited',outbound,'{"full_thread_reviewed":true,"summary":"Controlled invitation","reviewed_by":"fixture","native_delivery_verified":true}');
 perform record_balance_challenge_timing_event(tid,'invited',outbound,'{"full_thread_reviewed":true,"summary":"Retry bookkeeping only","reviewed_by":"fixture","native_delivery_verified":true}');
 assert (select count(*) from balance_challenge_timing_events where assignment_id=(a->>'id')::uuid and kind='invited')=1,'receipt retries must not duplicate exposure';
 expected_failure:=false;
 begin perform record_balance_challenge_timing_event(tid,'interested',outbound,'{"full_thread_reviewed":true,"summary":"fixture","reviewed_by":"fixture"}');
 exception when others then expected_failure:=true; end;
 assert expected_failure,'outbound cannot count as inbound interest';
 insert into ig_messages(id,thread_id,direction,text,created_at) values(next_opener,tid,'out','replied to their story (story media attached) Later controlled fixture',clock_timestamp());
 insert into ig_messages(id,thread_id,direction,text,created_at) values(next_source,tid,'in','A later conversational exchange fixture',clock_timestamp());
 assert (balance_challenge_timing_context(tid)->>'conversation_number')::int=1,'more messages alone must not increase conversations';
 expected_failure:=false;
 begin perform record_balance_challenge_timing_conversation(tid,next_source,'{}');
 exception when others then expected_failure:=true; end;
 assert expected_failure,'no automatic time/message-count episode';
 boundary_review:=jsonb_build_object('full_thread_reviewed',true,'new_conversation_verified',true,'boundary_reason','new_story_exchange',
 'previous_conversation_end_message_id',outbound,'story_opener_message_id',next_opener,'summary','Controlled new Story exchange after previous closure','reviewed_by','fixture');
 ctx:=record_balance_challenge_timing_conversation(tid,next_source,boundary_review);
 assert (ctx->>'conversation_number')::int=2,'verified new conversation increments once';
 ctx:=record_balance_challenge_timing_conversation(tid,next_source,boundary_review);
 assert (ctx->>'conversation_number')::int=2,'episode retries are idempotent';
 insert into ig_messages(id,thread_id,direction,text,created_at) values(direct_opener,tid,'out','Controlled Sunday direct follow-up',clock_timestamp());
 assert (balance_challenge_timing_context(tid)->>'conversation_number')::int=2,'unanswered direct follow-up does not increment';
 insert into ig_messages(id,thread_id,direction,text,created_at) values(direct_reply,tid,'in','Controlled reply to Sunday follow-up',clock_timestamp());
 boundary_review:=jsonb_build_object('full_thread_reviewed',true,'new_conversation_verified',true,'boundary_reason','separate_returning_exchange',
 'previous_conversation_end_message_id',next_source,'opener_message_id',direct_opener,'summary','Controlled later direct DM and actual reply','reviewed_by','fixture');
 ctx:=record_balance_challenge_timing_conversation(tid,direct_reply,boundary_review);
 assert (ctx->>'conversation_number')::int=3,'answered direct follow-up counts as third conversation';
 assert (ctx->>'training_due')::boolean,'all three groups eligible by third verified conversation';
 assert not has_table_privilege('anon','balance_challenge_timing_assignments','SELECT'),'private assignment table';
 assert not has_function_privilege('authenticated','assign_balance_challenge_timing(uuid,uuid,jsonb)','EXECUTE'),'private RPC';
 assert exists(select 1 from pg_class where oid='balance_challenge_timing_events'::regclass and relrowsecurity),'RLS required';
 raise notice 'PASS: idempotence, session timing, direction, overrides, receipts, permissions and RLS';
end $$;
rollback;
