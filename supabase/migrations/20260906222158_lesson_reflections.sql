create table public.lesson_reflections (
 user_id uuid not null references public.users(id) on delete cascade,
 lesson_id text not null,
 lesson_title text not null check (char_length(lesson_title) between 1 and 300),
 unit_id text,
 course_id text,
 reflection_text text not null check (char_length(btrim(reflection_text)) between 1 and 2000),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 primary key (user_id, lesson_id)
);
alter table public.lesson_reflections enable row level security;
revoke all on public.lesson_reflections from anon, authenticated;
grant select, insert, update on public.lesson_reflections to authenticated;
grant all on public.lesson_reflections to service_role;
create policy reflection_owner_read on public.lesson_reflections for select to authenticated using ((select auth.uid()) = user_id);
create policy reflection_coach_read on public.lesson_reflections for select to authenticated using (exists (select 1 from public.coach_clients cc where cc.client_id = lesson_reflections.user_id and cc.coach_id = (select auth.uid()) and cc.status = 'active'));
create policy reflection_owner_insert on public.lesson_reflections for insert to authenticated with check (
 (select auth.uid()) = user_id and exists (
 select 1 from public.lesson_completions lc where lc.user_id = (select auth.uid()) and lc.lesson_id = lesson_reflections.lesson_id and lc.score_percentage = 100 and lc.games_played > 0
 ));
create policy reflection_owner_update on public.lesson_reflections for update to authenticated using ((select auth.uid()) = user_id) with check (
 (select auth.uid()) = user_id and exists (
 select 1 from public.lesson_completions lc where lc.user_id = (select auth.uid()) and lc.lesson_id = lesson_reflections.lesson_id and lc.score_percentage = 100 and lc.games_played > 0
 ));
create trigger lesson_reflections_updated before update on public.lesson_reflections for each row execute function public.update_updated_at_column();
comment on table public.lesson_reflections is 'Optional private reflections after perfect lesson quizzes; one saved reflection per learner and lesson, readable by the learner and their active coach.';
