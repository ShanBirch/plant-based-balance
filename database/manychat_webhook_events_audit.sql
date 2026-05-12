-- Audit every ManyChat webhook hit before it can silently disappear.
-- This is intentionally service-role only. It stores raw inbound payloads so
-- missed IG DMs can be recovered even when parsing or downstream drafting fails.

create table if not exists public.manychat_webhook_events (
    id uuid primary key default gen_random_uuid(),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    processed_at timestamptz,
    source text not null default 'manychat',
    function_name text not null default 'manychat-inbound',
    http_method text,
    status text not null default 'received',
    error_stage text,
    error_message text,
    subscriber_id text,
    channel text,
    ig_username text,
    profile_name text,
    manychat_message_id text,
    thread_id uuid references public.ig_threads(id) on delete set null,
    ig_message_id uuid references public.ig_messages(id) on delete set null,
    message_text text,
    message_text_hash text,
    raw_body text,
    raw_payload jsonb,
    custom_data jsonb,
    safe_headers jsonb not null default '{}'::jsonb
);

create index if not exists idx_manychat_webhook_events_created_at
    on public.manychat_webhook_events (created_at desc);

create index if not exists idx_manychat_webhook_events_subscriber_created
    on public.manychat_webhook_events (subscriber_id, created_at desc);

create index if not exists idx_manychat_webhook_events_status_created
    on public.manychat_webhook_events (status, created_at desc);

create index if not exists idx_manychat_webhook_events_message_id
    on public.manychat_webhook_events (manychat_message_id)
    where manychat_message_id is not null;

alter table public.manychat_webhook_events enable row level security;

revoke all on table public.manychat_webhook_events from anon, authenticated;

drop trigger if exists trg_manychat_webhook_events_updated_at on public.manychat_webhook_events;
create trigger trg_manychat_webhook_events_updated_at
    before update on public.manychat_webhook_events
    for each row
    execute function public.update_updated_at_column();
