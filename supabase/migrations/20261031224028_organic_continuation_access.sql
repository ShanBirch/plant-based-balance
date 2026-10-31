insert into organic_outreach_existing_client_exclusions(user_id,reason)
select distinct u.id,'Existing Stripe subscription record outside the new outreach offer'
from users u join stripe_subscription_links s on s.user_id=u.id or lower(s.email)=lower(u.email)
where s.stripe_price_id is distinct from 'price_1UWkkrCGCyRUsOfKYcvJGqiR'
on conflict do nothing;
create function public.organic_outreach_paid_continuation_allowed(p_user_id uuid) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
 select organic_outreach_cohort_allowed(p_user_id) and exists(select 1 from stripe_subscription_links s
 join users u on u.id=s.user_id where s.user_id=p_user_id and s.subscription_status='active'
 and s.subscription_plan='organic_coaching_continuation_weekly'
 and s.stripe_price_id='price_1UWkkrCGCyRUsOfKYcvJGqiR' and s.current_period_end>now()
 and u.subscription_status='active' and u.subscription_plan=s.subscription_plan);
$$;
revoke all on function public.organic_outreach_paid_continuation_allowed(uuid) from public,anon,authenticated;
grant execute on function public.organic_outreach_paid_continuation_allowed(uuid) to service_role;
do $$ declare d text; needle text; begin
 select pg_get_functiondef('public.workout_accountability_allowed(uuid)'::regprocedure) into d;
 needle:='and not exists(select 1 from balance_free_coaching_setups s join balance_free_starters g on g.id=s.grant_id where s.thread_id=t.id and (g.revoked_at is not null or g.ends_at<=now()))';
 if position(needle in d)=0 then raise exception 'Existing free-access guard changed'; end if;
 d:=replace(d,needle,'and ('||substring(needle from 5)||' or (e.consent_source=''app_preferences'' and organic_outreach_paid_continuation_allowed(e.user_id) and not exists(select 1 from balance_free_coaching_setups s join balance_free_starters g on g.id=s.grant_id where s.thread_id=t.id and g.revoked_at is not null)))');execute d;
 select pg_get_functiondef('public.configure_app_support_accountability(uuid,uuid,integer,text,date,date,jsonb)'::regprocedure) into d;
 needle:='if exists(select 1 from balance_free_coaching_setups f join balance_free_starters g on g.id=f.grant_id';
 if position(needle in d)=0 then raise exception 'Existing setup guard changed'; end if;
 d:=replace(d,needle,'if not organic_outreach_paid_continuation_allowed(t.linked_user_id) and exists(select 1 from balance_free_coaching_setups f join balance_free_starters g on g.id=f.grant_id');
 d:=replace(d,'-- Read exact days/names from the program;', 'if organic_outreach_paid_continuation_allowed(t.linked_user_id) and not exists(select 1 from stripe_subscription_links x where x.user_id=t.linked_user_id and x.subscription_status=''active'' and x.stripe_price_id=''price_1UWkkrCGCyRUsOfKYcvJGqiR'' and p_ends_on <= (x.current_period_end at time zone p_timezone)::date) then raise exception ''Paid support cannot extend beyond verified paid access''; end if;'||chr(10)||' -- Read exact days/names from the program;');execute d;
end $$;
