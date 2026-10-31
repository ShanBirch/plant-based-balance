-- Entire test rolls back. No messages, queue preparation or delivery.
begin;
do $$ declare uid uuid; r coaching_support_preferences; e workout_accountability; p custom_workout_programs; configured uuid; begin
 select id into uid from users where organic_outreach_cohort_allowed(id) order by id limit 1;
 if uid is null then raise exception 'Source-verified cohort fixture required'; end if;
 select * into e from workout_accountability where user_id=uid and workout_accountability_allowed(id)
 and not exists(select 1 from workout_accountability_events v where v.enrollment_id=workout_accountability.id and v.status in ('queued','reserved','uncertain')) limit 1;
 select * into p from custom_workout_programs where user_id=e.user_id and is_active limit 1;
 if e.id is null or p.id is null then raise exception 'Existing enrollment/program fixture required'; end if;
 perform set_config('request.jwt.claim.sub',uid::text,true);
 r:=save_coaching_support_preferences(false,false,'direct','app_onboarding');
 if e.user_id=uid and e.consent_source='instagram_inbound' and (workout_accountability_allowed(e.id) or app_support_event_selected(e.id,'before') or app_support_event_selected(e.id,'logged')) then raise exception 'Saved app opt-out bypassed by old permission';end if;
 if r.morning_training or r.after_session or r.tone<>'direct' or r.consent_source<>'app_onboarding' then raise exception 'Tone inferred consent'; end if;
 r:=save_coaching_support_preferences(true,false,'gentle','app_settings');
 if not r.morning_training or r.after_session or r.revision<2 then raise exception 'Independent preference persistence failed'; end if;
 begin perform save_coaching_support_preferences(null,false,'gentle','app_settings'); raise exception 'Null consent accepted'; exception when raise_exception then if sqlerrm='Null consent accepted' then raise; end if; end;
 begin perform save_coaching_support_preferences(false,false,'harsh','app_settings'); raise exception 'Invalid tone accepted'; exception when raise_exception then if sqlerrm='Invalid tone accepted' then raise; end if; end;
 insert into coaching_support_preferences(user_id,morning_training,after_session,tone,consent_source)
 values(e.user_id,true,false,'gentle','app_onboarding') on conflict(user_id) do update set morning_training=true,after_session=false returning * into r;
 update workout_accountability set consent_source='app_preferences',consent_message_id=null,app_consent_revision=r.revision,
 app_program_id=p.id,app_program_updated_at=p.updated_at where id=e.id;
 configured:=configure_app_support_accountability(e.thread_id,p.id,r.revision,e.timezone,e.starts_on,e.ends_on,
 '{"full_thread_reviewed":true,"native_identity_verified":true,"independent_holds_checked":true,"app_context_reviewed":true,"no_duplicate_verified":true,"timezone_verified":true,"reviewed_by":"rollback_test"}');
 if configured is distinct from e.id or not exists(select 1 from workout_accountability where id=configured and consent_message_id is null and consent_source='app_preferences') then raise exception 'First-class app path fabricated inbound consent'; end if;
 if not app_support_event_selected(e.id,'before') or app_support_event_selected(e.id,'logged') or app_support_event_selected(e.id,'evening') then raise exception 'Unselected event escaped'; end if;
 update coaching_support_preferences set morning_training=false,after_session=true where user_id=e.user_id;
 if app_support_event_selected(e.id,'before') or not app_support_event_selected(e.id,'logged') then raise exception 'Revocation not immediate'; end if;
 update coaching_support_preferences set revision=revision+1 where user_id=e.user_id;
 if app_support_event_selected(e.id,'logged') or workout_accountability_allowed(e.id) then raise exception 'Stale consent accepted'; end if;
 if has_function_privilege('authenticated','public.configure_app_support_accountability(uuid,uuid,integer,text,date,date,jsonb)','execute')
 or has_table_privilege('authenticated','public.coaching_support_preferences','update') then raise exception 'Client can bypass audited consent path'; end if;
end $$;
rollback;
