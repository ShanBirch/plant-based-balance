-- Next challenge cohorts collect 15 people before starting.
-- The dashboard card can create a deliberate in-app invitation for the
-- authenticated user, then reuse the same auto-enrol path as website leads.

CREATE OR REPLACE FUNCTION public.auto_enroll_user_in_cohort(
    p_user_id UUID,
    p_cohort_type TEXT DEFAULT 'plant_based_30'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_user_email TEXT;
    v_invitation_id UUID;
    v_existing_challenge_id UUID;
    v_existing_status TEXT;
    v_existing_deadline TIMESTAMPTZ;
    v_existing_challenge_status TEXT;
    v_challenge_id UUID;
    v_challenge_status TEXT;
    v_challenge_name TEXT;
    v_min_participants INT := 15;
    v_duration_days INT := 30;
    v_participant_count INT := 0;
    v_admin_id UUID;
    v_user_points INT := 0;
    v_just_activated BOOLEAN := FALSE;
BEGIN
    -- Already in a non-completed cohort of this type.
    SELECT c.id, c.status, cp.status, cp.acceptance_deadline_at
      INTO v_existing_challenge_id, v_existing_challenge_status, v_existing_status, v_existing_deadline
    FROM public.challenges c
    JOIN public.challenge_participants cp ON cp.challenge_id = c.id
    WHERE c.is_system_cohort = TRUE
      AND c.cohort_type = p_cohort_type
      AND c.status IN ('pending', 'active')
      AND cp.user_id = p_user_id
      AND cp.status IN ('accepted', 'pending_acceptance')
    ORDER BY c.created_at DESC
    LIMIT 1;

    IF v_existing_challenge_id IS NOT NULL THEN
        IF v_existing_challenge_status = 'pending' THEN
            SELECT COUNT(*)::INT INTO v_participant_count
            FROM public.challenge_participants
            WHERE challenge_id = v_existing_challenge_id
              AND status IN ('accepted', 'pending_acceptance');

            IF v_participant_count >= v_min_participants THEN
                UPDATE public.challenge_participants cp
                SET status = 'accepted',
                    accepted_at = COALESCE(cp.accepted_at, NOW()),
                    acceptance_deadline_at = NULL,
                    starting_points = COALESCE((SELECT up.current_points FROM public.user_points up WHERE up.user_id = cp.user_id), 0),
                    current_points = COALESCE((SELECT up.current_points FROM public.user_points up WHERE up.user_id = cp.user_id), 0),
                    challenge_points = 0
                WHERE cp.challenge_id = v_existing_challenge_id
                  AND cp.status IN ('accepted', 'pending_acceptance');

                UPDATE public.challenges
                SET status = 'active',
                    start_date = CURRENT_DATE,
                    end_date = CURRENT_DATE + COALESCE(duration_days, v_duration_days),
                    min_participants_to_start = v_min_participants,
                    acceptance_phase_started_at = NULL,
                    updated_at = NOW()
                WHERE id = v_existing_challenge_id;

                v_existing_challenge_status := 'active';
                v_existing_status := 'accepted';
                v_existing_deadline := NULL;
                v_just_activated := TRUE;
            END IF;
        END IF;

        SELECT COUNT(*)::INT INTO v_participant_count
        FROM public.challenge_participants
        WHERE challenge_id = v_existing_challenge_id
          AND status IN ('accepted', 'pending_acceptance');

        RETURN jsonb_build_object(
            'challenge_id', v_existing_challenge_id,
            'cohort_type', p_cohort_type,
            'already_enrolled', TRUE,
            'just_filled', FALSE,
            'just_activated', v_just_activated,
            'just_started', v_just_activated,
            'user_status', v_existing_status,
            'acceptance_deadline', v_existing_deadline,
            'participant_count', v_participant_count,
            'min_participants', v_min_participants
        );
    END IF;

    SELECT email INTO v_user_email
    FROM public.users
    WHERE id = p_user_id;

    IF v_user_email IS NULL OR v_user_email = '' THEN
        RETURN jsonb_build_object('skipped', 'no_email');
    END IF;

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

    -- New signups join the next waiting cohort, not an already-running one.
    SELECT c.id, c.status INTO v_challenge_id, v_challenge_status
    FROM public.challenges c
    WHERE c.is_system_cohort = TRUE
      AND c.cohort_type = p_cohort_type
      AND c.status = 'pending'
      AND (
          SELECT COUNT(*)
          FROM public.challenge_participants cp2
          WHERE cp2.challenge_id = c.id
            AND cp2.status IN ('accepted', 'pending_acceptance')
      ) < v_min_participants
    ORDER BY c.created_at ASC
    LIMIT 1;

    IF v_challenge_id IS NULL THEN
        SELECT user_id INTO v_admin_id
        FROM public.admin_users
        LIMIT 1;

        IF v_admin_id IS NULL THEN
            v_admin_id := p_user_id;
        END IF;

        v_challenge_name := CASE p_cohort_type
            WHEN 'plant_based_30' THEN '30 Day Challenge'
            WHEN 'transform_30' THEN '30-Day Transformation Challenge'
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
        RETURNING id, status INTO v_challenge_id, v_challenge_status;
    END IF;

    SELECT COALESCE(current_points, 0) INTO v_user_points
    FROM public.user_points
    WHERE user_id = p_user_id;
    v_user_points := COALESCE(v_user_points, 0);

    INSERT INTO public.challenge_participants (
        challenge_id, user_id, status, accepted_at,
        acceptance_deadline_at,
        starting_points, current_points, challenge_points
    ) VALUES (
        v_challenge_id, p_user_id, 'accepted', NOW(),
        NULL,
        v_user_points, v_user_points, 0
    )
    ON CONFLICT (challenge_id, user_id) DO UPDATE SET
        status = 'accepted',
        accepted_at = NOW(),
        acceptance_deadline_at = NULL,
        starting_points = EXCLUDED.starting_points,
        current_points = EXCLUDED.current_points,
        challenge_points = 0;

    UPDATE public.cohort_invitations
    SET claimed_at = NOW(),
        claimed_by_user_id = p_user_id
    WHERE id = v_invitation_id;

    SELECT COUNT(*)::INT INTO v_participant_count
    FROM public.challenge_participants
    WHERE challenge_id = v_challenge_id
      AND status IN ('accepted', 'pending_acceptance');

    IF v_participant_count >= v_min_participants THEN
        UPDATE public.challenge_participants cp
        SET status = 'accepted',
            accepted_at = COALESCE(cp.accepted_at, NOW()),
            acceptance_deadline_at = NULL,
            starting_points = COALESCE((SELECT up.current_points FROM public.user_points up WHERE up.user_id = cp.user_id), 0),
            current_points = COALESCE((SELECT up.current_points FROM public.user_points up WHERE up.user_id = cp.user_id), 0),
            challenge_points = 0
        WHERE cp.challenge_id = v_challenge_id
          AND cp.status IN ('accepted', 'pending_acceptance');

        UPDATE public.challenges
        SET status = 'active',
            start_date = CURRENT_DATE,
            end_date = CURRENT_DATE + COALESCE(duration_days, v_duration_days),
            min_participants_to_start = v_min_participants,
            acceptance_phase_started_at = NULL,
            updated_at = NOW()
        WHERE id = v_challenge_id;

        v_challenge_status := 'active';
        v_just_activated := TRUE;
    END IF;

    RETURN jsonb_build_object(
        'challenge_id', v_challenge_id,
        'cohort_type', p_cohort_type,
        'already_enrolled', FALSE,
        'just_filled', FALSE,
        'just_activated', v_just_activated,
        'just_started', v_just_activated,
        'user_status', 'accepted',
        'acceptance_deadline', NULL,
        'participant_count', v_participant_count,
        'min_participants', v_min_participants,
        'invitation_id', v_invitation_id,
        'status', v_challenge_status
    );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.auto_enroll_user_in_cohort(UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.join_cohort_from_app(
    p_user_id UUID,
    p_cohort_type TEXT DEFAULT 'transform_30'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_user_email TEXT;
    v_user_name TEXT;
    v_invitation_id UUID;
    v_result JSONB;
BEGIN
    IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
        RETURN jsonb_build_object('error', 'not_allowed');
    END IF;

    SELECT email, name INTO v_user_email, v_user_name
    FROM public.users
    WHERE id = p_user_id;

    IF v_user_email IS NULL OR v_user_email = '' THEN
        RETURN jsonb_build_object('error', 'no_email');
    END IF;

    SELECT id INTO v_invitation_id
    FROM public.cohort_invitations
    WHERE LOWER(email) = LOWER(v_user_email)
      AND cohort_type = p_cohort_type
      AND claimed_at IS NULL
    ORDER BY created_at ASC
    LIMIT 1;

    IF v_invitation_id IS NULL THEN
        INSERT INTO public.cohort_invitations (
            email, name, cohort_type, source
        ) VALUES (
            LOWER(v_user_email),
            COALESCE(v_user_name, ''),
            p_cohort_type,
            'dashboard_card'
        )
        RETURNING id INTO v_invitation_id;
    END IF;

    SELECT public.auto_enroll_user_in_cohort(p_user_id, p_cohort_type) INTO v_result;
    RETURN v_result || jsonb_build_object('dashboard_invitation_id', v_invitation_id);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.join_cohort_from_app(UUID, TEXT) TO authenticated;

COMMENT ON FUNCTION public.join_cohort_from_app(UUID, TEXT) IS
    'Lets an authenticated user join the next challenge cohort from the dashboard invite card.';
