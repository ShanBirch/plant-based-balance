-- Invitation secrets are stored as SHA-256 hashes. Only the server may claim or
-- release a starter. This grant never changes billing or a paid subscription.
create table if not exists public.balance_free_starters (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  thread_id uuid references public.ig_threads(id),
  user_id uuid unique references auth.users(id),
  created_at timestamptz not null default now(),
  claim_before timestamptz not null default now() + interval '30 days',
  claimed_at timestamptz,
  revoked_at timestamptz,
  workouts_ready boolean not null default false,
  workout_limit integer not null default 2 check (workout_limit = 2)
);
alter table public.balance_free_starters enable row level security;
revoke all on public.balance_free_starters from anon, authenticated;
grant select, insert, update, delete on public.balance_free_starters to service_role;

create or replace function public.claim_balance_free_starter(p_user_id uuid, p_token_hash text)
returns setof public.balance_free_starters language plpgsql security invoker
set search_path = public as $$
declare invitation public.balance_free_starters;
begin
  select * into invitation from public.balance_free_starters
    where token_hash = p_token_hash for update;
  if invitation.id is null or invitation.revoked_at is not null
     or (invitation.user_id is null and invitation.claim_before <= now())
     or (invitation.user_id is not null and invitation.user_id <> p_user_id) then
    raise exception 'Invitation unavailable' using errcode = 'P0001';
  end if;
  if invitation.user_id is null then
    update public.balance_free_starters set user_id = p_user_id, claimed_at = now()
      where id = invitation.id returning * into invitation;
    -- Bind only an unlinked conversation. Never move an existing client link.
    update public.ig_threads set linked_user_id = p_user_id, updated_at = now()
      where id = invitation.thread_id and linked_user_id is null;
  end if;
  return next invitation;
end;
$$;
revoke all on function public.claim_balance_free_starter(uuid,text) from public, anon, authenticated;
grant execute on function public.claim_balance_free_starter(uuid,text) to service_role;
