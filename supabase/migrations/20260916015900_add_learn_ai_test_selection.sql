alter table public.ig_threads add column if not exists learn_ai_settings jsonb;
comment on column public.ig_threads.learn_ai_settings is 'Explicit account-scoped Learn responder selection, separate from frequently rewritten conversation custom_data. NULL preserves existing routing.';
