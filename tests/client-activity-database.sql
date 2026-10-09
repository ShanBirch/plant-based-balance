-- Run in a transaction against the installed migration. Fixtures touch only the
-- new notification tables and temporary source tables. No client record changes.
begin;
do $$
declare owner uuid; client uuid; event uuid:=gen_random_uuid(); visit uuid; opened jsonb; claim record; chat record; n integer;
begin
  select owner_id into owner from public.balance_activity_settings where singleton;
  select cc.client_id into client from public.coach_clients cc
    where public.balance_activity_eligible(cc.client_id,owner) order by cc.client_id limit 1;
  if client is null then raise exception 'Fixture requires one active client'; end if;
  if (public.balance_activity_record_presence(client,event,'test-session','foreground',now())->>'accepted')::boolean is distinct from false then raise exception 'Disabled capture'; end if;
  update public.balance_activity_settings set enabled=true,enabled_since=now()-interval '1 second' where singleton;
  if public.balance_activity_eligible(owner,owner) then raise exception 'Coach exclusion'; end if;
  if (public.balance_activity_record_presence(client,gen_random_uuid(),'old-queue','foreground',now()-interval '2 seconds')->>'accepted')::boolean is distinct from false then raise exception 'Pre-enable replay'; end if;
  opened:=public.balance_activity_record_presence(client,event,'test-session','foreground',now());
  if opened->>'outbox_id' is null then raise exception 'Missing open event'; end if;
  if public.balance_activity_record_presence(client,event,'test-session','foreground',now())->>'duplicate' <> 'true' then raise exception 'Event dedupe'; end if;
  perform public.balance_activity_record_presence(client,gen_random_uuid(),'other-tab','foreground',now());
  perform public.balance_activity_record_presence(client,gen_random_uuid(),'other-tab','presence',now());
  select visit_id into visit from public.balance_activity_outbox where id=(opened->>'outbox_id')::uuid;
  if (select count(*) from public.balance_activity_outbox where visit_id=visit and event_kind='open')<>1 then raise exception 'Tab dedupe'; end if;
  if (select count(*) from public.balance_activity_visit_sources where visit_id=visit)<>2 then raise exception 'Usage join'; end if;
  select * into claim from public.balance_activity_claim((opened->>'outbox_id')::uuid,1);
  if claim.id is null then raise exception 'Transport claim'; end if;
  if exists(select 1 from public.balance_activity_claim(claim.id,1)) then raise exception 'Concurrent claim'; end if;
  if public.balance_activity_finish(claim.id,gen_random_uuid(),'fake-provider',null) then raise exception 'Wrong lease accepted'; end if;
  if not public.balance_activity_finish(claim.id,claim.claim_token,'fixture-provider',null) then raise exception 'Finish failed'; end if;
  if public.balance_activity_finish(claim.id,claim.claim_token,'fixture-provider',null) then raise exception 'Finish repeated'; end if;
  if exists(select 1 from public.balance_activity_claim_chat(claim.id,client)) then raise exception 'Owner scope'; end if;
  select * into chat from public.balance_activity_claim_chat(claim.id,owner);
  if chat.event_id is null then raise exception 'Chat claim'; end if;
  if exists(select 1 from public.balance_activity_claim_chat(claim.id,owner)) then raise exception 'Chat lease'; end if;
  update public.balance_activity_outbox set chat_lease_until=now()-interval '1 minute' where id=claim.id;
  if exists(select 1 from public.balance_activity_claim_chat(claim.id,owner)) then raise exception 'Uncertain chat auto-reclaimed'; end if;
  if not public.balance_activity_finish_chat(chat.event_id,owner,chat.claim_token,'fixture-message') then raise exception 'Chat receipt'; end if;
  if exists(select 1 from public.balance_activity_claim_chat(claim.id,owner)) then raise exception 'Chat duplicate'; end if;
  perform set_config('balance.test_client',client::text,true);
  perform set_config('balance.test_visit',visit::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',client,'role','authenticated')::text,true);
end $$;
create temp table user_activity (like public.user_activity including defaults);
create trigger balance_test_capture after insert on user_activity for each row execute function balance_activity_private.capture_action();
create temp table lesson_completions (like public.lesson_completions including defaults);
create trigger balance_test_capture after insert or update on lesson_completions for each row execute function balance_activity_private.capture_action();
create temp table workouts (like public.workouts including defaults);
create trigger balance_test_capture after insert on workouts for each row execute function balance_activity_private.capture_action();
alter table user_activity alter column activity_data set default '{}'::jsonb;
create function pg_temp.test_client_time() returns trigger language plpgsql as $$ begin new.activity_data:=new.activity_data||jsonb_build_object('client_time',coalesce(new.activity_data->>'client_time',to_char(now() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))); return new; end $$;
create trigger test_client_time before insert on user_activity for each row execute function pg_temp.test_client_time();
insert into user_activity(user_id,activity_type,activity_data) values
  (current_setting('balance.test_client')::uuid,'ui_action','{"action":"startlessongames","session_id":"test-session","answer":"PRIVATE","replay_session_id":"PRIVATE"}'),
  (current_setting('balance.test_client')::uuid,'ui_action','{"action":"dm-send-btn","session_id":"test-session"}'),
  (current_setting('balance.test_client')::uuid,'ui_action','{"action":"course","session_id":"wrong-session"}'),
  (current_setting('balance.test_client')::uuid,'ui_action','{"action":"course","session_id":"test-session","client_time":"2020-01-01T00:00:00.000Z"}'),
  (current_setting('balance.test_client')::uuid,'ui_action','{"action":"course","session_id":"test-session","client_time":"invalid"}');
insert into lesson_completions(user_id,lesson_id,unit_id,module_id,games_played,games_correct,score_percentage)
  values(current_setting('balance.test_client')::uuid,'mind-test','mind-test','mind',8,6,75);
update lesson_completions set games_correct=8,score_percentage=100;
update lesson_completions set games_correct=8,score_percentage=100;
insert into workouts(user_id,workout_type) values(current_setting('balance.test_client')::uuid,'custom_template'),(current_setting('balance.test_client')::uuid,'history');
do $$
declare v uuid:=current_setting('balance.test_visit')::uuid; n integer;
begin
  if (select count(*) from public.balance_activity_actions where visit_id=v)<>4 then raise exception 'Capture expected navigation + two scores + history, got %',(select count(*) from public.balance_activity_actions where visit_id=v); end if;
  if exists(select 1 from public.balance_activity_actions where visit_id=v and detail::text like '%PRIVATE%') then raise exception 'Private details copied'; end if;
  if (select count(*) from public.balance_activity_actions where visit_id=v and kind='navigation_tapped')<>1 then raise exception 'Navigation semantic'; end if;
  update public.balance_activity_actions set received_at=now()-interval '100 seconds' where visit_id=v;
  n:=public.balance_activity_materialize();
  if n<>1 then raise exception 'Expected one summary, got %',n; end if;
  if public.balance_activity_materialize()<>0 then raise exception 'Repeated summary'; end if;
  if exists(select 1 from public.balance_activity_actions where visit_id=v and outbox_id is null) then raise exception 'Unbatched actions'; end if;
  if has_table_privilege('authenticated','public.balance_activity_outbox','select') or has_function_privilege('anon','public.balance_activity_claim(uuid,integer)','execute') then raise exception 'Client grant leak'; end if;
end $$;
rollback;
select 'PASS: disabled gating, owner/client scope, foreground/tab/event dedupe, transport/chat leases and receipts, safe source capture, retakes, semantic grouping, private grants; all fixtures rolled back' as result;
