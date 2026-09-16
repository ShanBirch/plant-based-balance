alter table public.app_replay_chunks drop constraint app_replay_chunks_payload_check;
alter table public.app_replay_chunks add constraint app_replay_chunks_payload_check
  check (length(payload) between 1 and 750000 and payload ~ '^[A-Za-z0-9+/=]+$');
