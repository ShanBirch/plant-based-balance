-- Keep challenge scoring aligned with the app's Brisbane-local challenge day.
-- Without this, early AEST activity on the start date falls before UTC midnight
-- and date-based sources can disappear until later in the day.

DO $$
DECLARE
  v_def TEXT;
  v_patched TEXT;
BEGIN
  SELECT pg_get_functiondef('public.get_xp_challenge_source_breakdown(uuid,uuid)'::REGPROCEDURE)
  INTO v_def;

  v_patched := v_def;
  v_patched := replace(
    v_patched,
    'LEAST(c.end_date::DATE, CURRENT_DATE) AS end_date',
    'LEAST(c.end_date::DATE, (NOW() AT TIME ZONE ''Australia/Brisbane'')::DATE) AS end_date'
  );
  v_patched := replace(
    v_patched,
    'c.start_date::TIMESTAMPTZ',
    '(c.start_date::TIMESTAMP AT TIME ZONE ''Australia/Brisbane'')'
  );
  v_patched := replace(
    v_patched,
    '(c.end_date + 1)::TIMESTAMPTZ',
    '((c.end_date + 1)::TIMESTAMP AT TIME ZONE ''Australia/Brisbane'')'
  );

  IF v_patched = v_def THEN
    RAISE EXCEPTION 'Could not patch get_xp_challenge_source_breakdown Brisbane date window';
  END IF;

  EXECUTE v_patched;
END $$;

DO $$
DECLARE
  v_def TEXT;
  v_patched TEXT;
BEGIN
  SELECT pg_get_functiondef('public.update_challenge_participant_points(uuid)'::REGPROCEDURE)
  INTO v_def;

  v_patched := v_def;
  v_patched := replace(
    v_patched,
    'LEAST(participant_record.end_date, CURRENT_DATE)',
    'LEAST(participant_record.end_date, (NOW() AT TIME ZONE ''Australia/Brisbane'')::DATE)'
  );
  v_patched := replace(
    v_patched,
    'CURRENT_DATE - participant_record.accepted_at::DATE',
    '(NOW() AT TIME ZONE ''Australia/Brisbane'')::DATE - participant_record.accepted_at::DATE'
  );

  IF v_patched = v_def THEN
    RAISE EXCEPTION 'Could not patch update_challenge_participant_points Brisbane current date';
  END IF;

  EXECUTE v_patched;
END $$;

CREATE OR REPLACE FUNCTION public.get_active_challenge_xp_multiplier(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_today DATE := (NOW() AT TIME ZONE 'Australia/Brisbane')::DATE;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.challenge_participants cp
    JOIN public.challenges c ON c.id = cp.challenge_id
    WHERE cp.user_id = p_user_id
      AND cp.status = 'accepted'
      AND c.status = 'active'
      AND (c.start_date IS NULL OR c.start_date <= v_today)
      AND (c.end_date IS NULL OR c.end_date >= v_today)
  ) THEN
    RETURN 2;
  END IF;

  RETURN 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_active_challenge_points(p_limit INTEGER DEFAULT 500)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_row     RECORD;
  v_limit   INTEGER := LEAST(GREATEST(COALESCE(p_limit, 500), 1), 2000);
  v_today   DATE := (NOW() AT TIME ZONE 'Australia/Brisbane')::DATE;
  v_updated INTEGER := 0;
  v_failed  INTEGER := 0;
  v_errors  JSONB := '[]'::JSONB;
BEGIN
  FOR v_row IN
    SELECT
      cp.user_id,
      COUNT(*)::INTEGER AS active_challenge_count
    FROM public.challenge_participants cp
    JOIN public.challenges c ON c.id = cp.challenge_id
    WHERE cp.status = 'accepted'
      AND c.status = 'active'
      AND c.start_date <= v_today
      AND c.end_date >= v_today
    GROUP BY cp.user_id
    ORDER BY MIN(cp.accepted_at) NULLS LAST, cp.user_id
    LIMIT v_limit
  LOOP
    BEGIN
      PERFORM public.update_challenge_participant_points(v_row.user_id);
      v_updated := v_updated + 1;
    EXCEPTION WHEN OTHERS THEN
      v_failed := v_failed + 1;
      v_errors := v_errors || jsonb_build_object(
        'user_id', v_row.user_id,
        'error', SQLERRM
      );
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'updated', v_updated,
    'failed', v_failed,
    'errors', v_errors
  );
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_active_challenge_points(INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_active_challenge_points(INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_active_challenge_xp_multiplier(UUID) TO authenticated, service_role;
