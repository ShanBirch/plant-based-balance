-- Admin RPCs to surface orphan signups (users not in any cohort) and to
-- manually force-enrol them. Used by the Cohorts tab in admin-dashboard.html.

CREATE OR REPLACE FUNCTION public.admin_get_recent_signups(p_days INT DEFAULT 7)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_is_admin BOOLEAN;
    v_result JSONB;
BEGIN
    SELECT EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()) INTO v_is_admin;
    IF NOT v_is_admin THEN RETURN jsonb_build_object('error', 'not_admin'); END IF;

    SELECT COALESCE(jsonb_agg(row_obj ORDER BY created_at DESC), '[]'::jsonb) INTO v_result
    FROM (
      SELECT
        u.created_at,
        jsonb_build_object(
          'id', u.id,
          'email', u.email,
          'name', u.name,
          'profile_photo', u.profile_photo,
          'onboarding_complete', u.onboarding_complete,
          'created_at', u.created_at,
          'in_plant_based', EXISTS (
            SELECT 1 FROM public.challenge_participants cp
            JOIN public.challenges c ON c.id = cp.challenge_id
            WHERE cp.user_id = u.id AND cp.status = 'accepted'
              AND c.is_system_cohort = TRUE AND c.cohort_type = 'plant_based_30'),
          'in_transform', EXISTS (
            SELECT 1 FROM public.challenge_participants cp
            JOIN public.challenges c ON c.id = cp.challenge_id
            WHERE cp.user_id = u.id AND cp.status = 'accepted'
              AND c.is_system_cohort = TRUE AND c.cohort_type = 'transform_30'),
          'has_invitation', EXISTS (
            SELECT 1 FROM public.cohort_invitations ci
            WHERE LOWER(ci.email) = LOWER(u.email))
        ) AS row_obj
      FROM public.users u
      WHERE u.created_at > NOW() - (p_days || ' days')::INTERVAL
        AND COALESCE(u.is_test_account, FALSE) = FALSE
        AND COALESCE(u.is_transferred_client, FALSE) = FALSE
    ) inner_q;

    RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_recent_signups(INT) TO authenticated;

-- Admin-only wrapper around auto_enroll_user_in_cohort. Lets the Cohorts tab
-- one-click enrol a user who slipped through (e.g. signed up during a deploy
-- window before the auto-enrol RPC was ready, or got skipped due to a bug).
CREATE OR REPLACE FUNCTION public.admin_force_enroll_user(
    p_user_id UUID,
    p_cohort_type TEXT DEFAULT 'plant_based_30'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_is_admin BOOLEAN;
    v_result JSONB;
BEGIN
    SELECT EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()) INTO v_is_admin;
    IF NOT v_is_admin THEN RETURN jsonb_build_object('error', 'not_admin'); END IF;

    SELECT auto_enroll_user_in_cohort(p_user_id, p_cohort_type) INTO v_result;
    RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_force_enroll_user(UUID, TEXT) TO authenticated;
