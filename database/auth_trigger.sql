-- Trigger Setup for Automatic User Creation
-- Run this in the Supabase SQL Editor

-- 1. Ensure generate_referral_code() is SECURITY DEFINER so it can
--    query public.users through RLS when called from auth context
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

-- 2. Ensure auto_generate_referral_code() trigger function is SECURITY DEFINER
CREATE OR REPLACE FUNCTION auto_generate_referral_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.referral_code IS NULL THEN
    NEW.referral_code := generate_referral_code();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Create the function that handles new user insertion
--    Uses COALESCE to handle both email/password and OAuth signups
--    (Google OAuth may provide 'full_name' instead of 'name')
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, name, program_start_date)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'name',
      NEW.raw_user_meta_data->>'full_name',
      split_part(NEW.email, '@', 1)
    ),
    NOW()
  );
  RETURN NEW;
EXCEPTION
  WHEN unique_violation THEN
    -- User already exists in public.users (e.g. retry after partial failure)
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Create the trigger to fire on auth.users insert
-- Drop it first if it exists to be safe
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 5. Recreate the referral code trigger on public.users (ensure SECURITY DEFINER version is used)
DROP TRIGGER IF EXISTS generate_user_referral_code ON public.users;

CREATE TRIGGER generate_user_referral_code
  BEFORE INSERT ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION auto_generate_referral_code();
