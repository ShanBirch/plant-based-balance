-- ============================================================
-- AUTO-ADD COACH SHANNON AS FRIEND FOR ALL NEW USERS
-- ============================================================
-- Every new account that joins the app should automatically have
-- Coach Shannon (Shannon Birch @ Coco's Personal Training) added
-- as a mutual friend. This creates BOTH directions of the
-- friendship so it shows up in both users' friends lists.
--
-- Run this in the Supabase SQL Editor.
-- ============================================================

-- ============================================================
-- 1. Helper function: add_coach_shannon_friend(new_user_id)
-- ============================================================
-- Looks up Coach Shannon by her known email addresses and creates
-- a mutual (two-row) accepted friendship with the given user.
--
-- SECURITY DEFINER lets this bypass the friendships RLS policy
-- (which normally requires auth.uid() = user_id on insert),
-- so it works both from the auth trigger and from a client-side
-- supabase.rpc() call by the new user themselves.
-- ============================================================
CREATE OR REPLACE FUNCTION public.add_coach_shannon_friend(new_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  coach_id UUID;
BEGIN
  -- Look up Coach Shannon (prefer the cocospersonaltraining admin
  -- account, fall back to the plantbased-balance address)
  SELECT id INTO coach_id
  FROM public.users
  WHERE email IN (
    'shannonbirch@cocospersonaltraining.com',
    'shannon@plantbased-balance.org'
  )
  ORDER BY CASE email
    WHEN 'shannonbirch@cocospersonaltraining.com' THEN 1
    WHEN 'shannon@plantbased-balance.org' THEN 2
    ELSE 3
  END
  LIMIT 1;

  -- If Shannon's account doesn't exist yet (e.g. very first signup),
  -- silently no-op so we don't break the auth flow.
  IF coach_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Don't try to friend Shannon with herself.
  IF coach_id = new_user_id THEN
    RETURN FALSE;
  END IF;

  -- Direction 1: new user -> Shannon
  BEGIN
    INSERT INTO public.friendships (user_id, friend_id, status)
    VALUES (new_user_id, coach_id, 'accepted');
  EXCEPTION
    WHEN unique_violation THEN
      -- Already exists; make sure it's accepted
      UPDATE public.friendships
        SET status = 'accepted', updated_at = NOW()
        WHERE user_id = new_user_id AND friend_id = coach_id;
  END;

  -- Direction 2: Shannon -> new user (so the user appears in
  -- Shannon's friends list as well)
  BEGIN
    INSERT INTO public.friendships (user_id, friend_id, status)
    VALUES (coach_id, new_user_id, 'accepted');
  EXCEPTION
    WHEN unique_violation THEN
      UPDATE public.friendships
        SET status = 'accepted', updated_at = NOW()
        WHERE user_id = coach_id AND friend_id = new_user_id;
  END;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Allow authenticated users (e.g. the freshly-signed-up user) to
-- call this from the client as a fallback if the trigger didn't run.
GRANT EXECUTE ON FUNCTION public.add_coach_shannon_friend(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_coach_shannon_friend(UUID) TO anon;

-- ============================================================
-- 2. Update the new-user trigger to call the function
-- ============================================================
-- Re-create handle_new_user so it also auto-adds Coach Shannon
-- right after creating the public.users row. The friend-add is
-- wrapped in its own EXCEPTION block so any failure can never
-- block the actual user creation.
-- ============================================================
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

  -- Auto-add Coach Shannon as a mutual friend for the new user.
  -- Wrapped so any failure here NEVER blocks signup.
  BEGIN
    PERFORM public.add_coach_shannon_friend(NEW.id);
  EXCEPTION WHEN OTHERS THEN
    -- Swallow errors silently; signup must always succeed.
    NULL;
  END;

  RETURN NEW;
EXCEPTION
  WHEN unique_violation THEN
    -- User already exists in public.users (e.g. retry after partial failure)
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- The trigger itself was created in auth_trigger.sql; no need to
-- recreate it because CREATE OR REPLACE FUNCTION above swaps in
-- the new function body in place.

-- ============================================================
-- 3. Backfill: add Coach Shannon as a mutual friend for every
--    existing user who isn't already her friend.
-- ============================================================
DO $$
DECLARE
  u RECORD;
BEGIN
  FOR u IN
    SELECT id FROM public.users
    WHERE email NOT IN (
      'shannonbirch@cocospersonaltraining.com',
      'shannon@plantbased-balance.org'
    )
  LOOP
    PERFORM public.add_coach_shannon_friend(u.id);
  END LOOP;
END $$;

-- ============================================================
-- COMMENTS
-- ============================================================
COMMENT ON FUNCTION public.add_coach_shannon_friend(UUID) IS
  'Creates a mutual accepted friendship between the given user and Coach Shannon. Idempotent. Used by the auth trigger and as a client-side fallback.';
