-- New free coaching does not grant course access. Existing course students keep
-- their verified purchase and historical access; quizzes cannot grant access.
create or replace function public.my_balance_courses_locked()
returns boolean language plpgsql stable security definer set search_path=''
as $$
declare uid uuid:=auth.uid(); grant_start timestamptz; grant_end timestamptz; plan text; paid boolean;
begin
 if uid is null then return true; end if;
 if exists(select 1 from public.admin_users where user_id=uid) then return false; end if;
 select starts_at,ends_at into grant_start,grant_end from public.balance_free_starters where user_id=uid and experience='coached_month_v1' and revoked_at is null order by starts_at desc limit 1;
 -- A pre-existing purchase is preserved, not created by this free enrolment.
 if exists(select 1 from public.founders_pass_purchases where user_id=uid and status='paid' and (grant_start is null or purchased_at<grant_start)) then return false; end if;
 if grant_start is not null and grant_end>now() then return true; end if;
 select subscription_plan into plan from public.users where id=uid;
 paid:=exists(select 1 from public.founders_pass_purchases where user_id=uid and status='paid') or exists(select 1 from public.stripe_subscription_links where user_id=uid and subscription_plan='balance_learn_weekly' and subscription_status in ('active','trialing') and current_period_end>now());
 if paid then return false; end if;
 if grant_start is not null or plan in ('standard_text_coaching_weekly','organic_coaching_continuation_weekly') then return true; end if;
 return exists(select 1 from auth.users where id=uid and created_at>='2026-11-01T00:00:00Z');
end; $$;
revoke all on function public.my_balance_courses_locked() from public,anon;
grant execute on function public.my_balance_courses_locked() to authenticated,service_role;
-- Keep the canonical validation/scoring implementation and add the access check
-- before it can create a lesson result or award XP.
do $$ declare definition text; begin
 select pg_get_functiondef('public.complete_lesson(uuid,text,text,text,integer,integer)'::regprocedure) into definition;
 if position('Courses are locked for this membership' in definition)=0 then
  definition:=replace(definition,E'BEGIN\n',E'BEGIN\n  IF public.my_balance_courses_locked() THEN RAISE EXCEPTION ''Courses are locked for this membership'' USING ERRCODE = ''42501''; END IF;\n');
  execute definition;
 end if;
end $$;
