-- Coach's Workouts This Week RPC
-- Returns this week's workout sets for the hardcoded coach user (Shannon).
-- SECURITY DEFINER so any authenticated user can read the coach's sessions
-- without needing RLS policies that expose all users' workouts.

CREATE OR REPLACE FUNCTION public.get_coach_workouts_this_week()
RETURNS TABLE (
    workout_date DATE,
    exercise_name TEXT,
    set_number INTEGER,
    reps TEXT,
    weight_kg TEXT,
    time_duration TEXT,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    coach_id UUID;
    week_start DATE;
BEGIN
    -- Hardcoded coach lookup by email
    SELECT id INTO coach_id
    FROM auth.users
    WHERE email = 'shannonbirch@cocospersonaltraining.com'
    LIMIT 1;

    IF coach_id IS NULL THEN
        RETURN;
    END IF;

    -- Monday as start of week (ISO)
    week_start := date_trunc('week', CURRENT_DATE)::DATE;

    RETURN QUERY
    SELECT
        w.workout_date,
        w.exercise_name,
        w.set_number,
        w.reps,
        w.weight_kg,
        w.time_duration,
        w.created_at
    FROM public.workouts w
    WHERE w.user_id = coach_id
      AND w.workout_type = 'history'
      AND w.workout_date >= week_start
      AND w.workout_date <= CURRENT_DATE
    ORDER BY w.created_at ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_coach_workouts_this_week() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_coach_workouts_this_week() TO anon;
