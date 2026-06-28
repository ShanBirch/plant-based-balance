CREATE OR REPLACE FUNCTION public.get_next_cohort_status(
    p_cohort_type TEXT DEFAULT 'transform_30'
)
RETURNS TABLE (
    challenge_id UUID,
    challenge_name TEXT,
    status TEXT,
    participant_count INT,
    min_participants INT,
    spots_remaining INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
    v_min_participants INT := 15;
BEGIN
    RETURN QUERY
    WITH next_cohort AS (
        SELECT
            c.id,
            c.name,
            c.status,
            COALESCE(c.min_participants_to_start, v_min_participants)::INT AS needed
        FROM public.challenges c
        WHERE c.is_system_cohort = TRUE
          AND c.cohort_type = p_cohort_type
          AND c.status = 'pending'
          AND (
              SELECT COUNT(*)::INT
              FROM public.challenge_participants cp
              WHERE cp.challenge_id = c.id
                AND cp.status IN ('accepted', 'pending_acceptance')
          ) < COALESCE(c.min_participants_to_start, v_min_participants)
        ORDER BY c.start_date ASC, c.id ASC
        LIMIT 1
    ),
    counted AS (
        SELECT
            nc.id,
            nc.name,
            nc.status,
            nc.needed,
            (
                SELECT COUNT(*)::INT
                FROM public.challenge_participants cp
                WHERE cp.challenge_id = nc.id
                  AND cp.status IN ('accepted', 'pending_acceptance')
            ) AS joined
        FROM next_cohort nc
    )
    SELECT
        counted.id,
        counted.name,
        counted.status,
        counted.joined,
        counted.needed,
        GREATEST(0, counted.needed - counted.joined)::INT
    FROM counted;

    IF NOT FOUND THEN
        RETURN QUERY
        SELECT
            NULL::UUID,
            '30-Day Transformation Challenge'::TEXT,
            'pending'::TEXT,
            0::INT,
            v_min_participants,
            v_min_participants;
    END IF;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_next_cohort_status(TEXT) TO authenticated;

COMMENT ON FUNCTION public.get_next_cohort_status(TEXT) IS
'Returns the next pending system cohort count for the dashboard invite card.';
