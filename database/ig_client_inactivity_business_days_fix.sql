-- Count client inactivity in Australia/Brisbane business days.
-- Saturday and Sunday neither advance the 3/7/14-day cadence nor satisfy
-- the three-business-day minimum gap between later touches.

CREATE OR REPLACE FUNCTION public.ig_add_business_days(
    p_start TIMESTAMPTZ,
    p_business_days INTEGER
)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
DECLARE
    v_local TIMESTAMP := p_start AT TIME ZONE 'Australia/Brisbane';
    v_added INTEGER := 0;
BEGIN
    IF p_start IS NULL OR p_business_days IS NULL OR p_business_days < 0 THEN
        RAISE EXCEPTION 'start and a non-negative business-day count are required';
    END IF;

    WHILE v_added < p_business_days LOOP
        v_local := v_local + INTERVAL '1 day';
        IF EXTRACT(DOW FROM v_local)::INTEGER NOT IN (0, 6) THEN
            v_added := v_added + 1;
        END IF;
    END LOOP;

    RETURN v_local AT TIME ZONE 'Australia/Brisbane';
END;
$$;

CREATE OR REPLACE FUNCTION public.ig_business_days_between(
    p_start TIMESTAMPTZ,
    p_end TIMESTAMPTZ
)
RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
    SELECT CASE
        WHEN p_start IS NULL OR p_end IS NULL OR p_end <= p_start THEN 0
        ELSE COALESCE((
            SELECT COUNT(*)::INTEGER
            FROM GENERATE_SERIES(
                (p_start AT TIME ZONE 'Australia/Brisbane')::DATE + 1,
                (p_end AT TIME ZONE 'Australia/Brisbane')::DATE,
                INTERVAL '1 day'
            ) AS d(day_value)
            WHERE EXTRACT(DOW FROM d.day_value)::INTEGER NOT IN (0, 6)
        ), 0)
    END;
$$;

REVOKE ALL ON FUNCTION public.ig_add_business_days(TIMESTAMPTZ, INTEGER)
    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ig_business_days_between(TIMESTAMPTZ, TIMESTAMPTZ)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ig_add_business_days(TIMESTAMPTZ, INTEGER)
    TO service_role;
GRANT EXECUTE ON FUNCTION public.ig_business_days_between(TIMESTAMPTZ, TIMESTAMPTZ)
    TO service_role;

DO $$
DECLARE
    v_definition TEXT;
BEGIN
    v_definition := pg_get_functiondef(
        'public.refresh_ig_client_inactivity_checkins(integer,timestamp with time zone)'::REGPROCEDURE
    );

    IF POSITION('h.inactivity_anchor_at + INTERVAL ''3 days''' IN v_definition) = 0
       OR POSITION('h.inactivity_anchor_at + INTERVAL ''7 days''' IN v_definition) = 0
       OR POSITION('h.inactivity_anchor_at + INTERVAL ''14 days''' IN v_definition) = 0
       OR POSITION('h.last_touch_at + INTERVAL ''72 hours''' IN v_definition) = 0
       OR POSITION('p_now < s.inactivity_anchor_at + INTERVAL ''7 days''' IN v_definition) = 0 THEN
        RAISE EXCEPTION 'unexpected client inactivity refresh definition; business-day patch not applied';
    END IF;

    v_definition := REPLACE(
        v_definition,
        'h.inactivity_anchor_at + INTERVAL ''3 days''',
        'public.ig_add_business_days(h.inactivity_anchor_at, 3)'
    );
    v_definition := REPLACE(
        v_definition,
        'h.inactivity_anchor_at + INTERVAL ''7 days''',
        'public.ig_add_business_days(h.inactivity_anchor_at, 7)'
    );
    v_definition := REPLACE(
        v_definition,
        'h.inactivity_anchor_at + INTERVAL ''14 days''',
        'public.ig_add_business_days(h.inactivity_anchor_at, 14)'
    );
    v_definition := REPLACE(
        v_definition,
        'h.last_touch_at + INTERVAL ''72 hours''',
        'public.ig_add_business_days(h.last_touch_at, 3)'
    );
    v_definition := REPLACE(
        v_definition,
        'p_now < s.inactivity_anchor_at + INTERVAL ''7 days''',
        'p_now < public.ig_add_business_days(s.inactivity_anchor_at, 7)'
    );
    v_definition := REPLACE(
        v_definition,
        'FLOOR(EXTRACT(EPOCH FROM (p_now - v_candidate.inactivity_anchor_at)) / 86400)::INTEGER',
        'public.ig_business_days_between(v_candidate.inactivity_anchor_at, p_now)'
    );
    v_definition := REPLACE(
        v_definition,
        '''weekend_policy'', ''defer_to_monday_0900_australia_brisbane''',
        '''day_count_basis'', ''business_days_australia_brisbane'', ''weekend_policy'', ''weekends_do_not_advance_count'''
    );

    EXECUTE v_definition;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_ig_client_inactivity_checkins(INTEGER, TIMESTAMPTZ)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_ig_client_inactivity_checkins(INTEGER, TIMESTAMPTZ)
    TO service_role;
