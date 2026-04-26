-- ============================================================
-- ADMIN COHORT OVERVIEW
-- Returns every system cohort with its roster + invitation funnel,
-- so the admin dashboard can show them without bypassing RLS.
-- Locked to admin_users by an auth.uid() check inside the function.
-- ============================================================

CREATE OR REPLACE FUNCTION public.admin_get_cohorts()
RETURNS JSONB AS $$
DECLARE
    v_is_admin BOOLEAN;
    v_result JSONB;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()
    ) INTO v_is_admin;

    IF NOT v_is_admin THEN
        RETURN jsonb_build_object('error', 'not_admin');
    END IF;

    SELECT jsonb_agg(cohort_obj ORDER BY status_rank, created_at DESC) INTO v_result
    FROM (
        SELECT
            CASE c.status WHEN 'active' THEN 0 WHEN 'pending' THEN 1 ELSE 2 END AS status_rank,
            c.created_at,
            jsonb_build_object(
                'id', c.id,
                'name', c.name,
                'cohort_type', c.cohort_type,
                'status', c.status,
                'start_date', c.start_date,
                'end_date', c.end_date,
                'duration_days', c.duration_days,
                'min_participants', c.min_participants_to_start,
                'created_at', c.created_at,
                'participants', (
                    SELECT COALESCE(jsonb_agg(
                        jsonb_build_object(
                            'user_id', cp.user_id,
                            'name', u.name,
                            'email', u.email,
                            'profile_photo', u.profile_photo,
                            'accepted_at', cp.accepted_at,
                            'challenge_points', cp.challenge_points
                        ) ORDER BY cp.accepted_at
                    ), '[]'::jsonb)
                    FROM public.challenge_participants cp
                    LEFT JOIN public.users u ON u.id = cp.user_id
                    WHERE cp.challenge_id = c.id AND cp.status = 'accepted'
                ),
                'invitations', (
                    SELECT jsonb_build_object(
                        'total', COALESCE(COUNT(*), 0),
                        'claimed', COALESCE(COUNT(*) FILTER (WHERE ci.claimed_at IS NOT NULL), 0),
                        'unclaimed', COALESCE(COUNT(*) FILTER (WHERE ci.claimed_at IS NULL), 0),
                        'sources', (
                            SELECT COALESCE(jsonb_object_agg(src_key, src_count), '{}'::jsonb)
                            FROM (
                                SELECT COALESCE(source, 'unknown') AS src_key, COUNT(*) AS src_count
                                FROM public.cohort_invitations
                                WHERE cohort_type = c.cohort_type
                                GROUP BY COALESCE(source, 'unknown')
                            ) src
                        )
                    )
                    FROM public.cohort_invitations ci
                    WHERE ci.cohort_type = c.cohort_type
                )
            ) AS cohort_obj
        FROM public.challenges c
        WHERE c.is_system_cohort = TRUE
    ) ranked;

    RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.admin_get_cohorts() TO authenticated;

COMMENT ON FUNCTION public.admin_get_cohorts() IS
    'Returns every system cohort with roster + invitation funnel for the admin dashboard. Caller must be in admin_users.';
