create function public.fill_apple_health_active_energy(p_expected_user_id uuid, p_days jsonb)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  account_id uuid := auth.uid();
  saved integer;
begin
  if account_id is null or account_id is distinct from p_expected_user_id then
    raise exception 'The signed-in account changed' using errcode = '42501';
  end if;

  if jsonb_typeof(p_days) is distinct from 'array' then
    raise exception 'Expected an array of daily active energy' using errcode = '22023';
  end if;
  if jsonb_array_length(p_days) > 30 then
    raise exception 'Expected at most 30 daily values' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.oura_connections
    where user_id = account_id and is_active
  ) then
    return 0;
  end if;

  -- The legacy table also holds Oura totals and native steps.
  -- Only fill missing energy, preserving existing provider values and step counts.
  insert into public.oura_daily_activity as activity (user_id, date, active_calories)
  select account_id, day.date, max(day.active_calories)
  from jsonb_to_recordset(p_days) as day(date date, active_calories integer)
  where day.date between current_date - 32 and current_date
    and day.active_calories between 1 and 30000
  group by day.date
  order by day.date
  on conflict (user_id, date) do update
    set active_calories = excluded.active_calories
    where coalesce(activity.active_calories, 0) <= 0
      and coalesce(activity.total_calories, 0) <= 0;

  get diagnostics saved = row_count;
  return saved;
end;
$$;

revoke execute on function public.fill_apple_health_active_energy(uuid, jsonb) from public, anon;
grant execute on function public.fill_apple_health_active_energy(uuid, jsonb) to authenticated;
