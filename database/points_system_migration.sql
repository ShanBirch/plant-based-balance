-- Migration: Points-Based Membership System
-- Purpose: Track user points for meal/workout posts, enable redemption for free membership time
-- Created: January 2026

-- ============================================================
-- USER POINTS TABLE
-- Tracks total points balance and streaks for each user
-- ============================================================
CREATE TABLE IF NOT EXISTS public.user_points (
  user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,

  -- Points balances
  current_points INTEGER DEFAULT 0,      -- Available to redeem
  lifetime_points INTEGER DEFAULT 0,     -- Total ever earned
  redeemed_points INTEGER DEFAULT 0,     -- Total spent

  -- General streak tracking (any verified post)
  current_streak INTEGER DEFAULT 0,      -- Days in a row with verified post
  longest_streak INTEGER DEFAULT 0,      -- Personal best streak
  last_post_date DATE,                   -- For streak calculation

  -- Meal-specific streaks
  meal_streak INTEGER DEFAULT 0,         -- Consecutive days tracking meals
  longest_meal_streak INTEGER DEFAULT 0,
  last_meal_date DATE,

  -- Workout-specific streaks
  workout_streak INTEGER DEFAULT 0,      -- Consecutive days logging workouts
  longest_workout_streak INTEGER DEFAULT 0,
  last_workout_date DATE,

  -- Stats
  total_meals_logged INTEGER DEFAULT 0,
  total_workouts_logged INTEGER DEFAULT 0,
  weeks_redeemed INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_user_points_user ON public.user_points(user_id);

-- ============================================================
-- POINT TRANSACTIONS TABLE
-- Audit log of all point earnings and redemptions
-- ============================================================
CREATE TABLE IF NOT EXISTS public.point_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- Transaction details
  transaction_type TEXT NOT NULL,  -- 'earn_meal', 'earn_workout', 'redeem_week', 'bonus_streak', 'bonus_milestone', 'admin_adjust'
  points_amount INTEGER NOT NULL,  -- Positive for earn, negative for redeem

  -- Reference to source (meal_log_id or workout_id)
  reference_id UUID,
  reference_type TEXT,             -- 'meal_log', 'workout', 'milestone', 'streak'

  -- Anti-cheat metadata
  photo_verified BOOLEAN DEFAULT FALSE,
  photo_timestamp TIMESTAMPTZ,
  verification_method TEXT,        -- 'exif', 'file_modified', 'server_time'
  ai_confidence TEXT,              -- 'high', 'medium', 'low'

  -- Description for UI
  description TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_point_transactions_user ON public.point_transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_point_transactions_type ON public.point_transactions(user_id, transaction_type);

-- ============================================================
-- MEAL MILESTONES TABLE
-- Track meal-related achievements (separate from workout_milestones)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.meal_milestones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  milestone_type TEXT NOT NULL,    -- 'first_meal', '10_meals', '50_meals', '100_meals', '365_meals', 'meal_streak_7', etc.
  milestone_value INTEGER,         -- Threshold reached (e.g., 10, 50, 100)

  achievement_data JSONB,          -- Additional context
  points_awarded INTEGER DEFAULT 0,

  achieved_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, milestone_type, milestone_value)
);

CREATE INDEX IF NOT EXISTS idx_meal_milestones_user ON public.meal_milestones(user_id, achieved_at DESC);

-- ============================================================
-- PHOTO HASHES TABLE
-- Prevent duplicate photo submissions for points
-- ============================================================
CREATE TABLE IF NOT EXISTS public.photo_hashes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  photo_hash TEXT NOT NULL,        -- SHA-256 hash of image data
  photo_type TEXT NOT NULL,        -- 'meal', 'workout'
  reference_id UUID,               -- meal_log_id or workout_id

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, photo_hash)
);

CREATE INDEX IF NOT EXISTS idx_photo_hashes_lookup ON public.photo_hashes(user_id, photo_hash);

-- ============================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================

-- Enable RLS on all new tables
ALTER TABLE public.user_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.point_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.photo_hashes ENABLE ROW LEVEL SECURITY;

-- USER_POINTS policies
CREATE POLICY "Users can view own points" ON public.user_points
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own points" ON public.user_points
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own points" ON public.user_points
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all points" ON public.user_points
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.admin_users WHERE admin_users.user_id = auth.uid())
  );

CREATE POLICY "Admins can update all points" ON public.user_points
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.admin_users WHERE admin_users.user_id = auth.uid())
  );

-- POINT_TRANSACTIONS policies
CREATE POLICY "Users can view own transactions" ON public.point_transactions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own transactions" ON public.point_transactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all transactions" ON public.point_transactions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.admin_users WHERE admin_users.user_id = auth.uid())
  );

-- MEAL_MILESTONES policies
CREATE POLICY "Users can view own milestones" ON public.meal_milestones
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own milestones" ON public.meal_milestones
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all milestones" ON public.meal_milestones
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.admin_users WHERE admin_users.user_id = auth.uid())
  );

-- PHOTO_HASHES policies (users shouldn't need to read these directly)
CREATE POLICY "Users can insert own photo hashes" ON public.photo_hashes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all photo hashes" ON public.photo_hashes
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.admin_users WHERE admin_users.user_id = auth.uid())
  );

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

-- Initialize points record for new users (trigger function)
CREATE OR REPLACE FUNCTION initialize_user_points()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_points (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to auto-initialize points for new users
DROP TRIGGER IF EXISTS auto_initialize_points ON public.users;
CREATE TRIGGER auto_initialize_points
  AFTER INSERT ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION initialize_user_points();

-- Update timestamp on points change
CREATE OR REPLACE FUNCTION update_points_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS points_updated_at ON public.user_points;
CREATE TRIGGER points_updated_at
  BEFORE UPDATE ON public.user_points
  FOR EACH ROW
  EXECUTE FUNCTION update_points_timestamp();

-- ============================================================
-- STORED PROCEDURE: Increment user points (for use by edge functions)
-- ============================================================
CREATE OR REPLACE FUNCTION increment_user_points(
  p_user_id UUID,
  p_amount INTEGER
)
RETURNS INTEGER AS $$
DECLARE
  new_total INTEGER;
BEGIN
  UPDATE public.user_points
  SET
    current_points = current_points + p_amount,
    lifetime_points = CASE WHEN p_amount > 0 THEN lifetime_points + p_amount ELSE lifetime_points END,
    updated_at = NOW()
  WHERE user_id = p_user_id
  RETURNING current_points INTO new_total;

  -- If no row exists, create one
  IF NOT FOUND THEN
    INSERT INTO public.user_points (user_id, current_points, lifetime_points)
    VALUES (p_user_id, GREATEST(p_amount, 0), GREATEST(p_amount, 0))
    RETURNING current_points INTO new_total;
  END IF;

  RETURN new_total;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- STORED PROCEDURE: Check if photo hash exists (anti-cheat)
-- ============================================================
CREATE OR REPLACE FUNCTION check_photo_hash_exists(
  p_user_id UUID,
  p_photo_hash TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  hash_exists BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM public.photo_hashes
    WHERE user_id = p_user_id
      AND photo_hash = p_photo_hash
  ) INTO hash_exists;

  RETURN hash_exists;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- STORED PROCEDURE: Get user points summary
-- ============================================================
CREATE OR REPLACE FUNCTION get_user_points_summary(p_user_id UUID)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'current_points', COALESCE(current_points, 0),
    'lifetime_points', COALESCE(lifetime_points, 0),
    'redeemed_points', COALESCE(redeemed_points, 0),
    'current_streak', COALESCE(current_streak, 0),
    'longest_streak', COALESCE(longest_streak, 0),
    'meal_streak', COALESCE(meal_streak, 0),
    'workout_streak', COALESCE(workout_streak, 0),
    'total_meals_logged', COALESCE(total_meals_logged, 0),
    'total_workouts_logged', COALESCE(total_workouts_logged, 0),
    'weeks_redeemed', COALESCE(weeks_redeemed, 0),
    'last_post_date', last_post_date
  )
  INTO result
  FROM public.user_points
  WHERE user_id = p_user_id;

  -- Return default if no record exists
  IF result IS NULL THEN
    result := json_build_object(
      'current_points', 0,
      'lifetime_points', 0,
      'redeemed_points', 0,
      'current_streak', 0,
      'longest_streak', 0,
      'meal_streak', 0,
      'workout_streak', 0,
      'total_meals_logged', 0,
      'total_workouts_logged', 0,
      'weeks_redeemed', 0,
      'last_post_date', NULL
    );
  END IF;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Initialize points for existing users
-- ============================================================
INSERT INTO public.user_points (user_id)
SELECT id FROM public.users
WHERE id NOT IN (SELECT user_id FROM public.user_points)
ON CONFLICT (user_id) DO NOTHING;

-- ============================================================
-- GRANT PERMISSIONS for service role
-- ============================================================
GRANT ALL ON public.user_points TO service_role;
GRANT ALL ON public.point_transactions TO service_role;
GRANT ALL ON public.meal_milestones TO service_role;
GRANT ALL ON public.photo_hashes TO service_role;
GRANT EXECUTE ON FUNCTION increment_user_points TO service_role;
GRANT EXECUTE ON FUNCTION check_photo_hash_exists TO service_role;
GRANT EXECUTE ON FUNCTION get_user_points_summary TO service_role;
