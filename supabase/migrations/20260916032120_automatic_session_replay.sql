-- Automatic, masked app diagnostics. Clients can append only their own chunks;
-- replay retrieval is restricted to Shannon's authenticated administrator account.
create table public.app_replay_chunks (
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null,
  seq integer not null check (seq between 0 and 100),
  payload text not null check (length(payload) between 1 and 350000 and payload ~ '^[A-Za-z0-9+/=]+$'),
  first_ms bigint not null,
  last_ms bigint not null check (last_ms >= first_ms and last_ms - first_ms <= 1800000),
  error_count integer not null default 0 check (error_count between 0 and 1000),
  created_at timestamptz not null default now(),
  primary key (user_id, session_id, seq)
);
create index app_replay_chunks_created on public.app_replay_chunks(created_at);
create index app_replay_chunks_user_created on public.app_replay_chunks(user_id, created_at);
alter table public.app_replay_chunks enable row level security;
revoke all on public.app_replay_chunks from public, anon, authenticated;
grant insert(user_id, session_id, seq, payload, first_ms, last_ms, error_count) on public.app_replay_chunks to authenticated;
grant select on public.app_replay_chunks to authenticated;
grant all on public.app_replay_chunks to service_role;
create policy replay_append_own on public.app_replay_chunks for insert to authenticated
  with check ((select auth.uid()) = user_id and coalesce((select auth.jwt()->>'is_anonymous'),'false') <> 'true');
create policy replay_admin_read on public.app_replay_chunks for select to authenticated
  using ((select auth.jwt()->>'email') = 'shannonbirch@cocospersonaltraining.com' and created_at > now() - interval '7 days');

create schema if not exists replay_private;
revoke all on schema replay_private from public, anon, authenticated;
-- This trigger needs to count rows the uploading member cannot read. It has no
-- callable public API and never trusts user-supplied IDs or timestamps.
create function replay_private.limit_upload() returns trigger
language plpgsql security definer set search_path = '' as $$
declare used_bytes bigint; used_chunks bigint;
begin
  if auth.uid() is null or auth.uid() <> new.user_id then raise exception 'Replay identity mismatch'; end if;
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 4191));
  new.created_at := now();
  select coalesce(sum(length(payload)),0), count(*) into used_bytes, used_chunks
    from public.app_replay_chunks where user_id = new.user_id and created_at > now() - interval '24 hours';
  if used_bytes + length(new.payload) > 12000000 or used_chunks >= 600 then raise exception 'Replay daily limit reached'; end if;
  return new;
end $$;
revoke all on function replay_private.limit_upload() from public, anon, authenticated;
create trigger replay_upload_limit before insert on public.app_replay_chunks for each row execute function replay_private.limit_upload();

create function public.list_app_replays(search_text text default '', before_time timestamptz default now())
returns table(user_id uuid, session_id uuid, member_name text, started_at timestamptz, last_at timestamptz, first_ms bigint, last_ms bigint, error_count bigint, chunks bigint)
language sql stable security invoker set search_path = '' as $$
  select c.user_id, c.session_id, coalesce(u.name,'Member'), min(c.created_at), max(c.created_at), min(c.first_ms), max(c.last_ms), sum(c.error_count), count(*)
  from public.app_replay_chunks c left join public.users u on u.id = c.user_id
  where (select auth.jwt()->>'email') = 'shannonbirch@cocospersonaltraining.com'
    and c.created_at > now() - interval '7 days'
    and (coalesce(search_text,'') = '' or u.name ilike '%' || left(search_text,100) || '%' or c.user_id::text = search_text)
  group by c.user_id, c.session_id, u.name having max(c.created_at) < before_time
  order by max(c.created_at) desc limit 50
$$;
revoke all on function public.list_app_replays(text,timestamptz) from public, anon;
grant execute on function public.list_app_replays(text,timestamptz) to authenticated;
-- Expired rows are hidden immediately by RLS; physical cleanup runs hourly.
select cron.schedule('balance-replay-retention', '17 * * * *', $$delete from public.app_replay_chunks where created_at < now() - interval '7 days'$$);
