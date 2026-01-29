-- ============================================================
-- CHALLENGE PREMIUM MIGRATION
-- $9.99 premium challenge entry with double XP and double points
-- Run this in Supabase SQL Editor
-- ============================================================

-- ============================================================
-- ADD PREMIUM FLAG TO CHALLENGE PARTICIPANTS
-- ============================================================
ALTER TABLE public.challenge_participants
ADD COLUMN IF NOT EXISTS is_premium BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS premium_purchased_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS premium_stripe_payment_id TEXT,
ADD COLUMN IF NOT EXISTS points_multiplier NUMERIC(3,1) DEFAULT 1.0;

-- ============================================================
-- CHALLENGE PREMIUM PURCHASES TABLE
-- Track all premium challenge purchases
-- ============================================================
CREATE TABLE IF NOT EXISTS public.challenge_premium_purchases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  challenge_id UUID NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,

  -- Payment details
  amount_aud NUMERIC(10,2) NOT NULL DEFAULT 9.99,
  stripe_payment_intent_id TEXT,
  stripe_charge_id TEXT,
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'completed', 'failed', 'refunded')),

  -- Premium benefits
  points_multiplier NUMERIC(3,1) NOT NULL DEFAULT 2.0,  -- 2x multiplier

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,

  -- One purchase per user per challenge
  UNIQUE(user_id, challenge_id)
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_challenge_participants_premium
  ON public.challenge_participants(is_premium) WHERE is_premium = TRUE;

CREATE INDEX IF NOT EXISTS idx_challenge_premium_purchases_user
  ON public.challenge_premium_purchases(user_id);

CREATE INDEX IF NOT EXISTS idx_challenge_premium_purchases_challenge
  ON public.challenge_premium_purchases(challenge_id);

CREATE INDEX IF NOT EXISTS idx_challenge_premium_purchases_status
  ON public.challenge_premium_purchases(payment_status);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE public.challenge_premium_purchases ENABLE ROW LEVEL SECURITY;

-- Users can view their own purchases
CREATE POLICY "Users can view own premium purchases" ON public.challenge_premium_purchases
  FOR SELECT USING (user_id = auth.uid());

-- Users can insert their own purchases (payment intent creation)
CREATE POLICY "Users can create premium purchases" ON public.challenge_premium_purchases
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- ============================================================
-- FUNCTION: Activate premium for challenge participant
-- Called after successful Stripe payment
-- ============================================================
CREATE OR REPLACE FUNCTION activate_challenge_premium(
  p_user_id UUID,
  p_challenge_id UUID,
  p_stripe_payment_intent_id TEXT,
  p_stripe_charge_id TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_multiplier NUMERIC(3,1) := 2.0;
BEGIN
  -- Update the premium purchase record
  UPDATE public.challenge_premium_purchases
  SET
    payment_status = 'completed',
    stripe_payment_intent_id = p_stripe_payment_intent_id,
    stripe_charge_id = p_stripe_charge_id,
    completed_at = NOW()
  WHERE user_id = p_user_id AND challenge_id = p_challenge_id;

  -- Activate premium on the participant
  UPDATE public.challenge_participants
  SET
    is_premium = TRUE,
    premium_purchased_at = NOW(),
    premium_stripe_payment_id = p_stripe_payment_intent_id,
    points_multiplier = v_multiplier
  WHERE user_id = p_user_id AND challenge_id = p_challenge_id;

  RETURN jsonb_build_object(
    'success', TRUE,
    'user_id', p_user_id,
    'challenge_id', p_challenge_id,
    'multiplier', v_multiplier,
    'benefits', ARRAY['Double XP', 'Double Points', 'Premium Badge']
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- FUNCTION: Get user's premium status for a challenge
-- ============================================================
CREATE OR REPLACE FUNCTION get_challenge_premium_status(
  p_user_id UUID,
  p_challenge_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_is_premium BOOLEAN;
  v_multiplier NUMERIC(3,1);
BEGIN
  SELECT is_premium, points_multiplier
  INTO v_is_premium, v_multiplier
  FROM public.challenge_participants
  WHERE user_id = p_user_id AND challenge_id = p_challenge_id;

  RETURN jsonb_build_object(
    'is_premium', COALESCE(v_is_premium, FALSE),
    'multiplier', COALESCE(v_multiplier, 1.0),
    'benefits', CASE
      WHEN COALESCE(v_is_premium, FALSE) THEN
        ARRAY['Double XP', 'Double Points', 'Premium Badge']
      ELSE
        ARRAY[]::TEXT[]
    END
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- FUNCTION: Check if user has ANY active premium challenge
-- Used by award-points to determine multiplier
-- ============================================================
CREATE OR REPLACE FUNCTION get_user_challenge_multiplier(p_user_id UUID)
RETURNS NUMERIC AS $$
DECLARE
  v_max_multiplier NUMERIC(3,1);
BEGIN
  -- Get the highest multiplier from any active premium challenge
  SELECT COALESCE(MAX(cp.points_multiplier), 1.0)
  INTO v_max_multiplier
  FROM public.challenge_participants cp
  JOIN public.challenges c ON c.id = cp.challenge_id
  WHERE cp.user_id = p_user_id
    AND cp.status = 'accepted'
    AND cp.is_premium = TRUE
    AND c.status = 'active';

  RETURN v_max_multiplier;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- UPDATE: Modify leaderboard to show premium badge
-- ============================================================
DROP FUNCTION IF EXISTS get_challenge_leaderboard(UUID);

CREATE OR REPLACE FUNCTION get_challenge_leaderboard(challenge_uuid UUID)
RETURNS TABLE(
  rank INT,
  user_id UUID,
  user_name TEXT,
  user_photo TEXT,
  challenge_points INT,
  is_creator BOOLEAN,
  is_premium BOOLEAN,
  points_multiplier NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ROW_NUMBER() OVER (ORDER BY cp.challenge_points DESC)::INT as rank,
    cp.user_id,
    u.name as user_name,
    u.profile_photo as user_photo,
    cp.challenge_points,
    (cp.user_id = c.creator_id) as is_creator,
    COALESCE(cp.is_premium, FALSE) as is_premium,
    COALESCE(cp.points_multiplier, 1.0) as points_multiplier
  FROM public.challenge_participants cp
  JOIN public.users u ON u.id = cp.user_id
  JOIN public.challenges c ON c.id = cp.challenge_id
  WHERE cp.challenge_id = challenge_uuid
  AND cp.status = 'accepted'
  ORDER BY cp.challenge_points DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- COMMENTS
-- ============================================================
COMMENT ON COLUMN public.challenge_participants.is_premium IS 'Whether participant purchased premium ($9.99)';
COMMENT ON COLUMN public.challenge_participants.points_multiplier IS 'Points multiplier (2x for premium)';
COMMENT ON TABLE public.challenge_premium_purchases IS 'Track $9.99 premium challenge purchases';
COMMENT ON FUNCTION activate_challenge_premium IS 'Activate premium status after Stripe payment';
COMMENT ON FUNCTION get_user_challenge_multiplier IS 'Get points multiplier for active premium challenges';
