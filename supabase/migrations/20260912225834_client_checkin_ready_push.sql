-- Server-owned, one attempt per member/week/occurrence. Ambiguous deliveries
-- stay claimed rather than risk notifying the member twice.
create table public.client_checkin_push_receipts (
 user_id uuid not null references public.users(id) on delete cascade,
 week_start date not null,
 occurrence text not null check (occurrence in ('weekly','midweek_wednesday')),
 claimed_at timestamptz not null default now(),
 sent_at timestamptz,
 result jsonb,
 primary key(user_id,week_start,occurrence)
);
alter table public.client_checkin_push_receipts enable row level security;
revoke all on public.client_checkin_push_receipts from public, anon, authenticated;
grant select,insert,update on public.client_checkin_push_receipts to service_role;

create function public.claim_client_checkin_pushes()
returns setof public.client_checkin_push_receipts
language sql security invoker set search_path = '' as $$
 with clock as (
   select (now() at time zone 'Australia/Brisbane')::date as today,
          date_trunc('week',now() at time zone 'Australia/Brisbane')::date as week_start
 ), due as (
   select u.id, c.week_start,
     case when extract(isodow from c.today)=3 then 'midweek_wednesday' else 'weekly' end as occurrence
   from public.users u cross join clock c
   where u.onboarding_complete is true and u.is_test_account is not true
     and u.program_start_date <= now()-interval '7 days'
     and exists (select 1 from public.push_subscriptions s where s.user_id=u.id)
     and (extract(isodow from c.today) in (5,6,7) or (
       extract(isodow from c.today)=3 and exists (
         select 1 from public.client_memory m where m.client_id=u.id
         and m.preferences->'in_app_checkins'->'weekly_reflection'->>'enabled'='true'
         and m.preferences->'in_app_checkins'->'weekly_reflection'->'additional_days' ? 'wednesday'
       )
     ))
 ), eligible as (
   select d.* from due d where not exists (
     select 1 from public.daily_checkins c where c.user_id=d.id and c.checkin_date=d.week_start
     and (c.additional_data->'weekly_checkins' @> jsonb_build_array(jsonb_build_object('week_start',d.week_start::text,'occurrence',d.occurrence))
       or (d.occurrence='weekly' and c.additional_data->'weekly_checkin'->>'week_start'=d.week_start::text))
   )
   and not exists (select 1 from public.client_checkin_push_receipts r where r.user_id=d.id and r.week_start=d.week_start and r.occurrence=d.occurrence)
   order by d.id limit 20
 )
 insert into public.client_checkin_push_receipts(user_id,week_start,occurrence)
 select id,week_start,occurrence from eligible
 on conflict do nothing returning *;
$$;
revoke all on function public.claim_client_checkin_pushes() from public,anon,authenticated;
grant execute on function public.claim_client_checkin_pushes() to service_role;
