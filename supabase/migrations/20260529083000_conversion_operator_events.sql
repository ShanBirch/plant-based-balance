create table if not exists public.conversion_operator_events (
    id uuid primary key default gen_random_uuid(),
    created_at timestamp with time zone not null default now(),
    coach_id uuid not null references public.users(id) on delete cascade,
    actor_id uuid not null references public.users(id) on delete cascade,
    entity_kind text not null check (entity_kind in ('lead', 'client')),
    thread_id uuid references public.ig_threads(id) on delete set null,
    client_id uuid references public.users(id) on delete set null,
    action text not null check (action in (
        'mark_link_sent',
        'mark_pitch_ready',
        'pitch_coaching',
        'move_fallback',
        'mark_paid',
        'snooze'
    )),
    previous_lane text,
    note text,
    snoozed_until timestamp with time zone,
    metadata jsonb not null default '{}'::jsonb
);

alter table public.conversion_operator_events enable row level security;

revoke all on table public.conversion_operator_events from anon;
grant select, insert on table public.conversion_operator_events to authenticated;

drop policy if exists "Admins can read own conversion operator events"
    on public.conversion_operator_events;
create policy "Admins can read own conversion operator events"
    on public.conversion_operator_events
    for select
    to authenticated
    using (auth.uid() = coach_id);

drop policy if exists "Admins can insert own conversion operator events"
    on public.conversion_operator_events;
create policy "Admins can insert own conversion operator events"
    on public.conversion_operator_events
    for insert
    to authenticated
    with check (auth.uid() = coach_id and auth.uid() = actor_id);

create index if not exists conversion_operator_events_coach_created_idx
    on public.conversion_operator_events (coach_id, created_at desc);

create index if not exists conversion_operator_events_thread_created_idx
    on public.conversion_operator_events (thread_id, created_at desc)
    where thread_id is not null;

create index if not exists conversion_operator_events_client_created_idx
    on public.conversion_operator_events (client_id, created_at desc)
    where client_id is not null;
