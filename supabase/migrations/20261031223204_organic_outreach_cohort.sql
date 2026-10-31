-- Positive source mapping only. Never infer enrollment from payment absence.
create table public.organic_outreach_existing_client_exclusions (
 user_id uuid primary key references public.users(id), reason text not null,
 recorded_at timestamptz not null default now()
);
alter table public.organic_outreach_existing_client_exclusions enable row level security;
revoke all on public.organic_outreach_existing_client_exclusions from public,anon,authenticated;
grant all on public.organic_outreach_existing_client_exclusions to service_role;
insert into organic_outreach_existing_client_exclusions(user_id,reason)
select u.id,'Existing paying member or established client before the outreach intake'
from users u where u.subscription_status in ('active','trialing','paid','paying')
 or exists(select 1 from coach_clients c where c.client_id=u.id and c.assigned_at < '2026-10-25T00:00:00+10')
 or exists(select 1 from founders_pass_purchases p where (p.user_id=u.id or lower(p.email)=lower(u.email)) and p.status='paid')
on conflict do nothing;
create function public.organic_outreach_cohort_allowed(p_user_id uuid) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from balance_coaching_challenge_enrolments e
 join ig_threads t on t.id=e.thread_id and t.linked_user_id=p_user_id and t.channel='instagram'
 and t.coach_id='00a6605e-8edb-4917-85ba-24a23f179059'
 join ig_messages m on m.id=e.acceptance_message_id and m.thread_id=t.id and m.direction='in'
 join balance_free_coaching_setups f on f.thread_id=t.id and f.acceptance_message_id=e.acceptance_message_id
 join balance_free_starters g on g.id=f.grant_id and g.user_id=p_user_id and g.thread_id=t.id
 join users u on u.id=p_user_id
 where e.intake_id='consistency_20261025' and g.experience='coached_month_v1' and g.revoked_at is null
 and g.setup->>'challengeEnrolmentId'=e.id::text and g.setup->>'challengeIntakeId'=e.intake_id
 and not exists(select 1 from organic_outreach_existing_client_exclusions x where x.user_id=p_user_id)
 and (u.subscription_status is null or u.subscription_status not in ('active','trialing','paid','paying')
   or u.subscription_plan='organic_coaching_continuation_weekly')
 and not exists(select 1 from founders_pass_purchases p where (p.user_id=u.id or lower(p.email)=lower(u.email)) and p.status='paid')
 );
$$;
create function public.my_outreach_support_eligibility() returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
 select auth.uid() is not null and organic_outreach_cohort_allowed(auth.uid());
$$;
revoke all on function public.organic_outreach_cohort_allowed(uuid),public.my_outreach_support_eligibility() from public,anon,authenticated;
grant execute on function public.organic_outreach_cohort_allowed(uuid) to service_role;
grant execute on function public.my_outreach_support_eligibility() to authenticated;

-- Apply the cohort check at consent save, configuration, preparation and every
-- action-time ownership check through the existing allowed predicate.
do $$ declare d text; begin
 select pg_get_functiondef('public.save_coaching_support_preferences(boolean,boolean,text,text)'::regprocedure) into d;
 d:=replace(d,'if uid is null or not exists','if not organic_outreach_cohort_allowed(uid) then raise exception ''This support system is only for the verified new outreach cohort''; end if;'||chr(10)||' if uid is null or not exists'); execute d;
 select pg_get_functiondef('public.workout_accountability_allowed(uuid)'::regprocedure) into d;
 d:=replace(d,'e.consent_source=''instagram_inbound'' or (t.channel=''instagram''','e.consent_source=''instagram_inbound'' or (organic_outreach_cohort_allowed(e.user_id) and t.channel=''instagram'''); execute d;
 select pg_get_functiondef('public.configure_app_support_accountability(uuid,uuid,integer,text,date,date,jsonb)'::regprocedure) into d;
 d:=replace(d,'if t.id is null or','if not organic_outreach_cohort_allowed(t.linked_user_id) or t.id is null or'); execute d;
 select pg_get_functiondef('public.coaching_support_review_candidates()'::regprocedure) into d;
 d:=replace(d,'where u.onboarding_complete','where organic_outreach_cohort_allowed(s.user_id) and u.onboarding_complete'); execute d;
end $$;
