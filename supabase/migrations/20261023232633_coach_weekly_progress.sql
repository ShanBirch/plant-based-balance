-- Private, immutable coach-reviewed snapshots. All access goes through the
-- authenticated weekly-progress endpoint; browsers cannot write this table.
create table public.coach_weekly_progress (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.users(id),
  client_id uuid not null references public.users(id),
  week_start date not null,
  message_id uuid unique references public.nudges(id) on delete cascade,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  created_at timestamptz not null default now(),
  check (coach_id <> client_id),
  check (extract(isodow from week_start) = 1)
);
create index coach_weekly_progress_client_week on public.coach_weekly_progress(client_id,week_start desc);
alter table public.coach_weekly_progress enable row level security;
revoke all on public.coach_weekly_progress from public,anon,authenticated;
grant select,insert,update on public.coach_weekly_progress to service_role;

-- Freeze reviewed content and bind attachments to the exact coach/client chat.
create function public.guard_coach_weekly_progress() returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_op = 'UPDATE' and (
    old.message_id is not null or new.payload is distinct from old.payload
    or new.coach_id <> old.coach_id or new.client_id <> old.client_id
    or new.week_start <> old.week_start or new.id <> old.id
    or new.created_at <> old.created_at
  ) then raise exception 'Reviewed progress snapshots are immutable'; end if;
  if new.message_id is not null and not exists (
    select 1 from public.nudges n where n.id=new.message_id
    and n.sender_id=new.coach_id and n.receiver_id=new.client_id
  ) then raise exception 'Progress attachment does not match this conversation'; end if;
  return new;
end $$;
revoke all on function public.guard_coach_weekly_progress() from public,anon,authenticated;
create trigger guard_coach_weekly_progress before insert or update on public.coach_weekly_progress
for each row execute function public.guard_coach_weekly_progress();
