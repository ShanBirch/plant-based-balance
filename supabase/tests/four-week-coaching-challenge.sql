-- Controlled transaction fixtures only. No messages are delivered.
begin;
do $$
declare tid uuid; mid uuid; first_tid uuid; first_mid uuid; first_reservation uuid;
 result jsonb; review jsonb; i integer; coach uuid; other_mid uuid;
begin
 select id into coach from users where id='00a6605e-8edb-4917-85ba-24a23f179059';
 -- Isolate the capacity fixture from actual intake reservations inside this rollback.
 perform 1 from balance_coaching_challenge_intakes where id='consistency_20261025' for update;
 if exists(select 1 from balance_coaching_challenge_enrolments) then raise exception 'Run capacity fixture before enrolment or in an isolated test database'; end if;
 for i in 1..7 loop
  tid:=gen_random_uuid(); mid:=gen_random_uuid();
  insert into ig_threads(id,coach_id,ig_username,profile_name,channel,subscriber_id,custom_data)
  values(tid,coach,'internal_challenge_'||tid,'Internal rollback challenge','instagram','internal_test:'||tid,'{}');
  insert into ig_messages(id,thread_id,direction,text,source)
  values(mid,tid,'in','I train twice a week on my own and would like help sticking with it. Yes to four free weeks and optional $14.99/week after, no automatic billing.','internal_rollback_test');
  review:=jsonb_build_object('full_thread_reviewed',true,'organic_fit_verified',true,'routine_understood',true,
   'existing_support_understood',true,'help_wanted',true,'terms_disclosed',true,'explicit_challenge_acceptance',true,
   'independent_holds_checked',true,'reviewed_by','rollback_fixture','routine_summary','Two sessions weekly',
   'existing_support_summary','Own routine, no coach','help_wanted_summary','Wants consistency support','source_message_ids',jsonb_build_array(mid));
  if i=1 then
   first_tid:=tid; first_mid:=mid;
   begin
    perform reserve_balance_coaching_challenge(tid,mid,review||'{"help_wanted":false}');
    raise exception 'Missing help signal accepted';
   exception when raise_exception then if sqlerrm='Missing help signal accepted' then raise; end if; end;
   update ig_threads set custom_data='{"human_takeover":true}' where id=tid;
   begin
    perform reserve_balance_coaching_challenge(tid,mid,review);
    raise exception 'Independent hold bypassed';
   exception when raise_exception then if sqlerrm='Independent hold bypassed' then raise; end if; end;
   update ig_threads set custom_data='{}' where id=tid;
   begin
    perform queue_balance_free_coaching(tid,mid,'Australia/Brisbane','[{"weekday":2,"time":"16:30"}]','none','Move regularly',20,'none_reported',
     '{"full_thread_reviewed":true,"explicit_free_month_acceptance":true,"schedule_agreed":true,"equipment_confirmed":true,"movement_restrictions_reviewed":true,"independent_holds_checked":true,"reviewed_by":"rollback"}');
    raise exception 'Unreserved queue bypass accepted';
   exception when raise_exception then if sqlerrm='Unreserved queue bypass accepted' then raise; end if; end;
  end if;
  if i<7 then
   result:=reserve_balance_coaching_challenge(tid,mid,review);
   if i=1 then first_reservation:=(result->>'id')::uuid; end if;
   if reserve_balance_coaching_challenge(tid,mid,review)->>'id'<>result->>'id' then raise exception 'Retry duplicated reservation'; end if;
  else
   begin
    perform reserve_balance_coaching_challenge(tid,mid,review);
    raise exception 'Seventh place accepted';
   exception when raise_exception then if sqlerrm='Seventh place accepted' then raise; end if; end;
  end if;
 end loop;
 if balance_coaching_challenge_status()->>'remaining'<>'0' or balance_coaching_challenge_status()->>'open'<>'false' then raise exception 'Full intake still open'; end if;
 result:=queue_balance_free_coaching(first_tid,first_mid,'Australia/Brisbane','[{"weekday":2,"time":"16:30"}]','none','Move regularly',20,'none_reported',
 '{"full_thread_reviewed":true,"explicit_free_month_acceptance":true,"schedule_agreed":true,"equipment_confirmed":true,"movement_restrictions_reviewed":true,"independent_holds_checked":true,"reviewed_by":"rollback"}');
 if result#>>'{input,durationDays}'<>'28' then raise exception 'Challenge job lost four-week duration'; end if;
 if result#>>'{input,challengeEnrolmentId}'<>first_reservation::text then raise exception 'Wrong challenge job attribution'; end if;
 if record_balance_challenge_milestone(first_reservation,'week_1_review','internal:review','Controlled fixture only','rollback') is not true then raise exception 'Milestone missing'; end if;
 if record_balance_challenge_milestone(first_reservation,'week_1_review','internal:review','Controlled fixture only','rollback') is not false then raise exception 'Duplicate milestone'; end if;
 begin
  perform record_balance_challenge_milestone(first_reservation,'paid_agreement',mid::text,'Wrong person','rollback');
  raise exception 'Foreign paid agreement accepted';
 exception when raise_exception then if sqlerrm='Foreign paid agreement accepted' then raise; end if; end;
 begin
  perform record_balance_challenge_milestone(first_reservation,'payment_confirmed','friendly_reply','No actual payment','rollback');
  raise exception 'Reply counted as payment';
 exception when raise_exception then if sqlerrm='Reply counted as payment' then raise; end if; end;
 if has_function_privilege('authenticated','reserve_balance_coaching_challenge(uuid,uuid,jsonb)','execute')
 or has_table_privilege('anon','balance_coaching_challenge_enrolments','select') then raise exception 'Public intake access exposed'; end if;
end $$;
select 'PASS: six-place cap, idempotency, help and hold gates, queue bypass, duration attribution, milestone evidence and service-only permissions' as result;
rollback;
