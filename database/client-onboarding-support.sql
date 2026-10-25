-- First-week delivery uses the existing sole native operator. No new sender,
-- automatic reminder consent, billing, or change to historical access promises.
create table public.client_onboarding_support_events (
 id uuid primary key default gen_random_uuid(),
 relationship_id uuid not null references public.coach_clients(id),
 thread_id uuid not null references public.ig_threads(id),
 timezone text not null,
 kind text not null check(kind in ('setup_check','routine_check')),
 due_at timestamptz not null,
 expires_at timestamptz not null,
 status text not null default 'pending' check(status in ('pending','queued','reserved','sent','uncertain','skipped','expired','held')),
 action_id uuid,
 action_version integer,
 expected_message_id uuid,
 claim_token uuid,
 attempted_at timestamptz,
 receipt jsonb not null default '{}',
 created_at timestamptz not null default now(),
 unique(relationship_id,kind)
);
alter table public.client_onboarding_support_events enable row level security;
revoke all on public.client_onboarding_support_events from public,anon,authenticated;
grant all on public.client_onboarding_support_events to service_role;

create function public.client_onboarding_support_allowed(p_event uuid) returns boolean
language sql stable security invoker set search_path=public,pg_temp as $$
 select exists(select 1 from client_onboarding_support_events e
 join coach_clients c on c.id=e.relationship_id join users u on u.id=c.client_id
 join ig_threads t on t.id=e.thread_id
 where e.id=p_event and c.status='active' and c.ended_at is null
 and u.onboarding_complete and u.last_login is not null and not coalesce(u.is_test_account,false)
 and t.linked_user_id=c.client_id and t.coach_id=c.coach_id
 and free_coaching_thread_allowed(t.id)
 and not exists(select 1 from balance_free_coaching_setups s join balance_free_starters g on g.id=s.grant_id
   where s.thread_id=t.id and (g.revoked_at is not null or g.ends_at<=now()))
 and not exists(select 1 from client_memory m where m.client_id=c.client_id and m.coach_id=c.coach_id
   and (m.preferences->>'onboarding_support_enabled'='false' or m.preferences->>'customer_service_manual_only'='true')));
$$;

create function public.refresh_client_onboarding_support() returns jsonb
language plpgsql security invoker set search_path=public,pg_temp as $$
declare n integer;
begin
 -- Exact identity + confirmed timezone are prerequisites, never name guesses.
 -- Include the two 25 October clients without enrolling historical clients.
 insert into client_onboarding_support_events(relationship_id,thread_id,timezone,kind,due_at,expires_at)
 select c.id,t.id,z.name,k.kind,
  (((c.assigned_at at time zone z.name)::date+k.day_offset)+time '19:00') at time zone z.name,
  (((c.assigned_at at time zone z.name)::date+k.day_offset)+time '22:00') at time zone z.name
 from coach_clients c join users u on u.id=c.client_id
 join lateral (select x.* from ig_threads x where x.linked_user_id=c.client_id and x.coach_id=c.coach_id
   and x.channel in ('instagram','messenger') order by
   exists(select 1 from balance_free_coaching_setups s where s.thread_id=x.id) desc,x.id limit 1) t on true
 left join balance_free_coaching_setups s on s.thread_id=t.id
 left join balance_free_starters g on g.id=s.grant_id
 left join user_facts f on f.user_id=u.id
 join pg_timezone_names z on z.name=coalesce(g.setup->>'timezone',f.personal_details->>'timezone')
 cross join (values ('setup_check',1),('routine_check',2)) k(kind,day_offset)
 where c.status='active' and c.ended_at is null and c.assigned_at>='2026-10-24T00:00:00+10'
 and c.assigned_at>now()-interval '4 days' and u.onboarding_complete and u.last_login is not null
 and c.coach_id='00a6605e-8edb-4917-85ba-24a23f179059'
 and not coalesce(u.is_test_account,false) and free_coaching_thread_allowed(t.id)
 and (g.id is null or (g.revoked_at is null and g.ends_at>now()))
 on conflict(relationship_id,kind) do nothing;

 update client_onboarding_support_events set status='uncertain',receipt=receipt||'{"reason":"attempt_requires_reconciliation","no_repeat":true}'
 where status='reserved' and attempted_at<now()-interval '10 minutes';
 update client_onboarding_support_events set status='expired',receipt=receipt||'{"reason":"missed_delivery_window"}'
 where status in ('pending','queued') and expires_at<now();
 update client_onboarding_support_events set status='held',receipt=receipt||'{"reason":"independent_hold_or_relationship_changed"}'
 where status in ('pending','queued') and not client_onboarding_support_allowed(id);
 update ig_next_actions a set status='cancelled',completed_at=now(),claim_owner=null,claim_token=null,claim_run_id=null,claim_expires_at=null,
 receipt=a.receipt||'{"onboarding_event_retired":true,"no_repeat":true}'
 from client_onboarding_support_events e where a.id=e.action_id and a.action_version=e.action_version
 and a.reason->>'policy'='client_onboarding_support_v1' and a.reason->>'event_id'=e.id::text
 and e.attempted_at is null and e.status in ('expired','held','skipped') and a.status in ('ready','waiting','claimed');
 insert into coach_alerts(coach_id,client_id,client_name,alert_type,priority,status,title,description,idempotency_key,data)
 select c.coach_id,c.client_id,u.name,'follow_up_review','medium','pending','New-client support needs attention',
 'The evening support window was missed or delivery is uncertain. Review current context; never repeat an attempted message or send a stale catch-up.',
 'client_onboarding_support_attention:'||e.id,jsonb_build_object('onboarding_event_id',e.id,'ig_thread_id',e.thread_id,'delivery_state',e.status,'operator_queue','needs_you')
 from client_onboarding_support_events e join coach_clients c on c.id=e.relationship_id join users u on u.id=c.client_id
 where e.status in ('expired','uncertain') on conflict(idempotency_key) where idempotency_key is not null do nothing;
 select count(*) into n from client_onboarding_support_events where status='pending' and due_at<=now() and expires_at>now() and client_onboarding_support_allowed(id);
 return jsonb_build_object('due',n,'sender','existing_meta_business_suite_operator');
end;
$$;

create function public.client_onboarding_support_due() returns setof jsonb
language sql stable security invoker set search_path=public,pg_temp as $$
 select to_jsonb(e)||jsonb_build_object('client_id',c.client_id,'coach_id',c.coach_id,'client_name',u.name,
  'last_login',u.last_login,'assigned_at',c.assigned_at,'program',to_jsonb(p),
  'latest_message_id',(select m.id from ig_messages m where m.thread_id=e.thread_id order by m.created_at desc,m.id desc limit 1))
 from client_onboarding_support_events e join coach_clients c on c.id=e.relationship_id join users u on u.id=c.client_id
 left join lateral (select x.* from custom_workout_programs x where x.user_id=c.client_id and x.is_active order by x.updated_at desc limit 1) p on true
 where e.status='pending' and e.due_at<=now() and e.expires_at>now() and client_onboarding_support_allowed(e.id)
 order by e.due_at limit 30;
$$;

create function public.ig_client_onboarding_support_eligible(a public.ig_next_actions) returns boolean
language plpgsql stable security invoker set search_path=public,pg_temp as $$
declare e client_onboarding_support_events; latest uuid;
begin
 if a.owner is distinct from 'manual' or a.action_type is distinct from 'reactivation'
 or a.reason->>'policy' is distinct from 'client_onboarding_support_v1' then return false; end if;
 select * into e from client_onboarding_support_events where id=(a.reason->>'event_id')::uuid;
 if e.id is null or e.action_id is distinct from a.id or e.action_version is distinct from a.action_version
 or e.thread_id is distinct from a.thread_id or e.status not in ('queued','reserved')
 or not client_onboarding_support_allowed(e.id) or now()<e.due_at or now()>e.expires_at
 or a.reason->>'final_text' is distinct from e.receipt->>'final_text' then return false; end if;
 if e.status='reserved' and e.claim_token is distinct from a.claim_token then return false; end if;
 select id into latest from ig_messages where thread_id=e.thread_id order by created_at desc,id desc limit 1;
 return latest is not null and latest=e.expected_message_id and exists(select 1 from ig_messages where id=latest and direction='out');
exception when invalid_text_representation then return false;
end;
$$;

create function public.prepare_client_onboarding_support(p_event_id uuid,p_final_text text,p_expected_message_id uuid,p_review jsonb)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare e client_onboarding_support_events; t ig_threads; latest uuid; a ig_next_actions;
begin
 select * into e from client_onboarding_support_events where id=p_event_id for update;
 if e.id is null or e.status is distinct from 'pending' or e.attempted_at is not null
 or now()<e.due_at or now()>e.expires_at or not client_onboarding_support_allowed(e.id) then raise exception 'Onboarding event not eligible'; end if;
 if p_final_text is null or length(trim(p_final_text)) not between 1 and 700
 or not coalesce(p_review @> '{"full_thread_reviewed":true,"native_identity_verified":true,"independent_holds_checked":true,"no_duplicate_verified":true,"app_context_reviewed":true,"cross_channel_contact_reviewed":true}',false)
 or nullif(trim(p_review->>'reviewed_by'),'') is null then raise exception 'Fresh conversation, app and cross-channel review required'; end if;
 select * into t from ig_threads where id=e.thread_id for update;
 select id into latest from ig_messages where thread_id=t.id order by created_at desc,id desc limit 1;
 if latest is null or latest is distinct from p_expected_message_id then raise exception 'Conversation changed'; end if;
 if exists(select 1 from ig_messages where id=latest and direction='in') then raise exception 'Answer fresh inbound first'; end if;
 if exists(select 1 from ig_next_actions where thread_id=t.id and (status in ('ready','waiting','needs_you','blocked','claimed') or (status='cooldown' and safe_after>now()))) then
 return jsonb_build_object('queued',false,'reason','existing_action_owns_thread'); end if;
 a:=upsert_ig_next_action(p_thread_id=>t.id,p_ig_username=>t.ig_username,p_lead_state=>'existing_client',p_owner=>'manual',p_action_type=>'reactivation',
 p_priority=>640,p_source_message_id=>latest,p_reason=>jsonb_build_object('policy','client_onboarding_support_v1','event_id',e.id,'is_dm',true,
 'cooldown_scope','dm','final_text',p_final_text,'expected_latest_message_id',latest,'review',p_review),p_supersede=>false);
 if a.reason->>'event_id' is distinct from e.id::text then return jsonb_build_object('queued',false,'reason','existing_action_owns_thread'); end if;
 update client_onboarding_support_events set status='queued',action_id=a.id,action_version=a.action_version,expected_message_id=latest,
 receipt=receipt||jsonb_build_object('final_text',p_final_text,'prepared_at',now(),'review',p_review) where id=e.id;
 return jsonb_build_object('queued',true,'action',to_jsonb(a));
end;
$$;

create function public.reserve_client_onboarding_support(p_event_id uuid,p_action_id uuid,p_claim_token uuid,p_run_id text,p_tab_id text)
returns boolean language plpgsql security invoker set search_path=public,pg_temp as $$
declare e client_onboarding_support_events; a ig_next_actions;
begin
 select * into e from client_onboarding_support_events where id=p_event_id for update;
 select * into a from ig_next_actions where id=p_action_id;
 if e.status is distinct from 'queued' or e.attempted_at is not null or e.action_id is distinct from a.id
 or a.claim_token is distinct from p_claim_token or not ig_client_onboarding_support_eligible(a)
 or not ig_browser_action_owned(p_run_id,'meta_business_suite',p_tab_id,a.id,a.action_version,p_claim_token,a.source_message_id) then return false; end if;
 update client_onboarding_support_events set status='reserved',attempted_at=now(),claim_token=p_claim_token where id=e.id;
 return true;
end;
$$;

create function public.record_client_onboarding_support(p_event_id uuid,p_claim_token uuid,p_status text,p_receipt jsonb)
returns boolean language plpgsql security invoker set search_path=public,pg_temp as $$
declare e client_onboarding_support_events;
begin
 select * into e from client_onboarding_support_events where id=p_event_id for update;
 if e.id is null or e.status not in ('reserved','uncertain') or e.claim_token is distinct from p_claim_token or p_status not in ('sent','uncertain') then return false; end if;
 if p_status='sent' and (p_receipt->>'native_verified' is distinct from 'true' or not exists(select 1 from ig_messages m
 where m.id=(p_receipt->>'canonical_message_id')::uuid and m.thread_id=e.thread_id and m.direction='out'
 and m.id is distinct from e.expected_message_id and m.text=e.receipt->>'final_text' and m.created_at>=e.attempted_at-interval '5 seconds')) then return false; end if;
 update client_onboarding_support_events set status=p_status,receipt=receipt||p_receipt||jsonb_build_object('recorded_at',now(),'no_repeat',true) where id=e.id;
 return true;
end;
$$;

-- Expand only the already guarded native allow-list, retaining every old gate.
-- A one-week move changes the actual app program, then restores the normal
-- week after that session day. Never overwrite a later human program edit.
create table public.workout_accountability_moves (
 id uuid primary key default gen_random_uuid(),
 enrollment_id uuid not null references public.workout_accountability(id),
 source_message_id uuid not null unique references public.ig_messages(id),
 program_id uuid not null references public.custom_workout_programs(id),
 source_date date not null,
 target_date date not null,
 scope text not null check(scope in ('this_week','weekly')),
 before_program jsonb not null,
 after_program jsonb not null,
 before_reminders jsonb not null,
 after_reminders jsonb not null,
 applied_program_updated_at timestamptz not null,
 applied_enrollment_version integer not null,
 restore_after timestamptz,
 status text not null check(status in ('applied','permanent','restored','held')),
 review jsonb not null,
 created_at timestamptz not null default now()
);
alter table public.workout_accountability_moves enable row level security;
revoke all on public.workout_accountability_moves from public,anon,authenticated;
grant all on public.workout_accountability_moves to service_role;
create unique index workout_accountability_one_temporary_move on public.workout_accountability_moves(program_id) where status='applied';

create function public.move_workout_accountability_session(p_enrollment_id uuid,p_source_message_id uuid,
 p_source_date date,p_target_date date,p_target_time text,p_scope text,p_expected_program_updated_at timestamptz,p_review jsonb)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare e workout_accountability; p custom_workout_programs; original jsonb; target jsonb; changed jsonb; reminders jsonb;
 old_day text; new_day text; result workout_accountability_moves; stamp timestamptz:=clock_timestamp(); local_today date;
begin
 select * into e from workout_accountability where id=p_enrollment_id for update;
 select * into result from workout_accountability_moves where source_message_id=p_source_message_id;
 if result.id is not null then
  if result.enrollment_id is distinct from e.id then raise exception 'Move receipt belongs to another member'; end if;
  return to_jsonb(result);
 end if;
 if e.id is null or not workout_accountability_allowed(e.id) then raise exception 'Consented active enrollment required'; end if;
 if not exists(select 1 from ig_messages where id=p_source_message_id and thread_id=e.thread_id and direction='in')
 or not coalesce(p_review @> '{"full_thread_reviewed":true,"explicit_move_request":true,"target_date_confirmed":true,"schedule_safety_reviewed":true,"independent_holds_checked":true}',false)
 or nullif(p_review->>'reviewed_by','') is null then raise exception 'Exact member request, target date and safe schedule review required'; end if;
 if exists(select 1 from ig_messages m join ig_messages source on source.id=p_source_message_id
  where m.thread_id=e.thread_id and m.direction='in' and (m.created_at,m.id)>(source.created_at,source.id)) then raise exception 'Newer member message requires fresh review'; end if;
 local_today:=(now() at time zone e.timezone)::date;
 if p_scope is null or p_scope not in ('this_week','weekly') or p_source_date is null or p_target_date is null
 or p_source_date not between local_today-1 and local_today+6 or p_target_date<local_today or p_target_date<=p_source_date
 or p_target_date>p_source_date+6 or p_target_date>e.ends_on
 or (p_scope='this_week' and date_trunc('week',p_source_date)<>date_trunc('week',p_target_date))
 or p_target_time is null or p_target_time!~'^[0-2][0-9]:[0-5][0-9]$' or p_target_time<'06:30' or p_target_time>'20:30'
 then raise exception 'Unambiguous upcoming date/time required; cross-week one-off moves need review'; end if;
 select * into p from custom_workout_programs where user_id=e.user_id and is_active order by updated_at desc limit 1 for update;
 if p.id is null or p.updated_at is distinct from p_expected_program_updated_at
 or exists(select 1 from workout_accountability_moves where program_id=p.id and status='applied') then raise exception 'Program changed or a temporary move is already active'; end if;
 old_day:=(array['Mon','Tue','Wed','Thu','Fri','Sat','Sun'])[extract(isodow from p_source_date)::int];
 new_day:=(array['Mon','Tue','Wed','Thu','Fri','Sat','Sun'])[extract(isodow from p_target_date)::int];
 select value into original from jsonb_array_elements(p.weekly_schedule) where value->>'day'=old_day;
 select value into target from jsonb_array_elements(p.weekly_schedule) where value->>'day'=new_day;
 if original is null or target is null or coalesce(original->'workout'->>'type','rest')='rest'
 or coalesce(target->'workout'->>'type','rest')<>'rest'
 or exists(select 1 from jsonb_array_elements(e.schedule) s where (s->>'weekday')::int=extract(isodow from p_target_date))
 or not exists(select 1 from jsonb_array_elements(e.schedule) s where (s->>'weekday')::int=extract(isodow from p_source_date)
 and s->>'session_name'=original->'workout'->>'name')
 or exists(select 1 from workouts where user_id=e.user_id and workout_type='history' and workout_date=p_source_date
 and template_name=original->'workout'->>'name') then raise exception 'Source is not an unlogged agreed session or destination is occupied'; end if;
 select jsonb_agg(case value->>'day' when old_day then jsonb_set(value,'{workout}','{"name":"Rest Day","type":"rest","exercises":[]}')
 when new_day then jsonb_set(jsonb_set(value,'{workout}',original->'workout'),'{time}',to_jsonb(p_target_time)) else value end order by ordinality)
 into changed from jsonb_array_elements(p.weekly_schedule) with ordinality;
 select jsonb_agg(case when (value->>'weekday')::int=extract(isodow from p_source_date)
 then value||jsonb_build_object('weekday',extract(isodow from p_target_date)::int,'time',p_target_time) else value end order by ordinality)
 into reminders from jsonb_array_elements(e.schedule) with ordinality;
 update custom_workout_programs set weekly_schedule=changed,updated_at=stamp where id=p.id;
 update workout_accountability set schedule=reminders,version=version+1,updated_at=stamp where id=e.id;
 insert into workout_accountability_moves(enrollment_id,source_message_id,program_id,source_date,target_date,scope,
 before_program,after_program,before_reminders,after_reminders,applied_program_updated_at,applied_enrollment_version,restore_after,status,review)
 values(e.id,p_source_message_id,p.id,p_source_date,p_target_date,p_scope,p.weekly_schedule,changed,e.schedule,reminders,stamp,e.version+1,
 case when p_scope='this_week' then (p_target_date+1)::timestamp at time zone e.timezone end,
 case when p_scope='this_week' then 'applied' else 'permanent' end,p_review) returning * into result;
 return to_jsonb(result);
end;
$$;

create function public.restore_workout_accountability_moves() returns void
language plpgsql security invoker set search_path=public,pg_temp as $$
declare m workout_accountability_moves; p custom_workout_programs; e workout_accountability;
begin
 for m in select * from workout_accountability_moves where status='applied' and restore_after<=now() for update loop
 select * into e from workout_accountability where id=m.enrollment_id for update;
 select * into p from custom_workout_programs where id=m.program_id for update;
 if p.updated_at is not distinct from m.applied_program_updated_at and p.weekly_schedule=m.after_program
 and e.version=m.applied_enrollment_version and e.schedule=m.after_reminders then
 update custom_workout_programs set weekly_schedule=m.before_program,updated_at=clock_timestamp() where id=p.id;
 update workout_accountability set schedule=m.before_reminders,version=version+1,updated_at=now() where id=e.id;
 update workout_accountability_moves set status='restored' where id=m.id;
 else
 update workout_accountability_moves set status='held' where id=m.id;
 insert into coach_alerts(coach_id,client_id,alert_type,priority,status,title,description,idempotency_key,data)
 values(e.coach_id,e.user_id,'follow_up_review','high','pending','Workout move needs a schedule review',
 'A newer program or reminder change prevented restoring the usual week. Keep that edit and reconcile the current calendar.',
 'workout_move_restore:'||m.id,jsonb_build_object('move_id',m.id,'operator_queue','needs_you'))
 on conflict(idempotency_key) where idempotency_key is not null do nothing;
 end if;
 end loop;
end;
$$;

do $$ declare n text; definition text; needle text; begin
 foreach n in array array['claim_ig_next_actions','ig_browser_action_owned'] loop
 select pg_get_functiondef(oid) into definition from pg_proc where pronamespace='public'::regnamespace and proname=n;
 needle:='public.ig_free_coaching_ready_eligible('||case n when 'claim_ig_next_actions' then 'q' else 'a' end||')';
 if position(needle in definition)=0 then raise exception 'Native ownership contract changed: %',n; end if;
 execute replace(definition,needle,'('||needle||' OR public.ig_client_onboarding_support_eligible('||case n when 'claim_ig_next_actions' then 'q' else 'a' end||'))');
 end loop;
end $$;

-- Reuse the existing five-minute server wake, never start another local sender.
do $$ declare definition text; needle text; begin
 select pg_get_functiondef('public.refresh_workout_accountability()'::regprocedure) into definition;
 needle:='-- Once attempted, a crash is uncertain/no-repeat, never a fresh retry.';
 if position(needle in definition)=0 then raise exception 'Accountability refresh contract changed'; end if;
 execute replace(definition,needle,'perform restore_workout_accountability_moves(); perform refresh_client_onboarding_support(); '||needle);
end $$;

create function public.workout_accountability_phase_eligible(p_event uuid) returns boolean
language sql stable security invoker set search_path=public,pg_temp as $$
 select exists(select 1 from workout_accountability_events v join workout_accountability e on e.id=v.enrollment_id
 where v.id=p_event and (v.kind='evening' or (v.kind='before' and v.local_date<e.starts_on+7)
 or (v.kind='logged' and v.local_date<e.starts_on+14)));
$$;

-- Week one: morning commitment, then logged-session OR evening check.
-- Week two: no morning prompts. From week three: only unlogged-day support.
-- No log means unknown attendance, never a claim that they skipped a workout.
do $$ declare definition text; needle text; begin
 select pg_get_functiondef('public.refresh_workout_accountability()'::regprocedure) into definition;
 needle:='-- Once attempted, a crash is uncertain/no-repeat, never a fresh retry.';
 definition:=replace(definition,needle,$phase$
 update workout_accountability_events v set status='skipped',receipt=receipt||'{"reason":"support_taper_or_no_logged_session"}'
 where v.status in ('pending','queued') and
 (not workout_accountability_phase_eligible(v.id) or (v.kind='logged' and v.expires_at<now() and not workout_accountability_logged(v.id)));
 $phase$||needle);
 needle:='workout_at-interval ''30 minutes'',workout_at+interval ''30 minutes''';
 if position(needle in definition)=0 then raise exception 'Before-reminder timing contract changed'; end if;
 definition:=replace(definition,needle,$timing$
 greatest((d+time '06:00') at time zone e.timezone,least((d+time '08:00') at time zone e.timezone,workout_at-interval '30 minutes')),
 least(workout_at+interval '30 minutes',((d+time '08:00') at time zone e.timezone)+interval '2 hours')
 $timing$);
 -- Phase-retire events created by this refresh too, before exposing the queue.
 needle:='-- Weekly review is prepared by the sole operator, not an automatic voice send.';
 if position(needle in definition)=0 then raise exception 'Weekly-review contract changed'; end if;
 definition:=replace(definition,needle,$retire$
 update workout_accountability_events v set status='skipped',receipt=receipt||'{"reason":"support_taper"}'
 where v.enrollment_id=e.id and v.status in ('pending','queued') and not workout_accountability_phase_eligible(v.id);
 $retire$||needle);
 execute definition;
 select pg_get_functiondef('public.workout_accountability_due()'::regprocedure) into definition;
 needle:='and workout_accountability_allowed(e.id)';
 if position(needle in definition)=0 then raise exception 'Due-reminder eligibility changed'; end if;
 execute replace(definition,needle,needle||' and workout_accountability_phase_eligible(v.id)');
 select pg_get_functiondef('public.ig_workout_accountability_action_eligible(public.ig_next_actions)'::regprocedure) into definition;
 needle:='or v.status not in (''queued'',''reserved'')';
 if position(needle in definition)=0 then raise exception 'Native-reminder eligibility changed'; end if;
 execute replace(definition,needle,needle||' or not workout_accountability_phase_eligible(v.id)');
end $$;

-- Existing reminder consent gates apply equally to linked Messenger clients.
do $$ declare definition text; begin
 select pg_get_functiondef('public.configure_workout_accountability(uuid,uuid,text,jsonb,date,date,jsonb)'::regprocedure) into definition;
 if position('t.channel<>''instagram''' in definition)=0 then raise exception 'Enrollment channel gate changed'; end if;
 execute replace(definition,'t.channel<>''instagram''','t.channel not in (''instagram'',''messenger'')');
 select pg_get_functiondef('public.workout_accountability_allowed(uuid)'::regprocedure) into definition;
 if position('t.channel=''instagram'' and nullif(t.ig_username,'''') is not null' in definition)=0 then raise exception 'Reminder identity gate changed'; end if;
 execute replace(definition,'t.channel=''instagram'' and nullif(t.ig_username,'''') is not null',
 '(t.channel=''instagram'' and nullif(t.ig_username,'''') is not null or t.channel=''messenger'' and nullif(t.subscriber_id,'''') is not null) and free_coaching_thread_allowed(t.id)
 and exists(select 1 from coach_clients c where c.coach_id=e.coach_id and c.client_id=e.user_id and c.status=''active'' and c.ended_at is null)
 and not exists(select 1 from balance_free_coaching_setups s join balance_free_starters g on g.id=s.grant_id where s.thread_id=t.id and (g.revoked_at is not null or g.ends_at<=now()))');
end $$;

-- Installation is mandatory in future ready handoffs; the private activation
-- link is separately preserved because a store download cannot claim a grant.
do $$ declare definition text; needle text; begin
 select pg_get_functiondef('public.prepare_free_coaching_ready(uuid,text,uuid,jsonb)'::regprocedure) into definition;
 needle:='or position(s.invitation_url in p_final_text)=0';
 if position(needle in definition)=0 then raise exception 'Ready-message contract changed'; end if;
 execute replace(definition,needle,needle||$check$
 or (case coalesce(p_review->>'phone_platform','unknown')
 when 'ios' then position('https://apps.apple.com/app/balance-fitness-gamified/id6761238161' in p_final_text)=0
 when 'android' then position('https://play.google.com/store/apps/details?id=com.fitgotchi.app' in p_final_text)=0
 else position('https://apps.apple.com/app/balance-fitness-gamified/id6761238161' in p_final_text)=0
   or position('https://play.google.com/store/apps/details?id=com.fitgotchi.app' in p_final_text)=0 end)
 $check$);
end $$;

do $$ declare f record; begin
 for f in select oid::regprocedure signature from pg_proc where pronamespace='public'::regnamespace and
 (proname like '%client_onboarding_support%' or proname in ('workout_accountability_phase_eligible','move_workout_accountability_session','restore_workout_accountability_moves')) loop
 execute format('revoke all on function %s from public,anon,authenticated',f.signature);
 execute format('grant execute on function %s to service_role',f.signature);
 end loop;
end $$;
