create or replace function public.coaching_support_context(p_user_id uuid) returns jsonb
language sql stable security invoker set search_path=public,pg_temp as $$
 select jsonb_build_object('preferences',to_jsonb(s),'onboarding_complete',u.onboarding_complete,
 'last_login',u.last_login,'program',to_jsonb(p),
 'enrollment',(select to_jsonb(e) from workout_accountability e where e.user_id=u.id and e.consent_source='app_preferences' order by e.updated_at desc limit 1),
 'delivery_configured',exists(select 1 from workout_accountability e where e.user_id=u.id and e.consent_source='app_preferences' and workout_accountability_allowed(e.id)),
 'integration_boundary','Existing operator must verify native identity/timezone, program and app consent before configuration. Dot service is not configured.')
 from users u left join coaching_support_preferences s on s.user_id=u.id
 left join lateral(select x.* from custom_workout_programs x where x.user_id=u.id and x.is_active order by x.updated_at desc limit 1) p on true
 where u.id=p_user_id;
$$;
create function public.coaching_support_review_candidates() returns setof jsonb
language sql stable security invoker set search_path=public,pg_temp as $$
 select coaching_support_context(s.user_id)||jsonb_build_object('user_id',s.user_id,
 'linked_instagram_threads',(select jsonb_agg(jsonb_build_object('thread_id',t.id,'coach_id',t.coach_id,'username',t.ig_username))
 from ig_threads t join coach_clients c on c.client_id=t.linked_user_id and c.coach_id=t.coach_id and c.status='active' and c.ended_at is null
 where t.linked_user_id=s.user_id and t.channel='instagram'))
 from coaching_support_preferences s join users u on u.id=s.user_id
 where u.onboarding_complete and u.last_login is not null and not coalesce(u.is_test_account,false)
 and (s.morning_training or s.after_session)
 and not exists(select 1 from workout_accountability e where e.user_id=s.user_id and e.consent_source='app_preferences'
 and e.app_consent_revision=s.revision and workout_accountability_allowed(e.id));
$$;
revoke all on function public.coaching_support_context(uuid),public.coaching_support_review_candidates() from public,anon,authenticated;
grant execute on function public.coaching_support_context(uuid),public.coaching_support_review_candidates() to service_role;
