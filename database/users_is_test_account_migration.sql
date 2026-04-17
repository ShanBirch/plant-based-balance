-- is_test_account flag on users
--
-- Filters Shannon's own second accounts + any flagged fake/test users out of
-- every proactive alert generator. Shannon was dismissing ~10+ alerts a day
-- for accounts like "Girly" (his own second account) and "John" (flagged fake)
-- — voice-match feedback showed these as the #1 source of noise.
--
-- Default FALSE. Admin dashboard exposes a per-row toggle so Shannon flags
-- accounts going forward; the UPDATE below pre-flags the one account whose
-- UUID we know for sure (Shannon's second account).
--
-- Consumed by every generator that selects from `users`:
--   ai-client-monitor, morning-pulse-scan, onboarding-welcome-draft,
--   onboarding-scheduled-scan, weekly-checkin-scan, plateau-detection-scan,
--   first-workout-celebration, weekly-coach-digest.
--
-- Run via exec_sql RPC. Idempotent.

ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS is_test_account BOOLEAN NOT NULL DEFAULT FALSE;

-- Pre-flag Shannon's known second account ("Girly") so alerts stop firing
-- for it immediately. Other suspected fakes (John, etc.) are left for Shannon
-- to flip via the admin UI — we don't want to silently disable real users.
UPDATE public.users
   SET is_test_account = TRUE
 WHERE id = 'bd1bccd6-56b6-4975-b708-7404c910d1a2';

-- Verify:
--   SELECT column_name, data_type, column_default, is_nullable
--   FROM information_schema.columns
--   WHERE table_name = 'users' AND column_name = 'is_test_account';
--   SELECT id, name, email, is_test_account FROM public.users WHERE is_test_account = TRUE;
