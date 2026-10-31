-- App consent is its own source. Never manufacture an Instagram consent message.
create table public.coaching_support_preferences (
 user_id uuid primary key references public.users(id) on delete cascade,
 morning_training boolean not null default false,
 after_session boolean not null default false,
 tone text not null default 'gentle' check(tone in ('gentle','direct')),
 consent_version text not null default 'support_choices_20261101_v1',
 consent_source text not null check(consent_source in ('app_onboarding','app_settings')),
 consent_at timestamptz not null default now(),
 revision integer not null default 1
);
create table public.coaching_support_preference_history (
 id bigint generated always as identity primary key,
 user_id uuid not null references public.users(id) on delete cascade,
 preferences jsonb not null,
 recorded_at timestamptz not null default now()
);
alter table public.coaching_support_preferences enable row level security;
alter table public.coaching_support_preference_history enable row level security;
revoke all on public.coaching_support_preferences,public.coaching_support_preference_history from public,anon,authenticated;
grant select on public.coaching_support_preferences to authenticated;
grant all on public.coaching_support_preferences,public.coaching_support_preference_history to service_role;
create policy support_preferences_own_read on public.coaching_support_preferences for select to authenticated using(user_id=(select auth.uid()));
create function public.save_coaching_support_preferences(p_morning boolean,p_after_session boolean,p_tone text,p_source text)
returns public.coaching_support_preferences language plpgsql security definer set search_path=public,pg_temp as $$
declare r public.coaching_support_preferences; uid uuid:=auth.uid();
begin
 if uid is null or not exists(select 1 from users where id=uid) then raise exception 'Sign in to save your support choices'; end if;
 if p_morning is null or p_after_session is null or p_tone not in ('gentle','direct') or p_tone is null
 or p_source not in ('app_onboarding','app_settings') or p_source is null then raise exception 'Invalid support choices'; end if;
 insert into coaching_support_preferences(user_id,morning_training,after_session,tone,consent_source)
 values(uid,p_morning,p_after_session,p_tone,p_source)
 on conflict(user_id) do update set morning_training=excluded.morning_training,after_session=excluded.after_session,
 tone=excluded.tone,consent_version=excluded.consent_version,consent_source=excluded.consent_source,
 consent_at=now(),revision=coaching_support_preferences.revision+1 returning * into r;
 insert into coaching_support_preference_history(user_id,preferences) values(uid,to_jsonb(r));
 return r;
end;
$$;
revoke all on function public.save_coaching_support_preferences(boolean,boolean,text,text) from public,anon;
grant execute on function public.save_coaching_support_preferences(boolean,boolean,text,text) to authenticated;
-- Operator handoff only; no scheduler enrollment or unrestricted client messaging.
-- The caller must still review exact native identity, opt-outs, saved program,
-- timezone, live conversation and delivery ownership before any contact.
create function public.coaching_support_context(p_user_id uuid) returns jsonb
language sql stable security invoker set search_path=public,pg_temp as $$
 select jsonb_build_object('preferences',to_jsonb(s),'onboarding_complete',u.onboarding_complete,
 'last_login',u.last_login,'program',to_jsonb(p),'delivery_enabled',false,
 'integration_boundary','App consent saved; existing Instagram scheduler requires exact inbound consent. Dot delivery integration is not configured.')
 from users u left join coaching_support_preferences s on s.user_id=u.id
 left join lateral(select x.* from custom_workout_programs x where x.user_id=u.id and x.is_active order by x.updated_at desc limit 1) p on true
 where u.id=p_user_id;
$$;
revoke all on function public.coaching_support_context(uuid) from public,anon,authenticated;
grant execute on function public.coaching_support_context(uuid) to service_role;
