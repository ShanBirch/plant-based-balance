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


create or replace function public.configure_app_support_accountability(p_thread_id uuid,p_program_id uuid,p_consent_revision integer,
 p_timezone text,p_starts_on date,p_ends_on date,p_review jsonb) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare t ig_threads; s coaching_support_preferences; p custom_workout_programs; slots jsonb; result uuid;
begin
 select * into t from ig_threads where id=p_thread_id for update;
 select * into s from coaching_support_preferences where user_id=t.linked_user_id for update;
 select * into p from custom_workout_programs where id=p_program_id and user_id=t.linked_user_id and is_active;
 if t.id is null or s.user_id is null or p_consent_revision is null or t.channel is distinct from 'instagram' or nullif(t.ig_username,'') is null or p.id is null
 or s.revision is distinct from p_consent_revision or not (s.morning_training or s.after_session)
 then raise exception 'Exact Instagram identity, active saved program and selected app consent required'; end if;
 if not coalesce(p_review @> '{"full_thread_reviewed":true,"native_identity_verified":true,"independent_holds_checked":true,"app_context_reviewed":true,"no_duplicate_verified":true,"timezone_verified":true}',false)
 or nullif(p_review->>'reviewed_by','') is null then raise exception 'Fresh native/app/source review required'; end if;
 if not exists(select 1 from pg_timezone_names where name=p_timezone) then raise exception 'Verified timezone required'; end if;
 if p_starts_on is null or p_ends_on is null or p_starts_on>p_ends_on or p_ends_on>p_starts_on+90 then raise exception 'Bounded coaching dates required'; end if;
 if exists(select 1 from balance_free_coaching_setups f join balance_free_starters g on g.id=f.grant_id
 where f.thread_id=t.id and (g.revoked_at is not null or p_ends_on>(g.ends_at at time zone p_timezone)::date)) then raise exception 'Cannot extend promised coaching access'; end if;
 -- Read exact days/names from the program; never ask for or invent a new schedule.
 if jsonb_typeof(p.weekly_schedule) is distinct from 'array' then raise exception 'Saved program schedule needs review'; end if;
 select jsonb_agg(jsonb_build_object('weekday',array_position(array['mon','tue','wed','thu','fri','sat','sun'],lower(left(x->>'day',3))),
 'time','08:00','session_name',x->'workout'->>'name') order by array_position(array['mon','tue','wed','thu','fri','sat','sun'],lower(left(x->>'day',3)))) into slots
 from jsonb_array_elements(p.weekly_schedule) x where nullif(x->'workout'->>'name','') is not null
 and lower(coalesce(x->'workout'->>'type','')) not in ('rest','recovery','yoga')
 and lower(x->'workout'->>'name') not in ('rest','rest day','recovery','yoga');
 if slots is null or jsonb_array_length(slots) not between 1 and 7
 or exists(select 1 from jsonb_array_elements(slots) x where x->>'weekday' is null)
 or (select count(distinct x->>'weekday') from jsonb_array_elements(slots) x)<>jsonb_array_length(slots) then raise exception 'Saved training days need review'; end if;
 -- Never replace a healthy inbound-consent enrollment or an in-flight action.
 if exists(select 1 from workout_accountability e where e.thread_id=t.id and e.enabled and e.consent_source='instagram_inbound') then raise exception 'Existing inbound-consent support owns this enrollment'; end if;
 if exists(select 1 from workout_accountability_events v join workout_accountability e on e.id=v.enrollment_id
 where e.thread_id=t.id and v.status in ('queued','reserved','uncertain')) then raise exception 'Reconcile existing event ownership first'; end if;
 select id into result from workout_accountability where thread_id=t.id and enabled and consent_source='app_preferences'
 and app_consent_revision=s.revision and app_program_id=p.id and app_program_updated_at=p.updated_at and timezone=p_timezone
 and schedule=slots and starts_on=p_starts_on and ends_on=p_ends_on;
 if result is not null then
  if not workout_accountability_allowed(result) then raise exception 'Independent support hold'; end if;
  return result;
 end if;
 insert into workout_accountability(thread_id,user_id,coach_id,timezone,schedule,consent_message_id,consent_review,starts_on,ends_on,
 consent_source,app_consent_revision,app_program_id,app_program_updated_at)
 values(t.id,t.linked_user_id,t.coach_id,p_timezone,slots,null,p_review,p_starts_on,p_ends_on,'app_preferences',s.revision,p.id,p.updated_at)
 on conflict(thread_id) do update set timezone=excluded.timezone,schedule=excluded.schedule,consent_message_id=null,
 consent_source='app_preferences',app_consent_revision=s.revision,app_program_id=p.id,app_program_updated_at=p.updated_at,
 consent_review=p_review,starts_on=p_starts_on,ends_on=p_ends_on,enabled=true,version=workout_accountability.version+1,updated_at=now()
 returning id into result;
 if not workout_accountability_allowed(result) then raise exception 'Existing onboarding/client/manual/safety hold prevents support'; end if;
 update workout_accountability_events set status='skipped',receipt=receipt||'{"reason":"app_preferences_changed","no_repeat":true}'
 where enrollment_id=result and status='pending';
 return result;
end;
$$;
