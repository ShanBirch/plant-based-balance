-- ============================================================
-- WORKOUT DUEL MIGRATION
-- Challenge a friend to the same workout with multiple scoring
-- modes, live real-time updates, and video proof verification
-- Run this in Supabase SQL Editor
-- ============================================================

-- ============================================================
-- WORKOUT DUELS TABLE (the challenge itself)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.workout_duels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Who created it
  challenger_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  opponent_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- Workout definition (from WORKOUT_LIBRARY or custom)
  workout_id TEXT NOT NULL,                 -- e.g. "gym-back-1"
  workout_name TEXT NOT NULL,               -- e.g. "Back 1"
  workout_category TEXT,                    -- e.g. "gym"
  workout_subcategory TEXT,                 -- e.g. "back"
  exercises JSONB NOT NULL DEFAULT '[]',    -- Snapshot of exercises at creation time
  -- Format: [{ name, sets, reps, desc }]

  -- Scoring mode
  scoring_mode TEXT NOT NULL DEFAULT 'raw_strength' CHECK (scoring_mode IN (
    'raw_strength',       -- Total volume (weight × reps), highest wins
    'bodyweight_battle',  -- Total volume / bodyweight, highest wins
    'pb_crusher',         -- % improvement over personal best, highest wins
    'total_workload'      -- Sum of volume across ALL exercises, highest wins
  )),

  -- Format: live (simultaneous) or async (within time window)
  duel_format TEXT NOT NULL DEFAULT 'async' CHECK (duel_format IN ('live', 'async')),

  -- Timing
  scheduled_at TIMESTAMPTZ,                 -- When the workout starts (48h from creation)
  workout_window_hours INT DEFAULT 48,      -- Hours to complete (async mode)
  expires_at TIMESTAMPTZ,                   -- When the challenge expires if not accepted

  -- Coin wager (optional)
  coin_bet INTEGER DEFAULT 0,
  coins_escrowed BOOLEAN DEFAULT FALSE,     -- Both players have paid in

  -- Bodyweight (needed for bodyweight_battle mode)
  challenger_bodyweight_kg NUMERIC,
  opponent_bodyweight_kg NUMERIC,

  -- PB baselines (snapshot at duel creation for pb_crusher mode)
  challenger_pb_baselines JSONB DEFAULT '{}',  -- { "Bench Press": { weight: 80, reps: 5 }, ... }
  opponent_pb_baselines JSONB DEFAULT '{}',

  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',      -- Waiting for opponent to accept
    'accepted',     -- Opponent accepted, waiting for scheduled time
    'live',         -- Currently in progress (live mode)
    'in_progress',  -- Workout window open (async mode)
    'completed',    -- Both finished, scores calculated
    'proof_phase',  -- In the 24h proof request window
    'settled',      -- All proofs resolved, final winner determined
    'cancelled',    -- Cancelled by creator
    'declined',     -- Opponent declined
    'expired'       -- Nobody accepted in time
  )),

  -- Results
  challenger_total_volume NUMERIC DEFAULT 0,
  opponent_total_volume NUMERIC DEFAULT 0,
  challenger_score NUMERIC DEFAULT 0,         -- Final score (depends on scoring_mode)
  opponent_score NUMERIC DEFAULT 0,
  winner_id UUID REFERENCES public.users(id),
  winner_rewarded BOOLEAN DEFAULT FALSE,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,                    -- When workout window opened
  challenger_finished_at TIMESTAMPTZ,
  opponent_finished_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  settled_at TIMESTAMPTZ,

  -- Constraints
  CONSTRAINT different_players CHECK (challenger_id != opponent_id)
);

-- ============================================================
-- WORKOUT DUEL SETS TABLE (individual logged sets)
-- Each set is locked on submission — no edits allowed
-- ============================================================
CREATE TABLE IF NOT EXISTS public.workout_duel_sets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  duel_id UUID NOT NULL REFERENCES public.workout_duels(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- Exercise identification
  exercise_name TEXT NOT NULL,
  exercise_index INT NOT NULL,              -- Order in the workout (0-based)
  set_number INT NOT NULL,                  -- Which set (1-based)

  -- Performance
  weight_kg NUMERIC NOT NULL DEFAULT 0,
  reps INT NOT NULL DEFAULT 0,
  volume NUMERIC GENERATED ALWAYS AS (weight_kg * reps) STORED,

  -- Drop set support
  is_drop_set BOOLEAN DEFAULT FALSE,
  drop_set_weights TEXT,                    -- "30,20,10"
  drop_set_reps TEXT,                       -- "8,6,8"
  drop_set_volume NUMERIC DEFAULT 0,        -- Calculated total drop set volume

  -- Proof status
  proof_requested BOOLEAN DEFAULT FALSE,
  proof_status TEXT DEFAULT 'none' CHECK (proof_status IN (
    'none',           -- No proof requested
    'requested',      -- Opponent wants video proof
    'uploaded',       -- Video uploaded, awaiting review
    'approved',       -- Opponent approved the video
    'rejected',       -- Opponent rejected the video (set voided)
    'expired'         -- 24h passed with no upload (set voided)
  )),
  proof_video_url TEXT,                     -- B2 URL to proof video
  proof_requested_at TIMESTAMPTZ,
  proof_uploaded_at TIMESTAMPTZ,
  proof_reviewed_at TIMESTAMPTZ,

  -- Voided sets don't count toward score
  is_voided BOOLEAN DEFAULT FALSE,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- One entry per user per exercise per set per duel
  UNIQUE(duel_id, user_id, exercise_name, set_number)
);

-- ============================================================
-- PROOF REQUESTS TABLE
-- Tracks the 3 proof request "tokens" per player per duel
-- ============================================================
CREATE TABLE IF NOT EXISTS public.duel_proof_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  duel_id UUID NOT NULL REFERENCES public.workout_duels(id) ON DELETE CASCADE,
  requester_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,   -- Who asked for proof
  target_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE, -- Who must prove it
  target_set_id UUID NOT NULL REFERENCES public.workout_duel_sets(id) ON DELETE CASCADE,

  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',    -- Waiting for video upload
    'uploaded',   -- Video uploaded
    'approved',   -- Requester approved
    'rejected',   -- Requester rejected (set voided)
    'expired'     -- 24h passed (set voided)
  )),

  -- Video
  video_url TEXT,

  -- Timing
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours'),
  responded_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ,

  -- Prevent duplicate requests on same set
  UNIQUE(duel_id, target_set_id)
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_workout_duels_challenger ON public.workout_duels(challenger_id);
CREATE INDEX IF NOT EXISTS idx_workout_duels_opponent ON public.workout_duels(opponent_id);
CREATE INDEX IF NOT EXISTS idx_workout_duels_status ON public.workout_duels(status);
CREATE INDEX IF NOT EXISTS idx_workout_duels_scheduled ON public.workout_duels(scheduled_at);

CREATE INDEX IF NOT EXISTS idx_duel_sets_duel ON public.workout_duel_sets(duel_id);
CREATE INDEX IF NOT EXISTS idx_duel_sets_user ON public.workout_duel_sets(user_id);
CREATE INDEX IF NOT EXISTS idx_duel_sets_duel_user ON public.workout_duel_sets(duel_id, user_id);

CREATE INDEX IF NOT EXISTS idx_proof_requests_duel ON public.duel_proof_requests(duel_id);
CREATE INDEX IF NOT EXISTS idx_proof_requests_target ON public.duel_proof_requests(target_user_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE public.workout_duels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_duel_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.duel_proof_requests ENABLE ROW LEVEL SECURITY;

-- Duels: both participants can view
CREATE POLICY "Duel participants can view" ON public.workout_duels
  FOR SELECT USING (challenger_id = auth.uid() OR opponent_id = auth.uid());

-- Duels: challenger can create
CREATE POLICY "Users can create duels" ON public.workout_duels
  FOR INSERT WITH CHECK (challenger_id = auth.uid());

-- Duels: participants can update
CREATE POLICY "Participants can update duels" ON public.workout_duels
  FOR UPDATE USING (challenger_id = auth.uid() OR opponent_id = auth.uid());

-- Sets: participants can view all sets in their duels
CREATE POLICY "Duel participants can view sets" ON public.workout_duel_sets
  FOR SELECT USING (
    duel_id IN (
      SELECT id FROM public.workout_duels
      WHERE challenger_id = auth.uid() OR opponent_id = auth.uid()
    )
  );

-- Sets: participants can insert own sets
CREATE POLICY "Users can log own sets" ON public.workout_duel_sets
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Sets: no direct updates allowed (sets are immutable once logged)
-- Proof status updates go through functions only

-- Proof requests: participants can view
CREATE POLICY "Duel participants can view proof requests" ON public.duel_proof_requests
  FOR SELECT USING (
    duel_id IN (
      SELECT id FROM public.workout_duels
      WHERE challenger_id = auth.uid() OR opponent_id = auth.uid()
    )
  );

-- Proof requests: requester can create
CREATE POLICY "Users can create proof requests" ON public.duel_proof_requests
  FOR INSERT WITH CHECK (requester_id = auth.uid());

-- Proof requests: target can update (upload video)
CREATE POLICY "Target can update proof requests" ON public.duel_proof_requests
  FOR UPDATE USING (target_user_id = auth.uid() OR requester_id = auth.uid());

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- Create a workout duel
CREATE OR REPLACE FUNCTION create_workout_duel(
  p_challenger_id UUID,
  p_opponent_id UUID,
  p_workout_id TEXT,
  p_workout_name TEXT,
  p_workout_category TEXT,
  p_workout_subcategory TEXT,
  p_exercises JSONB,
  p_scoring_mode TEXT,
  p_duel_format TEXT,
  p_scheduled_at TIMESTAMPTZ,
  p_coin_bet INTEGER DEFAULT 0,
  p_challenger_bodyweight NUMERIC DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  duel_id UUID;
  debit_result INTEGER;
  pb_baselines JSONB := '{}';
  exercise JSONB;
  exercise_name_val TEXT;
  pb_record RECORD;
BEGIN
  -- Validate they are friends
  IF NOT EXISTS (
    SELECT 1 FROM public.friendships
    WHERE status = 'accepted'
    AND ((user_id = p_challenger_id AND friend_id = p_opponent_id)
      OR (user_id = p_opponent_id AND friend_id = p_challenger_id))
  ) THEN
    RAISE EXCEPTION 'Players must be friends';
  END IF;

  -- Escrow coins from challenger if betting
  IF p_coin_bet > 0 THEN
    debit_result := debit_coins(
      p_challenger_id, p_coin_bet,
      'challenge_entry',
      'Workout duel bet escrow',
      NULL
    );
    IF debit_result = -1 THEN
      RAISE EXCEPTION 'Insufficient coins for bet';
    END IF;
  END IF;

  -- Build PB baselines for pb_crusher mode
  IF p_scoring_mode = 'pb_crusher' THEN
    FOR exercise IN SELECT * FROM jsonb_array_elements(p_exercises)
    LOOP
      exercise_name_val := exercise->>'name';
      SELECT best_weight_kg, best_weight_reps
      INTO pb_record
      FROM public.personal_bests
      WHERE user_id = p_challenger_id AND exercise_name = exercise_name_val;

      IF FOUND THEN
        pb_baselines := pb_baselines || jsonb_build_object(
          exercise_name_val,
          jsonb_build_object('weight', pb_record.best_weight_kg, 'reps', pb_record.best_weight_reps)
        );
      END IF;
    END LOOP;
  END IF;

  INSERT INTO public.workout_duels (
    challenger_id, opponent_id, workout_id, workout_name,
    workout_category, workout_subcategory, exercises,
    scoring_mode, duel_format, scheduled_at,
    workout_window_hours, expires_at, coin_bet,
    challenger_bodyweight_kg, challenger_pb_baselines
  ) VALUES (
    p_challenger_id, p_opponent_id, p_workout_id, p_workout_name,
    p_workout_category, p_workout_subcategory, p_exercises,
    p_scoring_mode, p_duel_format, p_scheduled_at,
    CASE WHEN p_duel_format = 'live' THEN 4 ELSE 48 END,
    NOW() + INTERVAL '48 hours',
    p_coin_bet,
    p_challenger_bodyweight, pb_baselines
  )
  RETURNING id INTO duel_id;

  RETURN duel_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION create_workout_duel TO authenticated;

-- Accept a workout duel
CREATE OR REPLACE FUNCTION accept_workout_duel(
  p_duel_id UUID,
  p_user_id UUID,
  p_bodyweight NUMERIC DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  duel RECORD;
  debit_result INTEGER;
  pb_baselines JSONB := '{}';
  exercise JSONB;
  exercise_name_val TEXT;
  pb_record RECORD;
BEGIN
  SELECT * INTO duel FROM public.workout_duels WHERE id = p_duel_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;

  IF duel.opponent_id != p_user_id THEN
    RETURN jsonb_build_object('error', 'not_opponent');
  END IF;

  IF duel.status != 'pending' THEN
    RETURN jsonb_build_object('error', 'not_pending', 'status', duel.status);
  END IF;

  IF duel.expires_at < NOW() THEN
    UPDATE public.workout_duels SET status = 'expired' WHERE id = p_duel_id;
    RETURN jsonb_build_object('error', 'expired');
  END IF;

  -- Escrow coins from opponent if betting
  IF duel.coin_bet > 0 THEN
    debit_result := debit_coins(
      p_user_id, duel.coin_bet,
      'challenge_entry',
      'Workout duel bet escrow',
      p_duel_id::TEXT
    );
    IF debit_result = -1 THEN
      RETURN jsonb_build_object('error', 'insufficient_coins');
    END IF;
  END IF;

  -- Build PB baselines for opponent in pb_crusher mode
  IF duel.scoring_mode = 'pb_crusher' THEN
    FOR exercise IN SELECT * FROM jsonb_array_elements(duel.exercises)
    LOOP
      exercise_name_val := exercise->>'name';
      SELECT best_weight_kg, best_weight_reps
      INTO pb_record
      FROM public.personal_bests
      WHERE user_id = p_user_id AND exercise_name = exercise_name_val;

      IF FOUND THEN
        pb_baselines := pb_baselines || jsonb_build_object(
          exercise_name_val,
          jsonb_build_object('weight', pb_record.best_weight_kg, 'reps', pb_record.best_weight_reps)
        );
      END IF;
    END LOOP;
  END IF;

  UPDATE public.workout_duels
  SET
    status = 'accepted',
    opponent_bodyweight_kg = p_bodyweight,
    opponent_pb_baselines = pb_baselines,
    coins_escrowed = TRUE,
    updated_at = NOW()
  WHERE id = p_duel_id;

  RETURN jsonb_build_object(
    'success', true,
    'duel_id', p_duel_id,
    'scheduled_at', duel.scheduled_at,
    'scoring_mode', duel.scoring_mode
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION accept_workout_duel TO authenticated;

-- Decline a workout duel
CREATE OR REPLACE FUNCTION decline_workout_duel(p_duel_id UUID, p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  duel RECORD;
BEGIN
  SELECT * INTO duel FROM public.workout_duels WHERE id = p_duel_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;

  IF duel.opponent_id != p_user_id THEN
    RETURN jsonb_build_object('error', 'not_opponent');
  END IF;

  -- Refund challenger's coins
  IF duel.coin_bet > 0 THEN
    PERFORM credit_coins(
      duel.challenger_id, duel.coin_bet,
      'refund',
      'Workout duel declined — bet refunded',
      p_duel_id::TEXT
    );
  END IF;

  UPDATE public.workout_duels
  SET status = 'declined', updated_at = NOW()
  WHERE id = p_duel_id;

  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION decline_workout_duel TO authenticated;

-- Start a workout duel (transition to live/in_progress)
CREATE OR REPLACE FUNCTION start_workout_duel(p_duel_id UUID, p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  duel RECORD;
  new_status TEXT;
BEGIN
  SELECT * INTO duel FROM public.workout_duels WHERE id = p_duel_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;

  IF duel.status != 'accepted' THEN
    RETURN jsonb_build_object('error', 'not_accepted');
  END IF;

  IF p_user_id != duel.challenger_id AND p_user_id != duel.opponent_id THEN
    RETURN jsonb_build_object('error', 'not_participant');
  END IF;

  new_status := CASE WHEN duel.duel_format = 'live' THEN 'live' ELSE 'in_progress' END;

  UPDATE public.workout_duels
  SET
    status = new_status,
    started_at = NOW(),
    expires_at = NOW() + (workout_window_hours || ' hours')::INTERVAL,
    updated_at = NOW()
  WHERE id = p_duel_id;

  RETURN jsonb_build_object('success', true, 'status', new_status);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION start_workout_duel TO authenticated;

-- Log a set in a workout duel (immutable once created)
CREATE OR REPLACE FUNCTION log_duel_set(
  p_duel_id UUID,
  p_user_id UUID,
  p_exercise_name TEXT,
  p_exercise_index INT,
  p_set_number INT,
  p_weight_kg NUMERIC,
  p_reps INT,
  p_is_drop_set BOOLEAN DEFAULT FALSE,
  p_drop_set_weights TEXT DEFAULT NULL,
  p_drop_set_reps TEXT DEFAULT NULL,
  p_drop_set_volume NUMERIC DEFAULT 0
)
RETURNS JSONB AS $$
DECLARE
  duel RECORD;
  new_set_id UUID;
  total_vol NUMERIC;
BEGIN
  SELECT * INTO duel FROM public.workout_duels WHERE id = p_duel_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;

  -- Must be active
  IF duel.status NOT IN ('live', 'in_progress') THEN
    RETURN jsonb_build_object('error', 'not_active', 'status', duel.status);
  END IF;

  -- Must be a participant
  IF p_user_id != duel.challenger_id AND p_user_id != duel.opponent_id THEN
    RETURN jsonb_build_object('error', 'not_participant');
  END IF;

  -- Check workout window hasn't expired
  IF duel.expires_at IS NOT NULL AND duel.expires_at < NOW() THEN
    RETURN jsonb_build_object('error', 'window_expired');
  END IF;

  -- Insert the set (will fail on duplicate due to UNIQUE constraint)
  INSERT INTO public.workout_duel_sets (
    duel_id, user_id, exercise_name, exercise_index, set_number,
    weight_kg, reps, is_drop_set, drop_set_weights, drop_set_reps, drop_set_volume
  ) VALUES (
    p_duel_id, p_user_id, p_exercise_name, p_exercise_index, p_set_number,
    p_weight_kg, p_reps, p_is_drop_set, p_drop_set_weights, p_drop_set_reps, p_drop_set_volume
  )
  RETURNING id INTO new_set_id;

  -- Recalculate user's total volume
  SELECT COALESCE(SUM(
    CASE WHEN is_voided THEN 0
         WHEN is_drop_set THEN drop_set_volume
         ELSE volume
    END
  ), 0)
  INTO total_vol
  FROM public.workout_duel_sets
  WHERE duel_id = p_duel_id AND user_id = p_user_id;

  -- Update the duel with new totals
  IF p_user_id = duel.challenger_id THEN
    UPDATE public.workout_duels
    SET challenger_total_volume = total_vol, updated_at = NOW()
    WHERE id = p_duel_id;
  ELSE
    UPDATE public.workout_duels
    SET opponent_total_volume = total_vol, updated_at = NOW()
    WHERE id = p_duel_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'set_id', new_set_id,
    'volume', p_weight_kg * p_reps,
    'running_total', total_vol
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION log_duel_set TO authenticated;

-- Mark a player as finished with their workout
CREATE OR REPLACE FUNCTION finish_duel_workout(p_duel_id UUID, p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  duel RECORD;
  both_done BOOLEAN;
BEGIN
  SELECT * INTO duel FROM public.workout_duels WHERE id = p_duel_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;

  -- Update finish timestamp
  IF p_user_id = duel.challenger_id THEN
    UPDATE public.workout_duels
    SET challenger_finished_at = NOW(), updated_at = NOW()
    WHERE id = p_duel_id;
    duel.challenger_finished_at := NOW();
  ELSIF p_user_id = duel.opponent_id THEN
    UPDATE public.workout_duels
    SET opponent_finished_at = NOW(), updated_at = NOW()
    WHERE id = p_duel_id;
    duel.opponent_finished_at := NOW();
  ELSE
    RETURN jsonb_build_object('error', 'not_participant');
  END IF;

  -- Check if both are done
  both_done := duel.challenger_finished_at IS NOT NULL AND duel.opponent_finished_at IS NOT NULL;

  IF both_done THEN
    -- Move to proof phase
    UPDATE public.workout_duels
    SET
      status = 'proof_phase',
      completed_at = NOW(),
      updated_at = NOW()
    WHERE id = p_duel_id;

    RETURN jsonb_build_object('success', true, 'both_finished', true, 'status', 'proof_phase');
  END IF;

  RETURN jsonb_build_object('success', true, 'both_finished', false, 'waiting_for_opponent', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION finish_duel_workout TO authenticated;

-- Request proof for a specific set (limited to 3 per player per duel)
CREATE OR REPLACE FUNCTION request_duel_proof(
  p_duel_id UUID,
  p_requester_id UUID,
  p_target_set_id UUID
)
RETURNS JSONB AS $$
DECLARE
  duel RECORD;
  target_set RECORD;
  request_count INT;
  proof_id UUID;
BEGIN
  SELECT * INTO duel FROM public.workout_duels WHERE id = p_duel_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;

  -- Must be in proof phase
  IF duel.status != 'proof_phase' THEN
    RETURN jsonb_build_object('error', 'not_proof_phase', 'status', duel.status);
  END IF;

  -- Must be a participant
  IF p_requester_id != duel.challenger_id AND p_requester_id != duel.opponent_id THEN
    RETURN jsonb_build_object('error', 'not_participant');
  END IF;

  -- Get the target set
  SELECT * INTO target_set FROM public.workout_duel_sets WHERE id = p_target_set_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'set_not_found');
  END IF;

  -- Can't request proof on your own sets
  IF target_set.user_id = p_requester_id THEN
    RETURN jsonb_build_object('error', 'cannot_proof_own_set');
  END IF;

  -- Check 3-request limit
  SELECT COUNT(*) INTO request_count
  FROM public.duel_proof_requests
  WHERE duel_id = p_duel_id AND requester_id = p_requester_id;

  IF request_count >= 3 THEN
    RETURN jsonb_build_object('error', 'limit_reached', 'used', request_count, 'max', 3);
  END IF;

  -- Create the proof request
  INSERT INTO public.duel_proof_requests (
    duel_id, requester_id, target_user_id, target_set_id
  ) VALUES (
    p_duel_id, p_requester_id, target_set.user_id, p_target_set_id
  )
  RETURNING id INTO proof_id;

  -- Mark the set as proof requested
  UPDATE public.workout_duel_sets
  SET proof_requested = TRUE, proof_status = 'requested', proof_requested_at = NOW()
  WHERE id = p_target_set_id;

  RETURN jsonb_build_object(
    'success', true,
    'proof_request_id', proof_id,
    'requests_remaining', 2 - request_count,
    'exercise', target_set.exercise_name,
    'weight', target_set.weight_kg,
    'reps', target_set.reps
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION request_duel_proof TO authenticated;

-- Upload proof video for a set
CREATE OR REPLACE FUNCTION submit_duel_proof(
  p_proof_request_id UUID,
  p_user_id UUID,
  p_video_url TEXT
)
RETURNS JSONB AS $$
DECLARE
  proof RECORD;
BEGIN
  SELECT * INTO proof FROM public.duel_proof_requests WHERE id = p_proof_request_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;

  IF proof.target_user_id != p_user_id THEN
    RETURN jsonb_build_object('error', 'not_target_user');
  END IF;

  IF proof.status != 'pending' THEN
    RETURN jsonb_build_object('error', 'already_responded', 'status', proof.status);
  END IF;

  IF proof.expires_at < NOW() THEN
    -- Auto-void the set
    UPDATE public.duel_proof_requests SET status = 'expired' WHERE id = p_proof_request_id;
    UPDATE public.workout_duel_sets SET proof_status = 'expired', is_voided = TRUE WHERE id = proof.target_set_id;
    RETURN jsonb_build_object('error', 'expired');
  END IF;

  -- Update proof request
  UPDATE public.duel_proof_requests
  SET status = 'uploaded', video_url = p_video_url, responded_at = NOW()
  WHERE id = p_proof_request_id;

  -- Update the set
  UPDATE public.workout_duel_sets
  SET proof_status = 'uploaded', proof_video_url = p_video_url, proof_uploaded_at = NOW()
  WHERE id = proof.target_set_id;

  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION submit_duel_proof TO authenticated;

-- Review a proof submission (approve or reject)
CREATE OR REPLACE FUNCTION review_duel_proof(
  p_proof_request_id UUID,
  p_reviewer_id UUID,
  p_approved BOOLEAN
)
RETURNS JSONB AS $$
DECLARE
  proof RECORD;
  duel RECORD;
BEGIN
  SELECT * INTO proof FROM public.duel_proof_requests WHERE id = p_proof_request_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;

  IF proof.requester_id != p_reviewer_id THEN
    RETURN jsonb_build_object('error', 'not_requester');
  END IF;

  IF proof.status != 'uploaded' THEN
    RETURN jsonb_build_object('error', 'not_uploaded', 'status', proof.status);
  END IF;

  IF p_approved THEN
    UPDATE public.duel_proof_requests
    SET status = 'approved', reviewed_at = NOW()
    WHERE id = p_proof_request_id;

    UPDATE public.workout_duel_sets
    SET proof_status = 'approved', proof_reviewed_at = NOW()
    WHERE id = proof.target_set_id;
  ELSE
    -- Rejected: void the set
    UPDATE public.duel_proof_requests
    SET status = 'rejected', reviewed_at = NOW()
    WHERE id = p_proof_request_id;

    UPDATE public.workout_duel_sets
    SET proof_status = 'rejected', is_voided = TRUE, proof_reviewed_at = NOW()
    WHERE id = proof.target_set_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'approved', p_approved);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION review_duel_proof TO authenticated;

-- Settle the duel: calculate final scores and determine winner
CREATE OR REPLACE FUNCTION settle_workout_duel(p_duel_id UUID)
RETURNS JSONB AS $$
DECLARE
  duel RECORD;
  c_volume NUMERIC;
  o_volume NUMERIC;
  c_score NUMERIC;
  o_score NUMERIC;
  winner UUID;
  pending_proofs INT;
BEGIN
  SELECT * INTO duel FROM public.workout_duels WHERE id = p_duel_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;

  IF duel.winner_rewarded THEN
    RETURN jsonb_build_object('error', 'already_settled');
  END IF;

  -- Check no pending proofs remain
  SELECT COUNT(*) INTO pending_proofs
  FROM public.duel_proof_requests
  WHERE duel_id = p_duel_id AND status IN ('pending', 'uploaded');

  IF pending_proofs > 0 THEN
    RETURN jsonb_build_object('error', 'proofs_pending', 'count', pending_proofs);
  END IF;

  -- Expire any timed-out proof requests
  UPDATE public.duel_proof_requests
  SET status = 'expired'
  WHERE duel_id = p_duel_id AND status = 'pending' AND expires_at < NOW();

  UPDATE public.workout_duel_sets
  SET is_voided = TRUE, proof_status = 'expired'
  WHERE id IN (
    SELECT target_set_id FROM public.duel_proof_requests
    WHERE duel_id = p_duel_id AND status = 'expired'
  );

  -- Calculate final volumes (excluding voided sets)
  SELECT COALESCE(SUM(
    CASE WHEN is_drop_set THEN drop_set_volume ELSE volume END
  ), 0) INTO c_volume
  FROM public.workout_duel_sets
  WHERE duel_id = p_duel_id AND user_id = duel.challenger_id AND NOT is_voided;

  SELECT COALESCE(SUM(
    CASE WHEN is_drop_set THEN drop_set_volume ELSE volume END
  ), 0) INTO o_volume
  FROM public.workout_duel_sets
  WHERE duel_id = p_duel_id AND user_id = duel.opponent_id AND NOT is_voided;

  -- Calculate scores based on mode
  CASE duel.scoring_mode
    WHEN 'raw_strength', 'total_workload' THEN
      c_score := c_volume;
      o_score := o_volume;

    WHEN 'bodyweight_battle' THEN
      c_score := CASE WHEN COALESCE(duel.challenger_bodyweight_kg, 0) > 0
        THEN c_volume / duel.challenger_bodyweight_kg ELSE c_volume END;
      o_score := CASE WHEN COALESCE(duel.opponent_bodyweight_kg, 0) > 0
        THEN o_volume / duel.opponent_bodyweight_kg ELSE o_volume END;

    WHEN 'pb_crusher' THEN
      -- For PB mode, score is already total volume but we compare against baseline
      -- Higher % improvement wins
      DECLARE
        c_baseline NUMERIC := 0;
        o_baseline NUMERIC := 0;
        ex_key TEXT;
        ex_val JSONB;
      BEGIN
        -- Sum challenger baselines
        FOR ex_key, ex_val IN SELECT * FROM jsonb_each(duel.challenger_pb_baselines)
        LOOP
          c_baseline := c_baseline + COALESCE((ex_val->>'weight')::NUMERIC, 0)
            * COALESCE((ex_val->>'reps')::NUMERIC, 1);
        END LOOP;

        -- Sum opponent baselines
        FOR ex_key, ex_val IN SELECT * FROM jsonb_each(duel.opponent_pb_baselines)
        LOOP
          o_baseline := o_baseline + COALESCE((ex_val->>'weight')::NUMERIC, 0)
            * COALESCE((ex_val->>'reps')::NUMERIC, 1);
        END LOOP;

        c_score := CASE WHEN c_baseline > 0 THEN (c_volume / c_baseline) * 100 ELSE 100 END;
        o_score := CASE WHEN o_baseline > 0 THEN (o_volume / o_baseline) * 100 ELSE 100 END;
      END;
  END CASE;

  -- Determine winner
  IF c_score > o_score THEN
    winner := duel.challenger_id;
  ELSIF o_score > c_score THEN
    winner := duel.opponent_id;
  ELSE
    winner := duel.challenger_id; -- Tie goes to challenger
  END IF;

  -- Update duel
  UPDATE public.workout_duels
  SET
    challenger_total_volume = c_volume,
    opponent_total_volume = o_volume,
    challenger_score = c_score,
    opponent_score = o_score,
    winner_id = winner,
    status = 'settled',
    settled_at = NOW(),
    updated_at = NOW()
  WHERE id = p_duel_id;

  -- Award coins to winner (2x the bet)
  IF duel.coin_bet > 0 THEN
    PERFORM credit_coins(
      winner, duel.coin_bet * 2,
      'challenge_win',
      'Won workout duel (' || (duel.coin_bet * 2) || ' coins)',
      p_duel_id::TEXT
    );
  END IF;

  -- Award 200 XP to winner
  UPDATE public.user_points
  SET
    current_points = current_points + 200,
    lifetime_points = lifetime_points + 200
  WHERE user_id = winner;

  INSERT INTO public.point_transactions (user_id, transaction_type, points, description)
  VALUES (winner, 'challenge_win', 200, 'Won workout duel: ' || duel.workout_name);

  -- Mark as rewarded
  UPDATE public.workout_duels
  SET winner_rewarded = TRUE
  WHERE id = p_duel_id;

  RETURN jsonb_build_object(
    'success', true,
    'winner_id', winner,
    'challenger_score', c_score,
    'opponent_score', o_score,
    'challenger_volume', c_volume,
    'opponent_volume', o_volume,
    'scoring_mode', duel.scoring_mode,
    'coin_prize', duel.coin_bet * 2
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION settle_workout_duel TO authenticated;

-- Get user's workout duels (active and past)
CREATE OR REPLACE FUNCTION get_user_workout_duels(p_user_id UUID)
RETURNS TABLE(
  duel_id UUID,
  workout_name TEXT,
  scoring_mode TEXT,
  duel_format TEXT,
  status TEXT,
  challenger_id UUID,
  challenger_name TEXT,
  opponent_id UUID,
  opponent_name TEXT,
  coin_bet INTEGER,
  scheduled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  winner_id UUID,
  challenger_score NUMERIC,
  opponent_score NUMERIC,
  is_challenger BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.id as duel_id,
    d.workout_name,
    d.scoring_mode,
    d.duel_format,
    d.status,
    d.challenger_id,
    cu.name as challenger_name,
    d.opponent_id,
    ou.name as opponent_name,
    d.coin_bet,
    d.scheduled_at,
    d.created_at,
    d.winner_id,
    d.challenger_score,
    d.opponent_score,
    (d.challenger_id = p_user_id) as is_challenger
  FROM public.workout_duels d
  JOIN public.users cu ON cu.id = d.challenger_id
  JOIN public.users ou ON ou.id = d.opponent_id
  WHERE d.challenger_id = p_user_id OR d.opponent_id = p_user_id
  ORDER BY
    CASE d.status
      WHEN 'live' THEN 0
      WHEN 'in_progress' THEN 1
      WHEN 'proof_phase' THEN 2
      WHEN 'accepted' THEN 3
      WHEN 'pending' THEN 4
      ELSE 5
    END,
    d.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_user_workout_duels TO authenticated;

-- Get full duel details including all sets
CREATE OR REPLACE FUNCTION get_workout_duel_detail(p_duel_id UUID, p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  duel RECORD;
  challenger_sets JSONB;
  opponent_sets JSONB;
  proof_requests JSONB;
  user_proof_count INT;
BEGIN
  SELECT * INTO duel FROM public.workout_duels WHERE id = p_duel_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;

  -- Must be a participant
  IF p_user_id != duel.challenger_id AND p_user_id != duel.opponent_id THEN
    RETURN jsonb_build_object('error', 'not_participant');
  END IF;

  -- Get challenger sets
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', s.id, 'exercise_name', s.exercise_name, 'exercise_index', s.exercise_index,
      'set_number', s.set_number, 'weight_kg', s.weight_kg, 'reps', s.reps,
      'volume', s.volume, 'is_drop_set', s.is_drop_set,
      'drop_set_weights', s.drop_set_weights, 'drop_set_reps', s.drop_set_reps,
      'drop_set_volume', s.drop_set_volume,
      'proof_status', s.proof_status, 'proof_video_url', s.proof_video_url,
      'is_voided', s.is_voided, 'created_at', s.created_at
    ) ORDER BY s.exercise_index, s.set_number
  ), '[]'::jsonb) INTO challenger_sets
  FROM public.workout_duel_sets s
  WHERE s.duel_id = p_duel_id AND s.user_id = duel.challenger_id;

  -- Get opponent sets
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', s.id, 'exercise_name', s.exercise_name, 'exercise_index', s.exercise_index,
      'set_number', s.set_number, 'weight_kg', s.weight_kg, 'reps', s.reps,
      'volume', s.volume, 'is_drop_set', s.is_drop_set,
      'drop_set_weights', s.drop_set_weights, 'drop_set_reps', s.drop_set_reps,
      'drop_set_volume', s.drop_set_volume,
      'proof_status', s.proof_status, 'proof_video_url', s.proof_video_url,
      'is_voided', s.is_voided, 'created_at', s.created_at
    ) ORDER BY s.exercise_index, s.set_number
  ), '[]'::jsonb) INTO opponent_sets
  FROM public.workout_duel_sets s
  WHERE s.duel_id = p_duel_id AND s.user_id = duel.opponent_id;

  -- Get proof requests
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', pr.id, 'requester_id', pr.requester_id, 'target_user_id', pr.target_user_id,
      'target_set_id', pr.target_set_id, 'status', pr.status,
      'video_url', pr.video_url, 'expires_at', pr.expires_at
    )
  ), '[]'::jsonb) INTO proof_requests
  FROM public.duel_proof_requests pr
  WHERE pr.duel_id = p_duel_id;

  -- Count user's proof requests used
  SELECT COUNT(*) INTO user_proof_count
  FROM public.duel_proof_requests
  WHERE duel_id = p_duel_id AND requester_id = p_user_id;

  RETURN jsonb_build_object(
    'duel', jsonb_build_object(
      'id', duel.id,
      'workout_id', duel.workout_id,
      'workout_name', duel.workout_name,
      'workout_category', duel.workout_category,
      'exercises', duel.exercises,
      'scoring_mode', duel.scoring_mode,
      'duel_format', duel.duel_format,
      'status', duel.status,
      'scheduled_at', duel.scheduled_at,
      'expires_at', duel.expires_at,
      'coin_bet', duel.coin_bet,
      'challenger_id', duel.challenger_id,
      'opponent_id', duel.opponent_id,
      'challenger_bodyweight_kg', duel.challenger_bodyweight_kg,
      'opponent_bodyweight_kg', duel.opponent_bodyweight_kg,
      'challenger_pb_baselines', duel.challenger_pb_baselines,
      'opponent_pb_baselines', duel.opponent_pb_baselines,
      'challenger_total_volume', duel.challenger_total_volume,
      'opponent_total_volume', duel.opponent_total_volume,
      'challenger_score', duel.challenger_score,
      'opponent_score', duel.opponent_score,
      'winner_id', duel.winner_id,
      'started_at', duel.started_at,
      'challenger_finished_at', duel.challenger_finished_at,
      'opponent_finished_at', duel.opponent_finished_at
    ),
    'challenger_sets', challenger_sets,
    'opponent_sets', opponent_sets,
    'proof_requests', proof_requests,
    'user_proof_requests_used', user_proof_count,
    'user_proof_requests_remaining', 3 - user_proof_count
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_workout_duel_detail TO authenticated;

-- Enable realtime for live mode
ALTER PUBLICATION supabase_realtime ADD TABLE public.workout_duel_sets;
ALTER PUBLICATION supabase_realtime ADD TABLE public.workout_duels;

-- ============================================================
-- COMMENTS
-- ============================================================
COMMENT ON TABLE public.workout_duels IS 'Workout duel challenges between friends with multiple scoring modes';
COMMENT ON TABLE public.workout_duel_sets IS 'Individual logged sets within a workout duel (immutable)';
COMMENT ON TABLE public.duel_proof_requests IS 'Video proof requests with 3-per-player limit per duel';
COMMENT ON FUNCTION create_workout_duel IS 'Creates a new workout duel, escrows coins, snapshots PB baselines';
COMMENT ON FUNCTION log_duel_set IS 'Logs an immutable set and updates running volume totals';
COMMENT ON FUNCTION request_duel_proof IS 'Requests video proof for a set (max 3 per player per duel)';
COMMENT ON FUNCTION settle_workout_duel IS 'Calculates final scores, determines winner, awards coins and XP';
