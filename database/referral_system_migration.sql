-- ============================================================
-- REFERRAL SYSTEM MIGRATION
-- Add referral tracking to Plant Based Balance
-- ============================================================

-- Add referral columns to users table
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS referred_by_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS referrals_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS free_days_earned INTEGER DEFAULT 0;

-- Create index on referral_code for fast lookups
CREATE INDEX IF NOT EXISTS idx_users_referral_code ON public.users(referral_code);
CREATE INDEX IF NOT EXISTS idx_users_referred_by ON public.users(referred_by_user_id);

-- ============================================================
-- REFERRALS TABLE (tracks each referral and rewards)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.referrals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Referral relationship
  referrer_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  referred_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  referral_code_used TEXT NOT NULL,

  -- Reward tracking
  reward_granted BOOLEAN DEFAULT FALSE,
  reward_granted_at TIMESTAMPTZ,
  reward_days INTEGER DEFAULT 14, -- 2 weeks = 14 days

  -- Status tracking
  status TEXT DEFAULT 'pending', -- 'pending', 'completed', 'expired'

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Indexes for queries
  INDEX idx_referrals_referrer (referrer_user_id, created_at DESC),
  INDEX idx_referrals_referred (referred_user_id),

  -- Prevent duplicate referrals
  UNIQUE(referred_user_id)
);

-- Enable RLS on referrals table
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

-- Users can view their own referrals (both sent and received)
CREATE POLICY "Users can view own referrals" ON public.referrals
  FOR SELECT USING (
    auth.uid() = referrer_user_id OR auth.uid() = referred_user_id
  );

-- Users can insert referrals (when someone signs up with their code)
CREATE POLICY "Users can create referrals" ON public.referrals
  FOR INSERT WITH CHECK (
    auth.uid() = referred_user_id OR auth.uid() = referrer_user_id
  );

-- Admins can view all referrals
CREATE POLICY "Admins can view all referrals" ON public.referrals
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE admin_users.user_id = auth.uid()
    )
  );

-- ============================================================
-- FUNCTIONS AND TRIGGERS
-- ============================================================

-- Function to generate unique referral code
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
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate referral code for new users
CREATE OR REPLACE FUNCTION auto_generate_referral_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.referral_code IS NULL THEN
    NEW.referral_code := generate_referral_code();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER generate_user_referral_code
  BEFORE INSERT ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION auto_generate_referral_code();

-- Function to update referrer's stats when referral is completed
CREATE OR REPLACE FUNCTION update_referrer_stats()
RETURNS TRIGGER AS $$
BEGIN
  -- Increment referrals_count and free_days_earned for referrer
  UPDATE public.users
  SET
    referrals_count = referrals_count + 1,
    free_days_earned = free_days_earned + NEW.reward_days
  WHERE id = NEW.referrer_user_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_referral_completed
  AFTER INSERT ON public.referrals
  FOR EACH ROW
  WHEN (NEW.reward_granted = TRUE)
  EXECUTE FUNCTION update_referrer_stats();

-- Update trigger for referrals table
CREATE TRIGGER update_referrals_updated_at
  BEFORE UPDATE ON public.referrals
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

-- Function to get user's referral network (people they invited + who invited them)
CREATE OR REPLACE FUNCTION get_referral_network(user_uuid UUID)
RETURNS TABLE(network_user_id UUID, relationship TEXT, user_name TEXT, user_email TEXT, joined_at TIMESTAMPTZ) AS $$
BEGIN
  RETURN QUERY

  -- People this user invited
  SELECT
    u.id as network_user_id,
    'invited' as relationship,
    u.name as user_name,
    u.email as user_email,
    u.created_at as joined_at
  FROM public.users u
  WHERE u.referred_by_user_id = user_uuid

  UNION

  -- Person who invited this user
  SELECT
    u.id as network_user_id,
    'invited_by' as relationship,
    u.name as user_name,
    u.email as user_email,
    u.created_at as joined_at
  FROM public.users u
  WHERE u.id = (SELECT referred_by_user_id FROM public.users WHERE id = user_uuid)
  AND u.id IS NOT NULL;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- COMMENTS
-- ============================================================

COMMENT ON TABLE public.referrals IS 'Tracks user referrals and rewards (2 weeks free per referral)';
COMMENT ON COLUMN public.users.referral_code IS 'Unique code for user to share with friends';
COMMENT ON COLUMN public.users.referred_by_user_id IS 'User who invited this person (NULL if direct signup)';
COMMENT ON COLUMN public.users.referrals_count IS 'Number of successful referrals this user has made';
COMMENT ON COLUMN public.users.free_days_earned IS 'Total free days earned from referrals (14 days per referral)';
