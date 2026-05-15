-- Challenge progress refresh
--
-- Seeded challenge users can have future-dated point_transactions so their
-- leaderboard score rises gradually. The XP breakdown must release those rows
-- by exact timestamp, and a scheduled function should refresh participant rows
-- without waiting for someone to open the leaderboard.

DO $$
DECLARE
    v_def  TEXT;
    v_next TEXT;
BEGIN
    SELECT pg_get_functiondef('public.get_xp_challenge_source_breakdown(uuid,uuid)'::REGPROCEDURE)
    INTO v_def;

    IF POSITION('pt.created_at <= now()' IN v_def) = 0 THEN
        v_next := REPLACE(
            v_def,
            'AND pt.created_at < (c.end_date + 1)::TIMESTAMPTZ',
            'AND pt.created_at <= now()
          AND pt.created_at < (c.end_date + 1)::TIMESTAMPTZ'
        );

        IF v_next = v_def THEN
            RAISE EXCEPTION 'Could not patch get_xp_challenge_source_breakdown timestamp gate';
        END IF;

        EXECUTE v_next;
    END IF;
END $$;

CREATE OR REPLACE FUNCTION public.refresh_active_challenge_points(p_limit INTEGER DEFAULT 500)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_row     RECORD;
    v_limit   INTEGER := LEAST(GREATEST(COALESCE(p_limit, 500), 1), 2000);
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
          AND c.start_date <= CURRENT_DATE
          AND c.end_date >= CURRENT_DATE
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
