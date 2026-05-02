-- ============================================================
-- COHORT CHALLENGE MIGRATION
-- Auto-enrolling 30 Day Challenge for new signups.
-- A cohort fills with 6 people, then activates and starts the 30-day timer.
-- New signups go into the next waiting cohort.
-- ============================================================

-- ============================================================
-- 1. Add cohort fields to challenges table
-- ============================================================
ALTER TABLE public.challenges
  ADD COLUMN IF NOT EXISTS is_system_cohort BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS min_participants_to_start INT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS cohort_type TEXT DEFAULT NULL;

-- Fast lookup: open waiting cohort of a given type
CREATE INDEX IF NOT EXISTS idx_challenges_cohort_waiting
  ON public.challenges(is_system_cohort, status, cohort_type)
  WHERE is_system_cohort = TRUE;

-- ============================================================
-- 2. RPC: auto_enroll_user_in_cohort
-- Finds (or creates) the open waiting cohort for the given type
-- and adds the user as an accepted participant.
-- If enrollment fills the cohort to min_participants_to_start,
-- flips status to 'active' and resets start_date/end_date so the
-- 30-day timer starts NOW (not when the cohort was created).
-- ============================================================
CREATE OR REPLACE FUNCTION auto_enroll_user_in_cohort(
  p_user_id UUID,
  p_cohort_type TEXT DEFAULT 'plant_based_30'
)
RETURNS JSONB AS $$
DECLARE
  v_existing_challenge_id UUID;
  v_challenge_id UUID;
  v_min_participants INT := 6;
  v_duration_days INT := 30;
  v_participant_count INT;
  v_just_started BOOLEAN := FALSE;
  v_admin_id UUID;
  v_user_points INT;
BEGIN
  -- 1. Already enrolled in a non-completed cohort of this type? Return that.
  SELECT c.id INTO v_existing_challenge_id
  FROM public.challenges c
  JOIN public.challenge_participants cp ON cp.challenge_id = c.id
  WHERE c.is_system_cohort = TRUE
    AND c.cohort_type = p_cohort_type
    AND c.status IN ('pending', 'active')
    AND cp.user_id = p_user_id
    AND cp.status = 'accepted'
  LIMIT 1;

  IF v_existing_challenge_id IS NOT NULL THEN
    SELECT COUNT(*)::INT INTO v_participant_count
    FROM public.challenge_participants
    WHERE challenge_id = v_existing_challenge_id AND status = 'accepted';

    RETURN jsonb_build_object(
      'challenge_id', v_existing_challenge_id,
      'already_enrolled', TRUE,
      'just_started', FALSE,
      'participant_count', v_participant_count,
      'min_participants', v_min_participants
    );
  END IF;

  -- 2. Find an open waiting cohort with space.
  SELECT c.id INTO v_challenge_id
  FROM public.challenges c
  WHERE c.is_system_cohort = TRUE
    AND c.cohort_type = p_cohort_type
    AND c.status = 'pending'
    AND (
      SELECT COUNT(*) FROM public.challenge_participants cp2
      WHERE cp2.challenge_id = c.id AND cp2.status = 'accepted'
    ) < v_min_participants
  ORDER BY c.created_at ASC
  LIMIT 1;

  -- 3. No open cohort? Create a new one.
  IF v_challenge_id IS NULL THEN
    -- creator_id is required; use an admin if available, otherwise the user themselves.
    SELECT user_id INTO v_admin_id FROM public.admin_users LIMIT 1;
    IF v_admin_id IS NULL THEN
      v_admin_id := p_user_id;
    END IF;

    INSERT INTO public.challenges (
      name, creator_id, start_date, end_date, duration_days, status,
      is_system_cohort, min_participants_to_start, cohort_type
    ) VALUES (
      '30 Day Challenge',
      v_admin_id,
      CURRENT_DATE,                     -- placeholder until activation
      CURRENT_DATE + v_duration_days,   -- placeholder until activation
      v_duration_days,
      'pending',
      TRUE,
      v_min_participants,
      p_cohort_type
    )
    RETURNING id INTO v_challenge_id;
  END IF;

  -- 4. Get user's current XP for snapshotting starting_points.
  SELECT COALESCE(current_points, 0) INTO v_user_points
  FROM public.user_points
  WHERE user_id = p_user_id;
  v_user_points := COALESCE(v_user_points, 0);

  -- 5. Add user as participant (or update if already invited).
  INSERT INTO public.challenge_participants (
    challenge_id, user_id, status, accepted_at,
    starting_points, current_points, challenge_points
  ) VALUES (
    v_challenge_id, p_user_id, 'accepted', NOW(),
    v_user_points, v_user_points, 0
  )
  ON CONFLICT (challenge_id, user_id) DO UPDATE SET
    status = 'accepted',
    accepted_at = NOW(),
    starting_points = v_user_points,
    current_points = v_user_points,
    challenge_points = 0;

  -- 6. Count participants now.
  SELECT COUNT(*)::INT INTO v_participant_count
  FROM public.challenge_participants
  WHERE challenge_id = v_challenge_id AND status = 'accepted';

  -- 7. Did this enrollment fill the cohort? Activate it.
  IF v_participant_count >= v_min_participants THEN
    -- Reset starting_points for ALL participants to their current XP,
    -- so XP earned during the waiting period doesn't count toward the challenge.
    UPDATE public.challenge_participants cp
    SET
      starting_points = COALESCE((SELECT current_points FROM public.user_points up WHERE up.user_id = cp.user_id), 0),
      current_points = COALESCE((SELECT current_points FROM public.user_points up WHERE up.user_id = cp.user_id), 0),
      challenge_points = 0
    WHERE cp.challenge_id = v_challenge_id;

    UPDATE public.challenges
    SET
      status = 'active',
      start_date = CURRENT_DATE,
      end_date = CURRENT_DATE + v_duration_days,
      updated_at = NOW()
    WHERE id = v_challenge_id;

    v_just_started := TRUE;
  END IF;

  RETURN jsonb_build_object(
    'challenge_id', v_challenge_id,
    'already_enrolled', FALSE,
    'just_started', v_just_started,
    'participant_count', v_participant_count,
    'min_participants', v_min_participants
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 3. RPC: get_user_cohort_challenge
-- Returns the user's current cohort challenge (waiting or active),
-- with everything the home card needs to render.
-- ============================================================
CREATE OR REPLACE FUNCTION get_user_cohort_challenge(
  p_user_id UUID,
  p_cohort_type TEXT DEFAULT 'plant_based_30'
)
RETURNS TABLE(
  challenge_id UUID,
  challenge_name TEXT,
  status TEXT,
  start_date DATE,
  end_date DATE,
  duration_days INT,
  days_remaining INT,
  participant_count INT,
  min_participants INT,
  user_rank INT,
  user_points INT,
  cohort_type TEXT,
  is_system_cohort BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.name,
    c.status,
    c.start_date,
    c.end_date,
    c.duration_days,
    GREATEST(0, c.end_date - CURRENT_DATE)::INT,
    (SELECT COUNT(*)::INT FROM public.challenge_participants cp2
     WHERE cp2.challenge_id = c.id AND cp2.status = 'accepted'),
    c.min_participants_to_start,
    (SELECT COUNT(*)::INT + 1 FROM public.challenge_participants cp3
     WHERE cp3.challenge_id = c.id AND cp3.status = 'accepted'
     AND cp3.challenge_points > cp.challenge_points),
    cp.challenge_points,
    c.cohort_type,
    c.is_system_cohort
  FROM public.challenges c
  JOIN public.challenge_participants cp ON cp.challenge_id = c.id AND cp.user_id = p_user_id
  WHERE c.is_system_cohort = TRUE
    AND c.cohort_type = p_cohort_type
    AND c.status IN ('pending', 'active')
    AND cp.status = 'accepted'
  ORDER BY c.created_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 4. Grants
-- ============================================================
GRANT EXECUTE ON FUNCTION auto_enroll_user_in_cohort(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_cohort_challenge(UUID, TEXT) TO authenticated;

COMMENT ON FUNCTION auto_enroll_user_in_cohort IS
  'Auto-enrolls a user in the open waiting cohort of the given type. Creates a new cohort if none exists. Activates the cohort (status=active, dates reset) when min_participants_to_start is reached.';
COMMENT ON FUNCTION get_user_cohort_challenge IS
  'Returns the user current cohort challenge (waiting or active) with progress info for home-card rendering.';
