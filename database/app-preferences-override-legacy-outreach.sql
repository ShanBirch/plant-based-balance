-- A deliberate app choice supersedes an older optional-contact permission only
-- inside the positively mapped NEW cohort. Preserve all historical records.
create or replace function public.app_support_event_selected(p_enrollment uuid,p_kind text) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from workout_accountability e where e.id=p_enrollment and
 ((e.consent_source='instagram_inbound' and not (organic_outreach_cohort_allowed(e.user_id)
   and exists(select 1 from coaching_support_preferences s where s.user_id=e.user_id)))
 or (e.consent_source='app_preferences' and exists(select 1 from coaching_support_preferences s
 where s.user_id=e.user_id and s.revision=e.app_consent_revision and s.consent_version='support_choices_20261101_v1'
 and ((p_kind='before' and s.morning_training) or (p_kind='logged' and s.after_session))))));
$$;
revoke all on function public.app_support_event_selected(uuid,text) from public,anon,authenticated;
grant execute on function public.app_support_event_selected(uuid,text) to service_role;
do $$ declare d text; needle text:='where e.id=p_id and e.enabled'; begin
 select pg_get_functiondef('public.workout_accountability_allowed(uuid)'::regprocedure) into d;
 if position('Saved app choices supersede legacy permission' in d)=0 then
  if position(needle in d)=0 then raise exception 'Existing action-time guard changed; review before applying';end if;
  d:=replace(d,needle,needle||' /* Saved app choices supersede legacy permission only for new outreach. */
 and not (e.consent_source=''instagram_inbound'' and organic_outreach_cohort_allowed(e.user_id)
 and exists(select 1 from coaching_support_preferences chosen where chosen.user_id=e.user_id))');
  execute d;
 end if;
end $$;
