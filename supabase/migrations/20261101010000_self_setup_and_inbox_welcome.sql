-- UI preferences may be exercised by an explicitly provisioned QA account.
-- This does not change the operational outreach/reminder eligibility predicate.
create or replace function public.new_free_month_self_setup_allowed(p_user_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select public.organic_outreach_cohort_allowed(p_user_id) or exists(
  select 1 from public.users u join auth.users a on a.id=u.id
  join public.balance_free_starters g on g.user_id=u.id
  where u.id=p_user_id and u.is_test_account=true
   and a.raw_app_meta_data->>'balance_support_preview'='true'
   and g.setup->>'qa_only'='true' and g.revoked_at is null
 );
$$;
revoke all on function public.new_free_month_self_setup_allowed(uuid) from public,anon,authenticated;
grant execute on function public.new_free_month_self_setup_allowed(uuid) to service_role;
create or replace function public.my_outreach_support_eligibility() returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and public.new_free_month_self_setup_allowed(auth.uid());
$$;
do $$ declare definition text; begin
 select pg_get_functiondef('public.save_coaching_support_preferences(boolean,boolean,text,text)'::regprocedure) into definition;
 definition:=replace(definition,'not organic_outreach_cohort_allowed(uid)','not public.new_free_month_self_setup_allowed(uid)');
 execute definition;
end $$;

-- An authenticated member can create only their own fixed welcome, once,
-- after setup. No arbitrary recipient, sender, text, or external delivery.
create or replace function public.ensure_balance_inbox_welcome() returns uuid
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); coach uuid:='00a6605e-8edb-4917-85ba-24a23f179059'; message_id uuid;
begin
 if uid is null or uid=coach then return null; end if;
 if not exists(select 1 from public.users u join auth.users a on a.id=u.id
   where u.id=uid and u.onboarding_complete=true
   and (a.created_at>='2026-11-01T00:00:00Z' or u.is_test_account=true)) then return null; end if;
 message_id:=md5('balance_setup_welcome_v1:'||uid::text)::uuid;
 insert into public.nudges(id,sender_id,receiver_id,message)
 values(message_id,coach,uid,'Hey, welcome to Balance! Your check-ins will arrive here in this inbox. Check it out, and if you have any questions, let me know.')
 on conflict(id) do nothing;
 return message_id;
end $$;
revoke all on function public.ensure_balance_inbox_welcome() from public,anon;
grant execute on function public.ensure_balance_inbox_welcome() to authenticated,service_role;
