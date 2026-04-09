-- Add 'welcome_bonus' to the allowed transaction types on coin_transactions.
--
-- BUG: finishOnboarding() in dashboard-script-5 calls credit_coins() with
-- txn_type = 'welcome_bonus' to grant new players their 2,500 starting
-- FitCoins. The original CHECK constraint in coin_system_migration.sql
-- did NOT include 'welcome_bonus', so every grant was silently failing
-- with a constraint violation. The JS catch block swallowed the error
-- while the "You received 2,500 FitCoins!" toast still displayed —
-- users saw the message but their balance never went up.
--
-- Fix: drop the old CHECK and recreate it with 'welcome_bonus' (and
-- a couple of other commonly-used transaction types for future-proofing).

ALTER TABLE public.coin_transactions
    DROP CONSTRAINT IF EXISTS coin_transactions_transaction_type_check;

ALTER TABLE public.coin_transactions
    ADD CONSTRAINT coin_transactions_transaction_type_check
    CHECK (transaction_type IN (
        'pack_purchase',       -- bought coins with real money
        'challenge_entry',     -- paid to enter a challenge
        'challenge_win',       -- bonus coins for winning a challenge
        'battle_bet',          -- coins wagered on a battle
        'battle_win',          -- coins won from a battle
        'character_purchase',  -- bought a character
        'cosmetic_purchase',   -- bought a cosmetic item
        'refund',              -- refund from cancelled challenge etc
        'admin_grant',         -- manually granted by admin
        'welcome_bonus',       -- 2,500 FitCoins granted on onboarding completion
        'referral_bonus',      -- coins earned from referring a friend
        'daily_reward'         -- daily login / streak reward
    ));
