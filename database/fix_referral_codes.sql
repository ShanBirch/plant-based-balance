-- ============================================================
-- FIX REFERRAL CODES
-- Ensure generate_referral_code function is callable and backfill existing users
-- ============================================================

-- Make the function callable by authenticated users
GRANT EXECUTE ON FUNCTION generate_referral_code() TO authenticated;
GRANT EXECUTE ON FUNCTION generate_referral_code() TO anon;

-- Backfill referral codes for existing users who don't have one
DO $$
DECLARE
  user_record RECORD;
  new_code TEXT;
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

    RAISE NOTICE 'Generated referral code % for user %', new_code, user_record.id;
  END LOOP;
END $$;

-- Verify results
SELECT
  COUNT(*) as total_users,
  COUNT(referral_code) as users_with_codes,
  COUNT(*) - COUNT(referral_code) as users_without_codes
FROM public.users;
