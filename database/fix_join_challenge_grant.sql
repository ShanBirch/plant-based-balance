-- ============================================================
-- FIX: Clients can't join wellness challenges
--
-- Symptom: Tapping "Spend Coins & Join" on a challenge invite
--          shows "Failed to join challenge. Please try again."
--          for every user, every time.
--
-- Root cause: wellness_challenges_master_fix.sql defined the
-- function with three parameters (added p_weight_goal in
-- weight_loss_goal_direction.sql) but its final GRANT block
-- still targeted the obsolete two-parameter signature:
--
--     GRANT EXECUTE ON FUNCTION
--         public.join_wellness_challenge(UUID, UUID)
--         TO authenticated;
--
-- That signature no longer exists, so the GRANT silently fails.
-- The 3-arg function ends up with no permission for the
-- authenticated role and PostgREST refuses every RPC call,
-- which the JS catches and surfaces as the generic
-- "Failed to join challenge" toast/alert.
--
-- This migration is idempotent: it can be run safely on any
-- environment to repair the grant and force PostgREST to
-- reload its schema cache so the fix takes effect immediately.
--
-- Run this in the Supabase SQL Editor.
-- ============================================================

-- 1. Defensively re-grant on whichever signatures still exist.
--    These DO blocks ignore "function does not exist" errors so
--    the migration never aborts mid-way.
DO $$
BEGIN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.join_wellness_challenge(UUID, UUID, TEXT) TO authenticated';
EXCEPTION WHEN undefined_function THEN
    RAISE NOTICE '[fix_join_challenge_grant] 3-arg join_wellness_challenge not found, skipping';
END $$;

DO $$
BEGIN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.join_wellness_challenge(UUID, UUID) TO authenticated';
EXCEPTION WHEN undefined_function THEN
    RAISE NOTICE '[fix_join_challenge_grant] 2-arg join_wellness_challenge not found (expected), skipping';
END $$;

-- 2. Make sure the related challenge RPCs are also granted, in
--    case they were missed by an earlier partial migration.
DO $$
BEGIN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.create_wellness_challenge(TEXT, UUID, DATE, DATE, INT, TEXT, INT, TEXT) TO authenticated';
EXCEPTION WHEN undefined_function THEN
    RAISE NOTICE '[fix_join_challenge_grant] create_wellness_challenge not found, skipping';
END $$;

DO $$
BEGIN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.leave_wellness_challenge(UUID, UUID) TO authenticated';
EXCEPTION WHEN undefined_function THEN
    RAISE NOTICE '[fix_join_challenge_grant] leave_wellness_challenge not found, skipping';
END $$;

-- 3. Force PostgREST to drop its cached function signatures so the
--    next RPC call from the app picks up the corrected grant.
NOTIFY pgrst, 'reload schema';
