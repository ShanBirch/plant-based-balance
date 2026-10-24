-- New invitations only. Legacy starter promises and billing remain unchanged.
alter table public.balance_free_starters
 add column experience text not null default 'legacy_starter',
 add column starts_at timestamptz,
 add column ends_at timestamptz,
 add column setup jsonb not null default '{}';

create table public.balance_free_coaching_setups (
 id uuid primary key default gen_random_uuid(),
 thread_id uuid not null unique references public.ig_threads(id),
 acceptance_message_id uuid not null references public.ig_messages(id),
 grant_id uuid not null unique references public.balance_free_starters(id),
 program jsonb not null,
 program_id uuid references public.custom_workout_programs(id),
 invitation_url text not null,
 review jsonb not null,
 verified_at timestamptz not null default now(),
 notice_status text not null default 'pending' check(notice_status in ('pending','queued','reserved','sent','uncertain','held')),
 action_id uuid,
 action_version integer,
 expected_message_id uuid,
 attempted_at timestamptz,
 claim_token uuid,
 receipt jsonb not null default '{}',
 created_at timestamptz not null default now()
);
alter table public.balance_free_coaching_setups enable row level security;
revoke all on public.balance_free_coaching_setups from public,anon,authenticated;
grant all on public.balance_free_coaching_setups to service_role;

create function public.free_coaching_thread_allowed(p_thread uuid) returns boolean
language sql stable security invoker set search_path=public,pg_temp as $$
 select exists(select 1 from ig_threads t where t.id=p_thread and t.channel in ('instagram','messenger')
 and not exists(select 1 from ig_personal_contacts p where lower(p.ig_username)=lower(t.ig_username))
 and not exists(select 1 from ig_threads x where (x.id=t.id or
 (nullif(t.ig_username,'') is not null and lower(x.ig_username)=lower(t.ig_username)) or
 (nullif(t.subscriber_id,'') is not null and x.channel=t.channel and x.subscriber_id=t.subscriber_id) or
 (t.linked_user_id is not null and x.linked_user_id=t.linked_user_id)) and
 (x.custom_data->>'client_community_support_enabled'='false' or exists(select 1 from jsonb_each(coalesce(x.custom_data,'{}')) f
 where f.key in ('manual_only','manual_review_only','friend_manual_only','codex_ai_opt_out','ai_automation_opt_out',
 'do_not_follow_up','blocked_by_shannon','human_takeover','personal_outreach','needs_shannon','safety_hold','authenticity_hold',
 'permanent_needs_you_draft_only','no_ai_send','no_ai_schedule','do_not_auto_send')
 and (f.value='true'::jsonb or f.value->>'enabled'='true'))))
 and not exists(select 1 from client_memory m where m.client_id=t.linked_user_id and
 (m.preferences->>'manual_only'='true' or m.preferences->>'permanent_needs_you_draft_only'='true')));
$$;

create function public.prepare_balance_free_coaching(p_thread_id uuid,p_acceptance_message_id uuid,
 p_timezone text,p_schedule jsonb,p_equipment text,p_goal text,p_session_minutes integer,p_program jsonb,p_review jsonb)
returns jsonb language plpgsql security invoker set search_path=public,extensions,pg_temp as $$
declare t ig_threads; existing balance_free_coaching_setups; g uuid; token text; result uuid; slot jsonb; entry jsonb; ex jsonb;
begin
 select * into t from ig_threads where id=p_thread_id for update;
 if t.id is null or not free_coaching_thread_allowed(t.id) then raise exception 'Current identity and hold review required'; end if;
 select * into existing from balance_free_coaching_setups where thread_id=t.id;
 if existing.id is not null then return to_jsonb(existing); end if;
 if t.linked_user_id is not null then raise exception 'Existing account needs an individual access review; never replace its program'; end if;
 if exists(select 1 from balance_free_starters where thread_id=t.id) then raise exception 'Preserve the existing starter agreement'; end if;
 if not exists(select 1 from ig_messages where id=p_acceptance_message_id and thread_id=t.id and direction='in') then raise exception 'Exact inbound acceptance required'; end if;
 if not coalesce(p_review @> '{"full_thread_reviewed":true,"explicit_free_month_acceptance":true,"schedule_agreed":true,"equipment_confirmed":true,"no_movement_restrictions_reported":true,"independent_holds_checked":true,"videos_verified":true}',false)
 or nullif(p_review->>'reviewed_by','') is null then raise exception 'Complete acceptance, suitability, schedule and video review required'; end if;
 if not exists(select 1 from pg_timezone_names where name=p_timezone) then raise exception 'Confirmed IANA timezone required'; end if;
 if p_equipment not in ('gym','dumbbells','bands','none') or p_equipment is null or nullif(trim(p_goal),'') is null
 or p_session_minutes is null or p_session_minutes not between 10 and 60 then raise exception 'Confirmed equipment, goal and duration required'; end if;
 if jsonb_typeof(p_schedule) is distinct from 'array' or jsonb_array_length(p_schedule) not between 1 and 6
 or jsonb_typeof(p_program->'weekly_schedule') is distinct from 'array'
 or jsonb_array_length(p_program->'weekly_schedule')<>7
 or (select count(*) from jsonb_array_elements(p_program->'weekly_schedule') x where x#>>'{workout,type}'='inline')<>jsonb_array_length(p_schedule)
 or (select jsonb_agg(x->>'day' order by ord) from jsonb_array_elements(p_program->'weekly_schedule') with ordinality as e(x,ord))<>'["Mon","Tue","Wed","Thu","Fri","Sat","Sun"]'::jsonb then raise exception 'Exact agreed schedule required'; end if;
 if (select count(distinct value->>'weekday') from jsonb_array_elements(p_schedule))<>jsonb_array_length(p_schedule) then raise exception 'Duplicate training day'; end if;
 for slot in select value from jsonb_array_elements(p_schedule) loop
  if coalesce(slot->>'weekday','') !~ '^[1-7]$' or coalesce(slot->>'time','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then raise exception 'Valid weekday and time required'; end if;
  select value into entry from jsonb_array_elements(p_program->'weekly_schedule')
   where value->>'day'=(array['Mon','Tue','Wed','Thu','Fri','Sat','Sun'])[(slot->>'weekday')::int] and value->>'time'=slot->>'time';
  if entry is null or entry#>>'{workout,type}' is distinct from 'inline' or nullif(entry#>>'{workout,name}','') is null
   or jsonb_typeof(entry#>'{workout,exercises}') is distinct from 'array' or jsonb_array_length(entry#>'{workout,exercises}')<3 then raise exception 'Complete video-backed session required for every agreed day'; end if;
  for ex in select value from jsonb_array_elements(entry#>'{workout,exercises}') loop
   if nullif(ex->>'name','') is null or coalesce(ex->>'sets','') !~ '^[1-6]$' or nullif(ex->>'reps','') is null
    or coalesce(ex->>'video_url','') !~ '^(https://|/assets/).+\.(mp4|mov|webm)(\?.*)?$' then raise exception 'Exact exercises, sets, reps and verified demos required'; end if;
  end loop;
 end loop;
 token:=rtrim(translate(encode(gen_random_bytes(32),'base64'),'+/','-_'),'=');
 insert into balance_free_starters(token_hash,thread_id,workouts_ready,experience,setup)
 values(encode(digest(token,'sha256'),'hex'),t.id,true,'coached_month_v1',jsonb_build_object('timezone',p_timezone,'schedule',p_schedule,'equipment',p_equipment,'goal',p_goal,'sessionMinutes',p_session_minutes)) returning id into g;
 insert into balance_free_coaching_setups(thread_id,acceptance_message_id,grant_id,program,invitation_url,review)
 values(t.id,p_acceptance_message_id,g,p_program,'https://plantbased-balance.org/free-starter.html#invite='||token,p_review) returning id into result;
 insert into coach_alerts(coach_id,client_name,alert_type,priority,title,description,status,data,idempotency_key)
 values(t.coach_id,coalesce(t.ig_username,'New coaching member'),'new_user_onboarding','medium','Free coaching month prepared',
 'Program and private invitation verified. The sole chat operator owns the ready message. No account or paid subscription has been created.','dismissed',
 jsonb_build_object('free_coaching_setup_id',result,'thread_id',t.id,'acceptance_message_id',p_acceptance_message_id,'program',p_program,'review',p_review),'free-coaching-setup:'||result);
 return (select to_jsonb(s) from balance_free_coaching_setups s where id=result);
end;
$$;

create or replace function public.claim_balance_free_starter(p_user_id uuid,p_token_hash text)
returns setof public.balance_free_starters language plpgsql security invoker set search_path=public,pg_temp as $$
declare invitation balance_free_starters; prepared balance_free_coaching_setups; t ig_threads; new_program uuid;
begin
 select * into invitation from balance_free_starters where token_hash=p_token_hash for update;
 if invitation.id is null or invitation.revoked_at is not null or (invitation.user_id is null and invitation.claim_before<=now())
 or (invitation.user_id is not null and invitation.user_id<>p_user_id) then raise exception 'Invitation unavailable'; end if;
 if invitation.experience='coached_month_v1' and invitation.ends_at<=now() then raise exception 'Your free month has ended. Contact Shannon about continuing.'; end if;
 if invitation.user_id is null then
  select * into t from ig_threads where id=invitation.thread_id for update;
  if t.linked_user_id is not null and t.linked_user_id<>p_user_id then raise exception 'Account identity needs review'; end if;
  if invitation.experience='coached_month_v1' then
   select * into prepared from balance_free_coaching_setups where grant_id=invitation.id for update;
   if prepared.id is null or not free_coaching_thread_allowed(t.id) then raise exception 'Prepared program unavailable'; end if;
   if exists(select 1 from custom_workout_programs where user_id=p_user_id and is_active) then raise exception 'Preserve the existing assigned program'; end if;
   if exists(select 1 from coach_clients where client_id=p_user_id and coach_id=t.coach_id and status<>'active') then raise exception 'Paused or ended coaching needs individual review'; end if;
   insert into custom_workout_programs(user_id,program_name,duration_weeks,weekly_schedule,is_active,start_date)
   values(p_user_id,prepared.program->>'program_name',5,prepared.program->'weekly_schedule',true,(now() at time zone (invitation.setup->>'timezone'))::date) returning id into new_program;
   update balance_free_coaching_setups set program_id=new_program where id=prepared.id;
   insert into user_facts(user_id,personal_details) values(p_user_id,jsonb_build_object(
    'coaching_setup_id',prepared.id,'equipment_access',invitation.setup->>'equipment',
    'training_frequency',jsonb_array_length(invitation.setup->'schedule'),
    'workout_calendar_times',(select jsonb_object_agg((array['monday','tuesday','wednesday','thursday','friday','saturday','sunday'])[array_position(array['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],v->>'day')],v->>'time') from jsonb_array_elements(prepared.program->'weekly_schedule') v where v->>'time' is not null)))
   on conflict(user_id) do update set personal_details=coalesce(user_facts.personal_details,'{}')||excluded.personal_details;
   update balance_free_starters set starts_at=now(),ends_at=((now() at time zone (invitation.setup->>'timezone'))+interval '1 month') at time zone (invitation.setup->>'timezone') where id=invitation.id;
   insert into coach_clients(coach_id,client_id,status) values(t.coach_id,p_user_id,'active') on conflict do nothing;
   insert into coach_alerts(coach_id,client_id,alert_type,priority,title,description,status,data,idempotency_key)
   values(t.coach_id,p_user_id,'new_user_onboarding','medium','Free coaching program assigned','Private invitation claimed; assigned program saved to this account.','dismissed',
   jsonb_build_object('free_coaching_setup_id',prepared.id,'program_id',new_program,'verified_at',now()),'free-coaching-claimed:'||prepared.id);
  end if;
  update balance_free_starters set user_id=p_user_id,claimed_at=now() where id=invitation.id returning * into invitation;
  update ig_threads set linked_user_id=p_user_id,updated_at=now() where id=invitation.thread_id and linked_user_id is null;
 end if;
 return next invitation;
end;
$$;

-- Service-only operations: user-edited metadata and URL flags cannot provision.
do $$ declare f record; begin
 for f in select oid::regprocedure signature from pg_proc where pronamespace='public'::regnamespace and
 proname in ('prepare_balance_free_coaching','free_coaching_thread_allowed','claim_balance_free_starter') loop
 execute format('revoke all on function %s from public,anon,authenticated',f.signature);
 execute format('grant execute on function %s to service_role',f.signature);
 end loop;
end $$;

create function public.refresh_free_coaching_setups() returns jsonb
language plpgsql security invoker set search_path=public,pg_temp as $$
declare s balance_free_coaching_setups; a ig_next_actions; g balance_free_starters; t ig_threads; latest uuid; d date; n integer;
begin
 for s in select * from balance_free_coaching_setups loop
  select * into t from ig_threads where id=s.thread_id;
  select * into g from balance_free_starters where id=s.grant_id;
  select * into a from ig_next_actions where id=s.action_id;
  select id into latest from ig_messages where thread_id=t.id order by created_at desc,id desc limit 1;
  if s.notice_status='queued' and s.attempted_at is null and exists(select 1 from ig_messages m where m.thread_id=t.id and m.direction='out' and m.text=s.receipt->>'final_text' and m.created_at>=s.created_at) then
   update balance_free_coaching_setups set notice_status='uncertain',attempted_at=(select min(m.created_at) from ig_messages m where m.thread_id=t.id and m.direction='out' and m.text=s.receipt->>'final_text' and m.created_at>=s.created_at),
    receipt=receipt||'{"canonical_delivery_found":true,"no_repeat":true}'::jsonb where id=s.id;
  elsif s.notice_status='reserved' and s.attempted_at<now()-interval '15 minutes' then
   update balance_free_coaching_setups set notice_status='uncertain' where id=s.id;
  elsif s.notice_status='queued' and s.attempted_at is null and (a.id is null or a.status in ('cancelled','completed') or a.action_version is distinct from s.action_version or a.reason->>'policy' is distinct from 'free_coaching_ready_v1' or latest is distinct from s.expected_message_id or not free_coaching_thread_allowed(t.id) or g.revoked_at is not null or g.claim_before<=now())
  and not coalesce(a.status='claimed' and a.claim_expires_at>now(),false) then
   update ig_next_actions set status='cancelled',completed_at=now(),receipt=receipt||'{"free_coaching_notice_stale":true}'::jsonb
    where id=s.action_id and reason->>'policy'='free_coaching_ready_v1' and action_version=s.action_version;
   update balance_free_coaching_setups set notice_status=case when free_coaching_thread_allowed(t.id) and g.revoked_at is null and g.claim_before>now() then 'pending' else 'held' end,
    action_id=null,action_version=null,expected_message_id=null where id=s.id;
  end if;
  if (s.notice_status in ('pending','queued') and s.created_at<now()-interval '30 minutes') or s.notice_status in ('uncertain','held') then
   insert into coach_alerts(coach_id,client_id,client_name,alert_type,priority,status,title,description,idempotency_key,data)
   values(t.coach_id,g.user_id,t.profile_name,'follow_up_review','medium','pending','Coaching setup delivery needs attention',
    'Reconcile the prepared setup and current conversation. Never retry a reserved or uncertain ready message.',
    'free_coaching_notice_attention:'||s.id,jsonb_build_object('free_coaching_setup_id',s.id,'thread_id',t.id,'operator_queue','needs_you','notice_status',s.notice_status))
   on conflict(idempotency_key) where idempotency_key is not null do nothing;
  elsif s.notice_status='sent' then
   update coach_alerts set status='dismissed',actioned_at=now() where idempotency_key='free_coaching_notice_attention:'||s.id and status='pending';
  end if;
  -- Weekly coaching is included even when Instagram reminders are declined.
  if g.user_id is not null and g.starts_at<=now() and g.ends_at>now() and g.revoked_at is null and free_coaching_thread_allowed(t.id)
   and exists(select 1 from users where id=g.user_id and onboarding_complete and not coalesce(is_test_account,false))
   and not exists(select 1 from workout_accountability e where e.thread_id=t.id and e.enabled) then
   d:=(now() at time zone (g.setup->>'timezone'))::date;
   if extract(isodow from d)=6 then
    insert into coach_alerts(coach_id,client_id,client_name,alert_type,priority,status,title,description,idempotency_key,data)
    values(t.coach_id,g.user_id,t.profile_name,'follow_up_review','medium','pending','Weekly coaching review due',
     'Included free-month coaching review. Use the weekly-client-checkin skill and real app evidence; deliver through Inbox after the applicable review. No course requirement.',
     'free_coaching_weekly:'||s.id||':'||date_trunc('week',d)::date,
     jsonb_build_object('free_coaching_setup_id',s.id,'ig_thread_id',t.id,'operator_queue','needs_you','review_week',date_trunc('week',d)::date))
    on conflict(idempotency_key) where idempotency_key is not null do nothing;
   end if;
  end if;
 end loop;
 select count(*) into n from free_coaching_setup_due();
 return jsonb_build_object('ready_notices_due',n,'sender','existing_meta_business_suite_operator');
end;
$$;
revoke all on function public.refresh_free_coaching_setups() from public,anon,authenticated;
grant execute on function public.refresh_free_coaching_setups() to service_role;
select cron.schedule('balance-free-coaching-setups','*/5 * * * *','select public.refresh_free_coaching_setups()');

create function public.free_coaching_setup_due() returns setof public.balance_free_coaching_setups
language sql stable security invoker set search_path=public,pg_temp as $$
 select s.* from balance_free_coaching_setups s join balance_free_starters g on g.id=s.grant_id
 where s.notice_status='pending' and s.attempted_at is null and g.revoked_at is null and g.claim_before>now()
 and free_coaching_thread_allowed(s.thread_id) order by s.created_at limit 10;
$$;

create function public.ig_free_coaching_ready_eligible(a public.ig_next_actions) returns boolean
language plpgsql stable security invoker set search_path=public,pg_temp as $$
declare s balance_free_coaching_setups; g balance_free_starters; latest uuid;
begin
 if a.owner is distinct from 'manual' or a.action_type is distinct from 'reactivation'
 or a.reason->>'policy' is distinct from 'free_coaching_ready_v1' then return false; end if;
 select * into s from balance_free_coaching_setups where id=(a.reason->>'setup_id')::uuid;
 select * into g from balance_free_starters where id=s.grant_id;
 if s.id is null or g.id is null or g.revoked_at is not null or g.claim_before<=now()
 or s.notice_status not in ('queued','reserved') or s.action_id is distinct from a.id or s.action_version is distinct from a.action_version
 or s.thread_id is distinct from a.thread_id or not free_coaching_thread_allowed(s.thread_id)
 or a.reason->>'final_text' is distinct from s.receipt->>'final_text' then return false; end if;
 if s.notice_status='reserved' and s.claim_token is distinct from a.claim_token then return false; end if;
 select id into latest from ig_messages where thread_id=s.thread_id order by created_at desc,id desc limit 1;
 return latest is not null and latest=s.expected_message_id;
exception when invalid_text_representation then return false;
end;
$$;

create function public.prepare_free_coaching_ready(p_setup_id uuid,p_final_text text,p_expected_message_id uuid,p_review jsonb)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare s balance_free_coaching_setups; t ig_threads; g balance_free_starters; latest uuid; a ig_next_actions;
begin
 select * into s from balance_free_coaching_setups where id=p_setup_id for update;
 select * into t from ig_threads where id=s.thread_id;
 select * into g from balance_free_starters where id=s.grant_id;
 if s.id is null or s.notice_status is distinct from 'pending' or s.attempted_at is not null
 or g.revoked_at is not null or g.claim_before<=now() or not free_coaching_thread_allowed(t.id) then raise exception 'Setup notice is not eligible'; end if;
 if p_final_text is null or length(p_final_text) not between 1 and 500 or position(s.invitation_url in p_final_text)=0
 or not coalesce(p_review @> '{"full_thread_reviewed":true,"native_identity_verified":true,"independent_holds_checked":true,"no_duplicate_verified":true,"answers_latest_turn":true}',false)
 then raise exception 'Fresh native review and verified personal invitation required'; end if;
 select id into latest from ig_messages where thread_id=t.id order by created_at desc,id desc limit 1;
 if latest is null or latest is distinct from p_expected_message_id then raise exception 'Conversation changed'; end if;
 if exists(select 1 from ig_next_actions where thread_id=t.id and (status in ('ready','waiting','needs_you','blocked','claimed') or (status='cooldown' and safe_after>now()))) then
 return jsonb_build_object('queued',false,'reason','existing_action_owns_thread'); end if;
 a:=upsert_ig_next_action(p_thread_id=>t.id,p_ig_username=>t.ig_username,p_lead_state=>'invited',p_owner=>'manual',p_action_type=>'reactivation',
 p_priority=>700,p_source_message_id=>latest,p_reason=>jsonb_build_object('policy','free_coaching_ready_v1','setup_id',s.id,'is_dm',true,'cooldown_scope','dm',
 'final_text',p_final_text,'expected_latest_message_id',latest,'review',p_review),p_supersede=>false);
 if a.reason->>'setup_id' is distinct from s.id::text then return jsonb_build_object('queued',false,'reason','existing_action_owns_thread'); end if;
 update balance_free_coaching_setups set notice_status='queued',action_id=a.id,action_version=a.action_version,expected_message_id=latest,
 receipt=receipt||jsonb_build_object('final_text',p_final_text,'prepared_at',now(),'notice_review',p_review) where id=s.id;
 return jsonb_build_object('queued',true,'action',to_jsonb(a));
end;
$$;

create function public.reserve_free_coaching_ready(p_setup_id uuid,p_action_id uuid,p_claim_token uuid,p_run_id text,p_tab_id text)
returns boolean language plpgsql security invoker set search_path=public,pg_temp as $$
declare s balance_free_coaching_setups; a ig_next_actions;
begin
 select * into s from balance_free_coaching_setups where id=p_setup_id for update;
 select * into a from ig_next_actions where id=p_action_id;
 if s.notice_status is distinct from 'queued' or s.attempted_at is not null or s.action_id is distinct from a.id
 or a.claim_token is distinct from p_claim_token or not ig_free_coaching_ready_eligible(a)
 or not ig_browser_action_owned(p_run_id,'meta_business_suite',p_tab_id,a.id,a.action_version,p_claim_token,a.source_message_id) then return false; end if;
 update balance_free_coaching_setups set notice_status='reserved',attempted_at=now(),claim_token=p_claim_token where id=s.id;
 return true;
end;
$$;

create function public.record_free_coaching_ready(p_setup_id uuid,p_claim_token uuid,p_status text,p_receipt jsonb)
returns boolean language plpgsql security invoker set search_path=public,pg_temp as $$
declare s balance_free_coaching_setups;
begin
 select * into s from balance_free_coaching_setups where id=p_setup_id for update;
 if s.notice_status not in ('reserved','uncertain') or s.claim_token is distinct from p_claim_token or p_status not in ('sent','uncertain') then return false; end if;
 if p_status='sent' and (p_receipt->>'native_verified' is distinct from 'true' or not exists(select 1 from ig_messages m
 where m.id=(p_receipt->>'canonical_message_id')::uuid and m.thread_id=s.thread_id and m.direction='out'
 and m.id is distinct from s.expected_message_id and m.text=s.receipt->>'final_text' and m.created_at>=s.attempted_at-interval '5 seconds')) then return false; end if;
 update balance_free_coaching_setups set notice_status=p_status,receipt=receipt||p_receipt||jsonb_build_object('recorded_at',now(),'no_repeat',true) where id=s.id;
 return true;
end;
$$;

-- Add this exact, proof-gated continuation to the existing sole sender.
do $$ declare n text; definition text; needle text; begin
 foreach n in array array['claim_ig_next_actions','ig_browser_action_owned'] loop
 select pg_get_functiondef(oid) into definition from pg_proc where pronamespace='public'::regnamespace and proname=n;
 needle:='public.ig_workout_accountability_action_eligible('||case n when 'claim_ig_next_actions' then 'q' else 'a' end||')';
 if position(needle in definition)=0 then raise exception 'Native ownership contract changed: %',n; end if;
 execute replace(definition,needle,'('||needle||' OR public.ig_free_coaching_ready_eligible('||case n when 'claim_ig_next_actions' then 'q' else 'a' end||'))');
 end loop;
end $$;
do $$ declare f record; begin
 for f in select oid::regprocedure signature from pg_proc where pronamespace='public'::regnamespace and
 proname in ('free_coaching_setup_due','ig_free_coaching_ready_eligible','prepare_free_coaching_ready','reserve_free_coaching_ready','record_free_coaching_ready') loop
 execute format('revoke all on function %s from public,anon,authenticated',f.signature);
 execute format('grant execute on function %s to service_role',f.signature);
 end loop;
end $$;
