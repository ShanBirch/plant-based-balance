-- Owner-only app activity notifications. Everything starts OFF; no historical replay.
-- Existing app data, client messaging, and coach approval flows are untouched.
create schema if not exists balance_activity_private;
revoke all on schema balance_activity_private from public, anon, authenticated;

create table public.balance_activity_settings (
  singleton boolean primary key default true check (singleton),
  owner_id uuid not null references public.users(id) on delete cascade,
  recipient_email text not null check (recipient_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  enabled boolean not null default false,
  enabled_since timestamptz,
  test_event_id uuid,
  runtime_status jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  check (not enabled or enabled_since is not null)
);
create table public.balance_activity_visits (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.users(id) on delete cascade,
  client_id uuid not null references public.users(id) on delete cascade,
  opened_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index balance_activity_visits_client on public.balance_activity_visits(client_id,last_seen_at desc);
create table public.balance_activity_visit_sources (
  visit_id uuid not null references public.balance_activity_visits(id) on delete cascade,
  client_id uuid not null references public.users(id) on delete cascade,
  usage_session_id text not null check (length(usage_session_id) between 1 and 120),
  primary key(visit_id,usage_session_id)
);
create index balance_activity_sources_lookup on public.balance_activity_visit_sources(client_id,usage_session_id);
create table public.balance_activity_event_receipts (
  event_id uuid primary key,
  client_id uuid not null references public.users(id) on delete cascade,
  visit_id uuid references public.balance_activity_visits(id) on delete cascade,
  received_at timestamptz not null default now()
);
create index balance_activity_receipts_rate on public.balance_activity_event_receipts(client_id,received_at desc);
create table public.balance_activity_outbox (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.users(id) on delete cascade,
  client_id uuid references public.users(id) on delete cascade,
  visit_id uuid references public.balance_activity_visits(id) on delete cascade,
  event_kind text not null check (event_kind in ('open','summary','test')),
  occurred_at timestamptz not null default now(),
  safe_activity jsonb not null default '{}'::jsonb,
  state text not null default 'pending' check (state in ('pending','sending','sent','failed','suppressed')),
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  first_attempt_at timestamptz,
  lease_until timestamptz,
  claim_token uuid,
  provider_message_id text,
  sent_at timestamptz,
  last_error_code text,
  chat_claim_token uuid,
  chat_lease_until timestamptz,
  chat_message_id text,
  chat_notified_at timestamptz,
  check ((event_kind='test' and client_id is null and visit_id is null) or (event_kind<>'test' and client_id is not null and visit_id is not null))
);
create unique index balance_activity_one_open on public.balance_activity_outbox(visit_id) where event_kind='open';
create index balance_activity_outbox_due on public.balance_activity_outbox(state,next_attempt_at);
create table public.balance_activity_actions (
  id bigint generated always as identity primary key,
  owner_id uuid not null references public.users(id) on delete cascade,
  client_id uuid not null references public.users(id) on delete cascade,
  visit_id uuid not null references public.balance_activity_visits(id) on delete cascade,
  source_key text not null unique,
  kind text not null check (kind in ('navigation_tapped','surface_opened','lesson_quiz_saved','workout_activity_saved','meal_logged','daily_checkin_saved','onboarding_quiz_saved')),
  detail jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now(),
  outbox_id uuid references public.balance_activity_outbox(id) on delete cascade
);
create index balance_activity_unbatched on public.balance_activity_actions(visit_id,received_at) where outbox_id is null;

-- No client-facing grants or policies. Only existing server credentials can use these objects.
alter table public.balance_activity_settings enable row level security;
alter table public.balance_activity_visits enable row level security;
alter table public.balance_activity_visit_sources enable row level security;
alter table public.balance_activity_event_receipts enable row level security;
alter table public.balance_activity_outbox enable row level security;
alter table public.balance_activity_actions enable row level security;
revoke all on public.balance_activity_settings, public.balance_activity_visits, public.balance_activity_visit_sources,
  public.balance_activity_event_receipts, public.balance_activity_outbox, public.balance_activity_actions from public,anon,authenticated;
grant select,insert,update,delete on public.balance_activity_settings, public.balance_activity_visits, public.balance_activity_visit_sources,
  public.balance_activity_event_receipts, public.balance_activity_outbox, public.balance_activity_actions to service_role;
revoke all on sequence public.balance_activity_actions_id_seq from public,anon,authenticated;
grant usage,select on sequence public.balance_activity_actions_id_seq to service_role;

create function public.balance_activity_eligible(p_user_id uuid,p_owner_id uuid) returns boolean
language sql stable security invoker set search_path='' as $$
  select p_user_id<>p_owner_id and exists (
    select 1 from public.coach_clients cc join public.users u on u.id=cc.client_id
    where cc.coach_id=p_owner_id and cc.client_id=p_user_id and cc.status='active' and cc.ended_at is null
      and not coalesce(u.is_test_account,false)
      and not exists (select 1 from public.admin_users au where au.user_id=p_user_id)
      and not exists (select 1 from public.coach_clients own where own.coach_id=p_user_id and own.status='active' and own.ended_at is null)
  )
$$;

create function public.balance_activity_record_presence(p_user_id uuid,p_event_id uuid,p_usage_session_id text,p_kind text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare cfg public.balance_activity_settings; v public.balance_activity_visits; eid uuid;
begin
  if p_kind not in ('foreground','presence') or p_event_id is null or p_usage_session_id !~ '^[a-zA-Z0-9_-]{1,120}$' then
    raise exception 'invalid_event';
  end if;
  select * into cfg from public.balance_activity_settings where singleton;
  if not coalesce(cfg.enabled,false) or not public.balance_activity_eligible(p_user_id,cfg.owner_id) then return jsonb_build_object('accepted',false); end if;
  perform pg_advisory_xact_lock(hashtextextended('balance-activity:'||p_user_id::text,0));
  if exists(select 1 from public.balance_activity_event_receipts where event_id=p_event_id) then return jsonb_build_object('duplicate',true); end if;
  if (select count(*) from public.balance_activity_event_receipts where client_id=p_user_id and received_at>now()-interval '1 minute')>=12 then return jsonb_build_object('limited',true); end if;
  select * into v from public.balance_activity_visits where client_id=p_user_id and owner_id=cfg.owner_id
    and opened_at>=cfg.enabled_since and last_seen_at>now()-interval '10 minutes' order by last_seen_at desc limit 1 for update;
  if v.id is null and p_kind='foreground' then
    insert into public.balance_activity_visits(owner_id,client_id) values(cfg.owner_id,p_user_id) returning * into v;
    insert into public.balance_activity_outbox(owner_id,client_id,visit_id,event_kind,safe_activity)
      values(cfg.owner_id,p_user_id,v.id,'open',jsonb_build_object('version','balance_activity_v1','action','opened_balance')) returning id into eid;
  elsif v.id is not null then
    update public.balance_activity_visits set last_seen_at=now() where id=v.id;
  end if;
  insert into public.balance_activity_event_receipts(event_id,client_id,visit_id) values(p_event_id,p_user_id,v.id);
  if v.id is not null then
    insert into public.balance_activity_visit_sources(visit_id,client_id,usage_session_id) values(v.id,p_user_id,p_usage_session_id) on conflict do nothing;
  end if;
  return jsonb_build_object('accepted',true,'outbox_id',eid);
end $$;

-- A trigger is required so late writes are recorded when saved, rather than missed by a timestamp scan.
-- It copies only fixed labels/counts/lesson identifiers, never messages, health values, answers or replay data.
create function balance_activity_private.capture_action() returns trigger
language plpgsql security definer set search_path='' as $$
declare cfg public.balance_activity_settings; v public.balance_activity_visits; k text; d jsonb:='{}'; a text; source_revision text:='insert';
begin
  -- Attribute saves only to the authenticated client, never coach/admin/service imports.
  if (select auth.uid()) is distinct from new.user_id then return new; end if;
  select * into cfg from public.balance_activity_settings where singleton;
  if not coalesce(cfg.enabled,false) or not public.balance_activity_eligible(new.user_id,cfg.owner_id) then return new; end if;
  if tg_table_name='user_activity' then
    if new.activity_type='ui_action' then
      a:=new.activity_data->>'action';
      if a not in ('course','home','movement','nutrition','feed','nav-cycle-btn','view_balance_learn','startlessongames') then return new; end if;
      k:='navigation_tapped'; d:=jsonb_build_object('target',a);
    elsif new.activity_type='app_surface_opened' and new.activity_data->>'surface' in ('direct_message','foundations_journey','onboarding_wizard') then
      k:='surface_opened'; d:=jsonb_build_object('surface',new.activity_data->>'surface');
    else return new; end if;
    select vis.* into v from public.balance_activity_visits vis
      join public.balance_activity_visit_sources src on src.visit_id=vis.id
      where vis.client_id=new.user_id and src.client_id=new.user_id and src.usage_session_id=new.activity_data->>'session_id'
        and vis.owner_id=cfg.owner_id and vis.opened_at>=cfg.enabled_since and vis.last_seen_at>now()-interval '10 minutes'
        and new.occurred_at>=vis.opened_at and new.occurred_at<=now()+interval '1 minute'
      order by vis.opened_at desc limit 1;
  else
    select * into v from public.balance_activity_visits where client_id=new.user_id and owner_id=cfg.owner_id
      and opened_at>=cfg.enabled_since and last_seen_at>now()-interval '10 minutes' order by opened_at desc limit 1;
    if tg_table_name='lesson_completions' then
      if tg_op='UPDATE' then
        if (new.games_played,new.games_correct,new.score_percentage) is not distinct from (old.games_played,old.games_correct,old.score_percentage) then return new; end if;
        source_revision:='score:'||new.games_played||':'||new.games_correct||':'||new.score_percentage;
      elsif new.completed_at<coalesce(v.opened_at,now()) or new.completed_at>now()+interval '1 minute' then return new; end if;
      if new.lesson_id !~ '^[a-zA-Z0-9_-]{1,80}$' then return new; end if;
      k:='lesson_quiz_saved'; d:=jsonb_build_object('lesson_id',left(new.lesson_id,80),'correct',new.games_correct,'total',new.games_played,'score_percentage',new.score_percentage);
    elsif tg_table_name='workouts' then
      if new.workout_type is distinct from 'history' or coalesce(new.is_current_workout,false) or new.created_at<coalesce(v.opened_at,now()) then return new; end if;
      k:='workout_activity_saved';
    elsif tg_table_name='meal_logs' then
      if new.created_at<coalesce(v.opened_at,now()) then return new; end if;
      k:='meal_logged';
    elsif tg_table_name='daily_checkins' then
      if tg_op='UPDATE' then
        if (new.energy,new.equipment,new.sleep,new.water_intake,new.additional_data) is not distinct from (old.energy,old.equipment,old.sleep,old.water_intake,old.additional_data) then return new; end if;
        source_revision:='update:'||new.updated_at::text;
      elsif new.created_at<coalesce(v.opened_at,now()) then return new; end if;
      k:='daily_checkin_saved';
    elsif tg_table_name='quiz_results' then
      if new.created_at<coalesce(v.opened_at,now()) then return new; end if;
      k:='onboarding_quiz_saved';
    else return new; end if;
  end if;
  if v.id is null then return new; end if;
  insert into public.balance_activity_actions(owner_id,client_id,visit_id,source_key,kind,detail)
    values(cfg.owner_id,new.user_id,v.id,tg_table_name||':'||new.id::text||':'||source_revision,k,d) on conflict(source_key) do nothing;
  return new;
exception when others then
  -- Notifications must never make a client save fail. Logs contain only SQLSTATE.
  raise warning 'balance_activity capture failed (%)',sqlstate;
  begin
    update public.balance_activity_settings set runtime_status=runtime_status || jsonb_build_object('capture_error_code',sqlstate,'capture_error_at',now()) where singleton;
  exception when others then null; end;
  return new;
end $$;
revoke all on function balance_activity_private.capture_action() from public,anon,authenticated,service_role;
create trigger balance_activity_capture after insert on public.user_activity for each row execute function balance_activity_private.capture_action();
create trigger balance_activity_capture after insert or update on public.lesson_completions for each row execute function balance_activity_private.capture_action();
create trigger balance_activity_capture after insert on public.workouts for each row execute function balance_activity_private.capture_action();
create trigger balance_activity_capture after insert on public.meal_logs for each row execute function balance_activity_private.capture_action();
create trigger balance_activity_capture after insert or update on public.daily_checkins for each row execute function balance_activity_private.capture_action();
create trigger balance_activity_capture after insert on public.quiz_results for each row execute function balance_activity_private.capture_action();

create function public.balance_activity_materialize() returns integer
language plpgsql security invoker set search_path='' as $$
declare cfg public.balance_activity_settings; v record; eid uuid; ids bigint[]; payload jsonb; made integer:=0;
begin
  select * into cfg from public.balance_activity_settings where singleton;
  if not coalesce(cfg.enabled,false) then return 0; end if;
  for v in select vis.* from public.balance_activity_visits vis
    where vis.owner_id=cfg.owner_id and vis.opened_at>=cfg.enabled_since
      and exists(select 1 from public.balance_activity_actions a where a.visit_id=vis.id and a.outbox_id is null and a.received_at<now()-interval '90 seconds')
    order by vis.opened_at limit 30 for update skip locked
  loop
    if not public.balance_activity_eligible(v.client_id,cfg.owner_id) then continue; end if;
    select array_agg(id) into ids from public.balance_activity_actions where visit_id=v.id and outbox_id is null and received_at<now()-interval '15 seconds';
    if ids is null then continue; end if;
    select jsonb_agg(jsonb_build_object('kind',kind,'detail',detail,'count',n) order by kind,detail::text) into payload
      from (select kind,detail,count(*) n from public.balance_activity_actions where id=any(ids) group by kind,detail) grouped;
    insert into public.balance_activity_outbox(owner_id,client_id,visit_id,event_kind,safe_activity)
      values(cfg.owner_id,v.client_id,v.id,'summary',jsonb_build_object('version','balance_activity_v1','actions',payload,'window_start',
        (select min(received_at) from public.balance_activity_actions where id=any(ids)), 'window_end',
        (select max(received_at) from public.balance_activity_actions where id=any(ids)))) returning id into eid;
    update public.balance_activity_actions set outbox_id=eid where id=any(ids);
    made:=made+1;
  end loop;
  return made;
end $$;

create function public.balance_activity_runtime_status(p_status jsonb) returns void
language sql security invoker set search_path='' as $$
  update public.balance_activity_settings set runtime_status=runtime_status || jsonb_build_object(
    'version','balance_activity_v1','email_configured',p_status->'email_configured','sender',left(p_status->>'sender',320),
    'checked_at',now()),updated_at=now() where singleton
$$;
create function public.balance_activity_claim(p_event_id uuid default null,p_limit integer default 3)
returns table(id uuid,event_kind text,recipient_email text,claim_token uuid)
language plpgsql security invoker set search_path='' as $$
declare cfg public.balance_activity_settings;
begin
  select * into cfg from public.balance_activity_settings where singleton;
  if cfg.owner_id is null then return; end if;
  -- Resend's idempotency retention is 24 hours. Stop automated retries before it expires.
  update public.balance_activity_outbox o set state='failed',last_error_code='retry_window_expired'
    where o.state in ('pending','sending') and o.first_attempt_at<now()-interval '20 hours';
  update public.balance_activity_outbox o set state='suppressed',last_error_code='outside_live_scope'
    where o.state in ('pending','sending') and (o.lease_until is null or o.lease_until<now()) and o.event_kind<>'test'
      and (not coalesce(cfg.enabled,false) or o.occurred_at<cfg.enabled_since or o.owner_id<>cfg.owner_id or not public.balance_activity_eligible(o.client_id,cfg.owner_id));
  return query
    with due as (
      select o.id from public.balance_activity_outbox o where o.owner_id=cfg.owner_id
        and (p_event_id is null or o.id=p_event_id)
        and ((o.event_kind='test' and o.id=cfg.test_event_id) or (o.event_kind<>'test' and cfg.enabled and o.occurred_at>=cfg.enabled_since))
        and (o.state='pending' or (o.state='sending' and o.lease_until<now())) and o.next_attempt_at<=now() and o.attempts<8
        order by o.occurred_at limit greatest(1,least(coalesce(p_limit,3),10)) for update skip locked
    ), claimed as (
      update public.balance_activity_outbox o set state='sending',attempts=o.attempts+1,first_attempt_at=coalesce(o.first_attempt_at,now()),
        lease_until=now()+interval '2 minutes',claim_token=gen_random_uuid()
      from due where o.id=due.id returning o.*
    ) select c.id,c.event_kind,cfg.recipient_email,c.claim_token from claimed c;
end $$;
create function public.balance_activity_finish(p_event_id uuid,p_claim_token uuid,p_provider_id text,p_error_code text) returns boolean
language plpgsql security invoker set search_path='' as $$
declare changed integer;
begin
  update public.balance_activity_outbox set state=case when p_provider_id is not null then 'sent' when attempts>=8 then 'failed' else 'pending' end,
    provider_message_id=left(p_provider_id,200),sent_at=case when p_provider_id is not null then now() else null end,
    last_error_code=left(p_error_code,80),lease_until=null,
    next_attempt_at=now()+make_interval(secs=>least(3600,30*(2^least(attempts,7))::integer))
  where id=p_event_id and claim_token=p_claim_token and state='sending';
  get diagnostics changed=row_count;
  return changed=1;
end $$;

-- Receipt operations are only for the existing authorised owner-chat consumer.
create function public.balance_activity_claim_chat(p_event_id uuid,p_owner_id uuid)
returns table(event_id uuid,claim_token uuid,event_kind text,client_id uuid,client_name text,occurred_at timestamptz,safe_activity jsonb)
language plpgsql security invoker set search_path='' as $$
begin
  return query
  with claim as (
    update public.balance_activity_outbox o set chat_claim_token=gen_random_uuid(),chat_lease_until=now()+interval '10 minutes'
    from public.balance_activity_settings cfg
    where o.id=p_event_id and o.owner_id=p_owner_id and cfg.singleton and cfg.owner_id=p_owner_id and o.state='sent'
      and o.chat_notified_at is null and (o.chat_lease_until is null or o.chat_lease_until<now())
      and ((o.event_kind='test' and o.id=cfg.test_event_id) or (cfg.enabled and o.occurred_at>=cfg.enabled_since and public.balance_activity_eligible(o.client_id,p_owner_id)))
    returning o.*
  ) select c.id,c.chat_claim_token,c.event_kind,c.client_id,left(u.name,120),c.occurred_at,c.safe_activity
    from claim c left join public.users u on u.id=c.client_id;
end $$;
create function public.balance_activity_finish_chat(p_event_id uuid,p_owner_id uuid,p_claim_token uuid,p_message_id text) returns boolean
language plpgsql security invoker set search_path='' as $$
declare changed integer;
begin
  if nullif(btrim(p_message_id),'') is null then return false; end if;
  update public.balance_activity_outbox set chat_notified_at=now(),chat_message_id=left(p_message_id,500),chat_lease_until=null
    where id=p_event_id and owner_id=p_owner_id and chat_claim_token=p_claim_token and chat_notified_at is null;
  get diagnostics changed=row_count; return changed=1;
end $$;

revoke all on function public.balance_activity_eligible(uuid,uuid),public.balance_activity_record_presence(uuid,uuid,text,text),
  public.balance_activity_materialize(),public.balance_activity_runtime_status(jsonb),public.balance_activity_claim(uuid,integer),
  public.balance_activity_finish(uuid,uuid,text,text),public.balance_activity_claim_chat(uuid,uuid),public.balance_activity_finish_chat(uuid,uuid,uuid,text)
  from public,anon,authenticated;
grant execute on function public.balance_activity_eligible(uuid,uuid),public.balance_activity_record_presence(uuid,uuid,text,text),
  public.balance_activity_materialize(),public.balance_activity_runtime_status(jsonb),public.balance_activity_claim(uuid,integer),
  public.balance_activity_finish(uuid,uuid,text,text),public.balance_activity_claim_chat(uuid,uuid),public.balance_activity_finish_chat(uuid,uuid,uuid,text)
  to service_role;
