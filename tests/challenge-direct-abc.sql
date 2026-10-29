-- Source/timing bookkeeping fixtures only. No sender. Every fixture rolls back.
begin;
do $$
declare tid uuid; src uuid; opener uuid; delivered uuid; response uuid; a jsonb; r jsonb;
 eligibility jsonb; coach uuid; n int; ep int; failed boolean; seen text[]:='{}'; oldsrc uuid;
begin
 assert not (select enabled from balance_challenge_approach_experiments where id='group_a_approach_20261030'),'nested test retired';
 select coach_id into coach from ig_threads where coach_id is not null limit 1;
 for n in 1..100 loop
  tid:=gen_random_uuid();src:=gen_random_uuid();opener:=gen_random_uuid();delivered:=gen_random_uuid();response:=gen_random_uuid();
  insert into ig_threads(id,subscriber_id,coach_id,ig_username,channel,custom_data)
   values(tid,'controlled_'||tid,coach,'controlled_direct_fixture_'||replace(tid::text,'-',''),'instagram','{"acquisition_mode":"organic_outreach"}');
  insert into ig_messages(id,thread_id,direction,text,created_at) values(opener,tid,'out','Controlled Story opener',clock_timestamp());
  insert into ig_messages(id,thread_id,direction,text,created_at) values(src,tid,'in','Controlled reciprocal chat answer',clock_timestamp());
  eligibility:='{"full_thread_reviewed":true,"organic_business":true,"reciprocal":true,"no_prior_offer":true,"no_prior_fitness_pivot":true,"independent_holds_checked":true,"not_internal_test":true,"reviewed_by":"rollback fixture"}';
  a:=assign_balance_challenge_timing(tid,src,eligibility);
  r:='{"disposition":"invite_challenge","challengeApproach":"direct_challenge","directChallengeReason":"Transparent free challenge invitation as the topic winds down"}';
  assert not balance_direct_challenge_claim_allowed(tid,src,r||'{"approachSubvariant":"A2_fitness_first"}'),'stale nested plan blocked';
  assert not balance_direct_challenge_claim_allowed(tid,src,'{"disposition":"continue","trainingPivot":true}'),'no compulsory fitness-first bridge';
  assert balance_direct_challenge_claim_allowed(tid,src,'{"disposition":"continue"}'),'ordinary conversation remains allowed';
  if a->>'variant'<>'A' then
   assert not coalesce(balance_direct_challenge_claim_allowed(tid,src,r),false),'B/C cannot invite early';
  end if;
  for ep in 2..(a->>'target_conversation')::int loop
   oldsrc:=src;opener:=gen_random_uuid();src:=gen_random_uuid();
   insert into ig_messages(id,thread_id,direction,text,created_at) values(opener,tid,'out','Controlled later authorised opener',clock_timestamp());
   insert into ig_messages(id,thread_id,direction,text,created_at) values(src,tid,'in','Controlled reply to later opener',clock_timestamp());
   perform record_balance_challenge_timing_conversation(tid,src,jsonb_build_object('full_thread_reviewed',true,'new_conversation_verified',true,
    'boundary_reason','separate_returning_exchange','previous_conversation_end_message_id',oldsrc,'opener_message_id',opener,'summary','Controlled separate exchange','reviewed_by','fixture'));
  end loop;
  assert balance_direct_challenge_claim_allowed(tid,src,r),'every ABC arm permits direct invitation at its assigned episode';
  assert not balance_direct_challenge_claim_allowed(tid,src,'{"disposition":"invite_challenge"}'),'cannot omit approach label';
  failed:=false;
  begin perform assign_balance_challenge_approach(tid,src,eligibility); exception when others then failed:=true; end;
  assert failed,'no new nested assignment';
  insert into ig_messages(id,thread_id,direction,text,created_at) values(delivered,tid,'out','Controlled direct free challenge invitation',clock_timestamp());
  r:='{"full_thread_reviewed":true,"native_delivery_verified":true,"summary":"Controlled actual direct invitation","reviewed_by":"fixture","policy_revision":"direct_challenge_abc_20261030_v1","challenge_approach":"direct_challenge","invitation_in_same_message":true}';
  failed:=false;
  begin perform record_balance_challenge_timing_event(tid,'training_opened',delivered,r||'{"policy_revision":"old_revision"}'); exception when others then failed:=true; end;
  assert failed,'new exposure cannot use old revision';
  perform record_balance_challenge_timing_event(tid,'training_opened',delivered,r);
  perform record_balance_challenge_timing_event(tid,'invited',delivered,r);
  perform record_balance_challenge_timing_event(tid,'invited',delivered,r);
  assert (select count(*) from balance_challenge_timing_events where assignment_id=(a->>'id')::uuid and kind='invited')=1,'retry deduplicated';
  assert not balance_direct_challenge_claim_allowed(tid,src,'{"disposition":"invite_challenge","challengeApproach":"direct_challenge","directChallengeReason":"fixture"}'),'no repeat invitation';
  insert into ig_messages(id,thread_id,direction,text,created_at) values(response,tid,'in','No thanks, already supported',clock_timestamp());
  perform record_balance_challenge_timing_event(tid,'already_supported',response,jsonb_build_object('full_thread_reviewed',true,
   'summary','Controlled explicit existing support','reviewed_by','fixture','evidence_quote','already supported',
   'exposure_message_id',delivered,'policy_revision','direct_challenge_abc_20261030_v1'));
  if not a->>'variant'=any(seen) then seen:=array_append(seen,a->>'variant'); end if;
  exit when cardinality(seen)=3;
 end loop;
 assert cardinality(seen)=3,'all three timings exercised';
 assert jsonb_array_length(balance_direct_challenge_report()->'layers')>=3,'report separates ABC timing layers';
 assert balance_challenge_timing_report()->'direct_challenge_abc' is not null,'main report contains new approach layer';
 assert not has_function_privilege('authenticated','balance_direct_challenge_claim_allowed(uuid,uuid,jsonb)','EXECUTE'),'claim guard stays private';
 raise notice 'PASS: all ABC timings, direct invitations, retired nested allocation, source-backed outcomes, no repeat and layered report';
end $$;
rollback;
