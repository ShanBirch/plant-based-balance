-- Launch the 30 Day Challenge immediately and add participant point breakdowns.
--
-- Intent:
--   1. Existing waiting system cohorts become active now.
--   2. Future invited users join the currently active cohort instead of waiting
--      for a cohort to fill.
--   3. Participants can view aggregated point sources for anyone on the same
--      challenge leaderboard without exposing private meal/workout records.

-- Launch any currently waiting 30-day system cohorts that already have people.
WITH launchable AS (
    SELECT c.id, COALESCE(c.duration_days, 30) AS duration_days
    FROM public.challenges c
    WHERE c.is_system_cohort = TRUE
      AND c.cohort_type IN ('plant_based_30', 'transform_30')
      AND c.status = 'pending'
      AND EXISTS (
          SELECT 1
          FROM public.challenge_participants cp
          WHERE cp.challenge_id = c.id
            AND cp.status IN ('accepted', 'pending_acceptance')
      )
)
UPDATE public.challenge_participants cp
SET status = 'accepted',
    accepted_at = COALESCE(cp.accepted_at, NOW()),
    acceptance_deadline_at = NULL,
    starting_points = COALESCE((SELECT up.current_points FROM public.user_points up WHERE up.user_id = cp.user_id), 0),
    current_points = COALESCE((SELECT up.current_points FROM public.user_points up WHERE up.user_id = cp.user_id), 0),
    challenge_points = 0
FROM launchable l
WHERE cp.challenge_id = l.id
  AND cp.status IN ('accepted', 'pending_acceptance');

WITH launchable AS (
    SELECT c.id, COALESCE(c.duration_days, 30) AS duration_days
    FROM public.challenges c
    WHERE c.is_system_cohort = TRUE
      AND c.cohort_type IN ('plant_based_30', 'transform_30')
      AND c.status = 'pending'
      AND EXISTS (
          SELECT 1
          FROM public.challenge_participants cp
          WHERE cp.challenge_id = c.id
            AND cp.status = 'accepted'
      )
)
UPDATE public.challenges c
SET status = 'active',
    start_date = CURRENT_DATE,
    end_date = CURRENT_DATE + l.duration_days,
    min_participants_to_start = 1,
    acceptance_phase_started_at = NULL,
    updated_at = NOW()
FROM launchable l
WHERE c.id = l.id;

-- Replace cohort enrollment so invited users join the active challenge.
CREATE OR REPLACE FUNCTION public.auto_enroll_user_in_cohort(
    p_user_id UUID,
    p_cohort_type TEXT DEFAULT 'plant_based_30'
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
    v_existing_status TEXT;
    v_existing_deadline TIMESTAMPTZ;
    v_existing_challenge_status TEXT;
    v_challenge_id UUID;
    v_challenge_status TEXT;
    v_challenge_name TEXT;
    v_min_participants INT := 1;
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

        SELECT COUNT(*)::INT INTO v_participant_count
        FROM public.challenge_participants
        WHERE challenge_id = v_existing_challenge_id
          AND status = 'accepted';

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

    -- Prefer the active cohort that still has time left.
    SELECT c.id, c.status INTO v_challenge_id, v_challenge_status
    FROM public.challenges c
    WHERE c.is_system_cohort = TRUE
      AND c.cohort_type = p_cohort_type
      AND c.status = 'active'
      AND c.end_date >= CURRENT_DATE
    ORDER BY c.start_date DESC, c.created_at DESC
    LIMIT 1;

    -- If a waiting cohort exists, reuse it and launch it below.
    IF v_challenge_id IS NULL THEN
        SELECT c.id, c.status INTO v_challenge_id, v_challenge_status
        FROM public.challenges c
        WHERE c.is_system_cohort = TRUE
          AND c.cohort_type = p_cohort_type
          AND c.status = 'pending'
        ORDER BY c.created_at ASC
        LIMIT 1;
    END IF;

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
            'active',
            TRUE,
            v_min_participants,
            p_cohort_type
        )
        RETURNING id, status INTO v_challenge_id, v_challenge_status;

        v_just_activated := TRUE;
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

    IF v_challenge_status = 'pending' THEN
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

        v_just_activated := TRUE;
    END IF;

    SELECT COUNT(*)::INT INTO v_participant_count
    FROM public.challenge_participants
    WHERE challenge_id = v_challenge_id
      AND status = 'accepted';

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
        'invitation_id', v_invitation_id
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.auto_enroll_user_in_cohort(UUID, TEXT) TO authenticated;

COMMENT ON FUNCTION public.auto_enroll_user_in_cohort(UUID, TEXT) IS
    'Enrolls invited users into the live system cohort for the selected 30-day challenge type.';

-- Aggregated, participant-safe point sources for leaderboard detail cards.
CREATE OR REPLACE FUNCTION public.get_challenge_participant_point_breakdown(
    p_challenge_id UUID,
    p_participant_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_viewer_id UUID := auth.uid();
    v_is_allowed BOOLEAN := FALSE;
    v_challenge RECORD;
    v_participant RECORD;
    v_categories JSONB := '[]'::JSONB;
    v_recent JSONB := '[]'::JSONB;
    v_activity_points INT := 0;
BEGIN
    IF v_viewer_id IS NULL THEN
        RETURN jsonb_build_object('ok', FALSE, 'error', 'unauthenticated');
    END IF;

    SELECT *
      INTO v_challenge
    FROM public.challenges
    WHERE id = p_challenge_id
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', FALSE, 'error', 'challenge_not_found');
    END IF;

    SELECT
        cp.user_id,
        cp.challenge_points,
        cp.current_points,
        cp.starting_points,
        cp.accepted_at,
        u.name AS user_name,
        u.profile_photo AS user_photo
      INTO v_participant
    FROM public.challenge_participants cp
    JOIN public.users u ON u.id = cp.user_id
    WHERE cp.challenge_id = p_challenge_id
      AND cp.user_id = p_participant_user_id
      AND cp.status = 'accepted'
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', FALSE, 'error', 'participant_not_found');
    END IF;

    SELECT EXISTS (
        SELECT 1
        FROM public.challenge_participants cp
        WHERE cp.challenge_id = p_challenge_id
          AND cp.user_id = v_viewer_id
          AND cp.status IN ('accepted', 'pending_acceptance')
    ) OR EXISTS (
        SELECT 1
        FROM public.admin_users au
        WHERE au.user_id = v_viewer_id
    )
    INTO v_is_allowed;

    IF NOT v_is_allowed THEN
        RETURN jsonb_build_object('ok', FALSE, 'error', 'forbidden');
    END IF;

    WITH tx AS (
        SELECT
            pt.transaction_type,
            pt.points_amount,
            LEFT(COALESCE(pt.description, ''), 90) AS description,
            pt.created_at,
            CASE
                WHEN LOWER(COALESCE(pt.transaction_type, '')) LIKE '%workout%'
                  OR LOWER(COALESCE(pt.description, '')) LIKE '%workout%' THEN 'workouts'
                WHEN LOWER(COALESCE(pt.transaction_type, '')) LIKE '%daily_log%'
                  OR LOWER(COALESCE(pt.transaction_type, '')) LIKE '%meal%'
                  OR LOWER(COALESCE(pt.description, '')) LIKE '%meal%'
                  OR LOWER(COALESCE(pt.description, '')) LIKE '%nutrition%' THEN 'nutrition'
                WHEN LOWER(COALESCE(pt.transaction_type, '')) LIKE '%weigh%'
                  OR LOWER(COALESCE(pt.description, '')) LIKE '%weigh%' THEN 'weigh_ins'
                WHEN LOWER(COALESCE(pt.transaction_type, '')) LIKE '%story%'
                  OR LOWER(COALESCE(pt.transaction_type, '')) LIKE '%post%'
                  OR LOWER(COALESCE(pt.description, '')) LIKE '%feed%'
                  OR LOWER(COALESCE(pt.description, '')) LIKE '%post%' THEN 'feed_posts'
                WHEN LOWER(COALESCE(pt.transaction_type, '')) LIKE '%lesson%'
                  OR LOWER(COALESCE(pt.transaction_type, '')) LIKE '%learning%'
                  OR LOWER(COALESCE(pt.transaction_type, '')) LIKE '%quiz%' THEN 'learning'
                WHEN LOWER(COALESCE(pt.transaction_type, '')) LIKE '%streak%'
                  OR LOWER(COALESCE(pt.transaction_type, '')) LIKE '%milestone%'
                  OR LOWER(COALESCE(pt.transaction_type, '')) LIKE '%bonus%' THEN 'bonuses'
                WHEN LOWER(COALESCE(pt.transaction_type, '')) LIKE '%challenge%' THEN 'challenge_rewards'
                ELSE 'other'
            END AS category_key
        FROM public.point_transactions pt
        WHERE pt.user_id = p_participant_user_id
          AND pt.points_amount > 0
          AND pt.created_at >= v_challenge.start_date::TIMESTAMPTZ
          AND pt.created_at < (LEAST(v_challenge.end_date, CURRENT_DATE) + 1)::TIMESTAMPTZ
    ),
    grouped AS (
        SELECT
            category_key,
            CASE category_key
                WHEN 'workouts' THEN 'Workouts'
                WHEN 'nutrition' THEN 'Nutrition'
                WHEN 'weigh_ins' THEN 'Weigh-ins'
                WHEN 'feed_posts' THEN 'Feed posts'
                WHEN 'learning' THEN 'Learning'
                WHEN 'bonuses' THEN 'Bonuses'
                WHEN 'challenge_rewards' THEN 'Challenge rewards'
                ELSE 'Other'
            END AS label,
            SUM(points_amount)::INT AS points,
            COUNT(*)::INT AS count,
            MAX(created_at) AS last_earned_at
        FROM tx
        GROUP BY category_key
    )
    SELECT
        COALESCE(jsonb_agg(
            jsonb_build_object(
                'category_key', category_key,
                'label', label,
                'points', points,
                'count', count,
                'last_earned_at', last_earned_at
            )
            ORDER BY points DESC, last_earned_at DESC
        ), '[]'::JSONB),
        COALESCE(SUM(points), 0)::INT
    INTO v_categories, v_activity_points
    FROM grouped;

    WITH tx AS (
        SELECT
            pt.transaction_type,
            pt.points_amount,
            LEFT(COALESCE(pt.description, ''), 90) AS description,
            pt.created_at
        FROM public.point_transactions pt
        WHERE pt.user_id = p_participant_user_id
          AND pt.points_amount > 0
          AND pt.created_at >= v_challenge.start_date::TIMESTAMPTZ
          AND pt.created_at < (LEAST(v_challenge.end_date, CURRENT_DATE) + 1)::TIMESTAMPTZ
        ORDER BY pt.created_at DESC
        LIMIT 8
    )
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'transaction_type', transaction_type,
            'points', points_amount,
            'description', description,
            'label', CASE
                WHEN NULLIF(description, '') IS NOT NULL THEN description
                WHEN LOWER(COALESCE(transaction_type, '')) LIKE '%daily_log%' THEN 'Daily nutrition target'
                WHEN LOWER(COALESCE(transaction_type, '')) LIKE '%meal_timing%' THEN 'Meal timing bonus'
                WHEN LOWER(COALESCE(transaction_type, '')) LIKE '%meal%' THEN 'Meal logged'
                WHEN LOWER(COALESCE(transaction_type, '')) LIKE '%workout%' THEN 'Workout logged'
                WHEN LOWER(COALESCE(transaction_type, '')) LIKE '%weigh%' THEN 'Weigh-in logged'
                WHEN LOWER(COALESCE(transaction_type, '')) LIKE '%story%'
                  OR LOWER(COALESCE(transaction_type, '')) LIKE '%post%' THEN 'Feed post'
                WHEN LOWER(COALESCE(transaction_type, '')) LIKE '%lesson%'
                  OR LOWER(COALESCE(transaction_type, '')) LIKE '%learning%'
                  OR LOWER(COALESCE(transaction_type, '')) LIKE '%quiz%' THEN 'Learning XP'
                WHEN LOWER(COALESCE(transaction_type, '')) LIKE '%streak%'
                  OR LOWER(COALESCE(transaction_type, '')) LIKE '%milestone%'
                  OR LOWER(COALESCE(transaction_type, '')) LIKE '%bonus%' THEN 'Bonus XP'
                ELSE 'XP earned'
            END,
            'created_at', created_at
        )
        ORDER BY created_at DESC
    ), '[]'::JSONB)
    INTO v_recent
    FROM tx;

    RETURN jsonb_build_object(
        'ok', TRUE,
        'challenge_id', p_challenge_id,
        'participant_user_id', v_participant.user_id,
        'user_name', v_participant.user_name,
        'user_photo', v_participant.user_photo,
        'challenge_type', v_challenge.challenge_type,
        'challenge_points', COALESCE(v_participant.challenge_points, 0),
        'current_points', COALESCE(v_participant.current_points, 0),
        'starting_points', COALESCE(v_participant.starting_points, 0),
        'activity_points', COALESCE(v_activity_points, 0),
        'categories', v_categories,
        'recent', v_recent
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_challenge_participant_point_breakdown(UUID, UUID) TO authenticated;

COMMENT ON FUNCTION public.get_challenge_participant_point_breakdown(UUID, UUID) IS
    'Returns aggregated XP sources for a challenge participant. Viewers must be on the same challenge or be an admin.';
