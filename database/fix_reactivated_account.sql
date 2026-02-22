-- ============================================================
-- FIX: Reactivated Account – Remap orphaned public.users row
-- ============================================================
-- Problem: When a Supabase auth account is deleted and re-created
-- with the same email, the new auth user gets a NEW UUID.
-- But the old public.users row (with the old UUID) still exists,
-- and handle_new_user() silently skips creating a new row because
-- of the UNIQUE email constraint.
--
-- Result: friendships, nudges, push_subscriptions, etc. are all
-- tied to the OLD UUID, but auth.uid() returns the NEW UUID.
-- The inbox appears empty and queries fail silently.
--
-- This script:
--   1. Finds orphaned public.users rows (email exists in public.users
--      but the UUID doesn't match any auth.users row)
--   2. Remaps the orphaned row's UUID to the current auth UUID
--   3. All FK-cascaded tables (friendships, nudges, etc.) follow
--      automatically because we update the PK.
--
-- Run this in the Supabase SQL Editor.
-- ============================================================

-- Step 1: Diagnostic – show orphaned users (public.users rows
-- whose id has no matching auth.users row) that share an email
-- with a real auth user.
SELECT
    pu.id    AS orphaned_public_uuid,
    pu.email AS email,
    au.id    AS current_auth_uuid
FROM public.users pu
JOIN auth.users au ON LOWER(au.email) = LOWER(pu.email)
WHERE pu.id != au.id;

-- Step 2: Fix – for each orphaned row, migrate all references
-- from the old UUID to the new auth UUID, then update the
-- public.users row itself.
DO $$
DECLARE
    rec RECORD;
BEGIN
    FOR rec IN
        SELECT
            pu.id    AS old_id,
            au.id    AS new_id,
            pu.email AS email
        FROM public.users pu
        JOIN auth.users au ON LOWER(au.email) = LOWER(pu.email)
        WHERE pu.id != au.id
    LOOP
        RAISE NOTICE 'Migrating account % -> % (email: %)', rec.old_id, rec.new_id, rec.email;

        -- Check if a public.users row already exists for the new UUID
        -- (created by handle_new_user before the email conflict, or manually).
        -- If it does, we merge into the OLD row (which has all the data) and delete the empty new one.
        IF EXISTS (SELECT 1 FROM public.users WHERE id = rec.new_id) THEN
            DELETE FROM public.users WHERE id = rec.new_id;
            RAISE NOTICE '  Deleted empty public.users row for new UUID %', rec.new_id;
        END IF;

        -- Temporarily drop the FK constraint from public.users -> auth.users
        -- so we can update the PK to the new auth UUID.
        ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_id_fkey;

        -- Update all tables that reference the old user ID.
        -- friendships
        UPDATE public.friendships SET user_id = rec.new_id WHERE user_id = rec.old_id;
        UPDATE public.friendships SET friend_id = rec.new_id WHERE friend_id = rec.old_id;

        -- nudges (direct messages)
        UPDATE public.nudges SET sender_id = rec.new_id WHERE sender_id = rec.old_id;
        UPDATE public.nudges SET receiver_id = rec.new_id WHERE receiver_id = rec.old_id;

        -- push_subscriptions
        UPDATE public.push_subscriptions SET user_id = rec.new_id WHERE user_id = rec.old_id;

        -- user_points
        UPDATE public.user_points SET user_id = rec.new_id WHERE user_id = rec.old_id;

        -- point_transactions
        UPDATE public.point_transactions SET user_id = rec.new_id WHERE user_id = rec.old_id;

        -- workouts
        UPDATE public.workouts SET user_id = rec.new_id WHERE user_id = rec.old_id;

        -- daily_nutrition
        UPDATE public.daily_nutrition SET user_id = rec.new_id WHERE user_id = rec.old_id;

        -- referrals
        UPDATE public.referrals SET referrer_id = rec.new_id WHERE referrer_id = rec.old_id;
        UPDATE public.referrals SET referred_id = rec.new_id WHERE referred_id = rec.old_id;

        -- workout_replacements
        BEGIN
            UPDATE public.workout_replacements SET user_id = rec.new_id WHERE user_id = rec.old_id;
        EXCEPTION WHEN undefined_table THEN NULL;
        END;

        -- admin_users
        BEGIN
            UPDATE public.admin_users SET user_id = rec.new_id WHERE user_id = rec.old_id;
        EXCEPTION WHEN undefined_table THEN NULL;
        END;

        -- Finally, update the public.users PK itself
        UPDATE public.users SET id = rec.new_id WHERE id = rec.old_id;

        -- Re-add the FK constraint
        ALTER TABLE public.users
            ADD CONSTRAINT users_id_fkey
            FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

        RAISE NOTICE '  Migration complete for %', rec.email;
    END LOOP;
END $$;

-- Step 3: Verify – the orphaned rows should be gone now
SELECT
    pu.id    AS orphaned_public_uuid,
    pu.email AS email,
    au.id    AS current_auth_uuid
FROM public.users pu
JOIN auth.users au ON LOWER(au.email) = LOWER(pu.email)
WHERE pu.id != au.id;
-- Expected: 0 rows
