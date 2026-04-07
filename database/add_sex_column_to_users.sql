-- Migration: Add sex column to users table
-- Purpose: Store user's biological sex for BMR/TDEE calculations
-- This fixes the bug where gender resets to female on page refresh

-- Add sex column to users table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'users'
        AND column_name = 'sex'
    ) THEN
        ALTER TABLE public.users
        ADD COLUMN sex TEXT;

        RAISE NOTICE 'Added sex column to users table';
    ELSE
        RAISE NOTICE 'sex column already exists in users table';
    END IF;
END $$;

-- Backfill existing users with their sex from quiz_results
-- This ensures existing users don't lose their gender setting
UPDATE public.users u
SET sex = qr.sex
FROM (
    SELECT DISTINCT ON (user_id) user_id, sex
    FROM public.quiz_results
    WHERE sex IS NOT NULL
    ORDER BY user_id, created_at DESC
) qr
WHERE u.id = qr.user_id
AND u.sex IS NULL;

-- Create an index for better query performance
CREATE INDEX IF NOT EXISTS idx_users_sex ON public.users(sex);

RAISE NOTICE 'Migration completed: sex column added and backfilled';
