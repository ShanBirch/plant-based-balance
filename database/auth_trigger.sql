-- Trigger Setup for Automatic User Creation
-- Run this in the Supabase SQL Editor

-- 1. Remove the separate referral code trigger (inlined into handle_new_user)
DROP TRIGGER IF EXISTS generate_user_referral_code ON public.users;

-- 2. Create the function that handles new user insertion
--    - Generates referral code inline (avoids search_path issues with external functions)
--    - Uses COALESCE to handle both email/password and OAuth signups
--      (Google OAuth may provide 'full_name' instead of 'name')
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  ref_code TEXT;
  code_exists BOOLEAN;
  old_user_id UUID;
BEGIN
  -- Generate unique referral code inline (no external function dependency)
  LOOP
    ref_code := upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 8));
    SELECT EXISTS(SELECT 1 FROM public.users WHERE referral_code = ref_code) INTO code_exists;
    IF NOT code_exists THEN EXIT; END IF;
  END LOOP;

  -- Check if a public.users row already exists for this email with a different UUID.
  -- This happens when an auth account is deleted and re-created with the same email:
  -- the old public.users row may survive if ON DELETE CASCADE didn't fire.
  SELECT id INTO old_user_id
  FROM public.users
  WHERE LOWER(email) = LOWER(NEW.email)
    AND id != NEW.id
  LIMIT 1;

  IF old_user_id IS NOT NULL THEN
    -- Reactivated account: remap the old public.users row to the new auth UUID.
    -- All FK-referencing tables (friendships, nudges, etc.) will follow via CASCADE UPDATE
    -- or we update them explicitly to be safe.
    RAISE NOTICE 'handle_new_user: remapping reactivated account % -> % (%)', old_user_id, NEW.id, NEW.email;

    -- Update child tables that reference the old user ID
    UPDATE public.friendships SET user_id = NEW.id WHERE user_id = old_user_id;
    UPDATE public.friendships SET friend_id = NEW.id WHERE friend_id = old_user_id;
    UPDATE public.nudges SET sender_id = NEW.id WHERE sender_id = old_user_id;
    UPDATE public.nudges SET receiver_id = NEW.id WHERE receiver_id = old_user_id;
    BEGIN UPDATE public.push_subscriptions SET user_id = NEW.id WHERE user_id = old_user_id; EXCEPTION WHEN undefined_table THEN NULL; END;
    BEGIN UPDATE public.user_points SET user_id = NEW.id WHERE user_id = old_user_id; EXCEPTION WHEN undefined_table THEN NULL; END;
    BEGIN UPDATE public.point_transactions SET user_id = NEW.id WHERE user_id = old_user_id; EXCEPTION WHEN undefined_table THEN NULL; END;
    BEGIN UPDATE public.workouts SET user_id = NEW.id WHERE user_id = old_user_id; EXCEPTION WHEN undefined_table THEN NULL; END;
    BEGIN UPDATE public.daily_nutrition SET user_id = NEW.id WHERE user_id = old_user_id; EXCEPTION WHEN undefined_table THEN NULL; END;
    BEGIN UPDATE public.referrals SET referrer_id = NEW.id WHERE referrer_id = old_user_id; EXCEPTION WHEN undefined_table THEN NULL; END;
    BEGIN UPDATE public.referrals SET referred_id = NEW.id WHERE referred_id = old_user_id; EXCEPTION WHEN undefined_table THEN NULL; END;
    BEGIN UPDATE public.admin_users SET user_id = NEW.id WHERE user_id = old_user_id; EXCEPTION WHEN undefined_table THEN NULL; END;

    -- Temporarily drop the FK to auth.users so we can update the PK
    ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_id_fkey;

    -- Remap the old row's UUID to the new auth UUID
    UPDATE public.users SET id = NEW.id WHERE id = old_user_id;

    -- Re-add the FK constraint
    ALTER TABLE public.users
      ADD CONSTRAINT users_id_fkey
      FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

    RETURN NEW;
  END IF;

  INSERT INTO public.users (id, email, name, referral_code, program_start_date)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'name',
      NEW.raw_user_meta_data->>'full_name',
      split_part(NEW.email, '@', 1)
    ),
    ref_code,
    NOW()
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
