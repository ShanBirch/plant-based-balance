-- ============================================================
-- TRANSFORM CHALLENGE — second cohort variant alongside the
-- existing plant_based_30 cohort. Same plumbing, new cohort_type
-- ('transform_30') and a cohort-aware challenge name when the
-- auto_enroll RPC creates a new system cohort row.
--
-- Replaces auto_enroll_user_in_cohort so the challenge it
-- inserts gets the right name based on cohort_type instead of
-- always being labelled "30 Day Challenge".
-- ============================================================

CREATE OR REPLACE FUNCTION auto_enroll_user_in_cohort(
    p_user_id UUID,
    p_cohort_type TEXT DEFAULT 'plant_based_30'
)
RETURNS JSONB AS $$
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
    -- 0. Already enrolled? Return that record.
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
            WHEN 'plant_based_30' THEN '30 Day Challenge'
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION auto_enroll_user_in_cohort(UUID, TEXT) TO authenticated;
