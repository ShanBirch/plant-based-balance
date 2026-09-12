-- All writes go through authenticated server endpoints and service-only RPCs.
create table public.learn_action_enrollments (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.users(id),
 course_id text not null default 'balance-foundations' check(course_id='balance-foundations'),
 start_date date not null, active boolean not null default true, created_at timestamptz not null default now(),
 unique(id,user_id)
);
create unique index learn_action_active_enrollment on public.learn_action_enrollments(user_id) where active;
create table public.learn_action_reviews (
 id uuid primary key default gen_random_uuid(), enrollment_id uuid not null, user_id uuid not null,
 week smallint not null check(week between 1 and 6), action_key text not null,
 status text not null default 'planned' check(status in ('planned','submitted','needs_information','completed','legacy_completed')),
 instructions jsonb not null default '{}', reflection_text text, reflection_lesson_id text, reflection_at timestamptz,
 report jsonb not null default '{}', report_complete boolean not null default false,
 revision integer not null default 0, submitted_at timestamptz, reviewed_at timestamptz, reviewed_by uuid references public.users(id), review_note text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(enrollment_id,week), foreign key(enrollment_id,user_id) references public.learn_action_enrollments(id,user_id),
 check(action_key='learn_w'||week||'_v3'),
 check(status <> 'completed' or (reviewed_by is not null and reviewed_at is not null and report_complete))
);
create table public.learn_action_review_events (
 id uuid primary key default gen_random_uuid(), review_id uuid not null references public.learn_action_reviews(id),
 actor_id uuid references public.users(id), operation text not null, before_record jsonb, after_record jsonb not null, created_at timestamptz not null default now()
);
create index learn_action_review_user on public.learn_action_reviews(user_id,enrollment_id,week);
create index learn_action_event_review on public.learn_action_review_events(review_id,created_at);
alter table public.learn_action_enrollments enable row level security;
alter table public.learn_action_reviews enable row level security;
alter table public.learn_action_review_events enable row level security;
revoke all on public.learn_action_enrollments, public.learn_action_reviews, public.learn_action_review_events from anon,authenticated;
grant select on public.learn_action_enrollments, public.learn_action_reviews, public.learn_action_review_events to authenticated;
grant all on public.learn_action_enrollments, public.learn_action_reviews, public.learn_action_review_events to service_role;
create policy learn_enrollment_read on public.learn_action_enrollments for select to authenticated using (
 user_id=(select auth.uid()) or exists(select 1 from public.admin_users a where a.user_id=(select auth.uid()) and a.role='super_admin')
 or exists(select 1 from public.coach_clients c where c.client_id=user_id and c.coach_id=(select auth.uid()) and c.status='active')
);
create policy learn_review_read on public.learn_action_reviews for select to authenticated using (
 user_id=(select auth.uid()) or exists(select 1 from public.admin_users a where a.user_id=(select auth.uid()) and a.role='super_admin')
 or exists(select 1 from public.coach_clients c where c.client_id=user_id and c.coach_id=(select auth.uid()) and c.status='active')
);
create policy learn_events_read on public.learn_action_review_events for select to authenticated using (
 exists(select 1 from public.learn_action_reviews r where r.id=review_id)
);

-- Freeze only existing completed credit. Never infer a new action was attempted.
insert into public.learn_action_enrollments(user_id,start_date)
 select user_id, week_started_at-((current_week-1)*7) from public.social_journey_progress;
insert into public.learn_action_reviews(enrollment_id,user_id,week,action_key,status,instructions,report)
 select e.id,j.user_id,w,'learn_w'||w||'_v3','legacy_completed',
 '{"version":2,"title":"Earlier completed Learn action"}'::jsonb,
 jsonb_build_object('historical_snapshot',coalesce(j.settings->'foundation_week_progress'->w::text,'{}'::jsonb),'reason','Completed before coach-reviewed actions were introduced')
 from public.social_journey_progress j join public.learn_action_enrollments e on e.user_id=j.user_id
 cross join generate_series(1,6) w
 where exists(select 1 from jsonb_array_elements(coalesce(j.settings->'foundation_week_progress'->w::text->'tasks','[]'::jsonb)) t where t->>'id'='w'||w||'_experiment' and t->>'complete'='true')
 or exists(select 1 from jsonb_array_elements(coalesce(j.progress_snapshot->'tasks','[]'::jsonb)) t where t->>'id'='w'||w||'_experiment' and t->>'complete'='true')
 or coalesce(j.settings->'learn_actions_v2'->'credited_weeks','[]'::jsonb) @> to_jsonb(w);

create function public.ensure_learn_action_enrollment(p_user_id uuid,p_start_date date,p_restart boolean default false)
 returns public.learn_action_enrollments language plpgsql security invoker set search_path=public,pg_temp as $$
declare result public.learn_action_enrollments;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_user_id::text,318));
 select * into result from public.learn_action_enrollments where user_id=p_user_id and active for update;
 if result.id is not null and result.start_date=p_start_date and not p_restart then return result; end if;
 update public.learn_action_enrollments set active=false where user_id=p_user_id and active;
 insert into public.learn_action_enrollments(user_id,start_date) values(p_user_id,p_start_date) returning * into result;
 return result;
end $$;
revoke all on function public.ensure_learn_action_enrollment(uuid,date,boolean) from public,anon,authenticated;
grant execute on function public.ensure_learn_action_enrollment(uuid,date,boolean) to service_role;

create function public.write_learn_action_review(p_enrollment uuid,p_week integer,p_actor uuid,p_operation text,p_payload jsonb,p_revision integer default null)
 returns public.learn_action_reviews language plpgsql security invoker set search_path=public,pg_temp as $$
declare enrol public.learn_action_enrollments; rec public.learn_action_reviews; old_record jsonb; can_review boolean;
begin
 select * into enrol from public.learn_action_enrollments where id=p_enrollment for update;
 if enrol.id is null or p_week not between 1 and 6 then raise exception 'Invalid enrollment or week'; end if;
 if p_operation in ('approve','request_information') then
   select exists(select 1 from public.admin_users where user_id=p_actor and role='super_admin')
      or exists(select 1 from public.coach_clients where coach_id=p_actor and client_id=enrol.user_id and status='active') into can_review;
   if not can_review or p_actor=enrol.user_id then raise exception 'Coach authorization required' using errcode='42501'; end if;
 elsif p_operation in ('plan','report') then
   if p_actor<>enrol.user_id or not enrol.active then raise exception 'Current member enrollment required' using errcode='42501'; end if;
 else raise exception 'Unsupported action'; end if;
 select * into rec from public.learn_action_reviews where enrollment_id=p_enrollment and week=p_week for update;
 if rec.id is null then
   if p_operation in ('approve','request_information') then raise exception 'No submitted report'; end if;
   insert into public.learn_action_reviews(enrollment_id,user_id,week,action_key) values(p_enrollment,enrol.user_id,p_week,'learn_w'||p_week||'_v3') returning * into rec;
 end if;
 if p_revision is null or p_revision<>rec.revision then raise exception 'This evidence changed. Reload before continuing.' using errcode='40001'; end if;
 if rec.status in ('completed','legacy_completed') then raise exception 'Completed evidence is preserved; it cannot be overwritten'; end if;
 old_record=to_jsonb(rec);
 if p_operation='plan' then
   rec.reflection_text=left(p_payload->>'reflection_text',2000); rec.reflection_lesson_id=p_payload->>'lesson_id'; rec.reflection_at=now();
   rec.instructions=coalesce(p_payload->'instructions',rec.instructions);
 elsif p_operation='report' then
   rec.report=p_payload->'report'; rec.report_complete=coalesce((p_payload->>'complete')::boolean,false);
   rec.instructions=p_payload->'instructions'; rec.status=case when rec.report_complete then 'submitted' when rec.status='needs_information' then 'needs_information' else 'planned' end;
   rec.submitted_at=case when rec.report_complete then now() else null end;
   rec.reviewed_by=null; rec.reviewed_at=null;
 elsif p_operation='approve' then
   if rec.status<>'submitted' or not rec.report_complete then raise exception 'A complete submitted report is required'; end if;
   rec.status='completed';rec.reviewed_at=now();rec.reviewed_by=p_actor;rec.review_note=left(p_payload->>'note',2000);
 else
   if rec.status<>'submitted' then raise exception 'A submitted report is required'; end if;
   if length(trim(coalesce(p_payload->>'note','')))<2 then raise exception 'Explain what information is needed'; end if;
   rec.status='needs_information';rec.reviewed_at=now();rec.reviewed_by=p_actor;rec.review_note=left(p_payload->>'note',2000);
 end if;
 rec.revision=rec.revision+1;rec.updated_at=now();
 update public.learn_action_reviews set status=rec.status,instructions=rec.instructions,reflection_text=rec.reflection_text,reflection_lesson_id=rec.reflection_lesson_id,reflection_at=rec.reflection_at,
 report=rec.report,report_complete=rec.report_complete,revision=rec.revision,submitted_at=rec.submitted_at,reviewed_at=rec.reviewed_at,reviewed_by=rec.reviewed_by,review_note=rec.review_note,updated_at=rec.updated_at where id=rec.id;
 insert into public.learn_action_review_events(review_id,actor_id,operation,before_record,after_record) values(rec.id,p_actor,p_operation,old_record,to_jsonb(rec));
 return rec;
end $$;
revoke all on function public.write_learn_action_review(uuid,integer,uuid,text,jsonb,integer) from public,anon,authenticated;
grant execute on function public.write_learn_action_review(uuid,integer,uuid,text,jsonb,integer) to service_role;
