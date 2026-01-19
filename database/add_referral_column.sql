-- Add referral column to users table for stories feature
-- This enables friend-of-friend visibility for stories

-- Add the column if it doesn't exist
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS referred_by_user_id UUID REFERENCES public.users(id);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_users_referred_by
ON public.users(referred_by_user_id);

-- Verify the column was added
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'users'
AND column_name = 'referred_by_user_id';
