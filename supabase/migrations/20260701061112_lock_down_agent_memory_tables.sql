-- Lock down agent/repo-memory tables that are not used by the Balance client app.
-- These tables were exposed to anon/authenticated with RLS disabled.

revoke all on table public.app_state from anon, authenticated;
revoke all on table public.repo_index from anon, authenticated;
revoke all on table public.settings from anon, authenticated;
revoke all on table public.user_memories from anon, authenticated;

revoke all on sequence public.repo_index_id_seq from anon, authenticated;
revoke all on sequence public.user_memories_id_seq from anon, authenticated;

alter table public.app_state enable row level security;
alter table public.repo_index enable row level security;
alter table public.settings enable row level security;
alter table public.user_memories enable row level security;
