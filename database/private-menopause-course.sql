-- Owner-only review. Content is seeded separately, never in public deploy assets.
create table public.private_learning_courses (
  id text primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  constraint private_course_owner check (owner_id = '00a6605e-8edb-4917-85ba-24a23f179059'::uuid),
  constraint private_course_id check (id = 'balance-menopause')
);
alter table public.private_learning_courses enable row level security;
revoke all on public.private_learning_courses from public, anon, authenticated;
grant select on public.private_learning_courses to authenticated;
grant all on public.private_learning_courses to service_role;
create policy private_course_owner_read on public.private_learning_courses
for select to authenticated using ((select auth.uid()) = owner_id);

create table public.private_learning_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id text not null references public.private_learning_courses(id) on delete cascade,
  lesson_id text not null,
  score integer not null default 0 check (score between 0 and 100),
  completed boolean not null default false,
  reflection text not null default '' check (length(reflection) <= 4000),
  updated_at timestamptz not null default now(),
  primary key (user_id, course_id, lesson_id),
  constraint private_progress_owner check (user_id = '00a6605e-8edb-4917-85ba-24a23f179059'::uuid),
  constraint private_progress_lesson check (lesson_id ~ '^menopause-[1-9]-[1-3]$' or lesson_id ~ '^week-[1-9]$')
);
alter table public.private_learning_progress enable row level security;
revoke all on public.private_learning_progress from public, anon, authenticated;
grant select, insert, update on public.private_learning_progress to authenticated;
grant all on public.private_learning_progress to service_role;
create policy private_progress_read on public.private_learning_progress for select to authenticated
using ((select auth.uid()) = user_id and exists (select 1 from public.private_learning_courses c where c.id=course_id and c.owner_id=(select auth.uid())));
create policy private_progress_insert on public.private_learning_progress for insert to authenticated
with check ((select auth.uid()) = user_id and exists (select 1 from public.private_learning_courses c where c.id=course_id and c.owner_id=(select auth.uid())));
create policy private_progress_update on public.private_learning_progress for update to authenticated
using ((select auth.uid()) = user_id and exists (select 1 from public.private_learning_courses c where c.id=course_id and c.owner_id=(select auth.uid())))
with check ((select auth.uid()) = user_id and exists (select 1 from public.private_learning_courses c where c.id=course_id and c.owner_id=(select auth.uid())));
