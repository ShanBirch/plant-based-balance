-- ============================================================
-- REFERRAL DOUBLE XP MIGRATION
-- Change referral reward from "2 weeks free" to "1 week double XP"
-- ============================================================

-- Add double XP tracking column to users table
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS double_xp_until TIMESTAMPTZ;

-- Create index for checking active double XP status
CREATE INDEX IF NOT EXISTS idx_users_double_xp_until ON public.users(double_xp_until);

-- ============================================================
-- HELPER FUNCTION: Check if user has active double XP
-- ============================================================
CREATE OR REPLACE FUNCTION has_active_double_xp(user_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS(
    SELECT 1 FROM public.users
    WHERE id = user_uuid
    AND double_xp_until IS NOT NULL
    AND double_xp_until > NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- HELPER FUNCTION: Grant double XP to user (no stacking)
-- Returns true if granted, false if already has active double XP
-- ============================================================
CREATE OR REPLACE FUNCTION grant_double_xp(user_uuid UUID, days INTEGER DEFAULT 7)
RETURNS TABLE(success BOOLEAN, double_xp_until TIMESTAMPTZ, message TEXT) AS $$
DECLARE
  current_double_xp TIMESTAMPTZ;
  new_double_xp_until TIMESTAMPTZ;
BEGIN
  -- Check if user already has active double XP
  SELECT u.double_xp_until INTO current_double_xp
  FROM public.users u
  WHERE u.id = user_uuid;

  IF current_double_xp IS NOT NULL AND current_double_xp > NOW() THEN
    -- User already has active double XP - no stacking allowed
    RETURN QUERY SELECT
      FALSE as success,
      current_double_xp as double_xp_until,
      'User already has active double XP until ' || current_double_xp::TEXT as message;
    RETURN;
  END IF;

  -- Grant new double XP period starting from now
  new_double_xp_until := NOW() + (days || ' days')::INTERVAL;

  UPDATE public.users
  SET double_xp_until = new_double_xp_until
  WHERE id = user_uuid;

  RETURN QUERY SELECT
    TRUE as success,
    new_double_xp_until as double_xp_until,
    'Double XP granted until ' || new_double_xp_until::TEXT as message;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- HELPER FUNCTION: Get user's XP multiplier
-- Returns 2 if double XP is active, 1 otherwise
-- ============================================================
CREATE OR REPLACE FUNCTION get_xp_multiplier(user_uuid UUID)
RETURNS INTEGER AS $$
BEGIN
  IF has_active_double_xp(user_uuid) THEN
    RETURN 2;
  ELSE
    RETURN 1;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- UPDATE REFERRER STATS FUNCTION
-- Now tracks double XP grants instead of free days
-- ============================================================
CREATE OR REPLACE FUNCTION update_referrer_stats()
RETURNS TRIGGER AS $$
BEGIN
  -- Only increment referrals_count (no longer tracking free_days_earned for new rewards)
  UPDATE public.users
  SET referrals_count = referrals_count + 1
  WHERE id = NEW.referrer_user_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- COMMENTS
-- ============================================================
COMMENT ON COLUMN public.users.double_xp_until IS 'When the users double XP period expires (NULL if no active double XP)';
COMMENT ON FUNCTION has_active_double_xp(UUID) IS 'Check if user currently has an active double XP period';
COMMENT ON FUNCTION grant_double_xp(UUID, INTEGER) IS 'Grant double XP to user for specified days (default 7). Does not stack - returns false if user already has active double XP';
COMMENT ON FUNCTION get_xp_multiplier(UUID) IS 'Returns 2 if user has active double XP, 1 otherwise';
