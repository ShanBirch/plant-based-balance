create table if not exists public.balance_course_enrollments (
 user_id uuid not null references auth.users(id) on delete cascade,
 course_id text not null check(course_id in ('master','lead')),
 started_at timestamptz not null default now(),
 primary key(user_id,course_id)
);
alter table public.balance_course_enrollments enable row level security;
revoke all on public.balance_course_enrollments from anon,authenticated;
grant select,insert on public.balance_course_enrollments to authenticated;
grant all on public.balance_course_enrollments to service_role;
create policy course_enrollment_read on public.balance_course_enrollments for select to authenticated using ((select auth.uid())=user_id);
create policy course_enrollment_start on public.balance_course_enrollments for insert to authenticated with check ((select auth.uid())=user_id);
create table if not exists public.balance_lead_projects (
 user_id uuid primary key references auth.users(id) on delete cascade,
 data jsonb not null default '{}'::jsonb check(jsonb_typeof(data)='object' and octet_length(data::text)<=100000),
 updated_at timestamptz not null default now()
);
alter table public.balance_lead_projects enable row level security;
revoke all on public.balance_lead_projects from anon,authenticated;
grant select,insert,update on public.balance_lead_projects to authenticated;
grant all on public.balance_lead_projects to service_role;
create policy lead_projects_read on public.balance_lead_projects for select to authenticated using ((select auth.uid())=user_id);
create policy lead_projects_insert on public.balance_lead_projects for insert to authenticated with check ((select auth.uid())=user_id);
create policy lead_projects_update on public.balance_lead_projects for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
notify pgrst,'reload schema';
revoke insert on public.balance_course_enrollments from authenticated;
grant insert(user_id,course_id) on public.balance_course_enrollments to authenticated;
