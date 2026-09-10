-- Resolve only the public-facing Balance coach ID; member profile RLS stays private.
create or replace function public.get_balance_coach_id() returns uuid
language sql stable security definer set search_path='' as $$
 select id from public.users where email='shannonbirch@cocospersonaltraining.com' and (select auth.uid()) is not null limit 1;
$$;
revoke all on function public.get_balance_coach_id() from public,anon;
grant execute on function public.get_balance_coach_id() to authenticated;
