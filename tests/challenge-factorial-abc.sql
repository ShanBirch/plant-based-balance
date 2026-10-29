-- Six concurrent cells; controlled transactional bookkeeping only, no sender.
begin;
do $$
declare tid uuid; src uuid; opener uuid; delivered uuid; replyid uuid; inviteid uuid; chat uuid;
 a jsonb; s jsonb; r jsonb; eligibility jsonb; coach uuid; n int; ep int; failed boolean;
 seen text[]:='{}'; cell text; prior uuid;
begin
 select coach_id into coach from ig_threads where coach_id is not null limit 1;
 for n in 1..200 loop
  tid:=gen_random_uuid();src:=gen_random_uuid();opener:=gen_random_uuid();delivered:=gen_random_uuid();inviteid:=gen_random_uuid();
  insert into ig_threads(id,subscriber_id,coach_id,ig_username,channel,custom_data)
   values(tid,'controlled_'||tid,coach,'controlled_factorial_fixture_'||replace(tid::text,'-',''),'instagram','{"acquisition_mode":"organic_outreach"}');
  insert into ig_messages(id,thread_id,direction,text,created_at) values(opener,tid,'out','Controlled reply about their Story',clock_timestamp());
  insert into ig_messages(id,thread_id,direction,text,created_at) values(src,tid,'in','Controlled Story topic response',clock_timestamp());
  eligibility:='{"full_thread_reviewed":true,"organic_business":true,"reciprocal":true,"no_prior_offer":true,"no_prior_fitness_pivot":true,"independent_holds_checked":true,"not_internal_test":true,"reviewed_by":"rollback fixture","no_prior_exposure":true,"not_person_led_fitness":true}';
  a:=assign_balance_challenge_timing(tid,src,eligibility);
  s:=assign_balance_challenge_approach(tid,src,eligibility);
  assert s->>'subvariant'=(assign_balance_challenge_approach(tid,src,eligibility)->>'subvariant'),'stable approach on retry';
  assert s->>'subvariant' in ('direct_challenge','fitness_first'),'valid independent approach';
  r:=jsonb_build_object('disposition',case s->>'subvariant' when 'direct_challenge' then 'invite_challenge' else 'continue' end,
   'approachSubvariant',s->>'subvariant','trainingPivot',true,'directChallengeReason','Reviewed natural Story-topic wind-down','rapportReviewed',true);
  if a->>'variant'<>'A' then
   assert not coalesce(balance_challenge_approach_claim_allowed(tid,src,r),false),'B/C approach cannot be exposed early';
  end if;
  for ep in 2..(a->>'target_conversation')::int loop
   prior:=src;opener:=gen_random_uuid();src:=gen_random_uuid();
   insert into ig_messages(id,thread_id,direction,text,created_at) values(opener,tid,'out','Controlled separate Story opener',clock_timestamp());
   insert into ig_messages(id,thread_id,direction,text,created_at) values(src,tid,'in','Controlled new Story reply',clock_timestamp());
   perform record_balance_challenge_timing_conversation(tid,src,jsonb_build_object('full_thread_reviewed',true,'new_conversation_verified',true,
    'boundary_reason','separate_returning_exchange','previous_conversation_end_message_id',prior,'opener_message_id',opener,'summary','Controlled separate exchange','reviewed_by','fixture'));
  end loop;
  if s->>'subvariant'='direct_challenge' then
   assert not coalesce(balance_challenge_approach_claim_allowed(tid,src,r),false),'direct is not the first response: Story back-and-forth required';
  end if;
  -- Genuine Story discussion precedes either first test approach.
  chat:=gen_random_uuid();replyid:=gen_random_uuid();
  insert into ig_messages(id,thread_id,direction,text,created_at) values(chat,tid,'out','Controlled follow-on about the actual Story topic',clock_timestamp());
  insert into ig_messages(id,thread_id,direction,text,created_at) values(replyid,tid,'in','Controlled further Story detail',clock_timestamp());
  src:=replyid;
  assert balance_challenge_approach_claim_allowed(tid,src,r),'assigned approach allowed at due timing after Story chat';
  assert not balance_challenge_approach_claim_allowed(tid,src,r||'{"approachSubvariant":"wrong"}'),'cannot change assigned approach';
  insert into ig_messages(id,thread_id,direction,text,created_at) values(delivered,tid,'out','Controlled first assigned approach',clock_timestamp());
  r:=jsonb_build_object('full_thread_reviewed',true,'native_delivery_verified',true,'summary','Controlled first exposure','reviewed_by','fixture',
    'policy_revision','factorial_abc_20261030_v1','approach_subvariant',s->>'subvariant','rapport_reviewed',true,
    'invitation_in_same_message',s->>'subvariant'='direct_challenge');
  failed:=false;
  begin perform record_balance_challenge_timing_event(tid,'training_opened',delivered,r||'{"approach_subvariant":"wrong"}'); exception when others then failed:=true; end;
  assert failed,'receipt cannot relabel the approach';
  perform record_balance_challenge_timing_event(tid,'training_opened',delivered,r);
  perform record_balance_challenge_timing_event(tid,'training_opened',delivered,r);
  if s->>'subvariant'='direct_challenge' then
   perform record_balance_challenge_timing_event(tid,'invited',delivered,r);
  else
   failed:=false;
   begin perform record_balance_challenge_timing_event(tid,'invited',delivered,r); exception when others then failed:=true; end;
   assert failed,'fitness-first needs actual subsequent welcoming reply';
   replyid:=gen_random_uuid();
   insert into ig_messages(id,thread_id,direction,text,created_at) values(replyid,tid,'in','Controlled welcoming training reply',clock_timestamp());
   assert balance_challenge_approach_claim_allowed(tid,replyid,jsonb_build_object('disposition','invite_challenge','approachSubvariant',s->>'subvariant','fitnessResponseWelcomed',true)),'fitness-first can invite after welcomed response';
   insert into ig_messages(id,thread_id,direction,text,created_at) values(inviteid,tid,'out','Controlled invitation after training discussion',clock_timestamp());
   perform record_balance_challenge_timing_event(tid,'invited',inviteid,r||jsonb_build_object('fitness_response_welcomed',true,'fitness_response_message_id',replyid));
  end if;
  assert (select count(*) from balance_challenge_timing_events where assignment_id=(a->>'id')::uuid and kind='training_opened')=1,'first exposure retry deduplicates';
  cell:=(a->>'variant')||':'||(s->>'subvariant');
  if not cell=any(seen) then seen:=array_append(seen,cell); end if;
  exit when cardinality(seen)=6;
 end loop;
 assert cardinality(seen)=6,'BOTH approaches exercised in EACH of A/B/C';
 assert jsonb_array_length(balance_challenge_factorial_report()->'groups')=6,'all six reporting cells including zeros';
 assert balance_challenge_timing_report()->'factorial_abc' is not null,'main report includes six-cell layer';
 assert not has_function_privilege('authenticated','balance_challenge_factorial_report()','EXECUTE'),'private report';
 raise notice 'PASS: six cells, independent stable approach, due timing, Story rapport, exact receipts and fitness reply before invitation';
end $$;
rollback;
