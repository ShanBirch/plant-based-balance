-- ig_threads.coach_instructions
--
-- Mirrors client_memory.coach_instructions for cold IG/FB leads who don't
-- yet have a linked app account (linked_user_id IS NULL → no client_memory
-- row to write to). Without this column, hitting Save on the Control
-- panel's "COACH INSTRUCTIONS FOR AI" block for a cold lead fails — the
-- update-coach-instructions endpoint had nowhere to put the value.
--
-- Read paths (coach-control-context.js, ig-instant-draft.js cold-lead
-- fallback) prefer client_memory when the lead has converted, and fall
-- back to ig_threads here when they haven't. The save endpoint follows
-- the same shape: write to client_memory if we have a client_id, else
-- write to ig_threads via igThreadId.
--
-- Safe to re-run.

ALTER TABLE public.ig_threads
    ADD COLUMN IF NOT EXISTS coach_instructions TEXT;

COMMENT ON COLUMN public.ig_threads.coach_instructions IS
    'Free-text per-lead guidance from the coach to the AI for cold IG/FB leads (no linked app account). Mirrors client_memory.coach_instructions; once linked_user_id is set, the client_memory copy takes precedence. Empty/null = no extra guidance.';
