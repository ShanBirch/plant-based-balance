-- Preserve inbound Instagram media before Meta's temporary CDN URLs expire.
-- Only service-role server functions can read or mutate these records/files.

insert into storage.buckets (id, name, public, file_size_limit)
values ('ig-message-media', 'ig-message-media', false, 26214400)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit;

create table if not exists public.ig_message_media (
    id uuid primary key default gen_random_uuid(),
    ig_message_id uuid not null references public.ig_messages(id) on delete cascade,
    ig_thread_id uuid not null references public.ig_threads(id) on delete cascade,
    graph_message_id text,
    ordinal integer not null check (ordinal >= 1),
    media_kind text not null check (media_kind in ('audio', 'photo', 'video')),
    source_url text not null,
    source_mime_type text,
    storage_bucket text not null default 'ig-message-media',
    storage_path text,
    byte_size bigint,
    sha256 text,
    status text not null default 'received' check (
        status in ('received', 'processing', 'preserved', 'verified', 'retry_wait', 'manual_review')
    ),
    attempt_count integer not null default 0,
    next_attempt_at timestamptz not null default now(),
    processing_token uuid,
    processing_started_at timestamptz,
    transcript text,
    transcript_model text,
    transcript_verified boolean not null default false,
    analysis jsonb not null default '{}'::jsonb,
    last_error text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (ig_message_id, ordinal)
);

create index if not exists idx_ig_message_media_retry_due
    on public.ig_message_media (next_attempt_at, created_at)
    where status in ('received', 'retry_wait');

create index if not exists idx_ig_message_media_message
    on public.ig_message_media (ig_message_id, ordinal);

alter table public.ig_message_media enable row level security;
revoke all on table public.ig_message_media from anon, authenticated;
grant select, insert, update, delete on table public.ig_message_media to service_role;

drop trigger if exists set_ig_message_media_updated_at on public.ig_message_media;
create trigger set_ig_message_media_updated_at
before update on public.ig_message_media
for each row execute function public.update_updated_at_column();

notify pgrst, 'reload schema';
