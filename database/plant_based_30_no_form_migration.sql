-- Make plant_based_30 cohort enrollment work without a form.
--
-- The vegan-challenge LP no longer collects email before download — anyone
-- who installs the app from that page should land in the next plant_based_30
-- cohort automatically. This relaxes auto_enroll_user_in_cohort so it
-- creates a synthetic cohort_invitations row for plant_based_30 when a new
-- signup has no invitation yet.
--
-- Safety checks:
--   1. User must not already be enrolled in any system cohort (avoids
--      double-enrolment for transform-LP users who hit this RPC first).
--   2. User must not have a pending invitation for a different cohort_type
--      (the transform-LP form still creates transform_30 invitations).

CREATE OR REPLACE FUNCTION auto_enroll_user_in_cohort(
    p_user_id UUID,
    p_cohort_type TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_email TEXT;
    v_invitation_id UUID;
    v_existing_challenge_id UUID;
    v_challenge_id UUID;
    v_challenge_name TEXT;
    v_min_participants INT := 6;
    v_duration_days INT := 30;
    v_participant_count INT;
    v_just_started BOOLEAN := FALSE;
    v_admin_id UUID;
    v_user_points INT;
BEGIN
    -- 0. Already enrolled in this cohort_type? Return that record.
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
            'cohort_type', p_cohort_type,
            'already_enrolled', TRUE,
            'just_started', FALSE,
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

    -- 2b. plant_based_30 fallback: vegan-challenge LP no longer has a form,
    -- so most signups won't have an invitation. Auto-create one if the user
    -- isn't already in another cohort and doesn't have a pending invitation
    -- elsewhere.
    IF v_invitation_id IS NULL AND p_cohort_type = 'plant_based_30' THEN
        -- Skip if user is already enrolled in any other system cohort.
        PERFORM 1
        FROM public.challenge_participants cp
        JOIN public.challenges c ON c.id = cp.challenge_id
        WHERE cp.user_id = p_user_id
          AND c.is_system_cohort = TRUE
          AND cp.status = 'accepted';
        IF FOUND THEN
            RETURN jsonb_build_object('skipped', 'already_in_other_cohort');
        END IF;

        -- Skip if user has a pending invitation for a different cohort_type
        -- (e.g. transform-LP applied first; let that one win).
        PERFORM 1
        FROM public.cohort_invitations
        WHERE LOWER(email) = LOWER(v_user_email)
          AND cohort_type <> 'plant_based_30'
          AND claimed_at IS NULL;
        IF FOUND THEN
            RETURN jsonb_build_object('skipped', 'has_other_invitation');
        END IF;

        INSERT INTO public.cohort_invitations (
            email, name, cohort_type, source, claimed_at, claimed_by_user_id
        ) VALUES (
            LOWER(v_user_email),
            COALESCE((SELECT first_name FROM public.users WHERE id = p_user_id), ''),
            'plant_based_30',
            'auto_signup',
            NULL,
            NULL
        )
        RETURNING id INTO v_invitation_id;
    END IF;

    IF v_invitation_id IS NULL THEN
        RETURN jsonb_build_object('skipped', 'no_invitation');
    END IF;

    -- 3. Find an open waiting cohort with space, or create one.
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

    IF v_challenge_id IS NULL THEN
        SELECT user_id INTO v_admin_id FROM public.admin_users LIMIT 1;
        IF v_admin_id IS NULL THEN
            v_admin_id := p_user_id;
        END IF;

        v_challenge_name := CASE p_cohort_type
            WHEN 'plant_based_30' THEN '30-Day Plant-Based Challenge'
            WHEN 'transform_30'   THEN '30-Day Transformation Challenge'
            ELSE '30-Day Challenge'
        END;

        INSERT INTO public.challenges (
            name, creator_id, start_date, end_date, duration_days, status,
            is_system_cohort, min_participants_to_start, cohort_type
        ) VALUES (
            v_challenge_name,
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
    END IF;

    -- 4. Get user's current XP.
    SELECT COALESCE(current_points, 0) INTO v_user_points
    FROM public.user_points
    WHERE user_id = p_user_id;
    v_user_points := COALESCE(v_user_points, 0);

    -- 5. Add user as participant.
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

    -- 6. Mark the invitation as claimed.
    UPDATE public.cohort_invitations
    SET claimed_at = NOW(), claimed_by_user_id = p_user_id
    WHERE id = v_invitation_id;

    -- 7. Count participants now and maybe activate.
    SELECT COUNT(*)::INT INTO v_participant_count
    FROM public.challenge_participants
    WHERE challenge_id = v_challenge_id AND status = 'accepted';

    IF v_participant_count >= v_min_participants THEN
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
        'cohort_type', p_cohort_type,
        'already_enrolled', FALSE,
        'just_started', v_just_started,
        'participant_count', v_participant_count,
        'min_participants', v_min_participants,
        'invitation_id', v_invitation_id
    );
END;
$$;

GRANT EXECUTE ON FUNCTION auto_enroll_user_in_cohort(UUID, TEXT) TO authenticated;

COMMENT ON FUNCTION auto_enroll_user_in_cohort IS
'Auto-enrol a user into a system cohort. For plant_based_30, falls back to a synthetic invitation when none exists (vegan-challenge LP no longer has a form). For other cohort types, still requires a cohort_invitations row.';
