-- Add auto_send_enabled to ig_threads so IG/FB lead drafts can bypass
-- the approve-gate per lead, same pattern as client_memory.auto_send_enabled.
ALTER TABLE public.ig_threads
    ADD COLUMN IF NOT EXISTS auto_send_enabled BOOLEAN NOT NULL DEFAULT FALSE;
