-- Shannon, 26 October 2026: migrate the existing sole responder to its own
-- Instagram tab. Keep the MBS coordination scope to exclude an old sender.
create or replace function public.ig_native_reactive_action_eligible(a public.ig_next_actions)
returns boolean language sql stable set search_path=public,pg_temp as $gate$
 select exists(select 1 from public.ig_threads t where t.id=a.thread_id
 and t.channel='instagram' and lower(t.ig_username)=lower(a.ig_username))
 and (
 (a.owner='dm_manager' and a.action_type in ('reply_inbound','close_sale')
 and exists(select 1 from public.ig_messages m where m.id=a.source_message_id
 and m.thread_id=a.thread_id and m.direction='in'))
 or public.ig_mbs_user_requested_checkin_eligible(a)
 or public.ig_workout_accountability_action_eligible(a)
 or public.ig_free_coaching_ready_eligible(a)
 or public.ig_client_onboarding_support_eligible(a));
$gate$;
revoke all on function public.ig_native_reactive_action_eligible(public.ig_next_actions) from public,anon,authenticated;
grant execute on function public.ig_native_reactive_action_eligible(public.ig_next_actions) to service_role;

do $patch$
declare d text; marker text; n text;
begin
 select pg_get_functiondef('public.valid_ig_browser_surface(jsonb,text)'::regprocedure) into d;
 -- PostgreSQL quoted strings below intentionally match the installed definition.
 marker:='lane IN (''plant_based_discovery_follows''';
 if position('''missed_dm_audit'',''plant_based_discovery_follows''' in d)=0 then
  if position(marker in d)=0 then raise exception 'surface validator changed'; end if;
  execute replace(d,marker,'lane IN (''missed_dm_audit'',''plant_based_discovery_follows''');
 end if;
 select pg_get_functiondef('public.ig_browser_coordination_scope(text,text)'::regprocedure) into d;
 if position('reactive migration' in d)=0 then
  execute replace(d,'SELECT CASE',E'SELECT CASE\n -- reactive migration: same sole sender across transports\n WHEN surface=''instagram'' AND work_lane=''missed_dm_audit'' THEN ''meta_business_suite''');
 end if;
 select pg_get_functiondef('public.claim_ig_next_actions(text,integer,integer,text,uuid[])'::regprocedure) into d;
 if position('ig_native_reactive_action_eligible' in d)=0 then
  marker:='WHERE q.owner = p_owner';
  if position(marker in d)=0 then raise exception 'claim guard changed'; end if;
  d:=replace(d,marker,marker||E'\n AND (NOT v_browser OR NOT EXISTS(SELECT 1 FROM public.ig_browser_shift_runs nr WHERE nr.run_id=p_run_id AND nr.browser_surface=''instagram'' AND nr.lane=''missed_dm_audit'') OR public.ig_native_reactive_action_eligible(q))');
  marker:='OR (v_surface=''instagram'' AND (';
  if position(marker in d)=0 then raise exception 'claim surface changed'; end if;
  execute replace(d,marker,marker||E'(public.ig_native_reactive_action_eligible(q) AND EXISTS(SELECT 1 FROM public.ig_browser_shift_runs nr WHERE nr.run_id=p_run_id AND nr.lane=''missed_dm_audit'')) OR ');
 end if;
 select pg_get_functiondef('public.ig_browser_action_owned(text,text,text,uuid,integer,uuid,uuid)'::regprocedure) into d;
 if position('ig_native_reactive_action_eligible' in d)=0 then
  marker:='AND a.id=p_action_id';
  if position(marker in d)=0 then raise exception 'owned action changed'; end if;
  d:=replace(d,marker,E'AND (p_surface<>''instagram'' OR r.lane<>''missed_dm_audit'' OR public.ig_native_reactive_action_eligible(a))\n '||marker);
  marker:='OR (p_surface=''instagram'' AND (';
  if position(marker in d)=0 then raise exception 'owned surface changed'; end if;
  execute replace(d,marker,marker||'(r.lane=''missed_dm_audit'' AND public.ig_native_reactive_action_eligible(a)) OR ');
 end if;
 foreach n in array array['reserve_client_onboarding_support','reserve_free_coaching_ready','reserve_workout_accountability'] loop
  select pg_get_functiondef(oid) into d from pg_proc where pronamespace='public'::regnamespace and proname=n;
  marker:='ig_browser_action_owned(p_run_id,''meta_business_suite'',p_tab_id';
  if position(marker in d)>0 then
   execute replace(d,marker,'ig_browser_action_owned(p_run_id,(select browser_surface from public.ig_browser_shift_runs where run_id=p_run_id),p_tab_id');
  elsif position('(select browser_surface' in d)=0 then raise exception 'reservation guard changed: %',n; end if;
 end loop;
 select pg_get_functiondef('public.persist_ig_native_delivery_receipt(uuid,integer,uuid,uuid,jsonb)'::regprocedure) into d;
 marker:='AND browser_surface = ''meta_business_suite''';
 if position(marker in d)>0 then
  execute replace(d,marker,'AND (browser_surface = ''meta_business_suite'' OR (browser_surface=''instagram'' AND lane=''missed_dm_audit'' AND v_channel=''instagram''))');
 elsif position('lane=''missed_dm_audit''' in d)=0 then raise exception 'receipt guard changed'; end if;
end $patch$;
