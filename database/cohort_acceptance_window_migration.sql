-- ============================================================
-- COHORT ACCEPTANCE WINDOW MIGRATION
--
-- Adds a 24-hour acceptance gate between "cohort filled to 6"
-- and "challenge actually starts". When the 6th person joins,
-- all 6 are flipped to status='pending_acceptance' with a 24h
-- deadline. Each participant must explicitly tap Accept. Anyone
-- who lets the timer run out is moved to status='expired' and
-- their slot reopens — the next user to enroll backfills it
-- with their own fresh 24h window. The challenge only flips to
-- status='active' once all 6 participants are status='accepted'.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Schema additions
-- ------------------------------------------------------------

ALTER TABLE public.challenge_participants
  ADD COLUMN IF NOT EXISTS acceptance_deadline_at TIMESTAMPTZ;

ALTER TABLE public.challenges
  ADD COLUMN IF NOT EXISTS acceptance_phase_started_at TIMESTAMPTZ;

-- Allow the new participant statuses introduced by this flow.
ALTER TABLE public.challenge_participants
  DROP CONSTRAINT IF EXISTS challenge_participants_status_check;
ALTER TABLE public.challenge_participants
  ADD CONSTRAINT challenge_participants_status_check
  CHECK (status IN ('invited', 'accepted', 'declined', 'left', 'pending_acceptance', 'expired'));

-- Fast lookup for the scheduled expirer.
CREATE INDEX IF NOT EXISTS idx_challenge_participants_pending_deadline
  ON public.challenge_participants (acceptance_deadline_at)
  WHERE status = 'pending_acceptance';

-- ------------------------------------------------------------
-- 2. Replace auto_enroll_user_in_cohort
--
-- Returns extra fields used by the dashboard:
--   user_status           — the calling user's row status after enroll
--   acceptance_deadline   — their personal 24h deadline (NULL until cohort fills)
--   just_filled           — TRUE the moment the cohort hits 6 for the first time
--                            (caller fans out the "accept within 24h" push)
--   just_activated        — TRUE when the all-six-accepted check passes here
--                            (rare via this RPC, normally happens via accept_cohort_invitation,
--                             but we still expose it for completeness)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION auto_enroll_user_in_cohort(
    p_user_id UUID,
    p_cohort_type TEXT DEFAULT 'plant_based_30'
)
RETURNS JSONB AS $$
DECLARE
    v_user_email TEXT;
    v_invitation_id UUID;
    v_existing_challenge_id UUID;
    v_existing_status TEXT;
    v_existing_deadline TIMESTAMPTZ;
    v_challenge_id UUID;
    v_min_participants INT := 6;
    v_duration_days INT := 30;
    v_participant_count INT;
    v_accepted_count INT;
    v_acceptance_phase_started TIMESTAMPTZ;
    v_user_status TEXT;
    v_user_deadline TIMESTAMPTZ;
    v_just_filled BOOLEAN := FALSE;
    v_just_activated BOOLEAN := FALSE;
    v_admin_id UUID;
    v_user_points INT;
    v_active_count INT;
BEGIN
    -- 0. Already in a non-completed cohort of this type? Return that record.
    SELECT c.id, cp.status, cp.acceptance_deadline_at
      INTO v_existing_challenge_id, v_existing_status, v_existing_deadline
    FROM public.challenges c
    JOIN public.challenge_participants cp ON cp.challenge_id = c.id
    WHERE c.is_system_cohort = TRUE
      AND c.cohort_type = p_cohort_type
      AND c.status IN ('pending', 'active')
      AND cp.user_id = p_user_id
      AND cp.status IN ('accepted', 'pending_acceptance')
    LIMIT 1;

    IF v_existing_challenge_id IS NOT NULL THEN
        SELECT COUNT(*)::INT INTO v_participant_count
        FROM public.challenge_participants
        WHERE challenge_id = v_existing_challenge_id
          AND status IN ('accepted', 'pending_acceptance');

        RETURN jsonb_build_object(
            'challenge_id', v_existing_challenge_id,
            'already_enrolled', TRUE,
            'just_filled', FALSE,
            'just_activated', FALSE,
            'just_started', FALSE,
            'user_status', v_existing_status,
            'acceptance_deadline', v_existing_deadline,
            'participant_count', v_participant_count,
            'min_participants', v_min_participants
        );
    END IF;

    -- 1. Look up the user's email.
    SELECT email INTO v_user_email FROM public.users WHERE id = p_user_id;
    IF v_user_email IS NULL OR v_user_email = '' THEN
        RETURN jsonb_build_object('skipped', 'no_email');
    END IF;

    -- 2. Find an unclaimed invitation matching this email + cohort type.
    SELECT id INTO v_invitation_id
    FROM public.cohort_invitations
    WHERE LOWER(email) = LOWER(v_user_email)
      AND cohort_type = p_cohort_type
      AND claimed_at IS NULL
    ORDER BY created_at ASC
    LIMIT 1;

    IF v_invitation_id IS NULL THEN
        RETURN jsonb_build_object('skipped', 'no_invitation');
    END IF;

    -- 3. Find an open waiting cohort with space (counts both accepted and
    --    pending_acceptance — the slot is occupied either way until expiry),
    --    or create a new one.
    SELECT c.id, c.acceptance_phase_started_at INTO v_challenge_id, v_acceptance_phase_started
    FROM public.challenges c
    WHERE c.is_system_cohort = TRUE
      AND c.cohort_type = p_cohort_type
      AND c.status = 'pending'
      AND (
          SELECT COUNT(*) FROM public.challenge_participants cp2
          WHERE cp2.challenge_id = c.id
            AND cp2.status IN ('accepted', 'pending_acceptance')
      ) < v_min_participants
    ORDER BY c.created_at ASC
    LIMIT 1;

    IF v_challenge_id IS NULL THEN
        SELECT user_id INTO v_admin_id FROM public.admin_users LIMIT 1;
        IF v_admin_id IS NULL THEN
            v_admin_id := p_user_id;
        END IF;

        INSERT INTO public.challenges (
            name, creator_id, start_date, end_date, duration_days, status,
            is_system_cohort, min_participants_to_start, cohort_type
        ) VALUES (
            '30-Day Plant-Based Challenge',
            v_admin_id,
            CURRENT_DATE,
            CURRENT_DATE + v_duration_days,
            v_duration_days,
            'pending',
            TRUE,
            v_min_participants,
            p_cohort_type
        )
        RETURNING id INTO v_challenge_id;

        v_acceptance_phase_started := NULL;
    END IF;

    -- 4. Snapshot the user's XP for starting_points.
    SELECT COALESCE(current_points, 0) INTO v_user_points
    FROM public.user_points
    WHERE user_id = p_user_id;
    v_user_points := COALESCE(v_user_points, 0);

    -- 5. Decide the new joiner's status.
    --    a) If the cohort has not yet hit 6 (acceptance phase not started),
    --       join as 'accepted' for now — they are considered confirmed by
    --       virtue of having opted in via the LP. They will be flipped to
    --       'pending_acceptance' below if this enrollment is the one that
    --       brings the cohort to 6.
    --    b) If the cohort is already in its acceptance phase (i.e. someone
    --       expired and a slot reopened), the new joiner is a replacement
    --       and gets their own fresh 24h window as 'pending_acceptance'.
    IF v_acceptance_phase_started IS NULL THEN
        v_user_status := 'accepted';
        v_user_deadline := NULL;
    ELSE
        v_user_status := 'pending_acceptance';
        v_user_deadline := NOW() + INTERVAL '24 hours';
    END IF;

    INSERT INTO public.challenge_participants (
        challenge_id, user_id, status, accepted_at,
        acceptance_deadline_at,
        starting_points, current_points, challenge_points
    ) VALUES (
        v_challenge_id, p_user_id, v_user_status,
        CASE WHEN v_user_status = 'accepted' THEN NOW() ELSE NULL END,
        v_user_deadline,
        v_user_points, v_user_points, 0
    )
    ON CONFLICT (challenge_id, user_id) DO UPDATE SET
        status = EXCLUDED.status,
        accepted_at = EXCLUDED.accepted_at,
        acceptance_deadline_at = EXCLUDED.acceptance_deadline_at,
        starting_points = EXCLUDED.starting_points,
        current_points = EXCLUDED.current_points,
        challenge_points = 0;

    -- 6. Mark the invitation as claimed.
    UPDATE public.cohort_invitations
    SET claimed_at = NOW(), claimed_by_user_id = p_user_id
    WHERE id = v_invitation_id;

    -- 7. Count participants (accepted + pending_acceptance) now.
    SELECT COUNT(*)::INT INTO v_active_count
    FROM public.challenge_participants
    WHERE challenge_id = v_challenge_id
      AND status IN ('accepted', 'pending_acceptance');

    -- 8. Did we just hit 6 for the first time? Flip everyone into
    --    pending_acceptance so they all get the same 24h confirm push.
    IF v_active_count >= v_min_participants AND v_acceptance_phase_started IS NULL THEN
        UPDATE public.challenge_participants
        SET status = 'pending_acceptance',
            acceptance_deadline_at = NOW() + INTERVAL '24 hours',
            accepted_at = NULL
        WHERE challenge_id = v_challenge_id
          AND status = 'accepted';

        UPDATE public.challenges
        SET acceptance_phase_started_at = NOW(),
            updated_at = NOW()
        WHERE id = v_challenge_id;

        v_user_status := 'pending_acceptance';
        v_user_deadline := NOW() + INTERVAL '24 hours';
        v_just_filled := TRUE;
    END IF;

    -- 9. Are all six already accepted? (Edge case: cohort was in acceptance
    --    phase, this user joined as a replacement, and they're somehow the
    --    last hold-out — extremely unlikely since they default to pending,
    --    but keep the symmetry.)
    SELECT COUNT(*)::INT INTO v_accepted_count
    FROM public.challenge_participants
    WHERE challenge_id = v_challenge_id AND status = 'accepted';

    IF v_accepted_count >= v_min_participants THEN
        UPDATE public.challenge_participants cp
        SET starting_points = COALESCE((SELECT current_points FROM public.user_points up WHERE up.user_id = cp.user_id), 0),
            current_points  = COALESCE((SELECT current_points FROM public.user_points up WHERE up.user_id = cp.user_id), 0),
            challenge_points = 0
        WHERE cp.challenge_id = v_challenge_id;

        UPDATE public.challenges
        SET status = 'active',
            start_date = CURRENT_DATE,
            end_date = CURRENT_DATE + v_duration_days,
            updated_at = NOW()
        WHERE id = v_challenge_id;

        v_just_activated := TRUE;
    END IF;

    v_participant_count := v_active_count;

    RETURN jsonb_build_object(
        'challenge_id', v_challenge_id,
        'already_enrolled', FALSE,
        'just_filled', v_just_filled,
        'just_activated', v_just_activated,
        -- legacy field kept for old clients; means "challenge is now active"
        'just_started', v_just_activated,
        'user_status', v_user_status,
        'acceptance_deadline', v_user_deadline,
        'participant_count', v_participant_count,
        'min_participants', v_min_participants,
        'invitation_id', v_invitation_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION auto_enroll_user_in_cohort(UUID, TEXT) TO authenticated;

-- ------------------------------------------------------------
-- 3. accept_cohort_invitation
--
-- Called from the dashboard when the user taps "Accept your spot".
-- Flips their participant row from 'pending_acceptance' to 'accepted'.
-- If this brings the cohort to 6 accepted, activates the challenge:
--   status='active', start_date=today, end_date=today+30,
--   starting_points snapshot for everyone.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION accept_cohort_invitation(
    p_user_id UUID,
    p_challenge_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_status TEXT;
    v_deadline TIMESTAMPTZ;
    v_min_participants INT;
    v_duration_days INT := 30;
    v_accepted_count INT;
    v_just_activated BOOLEAN := FALSE;
BEGIN
    SELECT cp.status, cp.acceptance_deadline_at, c.min_participants_to_start
      INTO v_status, v_deadline, v_min_participants
    FROM public.challenge_participants cp
    JOIN public.challenges c ON c.id = cp.challenge_id
    WHERE cp.challenge_id = p_challenge_id
      AND cp.user_id = p_user_id
    LIMIT 1;

    IF v_status IS NULL THEN
        RETURN jsonb_build_object('ok', FALSE, 'error', 'not_a_participant');
    END IF;

    IF v_status = 'accepted' THEN
        RETURN jsonb_build_object('ok', TRUE, 'already_accepted', TRUE);
    END IF;

    IF v_status <> 'pending_acceptance' THEN
        RETURN jsonb_build_object('ok', FALSE, 'error', 'not_pending', 'status', v_status);
    END IF;

    IF v_deadline IS NOT NULL AND v_deadline < NOW() THEN
        -- Past their personal deadline — let the scheduled expirer handle it
        -- so we don't double-mutate state from two paths. Surface as expired.
        RETURN jsonb_build_object('ok', FALSE, 'error', 'expired');
    END IF;

    UPDATE public.challenge_participants
    SET status = 'accepted',
        accepted_at = NOW(),
        acceptance_deadline_at = NULL
    WHERE challenge_id = p_challenge_id
      AND user_id = p_user_id;

    SELECT COUNT(*)::INT INTO v_accepted_count
    FROM public.challenge_participants
    WHERE challenge_id = p_challenge_id AND status = 'accepted';

    IF v_min_participants IS NOT NULL AND v_accepted_count >= v_min_participants THEN
        UPDATE public.challenge_participants cp
        SET starting_points = COALESCE((SELECT current_points FROM public.user_points up WHERE up.user_id = cp.user_id), 0),
            current_points  = COALESCE((SELECT current_points FROM public.user_points up WHERE up.user_id = cp.user_id), 0),
            challenge_points = 0
        WHERE cp.challenge_id = p_challenge_id;

        UPDATE public.challenges
        SET status = 'active',
            start_date = CURRENT_DATE,
            end_date = CURRENT_DATE + v_duration_days,
            updated_at = NOW()
        WHERE id = p_challenge_id;

        v_just_activated := TRUE;
    END IF;

    RETURN jsonb_build_object(
        'ok', TRUE,
        'already_accepted', FALSE,
        'just_activated', v_just_activated,
        'accepted_count', v_accepted_count,
        'min_participants', v_min_participants
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION accept_cohort_invitation(UUID, UUID) TO authenticated;

-- ------------------------------------------------------------
-- 4. expire_cohort_acceptances
--
-- Called by the hourly Netlify scheduled function. Finds every
-- pending_acceptance row whose deadline has passed, flips them
-- to 'expired', and returns a summary so the function can log
-- (and, if we want, push to admin). The vacated slot is filled
-- naturally on the next call to auto_enroll_user_in_cohort.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION expire_cohort_acceptances()
RETURNS JSONB AS $$
DECLARE
    v_expired_rows JSONB;
    v_count INT;
BEGIN
    WITH expired AS (
        UPDATE public.challenge_participants cp
        SET status = 'expired',
            acceptance_deadline_at = NULL
        FROM public.challenges c
        WHERE cp.challenge_id = c.id
          AND c.is_system_cohort = TRUE
          AND c.status = 'pending'
          AND cp.status = 'pending_acceptance'
          AND cp.acceptance_deadline_at IS NOT NULL
          AND cp.acceptance_deadline_at < NOW()
        RETURNING cp.user_id, cp.challenge_id, c.cohort_type
    )
    SELECT
        COALESCE(jsonb_agg(jsonb_build_object(
            'user_id', user_id,
            'challenge_id', challenge_id,
            'cohort_type', cohort_type
        )), '[]'::jsonb),
        COUNT(*)::INT
    INTO v_expired_rows, v_count
    FROM expired;

    RETURN jsonb_build_object(
        'expired_count', v_count,
        'expired', v_expired_rows
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION expire_cohort_acceptances() TO service_role;

-- ------------------------------------------------------------
-- 5. Replace get_user_cohort_challenge to surface acceptance state.
-- The return table shape adds new columns, so the existing function
-- has to be dropped before re-creation (Postgres rejects shape
-- changes via CREATE OR REPLACE).
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS get_user_cohort_challenge(UUID, TEXT);

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
    accepted_count INT,
    min_participants INT,
    user_rank INT,
    user_points INT,
    user_status TEXT,
    acceptance_deadline TIMESTAMPTZ,
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
         WHERE cp2.challenge_id = c.id
           AND cp2.status IN ('accepted', 'pending_acceptance')),
        (SELECT COUNT(*)::INT FROM public.challenge_participants cp2a
         WHERE cp2a.challenge_id = c.id
           AND cp2a.status = 'accepted'),
        c.min_participants_to_start,
        (SELECT COUNT(*)::INT + 1 FROM public.challenge_participants cp3
         WHERE cp3.challenge_id = c.id
           AND cp3.status = 'accepted'
           AND cp3.challenge_points > cp.challenge_points),
        cp.challenge_points,
        cp.status,
        cp.acceptance_deadline_at,
        c.cohort_type,
        c.is_system_cohort
    FROM public.challenges c
    JOIN public.challenge_participants cp
      ON cp.challenge_id = c.id AND cp.user_id = p_user_id
    WHERE c.is_system_cohort = TRUE
      AND c.cohort_type = p_cohort_type
      AND c.status IN ('pending', 'active')
      AND cp.status IN ('accepted', 'pending_acceptance')
    ORDER BY c.created_at DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_user_cohort_challenge(UUID, TEXT) TO authenticated;

COMMENT ON FUNCTION auto_enroll_user_in_cohort IS
    'Enrolls a user in the next open cohort. When the 6th participant joins, all 6 are flipped to pending_acceptance with a 24h deadline. Replacements (after expirations) join straight as pending_acceptance with their own 24h deadline.';
COMMENT ON FUNCTION accept_cohort_invitation IS
    'Confirms a participant''s spot. When the 6th acceptance lands, activates the challenge.';
COMMENT ON FUNCTION expire_cohort_acceptances IS
    'Hourly cleanup. Marks any pending_acceptance row past its 24h deadline as expired so the slot reopens.';
