-- ============================================================
-- CHALLENGES MIGRATION
-- Friend challenges with leaderboards and point competitions
-- Run this in Supabase SQL Editor
-- ============================================================

-- ============================================================
-- CHALLENGES TABLE (main challenge info)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.challenges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Challenge details
  name TEXT NOT NULL,
  creator_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- Timing
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  duration_days INT NOT NULL DEFAULT 30,

  -- Status: pending (waiting for accepts), active, completed, cancelled
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed', 'cancelled')),

  -- Winner (set when challenge completes)
  winner_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  winner_points INT,
  winner_rewarded BOOLEAN DEFAULT FALSE,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,

  -- Constraints
  CONSTRAINT valid_dates CHECK (end_date > start_date),
  CONSTRAINT min_duration CHECK (duration_days >= 1)
);

-- ============================================================
-- CHALLENGE PARTICIPANTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.challenge_participants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  challenge_id UUID NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- Status: invited, accepted, declined, left
  status TEXT NOT NULL DEFAULT 'invited' CHECK (status IN ('invited', 'accepted', 'declined', 'left')),

  -- Points tracking
  starting_points INT DEFAULT 0,  -- Points at challenge start (to calculate delta)
  current_points INT DEFAULT 0,   -- Current total points
  challenge_points INT DEFAULT 0, -- Points earned DURING challenge (current - starting)

  -- Timestamps
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  left_at TIMESTAMPTZ,

  -- Unique constraint - one entry per user per challenge
  UNIQUE(challenge_id, user_id)
);

-- ============================================================
-- CHALLENGE POINTS SNAPSHOTS (for line graph)
-- Daily snapshots of each participant's points
-- ============================================================
CREATE TABLE IF NOT EXISTS public.challenge_points_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  challenge_id UUID NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  snapshot_date DATE NOT NULL,
  challenge_points INT NOT NULL DEFAULT 0,  -- Points earned in challenge so far

  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- One snapshot per user per day per challenge
  UNIQUE(challenge_id, user_id, snapshot_date)
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_challenges_creator ON public.challenges(creator_id);
CREATE INDEX IF NOT EXISTS idx_challenges_status ON public.challenges(status);
CREATE INDEX IF NOT EXISTS idx_challenges_dates ON public.challenges(start_date, end_date);

CREATE INDEX IF NOT EXISTS idx_challenge_participants_challenge ON public.challenge_participants(challenge_id);
CREATE INDEX IF NOT EXISTS idx_challenge_participants_user ON public.challenge_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_challenge_participants_status ON public.challenge_participants(status);

CREATE INDEX IF NOT EXISTS idx_challenge_snapshots_challenge ON public.challenge_points_snapshots(challenge_id);
CREATE INDEX IF NOT EXISTS idx_challenge_snapshots_date ON public.challenge_points_snapshots(snapshot_date);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenge_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenge_points_snapshots ENABLE ROW LEVEL SECURITY;

-- Challenges: participants can view
CREATE POLICY "Challenge participants can view" ON public.challenges
  FOR SELECT USING (
    id IN (SELECT challenge_id FROM public.challenge_participants WHERE user_id = auth.uid())
  );

-- Challenges: creator can insert
CREATE POLICY "Users can create challenges" ON public.challenges
  FOR INSERT WITH CHECK (creator_id = auth.uid());

-- Challenges: creator can update
CREATE POLICY "Creator can update challenge" ON public.challenges
  FOR UPDATE USING (creator_id = auth.uid());

-- Participants: can view own challenges
CREATE POLICY "Users can view own participations" ON public.challenge_participants
  FOR SELECT USING (user_id = auth.uid() OR challenge_id IN (
    SELECT challenge_id FROM public.challenge_participants WHERE user_id = auth.uid()
  ));

-- Participants: challenge creator can insert (invite)
CREATE POLICY "Creator can invite participants" ON public.challenge_participants
  FOR INSERT WITH CHECK (
    challenge_id IN (SELECT id FROM public.challenges WHERE creator_id = auth.uid())
    OR user_id = auth.uid()
  );

-- Participants: user can update own status
CREATE POLICY "Users can update own participation" ON public.challenge_participants
  FOR UPDATE USING (user_id = auth.uid());

-- Snapshots: participants can view
CREATE POLICY "Participants can view snapshots" ON public.challenge_points_snapshots
  FOR SELECT USING (
    challenge_id IN (SELECT challenge_id FROM public.challenge_participants WHERE user_id = auth.uid())
  );

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- Get user's active and pending challenges
CREATE OR REPLACE FUNCTION get_user_challenges(user_uuid UUID)
RETURNS TABLE(
  challenge_id UUID,
  challenge_name TEXT,
  creator_id UUID,
  creator_name TEXT,
  start_date DATE,
  end_date DATE,
  duration_days INT,
  status TEXT,
  days_remaining INT,
  participant_count INT,
  user_status TEXT,
  user_rank INT,
  user_points INT,
  leader_name TEXT,
  leader_points INT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id as challenge_id,
    c.name as challenge_name,
    c.creator_id,
    creator.name as creator_name,
    c.start_date,
    c.end_date,
    c.duration_days,
    c.status,
    GREATEST(0, c.end_date - CURRENT_DATE)::INT as days_remaining,
    (SELECT COUNT(*)::INT FROM public.challenge_participants cp2
     WHERE cp2.challenge_id = c.id AND cp2.status = 'accepted') as participant_count,
    cp.status as user_status,
    (SELECT COUNT(*)::INT + 1 FROM public.challenge_participants cp3
     WHERE cp3.challenge_id = c.id AND cp3.status = 'accepted'
     AND cp3.challenge_points > cp.challenge_points) as user_rank,
    cp.challenge_points as user_points,
    (SELECT u.name FROM public.challenge_participants cp4
     JOIN public.users u ON u.id = cp4.user_id
     WHERE cp4.challenge_id = c.id AND cp4.status = 'accepted'
     ORDER BY cp4.challenge_points DESC LIMIT 1) as leader_name,
    (SELECT cp5.challenge_points FROM public.challenge_participants cp5
     WHERE cp5.challenge_id = c.id AND cp5.status = 'accepted'
     ORDER BY cp5.challenge_points DESC LIMIT 1) as leader_points
  FROM public.challenges c
  JOIN public.challenge_participants cp ON cp.challenge_id = c.id AND cp.user_id = user_uuid
  JOIN public.users creator ON creator.id = c.creator_id
  WHERE c.status IN ('pending', 'active')
  ORDER BY
    CASE WHEN cp.status = 'invited' THEN 0 ELSE 1 END,
    c.start_date ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get challenge leaderboard
CREATE OR REPLACE FUNCTION get_challenge_leaderboard(challenge_uuid UUID)
RETURNS TABLE(
  rank INT,
  user_id UUID,
  user_name TEXT,
  user_photo TEXT,
  challenge_points INT,
  is_creator BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ROW_NUMBER() OVER (ORDER BY cp.challenge_points DESC)::INT as rank,
    cp.user_id,
    u.name as user_name,
    u.profile_photo as user_photo,
    cp.challenge_points,
    (cp.user_id = c.creator_id) as is_creator
  FROM public.challenge_participants cp
  JOIN public.users u ON u.id = cp.user_id
  JOIN public.challenges c ON c.id = cp.challenge_id
  WHERE cp.challenge_id = challenge_uuid
  AND cp.status = 'accepted'
  ORDER BY cp.challenge_points DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get challenge point history for graph
CREATE OR REPLACE FUNCTION get_challenge_point_history(challenge_uuid UUID)
RETURNS TABLE(
  snapshot_date DATE,
  user_id UUID,
  user_name TEXT,
  challenge_points INT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    cps.snapshot_date,
    cps.user_id,
    u.name as user_name,
    cps.challenge_points
  FROM public.challenge_points_snapshots cps
  JOIN public.users u ON u.id = cps.user_id
  WHERE cps.challenge_id = challenge_uuid
  ORDER BY cps.snapshot_date ASC, cps.challenge_points DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update participant points (call this when user earns points)
CREATE OR REPLACE FUNCTION update_challenge_participant_points(user_uuid UUID)
RETURNS VOID AS $$
DECLARE
  current_total INT;
BEGIN
  -- Get user's current total points
  SELECT COALESCE(current_points, 0) INTO current_total
  FROM public.user_points
  WHERE user_id = user_uuid;

  -- Update all active challenge participations
  UPDATE public.challenge_participants cp
  SET
    current_points = current_total,
    challenge_points = current_total - starting_points
  FROM public.challenges c
  WHERE cp.challenge_id = c.id
  AND cp.user_id = user_uuid
  AND cp.status = 'accepted'
  AND c.status = 'active';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Accept challenge invitation
CREATE OR REPLACE FUNCTION accept_challenge_invitation(challenge_uuid UUID, user_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
  current_total INT;
  challenge_status TEXT;
BEGIN
  -- Check challenge is still pending or active
  SELECT status INTO challenge_status FROM public.challenges WHERE id = challenge_uuid;
  IF challenge_status NOT IN ('pending', 'active') THEN
    RETURN FALSE;
  END IF;

  -- Get user's current points
  SELECT COALESCE(current_points, 0) INTO current_total
  FROM public.user_points
  WHERE user_id = user_uuid;

  -- Update participation
  UPDATE public.challenge_participants
  SET
    status = 'accepted',
    accepted_at = NOW(),
    starting_points = current_total,
    current_points = current_total,
    challenge_points = 0
  WHERE challenge_id = challenge_uuid AND user_id = user_uuid;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Leave challenge
CREATE OR REPLACE FUNCTION leave_challenge(challenge_uuid UUID, user_uuid UUID)
RETURNS JSONB AS $$
DECLARE
  remaining_count INT;
  challenge_status TEXT;
BEGIN
  -- Update user's status to left
  UPDATE public.challenge_participants
  SET status = 'left', left_at = NOW()
  WHERE challenge_id = challenge_uuid AND user_id = user_uuid;

  -- Count remaining active participants
  SELECT COUNT(*) INTO remaining_count
  FROM public.challenge_participants
  WHERE challenge_id = challenge_uuid AND status = 'accepted';

  -- If only 1 or 0 participants left, cancel the challenge
  IF remaining_count <= 1 THEN
    UPDATE public.challenges
    SET status = 'cancelled', updated_at = NOW()
    WHERE id = challenge_uuid;

    RETURN jsonb_build_object('cancelled', TRUE, 'remaining', remaining_count);
  END IF;

  RETURN jsonb_build_object('cancelled', FALSE, 'remaining', remaining_count);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Start challenge (when all invitees have responded or creator starts it)
CREATE OR REPLACE FUNCTION start_challenge(challenge_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
  accepted_count INT;
BEGIN
  -- Count accepted participants
  SELECT COUNT(*) INTO accepted_count
  FROM public.challenge_participants
  WHERE challenge_id = challenge_uuid AND status = 'accepted';

  -- Need at least 2 participants
  IF accepted_count < 2 THEN
    RETURN FALSE;
  END IF;

  -- Update challenge status
  UPDATE public.challenges
  SET status = 'active', updated_at = NOW()
  WHERE id = challenge_uuid AND status = 'pending';

  -- Remove participants who haven't accepted
  UPDATE public.challenge_participants
  SET status = 'declined'
  WHERE challenge_id = challenge_uuid AND status = 'invited';

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Complete challenge and award winner
CREATE OR REPLACE FUNCTION complete_challenge(challenge_uuid UUID)
RETURNS JSONB AS $$
DECLARE
  winner_user_id UUID;
  winner_pts INT;
  winner_user_name TEXT;
  already_rewarded BOOLEAN;
BEGIN
  -- Check if winner was already rewarded (prevents race condition/double reward)
  SELECT winner_rewarded INTO already_rewarded
  FROM public.challenges
  WHERE id = challenge_uuid;

  IF already_rewarded = TRUE THEN
    RETURN jsonb_build_object(
      'error', 'already_completed',
      'message', 'Challenge winner was already rewarded'
    );
  END IF;

  -- Find the winner (highest challenge_points)
  SELECT cp.user_id, cp.challenge_points, u.name
  INTO winner_user_id, winner_pts, winner_user_name
  FROM public.challenge_participants cp
  JOIN public.users u ON u.id = cp.user_id
  WHERE cp.challenge_id = challenge_uuid AND cp.status = 'accepted'
  ORDER BY cp.challenge_points DESC
  LIMIT 1;

  -- Update challenge with winner
  UPDATE public.challenges
  SET
    status = 'completed',
    winner_id = winner_user_id,
    winner_points = winner_pts,
    completed_at = NOW(),
    updated_at = NOW()
  WHERE id = challenge_uuid;

  -- Award 200 points to winner
  UPDATE public.user_points
  SET
    current_points = current_points + 200,
    lifetime_points = lifetime_points + 200
  WHERE user_id = winner_user_id;

  -- Record the transaction
  INSERT INTO public.point_transactions (user_id, transaction_type, points, description)
  VALUES (winner_user_id, 'challenge_win', 200, 'Won challenge: ' || (SELECT name FROM public.challenges WHERE id = challenge_uuid));

  -- Mark as rewarded
  UPDATE public.challenges
  SET winner_rewarded = TRUE
  WHERE id = challenge_uuid;

  RETURN jsonb_build_object(
    'winner_id', winner_user_id,
    'winner_name', winner_user_name,
    'winner_points', winner_pts,
    'reward_points', 200
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Daily snapshot function (run via cron)
CREATE OR REPLACE FUNCTION create_daily_challenge_snapshots()
RETURNS INT AS $$
DECLARE
  snapshot_count INT := 0;
BEGIN
  -- Insert today's snapshots for all active challenge participants
  INSERT INTO public.challenge_points_snapshots (challenge_id, user_id, snapshot_date, challenge_points)
  SELECT
    cp.challenge_id,
    cp.user_id,
    CURRENT_DATE,
    cp.challenge_points
  FROM public.challenge_participants cp
  JOIN public.challenges c ON c.id = cp.challenge_id
  WHERE c.status = 'active'
  AND cp.status = 'accepted'
  ON CONFLICT (challenge_id, user_id, snapshot_date)
  DO UPDATE SET challenge_points = EXCLUDED.challenge_points;

  GET DIAGNOSTICS snapshot_count = ROW_COUNT;
  RETURN snapshot_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- COMMENTS
-- ============================================================
COMMENT ON TABLE public.challenges IS 'Friend challenges for point competitions';
COMMENT ON TABLE public.challenge_participants IS 'Users participating in challenges';
COMMENT ON TABLE public.challenge_points_snapshots IS 'Daily point snapshots for challenge progress graphs';
COMMENT ON FUNCTION get_challenge_leaderboard IS 'Returns ranked leaderboard for a challenge';
COMMENT ON FUNCTION complete_challenge IS 'Completes challenge and awards 200 points to winner';
