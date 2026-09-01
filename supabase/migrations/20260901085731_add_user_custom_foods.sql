create table if not exists public.user_custom_foods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  serving_label text not null default '1 serving' check (char_length(btrim(serving_label)) between 1 and 80),
  serving_weight_g numeric(8,2) not null check (serving_weight_g > 0 and serving_weight_g <= 5000),
  calories numeric(8,2) not null default 0 check (calories >= 0 and calories <= 100000),
  protein_g numeric(8,2) not null default 0 check (protein_g >= 0 and protein_g <= 5000),
  carbs_g numeric(8,2) not null default 0 check (carbs_g >= 0 and carbs_g <= 5000),
  fat_g numeric(8,2) not null default 0 check (fat_g >= 0 and fat_g <= 5000),
  fiber_g numeric(8,2) not null default 0 check (fiber_g >= 0 and fiber_g <= 5000),
  is_shared boolean not null default false,
  shared_at timestamptz,
  times_used integer not null default 0 check (times_used >= 0),
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_user_custom_foods_user_recent
  on public.user_custom_foods (user_id, last_used_at desc nulls last, updated_at desc);

alter table public.user_custom_foods enable row level security;

revoke all on table public.user_custom_foods from anon;
revoke all on table public.user_custom_foods from authenticated;
grant select, insert, update, delete on table public.user_custom_foods to authenticated;
grant select, insert, update, delete on table public.user_custom_foods to service_role;

drop policy if exists "Users can view their own and shared custom foods" on public.user_custom_foods;
create policy "Users can view their own and shared custom foods"
  on public.user_custom_foods for select
  to authenticated
  using ((select auth.uid()) = user_id or is_shared = true);

drop policy if exists "Users can create their own custom foods" on public.user_custom_foods;
create policy "Users can create their own custom foods"
  on public.user_custom_foods for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own custom foods" on public.user_custom_foods;
create policy "Users can update their own custom foods"
  on public.user_custom_foods for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own custom foods" on public.user_custom_foods;
create policy "Users can delete their own custom foods"
  on public.user_custom_foods for delete
  to authenticated
  using ((select auth.uid()) = user_id);

drop trigger if exists update_user_custom_foods_updated_at on public.user_custom_foods;
create trigger update_user_custom_foods_updated_at
  before update on public.user_custom_foods
  for each row execute function public.update_updated_at_column();

notify pgrst, 'reload schema';
