-- ============================================================
-- ENSURE REFERRAL SYSTEM IS PROPERLY CONFIGURED
-- Run this script to fix "Error loading code" issues
-- ============================================================

-- 1. Ensure the generate_referral_code function exists
CREATE OR REPLACE FUNCTION generate_referral_code()
RETURNS TEXT AS $$
DECLARE
  code TEXT;
  code_exists BOOLEAN;
BEGIN
  LOOP
    -- Generate 8-character alphanumeric code
    code := upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 8));

    -- Check if code already exists
    SELECT EXISTS(SELECT 1 FROM public.users WHERE referral_code = code) INTO code_exists;

    -- If code is unique, exit loop
    IF NOT code_exists THEN
      EXIT;
    END IF;
  END LOOP;

  RETURN code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION generate_referral_code() TO authenticated;
GRANT EXECUTE ON FUNCTION generate_referral_code() TO anon;

-- 3. Ensure users table has referral_code column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users'
    AND column_name = 'referral_code'
  ) THEN
    ALTER TABLE public.users ADD COLUMN referral_code TEXT UNIQUE;
  END IF;
END $$;

-- 4. Create index on referral_code for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_referral_code ON public.users(referral_code);

-- 5. Backfill referral codes for existing users who don't have one
DO $$
DECLARE
  user_record RECORD;
  new_code TEXT;
  affected_count INTEGER := 0;
BEGIN
  FOR user_record IN
    SELECT id FROM public.users WHERE referral_code IS NULL
  LOOP
    -- Generate unique code
    new_code := generate_referral_code();

    -- Update user
    UPDATE public.users
    SET referral_code = new_code
    WHERE id = user_record.id;

    affected_count := affected_count + 1;
    RAISE NOTICE 'Generated referral code % for user %', new_code, user_record.id;
  END LOOP;

  RAISE NOTICE 'Backfilled % users with referral codes', affected_count;
END $$;

-- 6. Verify results
DO $$
DECLARE
  total INTEGER;
  with_codes INTEGER;
  without_codes INTEGER;
BEGIN
  SELECT COUNT(*) INTO total FROM public.users;
  SELECT COUNT(referral_code) INTO with_codes FROM public.users;
  without_codes := total - with_codes;

  RAISE NOTICE '=== VERIFICATION RESULTS ===';
  RAISE NOTICE 'Total users: %', total;
  RAISE NOTICE 'Users with referral codes: %', with_codes;
  RAISE NOTICE 'Users without codes: %', without_codes;

  IF without_codes > 0 THEN
    RAISE WARNING 'Some users still do not have referral codes!';
  ELSE
    RAISE NOTICE '✓ All users have referral codes';
  END IF;
END $$;
