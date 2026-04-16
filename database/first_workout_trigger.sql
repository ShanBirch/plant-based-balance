-- First Workout Celebration Trigger
--
-- Fires when a user's very first row lands in public.workouts. Calls the
-- first-workout-celebration Netlify function which drafts a warm congrats
-- message in Shannon's voice and queues it as a coach_alerts row.
--
-- Because finishWorkout() saves N sets in a single statement (one row per
-- set × exercise), this trigger fires once per row. We avoid N-way duplicate
-- alerts via a self-filter: only the row whose INSERT sees zero OTHER rows
-- for this user (i.e. the first-committed row in the batch) fires pg_net.
-- Rows 2..N see row 1 already present and early-return.
--
-- Additional guard: skip if the user has no active coach_clients row. A
-- client who logs workouts before ever being assigned gets no alert;
-- onboarding_welcome covers the coach-assign moment separately.
--
-- Requires pg_net (already enabled).

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.trigger_first_workout_celebration()
RETURNS TRIGGER AS $fn$
DECLARE
    site_url TEXT := 'https://plantbased-balance.org';
    prior_rows INTEGER;
    has_coach BOOLEAN;
    request_id BIGINT;
BEGIN
    IF NEW.user_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- First-row-in-batch self-filter: only the row that sees no OTHER rows
    -- for this user fires. During a multi-row INSERT the trigger runs once per
    -- row in commit order; by the time rows 2..N run, row 1 is already visible.
    SELECT count(*) INTO prior_rows
    FROM public.workouts
    WHERE user_id = NEW.user_id AND id <> NEW.id;

    IF prior_rows > 0 THEN
        RETURN NEW;
    END IF;

    -- Only fire if the user has an active coach assignment
    SELECT EXISTS (
        SELECT 1 FROM public.coach_clients
        WHERE client_id = NEW.user_id AND status = 'active'
    ) INTO has_coach;

    IF NOT has_coach THEN
        RETURN NEW;
    END IF;

    SELECT net.http_post(
        url := site_url || '/.netlify/functions/first-workout-celebration',
        body := jsonb_build_object(
            'clientId',       NEW.user_id::text,
            'templateName',   NEW.template_name,
            'exerciseName',   NEW.exercise_name,
            'workoutDate',    NEW.workout_date,
            'insertedAt',     NEW.created_at
        ),
        headers := '{"Content-Type": "application/json"}'::jsonb
    ) INTO request_id;

    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'First workout celebration trigger failed: %', SQLERRM;
        RETURN NEW;
END;
$fn$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_first_workout_celebration ON public.workouts;
CREATE TRIGGER trigger_first_workout_celebration
    AFTER INSERT ON public.workouts
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_first_workout_celebration();

GRANT EXECUTE ON FUNCTION public.trigger_first_workout_celebration() TO authenticated;
GRANT EXECUTE ON FUNCTION public.trigger_first_workout_celebration() TO service_role;
