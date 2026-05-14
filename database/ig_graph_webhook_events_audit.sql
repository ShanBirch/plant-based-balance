-- Audit every direct Instagram Graph/API webhook hit before it can disappear.
-- This is intentionally service-role only. The first goal is durable capture;
-- mapping messages/comments into operator queues can be safely layered on top.

create table if not exists public.ig_graph_webhook_events (
    id uuid primary key default gen_random_uuid(),
    created_at timestamptz not null default now(),
    updated_at timestamptz,
    processed_at timestamptz,
    source text not null default 'instagram_graph',
    function_name text not null default 'instagram-webhook',
    http_method text,
    status text not null default 'received',
    error_stage text,
    error_message text,
    object_type text,
    event_type text,
    field text,
    ig_account_id text,
    sender_id text,
    recipient_id text,
    message_id text,
    comment_id text,
    media_id text,
    signature_valid boolean,
    raw_body text,
    raw_payload jsonb,
    event_payload jsonb,
    safe_headers jsonb not null default '{}'::jsonb
);

create index if not exists idx_ig_graph_webhook_events_created_at
    on public.ig_graph_webhook_events (created_at desc);

create index if not exists idx_ig_graph_webhook_events_status_created
    on public.ig_graph_webhook_events (status, created_at desc);

create index if not exists idx_ig_graph_webhook_events_field_created
    on public.ig_graph_webhook_events (field, created_at desc)
    where field is not null;

create index if not exists idx_ig_graph_webhook_events_sender_created
    on public.ig_graph_webhook_events (sender_id, created_at desc)
    where sender_id is not null;

create index if not exists idx_ig_graph_webhook_events_message_id
    on public.ig_graph_webhook_events (message_id)
    where message_id is not null;

create index if not exists idx_ig_graph_webhook_events_comment_id
    on public.ig_graph_webhook_events (comment_id)
    where comment_id is not null;

alter table public.ig_graph_webhook_events enable row level security;

revoke all on table public.ig_graph_webhook_events from anon, authenticated;

drop trigger if exists trg_ig_graph_webhook_events_updated_at on public.ig_graph_webhook_events;
create trigger trg_ig_graph_webhook_events_updated_at
    before update on public.ig_graph_webhook_events
    for each row
    execute function public.update_updated_at_column();
