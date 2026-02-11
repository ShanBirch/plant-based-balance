-- Trigger Setup for Automatic User Creation
-- Run this in the Supabase SQL Editor

-- 1. Remove the separate referral code trigger (inlined into handle_new_user)
DROP TRIGGER IF EXISTS generate_user_referral_code ON public.users;

-- 2. Create the function that handles new user insertion
--    - Generates referral code inline (avoids search_path issues with external functions)
--    - Uses COALESCE to handle both email/password and OAuth signups
--      (Google OAuth may provide 'full_name' instead of 'name')
--    - Explicitly sets coin_balance to 1200 starting coins
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  ref_code TEXT;
  code_exists BOOLEAN;
BEGIN
  -- Generate unique referral code inline (no external function dependency)
  LOOP
    ref_code := upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 8));
    SELECT EXISTS(SELECT 1 FROM public.users WHERE referral_code = ref_code) INTO code_exists;
    IF NOT code_exists THEN EXIT; END IF;
  END LOOP;

  INSERT INTO public.users (id, email, name, referral_code, program_start_date, coin_balance)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'name',
      NEW.raw_user_meta_data->>'full_name',
      split_part(NEW.email, '@', 1)
    ),
    ref_code,
    NOW(),
    1200
  );
  RETURN NEW;
EXCEPTION
  WHEN unique_violation THEN
    -- User already exists in public.users (e.g. retry after partial failure)
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Create the trigger to fire on auth.users insert
-- Drop it first if it exists to be safe
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
