-- Controlled bookkeeping only; no browser, sender or real-person exposure. Roll back all fixtures.
begin;
do $$
declare tid uuid; src uuid; opener uuid; outid uuid; replyid uuid; inviteid uuid;
 a jsonb; s jsonb; again jsonb; r jsonb; eligible jsonb; coach uuid; n int;
 got_a1 boolean:=false; got_a2 boolean:=false; got_b boolean:=false; failed boolean;
begin
 if not (select enabled from balance_challenge_approach_experiments where id='group_a_approach_20261030') then
  assert (select enabled from balance_challenge_approach_experiments where id='factorial_abc_20261030'),'retired nested test has active successor';
  raise notice 'Historical nested test retired; current contrast tests are in challenge-direct-abc.sql';
  return;
 end if;
 select coach_id into coach from ig_threads where coach_id is not null limit 1;
 for n in 1..100 loop
  tid:=gen_random_uuid(); src:=gen_random_uuid(); opener:=gen_random_uuid(); outid:=gen_random_uuid();
  replyid:=gen_random_uuid(); inviteid:=gen_random_uuid();
  insert into ig_threads(id,subscriber_id,coach_id,ig_username,channel,custom_data)
   values(tid,'controlled_'||tid,coach,'controlled_approach_fixture_'||replace(tid::text,'-',''),'instagram','{"acquisition_mode":"organic_outreach"}');
  insert into ig_messages(id,thread_id,direction,text,created_at) values(opener,tid,'out','Controlled original opener',clock_timestamp());
  insert into ig_messages(id,thread_id,direction,text,created_at) values(src,tid,'in','Controlled reciprocal answer',clock_timestamp());
  eligible:='{"full_thread_reviewed":true,"organic_business":true,"reciprocal":true,"no_prior_offer":true,"no_prior_fitness_pivot":true,"independent_holds_checked":true,"not_internal_test":true,"reviewed_by":"rollback fixture","no_prior_exposure":true,"not_person_led_fitness":true}';
  a:=assign_balance_challenge_timing(tid,src,eligible);
  if a->>'variant'<>'A' then
   failed:=false;
   begin perform assign_balance_challenge_approach(tid,src,eligible); exception when others then failed:=true; end;
   assert failed,'B/C cannot enter Group A subtest'; got_b:=true;
  else
   assert not balance_challenge_approach_claim_allowed(tid,src,'{"disposition":"invite_challenge"}'), 'cannot omit subassignment before new A exposure';
   failed:=false;
   begin perform assign_balance_challenge_approach(tid,opener,eligible); exception when others then failed:=true; end;
   assert failed,'outbound cannot be assignment source';
   s:=assign_balance_challenge_approach(tid,src,eligible);
   again:=assign_balance_challenge_approach(tid,src,eligible);
   assert s->>'subvariant'=again->>'subvariant','subvariant persists on retry';
   assert not balance_challenge_approach_claim_allowed(tid,src,'{"disposition":"invite_challenge","approachSubvariant":"wrong"}'), 'wrong approach blocked';
   insert into ig_messages(id,thread_id,direction,text,created_at) values(outid,tid,'out','Controlled first approach',clock_timestamp());
   r:=jsonb_build_object('full_thread_reviewed',true,'native_delivery_verified',true,'summary','Controlled exposure','reviewed_by','fixture',
    'policy_revision','challenge_approach_20261030_v1','approach_subvariant',s->>'subvariant',
    'invitation_in_same_message',s->>'subvariant'='A1_direct_challenge');
   if s->>'subvariant'='A1_direct_challenge' then
    got_a1:=true;
    assert balance_challenge_approach_claim_allowed(tid,src,jsonb_build_object('disposition','invite_challenge','approachSubvariant',s->>'subvariant')),'A1 direct invitation allowed';
    assert not balance_challenge_approach_claim_allowed(tid,src,jsonb_build_object('disposition','continue','trainingPivot',true,'approachSubvariant',s->>'subvariant')),'A1 cannot silently become fitness first';
    perform record_balance_challenge_timing_event(tid,'training_opened',outid,r);
    perform record_balance_challenge_timing_event(tid,'invited',outid,r);
   else
    got_a2:=true;
    assert balance_challenge_approach_claim_allowed(tid,src,jsonb_build_object('disposition','continue','trainingPivot',true,'approachSubvariant',s->>'subvariant')),'A2 fitness bridge allowed';
    assert not balance_challenge_approach_claim_allowed(tid,src,jsonb_build_object('disposition','invite_challenge','approachSubvariant',s->>'subvariant')),'A2 cannot start with invitation';
    failed:=false;
    begin perform record_balance_challenge_timing_event(tid,'training_opened',outid,r||'{"invitation_in_same_message":true}'); exception when others then failed:=true; end;
    assert failed,'wrong first receipt rejected';
    perform record_balance_challenge_timing_event(tid,'training_opened',outid,r);
    failed:=false;
    begin perform record_balance_challenge_timing_event(tid,'invited',outid,r); exception when others then failed:=true; end;
    assert failed,'A2 cannot invite without actual fitness reply';
    insert into ig_messages(id,thread_id,direction,text,created_at) values(replyid,tid,'in','Controlled welcoming fitness reply',clock_timestamp());
    assert balance_challenge_approach_claim_allowed(tid,replyid,jsonb_build_object('disposition','invite_challenge','approachSubvariant',s->>'subvariant','fitnessResponseWelcomed',true)),'A2 can invite after actual welcomed response';
    insert into ig_messages(id,thread_id,direction,text,created_at) values(inviteid,tid,'out','Controlled invitation after fitness reply',clock_timestamp());
    perform record_balance_challenge_timing_event(tid,'invited',inviteid,r||jsonb_build_object('fitness_response_welcomed',true,'fitness_response_message_id',replyid));
   end if;
   perform record_balance_challenge_timing_event(tid,'training_opened',outid,r);
   assert (select count(*) from balance_challenge_timing_events where assignment_id=(a->>'id')::uuid and kind='training_opened')=1,'no duplicate first exposure';
  end if;
  exit when got_a1 and got_a2 and got_b;
 end loop;
 assert got_a1 and got_a2 and got_b,'both nested arms and B/C exclusion exercised';
 assert jsonb_array_length(balance_challenge_approach_report()->'groups')=2,'nested report has both arms';
 assert not has_table_privilege('anon','balance_challenge_approach_assignments','SELECT'),'nested assignment private';
 assert not has_function_privilege('authenticated','assign_balance_challenge_approach(uuid,uuid,jsonb)','EXECUTE'),'nested assignment RPC private';
 raise notice 'PASS: stable assignment, prospective A only, both approaches, source/direction, real response, receipts, report and access controls';
end $$;
rollback;
