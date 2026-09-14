-- Preserve Arunima's assigned eight-week course; restore the six-week default for everyone else.
do $migration$
declare
  protected_user uuid;
  protected_hash text;
  learning_hash text;
  journey_hash text;
begin
  if (select count(*) from public.users where lower(trim(name))='arunima sharma') <> 1 then
    raise exception 'Expected exactly one Arunima Sharma; inspect member identity';
  end if;
  select id into protected_user from public.users where lower(trim(name))='arunima sharma';
  select md5(to_jsonb(p)::text) into protected_hash from public.social_journey_progress p where user_id=protected_user;
  if protected_hash is null or not exists(select 1 from public.social_journey_progress where user_id=protected_user and settings->>'learn_curriculum'='bridge_eight_v1') then
    raise exception 'Arunima eight-week assignment missing; do not modify members';
  end if;
  select md5(coalesce(string_agg(to_jsonb(p)::text,'|' order by user_id),'')) into learning_hash from public.user_learning_progress p;
  select md5(coalesce(string_agg(((to_jsonb(p)-'settings'-'updated_at') || jsonb_build_object('settings',settings-'learn_curriculum'))::text,'|' order by user_id),'')) into journey_hash from public.social_journey_progress p;
  update public.social_journey_progress
    set settings=jsonb_set(coalesce(settings,'{}'::jsonb),'{learn_curriculum}','"six_v2"'::jsonb)
    where user_id<>protected_user and coalesce(settings->>'learn_curriculum','')<>'six_v2';
  if protected_hash is distinct from (select md5(to_jsonb(p)::text) from public.social_journey_progress p where user_id=protected_user) then
    raise exception 'Protected member changed';
  end if;
  if learning_hash is distinct from (select md5(coalesce(string_agg(to_jsonb(p)::text,'|' order by user_id),'')) from public.user_learning_progress p) then
    raise exception 'Learning progress changed';
  end if;
  if journey_hash is distinct from (select md5(coalesce(string_agg(((to_jsonb(p)-'settings'-'updated_at') || jsonb_build_object('settings',settings-'learn_curriculum'))::text,'|' order by user_id),'')) from public.social_journey_progress p) then
    raise exception 'Journey dates, weeks, or action evidence changed';
  end if;
end $migration$;
