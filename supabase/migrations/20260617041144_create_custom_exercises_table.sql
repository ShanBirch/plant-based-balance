create table if not exists public.custom_exercises (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  exercise_name text not null,
  description text,
  muscle_group text,
  equipment text,
  video_url text,
  storage_path text,
  thumbnail_url text,
  default_sets integer default 3,
  default_reps text default '8-12',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_custom_exercises_user
  on public.custom_exercises(user_id);

create index if not exists idx_custom_exercises_name
  on public.custom_exercises(user_id, exercise_name);

alter table public.custom_exercises enable row level security;

drop policy if exists "Users can manage own custom exercises"
  on public.custom_exercises;

create policy "Users can manage own custom exercises"
  on public.custom_exercises
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Admins can view all custom exercises"
  on public.custom_exercises;

create policy "Admins can view all custom exercises"
  on public.custom_exercises
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.admin_users
      where admin_users.user_id = auth.uid()
    )
  );

grant select, insert, update, delete
  on public.custom_exercises
  to authenticated;

create or replace trigger update_custom_exercises_updated_at
  before update on public.custom_exercises
  for each row
  execute function public.update_updated_at_column();
