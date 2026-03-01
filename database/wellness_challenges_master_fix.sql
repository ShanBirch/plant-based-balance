-- 1. ENHANCE CHALLENGES TABLE (Ensure all columns exist)
ALTER TABLE public.challenges ADD COLUMN IF NOT EXISTS challenge_type TEXT DEFAULT 'xp';
ALTER TABLE public.challenges ADD COLUMN IF NOT EXISTS entry_fee INTEGER DEFAULT 1000;

-- Drop foreign key if it exists so we can change the type
DO $$ 
BEGIN 
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'challenges_rare_reward_id_fkey') THEN
        ALTER TABLE public.challenges DROP CONSTRAINT challenges_rare_reward_id_fkey;
    END IF;
END $$;

-- Change rare_reward_id from UUID to TEXT to support custom character IDs (like 'ronny')
ALTER TABLE public.challenges ALTER COLUMN rare_reward_id TYPE TEXT;

-- 2. ATOMIC CREATE CHALLENGE RPC
-- Handles coin debit, challenge record, and initial participant record in one transaction.
DROP FUNCTION IF EXISTS create_wellness_challenge(TEXT, UUID, DATE, DATE, INT, TEXT, INT, UUID);
DROP FUNCTION IF EXISTS create_wellness_challenge(TEXT, UUID, DATE, DATE, INT, TEXT, INT, TEXT);
CREATE OR REPLACE FUNCTION create_wellness_challenge(
    p_name TEXT,
    p_creator_id UUID,
    p_start_date DATE,
    p_end_date DATE,
    p_duration_days INT,
    p_challenge_type TEXT,
    p_entry_fee INT,
    p_rare_reward_id TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_challenge_id UUID;
    v_new_balance INTEGER;
    v_current_points INTEGER;
BEGIN
    RAISE NOTICE '[CreateChallenge] Starting for user %', p_creator_id;

    -- 1. Debit coins from creator
    SELECT debit_coins INTO v_new_balance
    FROM public.debit_coins(p_creator_id, p_entry_fee, 'challenge_entry', 'Created challenge: ' || p_name);

    IF v_new_balance = -1 THEN
        RETURN jsonb_build_object('error', 'insufficient_coins', 'message', 'Not enough coins to create challenge');
    END IF;

    -- 2. Insert challenge record
    INSERT INTO public.challenges (
        name, creator_id, start_date, end_date, duration_days, status, entry_fee, challenge_type, rare_reward_id
    ) VALUES (
        p_name, p_creator_id, p_start_date, p_end_date, p_duration_days, 'pending', p_entry_fee, p_challenge_type, p_rare_reward_id
    ) RETURNING id INTO v_challenge_id;

    -- 3. Get creator's current points for starting point baseline
    SELECT COALESCE(current_points, 0) INTO v_current_points
    FROM public.user_points
    WHERE user_id = p_creator_id;

    -- 4. Add creator as participant
    INSERT INTO public.challenge_participants (
        challenge_id, user_id, status, accepted_at, starting_points, current_points, challenge_points, has_paid, paid_at
    ) VALUES (
        v_challenge_id, p_creator_id, 'accepted', NOW(), v_current_points, v_current_points, 0, TRUE, NOW()
    );

    RAISE NOTICE '[CreateChallenge] Success. ID: %, New Balance: %', v_challenge_id, v_new_balance;

    RETURN jsonb_build_object(
        'success', true,
        'challenge_id', v_challenge_id,
        'new_balance', v_new_balance
    );
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '[CreateChallenge] CRITICAL ERROR: %', SQLERRM;
    RETURN jsonb_build_object('error', 'internal_error', 'message', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. ATOMIC JOIN CHALLENGE RPC
-- Handles coin debit and status update in one transaction.
DROP FUNCTION IF EXISTS join_wellness_challenge(UUID, UUID);
CREATE OR REPLACE FUNCTION join_wellness_challenge(
    p_challenge_id UUID,
    p_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_entry_fee INTEGER;
    v_new_balance INTEGER;
    v_current_points INTEGER;
    v_challenge_status TEXT;
    v_user_status TEXT;
BEGIN
    RAISE NOTICE '[JoinChallenge] Starting for user % in challenge %', p_user_id, p_challenge_id;

    -- 1. Verify challenge status and user invitation
    SELECT status, entry_fee INTO v_challenge_status, v_entry_fee
    FROM public.challenges WHERE id = p_challenge_id;

    IF v_challenge_status NOT IN ('pending', 'active') THEN
        RETURN jsonb_build_object('error', 'invalid_status', 'message', 'This challenge is no longer accepting participants');
    END IF;

    SELECT status INTO v_user_status
    FROM public.challenge_participants
    WHERE challenge_id = p_challenge_id AND user_id = p_user_id;

    IF v_user_status = 'accepted' THEN
        RETURN jsonb_build_object('error', 'already_joined', 'message', 'You have already joined this challenge');
    END IF;

    -- 2. Debit coins
    SELECT debit_coins INTO v_new_balance
    FROM public.debit_coins(p_user_id, v_entry_fee, 'challenge_entry', 'Joined challenge');

    IF v_new_balance = -1 THEN
        RETURN jsonb_build_object('error', 'insufficient_coins', 'message', 'Not enough coins to join challenge');
    END IF;

    -- 3. Get user's current points
    SELECT COALESCE(current_points, 0) INTO v_current_points
    FROM public.user_points
    WHERE user_id = p_user_id;

    -- 4. Update participant record
    UPDATE public.challenge_participants
    SET
        status = 'accepted',
        accepted_at = NOW(),
        starting_points = v_current_points,
        current_points = v_current_points,
        challenge_points = 0,
        has_paid = TRUE,
        paid_at = NOW()
    WHERE challenge_id = p_challenge_id AND user_id = p_user_id;

    -- 5. If challenge was pending and now has 2+ participants, maybe start it?
    -- (JS usually handles this manually or via start_challenge RPC, but we can automagically if preferred)

    RAISE NOTICE '[JoinChallenge] Success. New Balance: %', v_new_balance;

    RETURN jsonb_build_object(
        'success', true,
        'new_balance', v_new_balance
    );
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '[JoinChallenge] CRITICAL ERROR: %', SQLERRM;
    RETURN jsonb_build_object('error', 'internal_error', 'message', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. ENHANCED LEAVE/CANCEL CHALLENGE WITH REFUND
-- If the challenge is cancelled while still pending, the creator (and anyone else who paid) gets a refund.
DROP FUNCTION IF EXISTS leave_wellness_challenge(UUID, UUID);
CREATE OR REPLACE FUNCTION leave_wellness_challenge(
    p_challenge_id UUID,
    p_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_remaining_count INTEGER;
    v_challenge_status TEXT;
    v_is_creator BOOLEAN;
    v_entry_fee INTEGER;
    v_user_paid BOOLEAN;
BEGIN
    RAISE NOTICE '[LeaveChallenge] User % leaving %', p_user_id, p_challenge_id;

    -- 1. Get challenge context
    SELECT status, creator_id, entry_fee INTO v_challenge_status, v_is_creator, v_entry_fee
    FROM public.challenges WHERE id = p_challenge_id;

    SELECT has_paid INTO v_user_paid
    FROM public.challenge_participants
    WHERE challenge_id = p_challenge_id AND user_id = p_user_id;

    -- 2. Mark user as left
    UPDATE public.challenge_participants
    SET status = 'left', left_at = NOW()
    WHERE challenge_id = p_challenge_id AND user_id = p_user_id;

    -- 3. Refund if the challenge is still pending (didn't start yet)
    IF v_challenge_status = 'pending' AND v_user_paid = TRUE THEN
        PERFORM public.credit_coins(p_user_id, v_entry_fee, 'challenge_refund', 'Refund for cancelled challenge entry');
        RAISE NOTICE '[LeaveChallenge] Refunded % coins to %', v_entry_fee, p_user_id;
    END IF;

    -- 4. Count remaining active participants
    SELECT COUNT(*) INTO v_remaining_count
    FROM public.challenge_participants
    WHERE challenge_id = p_challenge_id AND status = 'accepted';

    -- 5. Auto-cancel logic
    IF v_remaining_count <= 0 OR (v_challenge_status = 'pending' AND v_remaining_count < 2 AND NOW() > (SELECT created_at + interval '24 hours' FROM public.challenges WHERE id = p_challenge_id)) THEN
        UPDATE public.challenges
        SET status = 'cancelled', updated_at = NOW()
        WHERE id = p_challenge_id;

        -- Refund everyone else if we just cancelled a pending challenge
        IF v_challenge_status = 'pending' THEN
             -- Refund loop for any other accepted participants
             DECLARE
                other_user_id UUID;
             BEGIN
                FOR other_user_id IN (SELECT user_id FROM public.challenge_participants WHERE challenge_id = p_challenge_id AND status = 'accepted' AND has_paid = TRUE) LOOP
                    PERFORM public.credit_coins(other_user_id, v_entry_fee, 'challenge_refund', 'Challenge cancelled - entry fee refunded');
                END LOOP;
             END;
        END IF;

        RETURN jsonb_build_object('status', 'cancelled', 'remaining', 0);
    END IF;

    RETURN jsonb_build_object('status', 'left', 'remaining', v_remaining_count);
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '[LeaveChallenge] ERROR: %', SQLERRM;
    RETURN jsonb_build_object('error', 'internal_error', 'message', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. WRAPPER FOR USER CHALLENGES (Auto-updates user's points before fetching)
DROP FUNCTION IF EXISTS get_user_challenges_v2(UUID);
CREATE OR REPLACE FUNCTION get_user_challenges_v2(p_user_id UUID)
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
  leader_points INT,
  challenge_type TEXT,
  unit_label TEXT,
  rare_reward_id TEXT,
  entry_fee INT
) AS $$
BEGIN
  -- Perform a point check and update for THIS user first
  PERFORM public.update_challenge_participant_points(p_user_id);

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
     ORDER BY cp5.challenge_points DESC LIMIT 1) as leader_points,
    c.challenge_type,
    public.get_challenge_unit(c.challenge_type) as unit_label,
    c.rare_reward_id,
    c.entry_fee
  FROM public.challenges c
  JOIN public.challenge_participants cp ON cp.challenge_id = c.id AND cp.user_id = p_user_id
  JOIN public.users creator ON creator.id = c.creator_id
  WHERE c.status IN ('pending', 'active')
  ORDER BY
    CASE WHEN cp.status = 'invited' THEN 0 ELSE 1 END,
    c.start_date ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. WRAPPER FOR LEADERBOARD (Auto-updates user's points before fetching)
DROP FUNCTION IF EXISTS get_challenge_leaderboard_v2(UUID, UUID);
CREATE OR REPLACE FUNCTION get_challenge_leaderboard_v2(p_challenge_id UUID, p_user_id UUID)
RETURNS TABLE(
  rank INT,
  user_id UUID,
  user_name TEXT,
  user_photo TEXT,
  challenge_points INT,
  is_creator BOOLEAN,
  challenge_type TEXT,
  unit_label TEXT,
  milestone_criteria JSONB,
  milestone_progress JSONB
) AS $$
BEGIN
  -- Update points for EVERYTHING the user is currently in (simpler than selective)
  PERFORM public.update_challenge_participant_points(p_user_id);

  RETURN QUERY
  SELECT
    ROW_NUMBER() OVER (ORDER BY cp.challenge_points DESC)::INT as rank,
    cp.user_id,
    u.name as user_name,
    u.profile_photo as user_photo,
    cp.challenge_points,
    (cp.user_id = c.creator_id) as is_creator,
    c.challenge_type,
    public.get_challenge_unit(c.challenge_type) as unit_label,
    c.milestone_criteria,
    cp.milestone_progress
  FROM public.challenge_participants cp
  JOIN public.users u ON u.id = cp.user_id
  JOIN public.challenges c ON c.id = cp.challenge_id
  WHERE cp.challenge_id = p_challenge_id
  AND cp.status = 'accepted'
  ORDER BY cp.challenge_points DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. FINAL GRANTS
GRANT EXECUTE ON FUNCTION public.create_wellness_challenge(TEXT, UUID, DATE, DATE, INT, TEXT, INT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_wellness_challenge(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.leave_wellness_challenge(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_challenges_v2(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_challenge_leaderboard_v2(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_challenge_unit(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_challenge_participant_points(UUID) TO authenticated;
