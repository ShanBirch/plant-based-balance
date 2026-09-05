create table if not exists public.balance_master_projects (
 user_id uuid primary key references auth.users(id) on delete cascade,
 data jsonb not null default '{}'::jsonb check (jsonb_typeof(data) = 'object' and octet_length(data::text) <= 200000),
 updated_at timestamptz not null default now()
);
alter table public.balance_master_projects enable row level security;
revoke all on public.balance_master_projects from anon, authenticated;
grant select, insert, update on public.balance_master_projects to authenticated;
grant all on public.balance_master_projects to service_role;
create policy master_projects_select_own on public.balance_master_projects for select to authenticated using ((select auth.uid()) = user_id);
create policy master_projects_insert_own on public.balance_master_projects for insert to authenticated with check ((select auth.uid()) = user_id);
create policy master_projects_update_own on public.balance_master_projects for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
comment on table public.balance_master_projects is 'Private Balance Master learning worksheets. These do not replace active coached workout or meal plans.';
notify pgrst, 'reload schema';
