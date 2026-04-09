-- Set starting coin_balance default to 0.
--
-- Previously the users.coin_balance column defaulted to 1200. New users
-- were then granted a +2,500 'welcome_bonus' in finishOnboarding(), so
-- their final balance was 1200 + 2500 = 3,700 — not the advertised
-- 2,500. This migration drops the 1,200 default so that new users
-- start at 0 and the welcome bonus alone gives them exactly 2,500.
--
-- Safe to run multiple times.

ALTER TABLE public.users
    ALTER COLUMN coin_balance SET DEFAULT 0;

-- Optional local-dev cleanup for an already-broken test account:
-- (Uncomment and replace <your-email> to reset a single account so you
-- can test the onboarding flow from scratch.)
--
-- WITH target AS (
--     SELECT id FROM public.users WHERE email = '<your-email>'
-- )
-- DELETE FROM public.coin_transactions
-- WHERE user_id IN (SELECT id FROM target);
--
-- UPDATE public.users
-- SET coin_balance = 0
-- WHERE email = '<your-email>';
