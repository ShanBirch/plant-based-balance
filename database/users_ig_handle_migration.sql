-- Add ig_handle to users so the IG/FB lead pipeline can auto-link a thread
-- to its app user once the user fills in their handle in the onboarding quiz.
--
-- The admin dashboard already lets Shannon manually link a lead to a user via
-- ig_threads.linked_user_id. This column closes the loop by giving us a
-- deterministic key to match on for future signups.
--
-- Safe to re-run.

ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS ig_handle TEXT;

-- Lower-case unique-ish lookup, but DON'T enforce uniqueness because the field
-- is user-entered and could collide on bad input. The auto-link below picks
-- the most-recent user when there's a tie.
CREATE INDEX IF NOT EXISTS idx_users_ig_handle_lower
    ON public.users (LOWER(ig_handle))
    WHERE ig_handle IS NOT NULL;

-- One-shot reconciliation: backfill linked_user_id on any unlinked IG/FB
-- thread whose ig_username already matches an existing user's ig_handle.
-- Strips a leading @ on either side. If multiple users share the same handle
-- (shouldn't happen but defensive) the most recently-created user wins.
WITH matches AS (
    SELECT DISTINCT ON (LOWER(REGEXP_REPLACE(t.ig_username, '^@', '')))
        t.id AS thread_id,
        u.id AS user_id
    FROM public.ig_threads t
    JOIN public.users u
      ON LOWER(REGEXP_REPLACE(t.ig_username, '^@', ''))
       = LOWER(REGEXP_REPLACE(u.ig_handle, '^@', ''))
    WHERE t.linked_user_id IS NULL
      AND t.ig_username IS NOT NULL
      AND u.ig_handle IS NOT NULL
    ORDER BY LOWER(REGEXP_REPLACE(t.ig_username, '^@', '')), u.created_at DESC
)
UPDATE public.ig_threads t
SET linked_user_id = m.user_id
FROM matches m
WHERE t.id = m.thread_id;
