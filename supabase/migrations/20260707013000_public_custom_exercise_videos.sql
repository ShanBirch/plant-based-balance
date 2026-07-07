-- Make video-backed custom exercises available to the shared exercise library.
alter table public.custom_exercises
  add column if not exists is_public boolean not null default false;

update public.custom_exercises
set is_public = true
where video_url is not null
  and video_url <> '';

create index if not exists idx_custom_exercises_public_created
  on public.custom_exercises (is_public, created_at desc);

drop policy if exists "Users can view public custom exercises" on public.custom_exercises;
create policy "Users can view public custom exercises"
  on public.custom_exercises
  for select
  to authenticated
  using (is_public = true);
