-- Day-0 Onboarding Welcome Trigger
--
-- Fires the moment a `coach_clients` row is INSERTed with status='active'.
-- Calls the `onboarding-welcome-draft` Netlify function which:
--   1. Loads client snapshot + client_memory + onboarding quiz facts
--   2. Drafts a warm Day-0 welcome in Shannon's voice (Vertex v7 + memory block)
--   3. Queues a coach_alerts row with alert_type='onboarding_welcome'
--   4. Fires a coach_draft_ready push so Shannon reviews on the lockscreen
--
-- Mirrors the pg_net + SECURITY DEFINER + EXCEPTION-WHEN-OTHERS pattern of
-- instant_coach_draft_trigger.sql. Fire-and-forget — never blocks the INSERT.
--
-- Requires pg_net (already enabled on this project).

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.trigger_coach_clients_onboarding_welcome()
RETURNS TRIGGER AS $fn$
DECLARE
    site_url TEXT := 'https://plantbased-balance.org';
    request_id BIGINT;
BEGIN
    -- Only fire for active assignments (skip paused/ended)
    IF NEW.status IS DISTINCT FROM 'active' THEN
        RETURN NEW;
    END IF;

    -- Defensive: never fire if coach_id/client_id somehow null
    IF NEW.coach_id IS NULL OR NEW.client_id IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT net.http_post(
        url := site_url || '/.netlify/functions/onboarding-welcome-draft',
        body := jsonb_build_object(
            'coachId',    NEW.coach_id::text,
            'clientId',   NEW.client_id::text,
            'assignedAt', COALESCE(NEW.assigned_at, now())
        ),
        headers := '{"Content-Type": "application/json"}'::jsonb
    ) INTO request_id;

    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Onboarding welcome trigger failed: %', SQLERRM;
        RETURN NEW;
END;
$fn$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_coach_clients_onboarding_welcome ON public.coach_clients;
CREATE TRIGGER trigger_coach_clients_onboarding_welcome
    AFTER INSERT ON public.coach_clients
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_coach_clients_onboarding_welcome();

GRANT EXECUTE ON FUNCTION public.trigger_coach_clients_onboarding_welcome() TO authenticated;
GRANT EXECUTE ON FUNCTION public.trigger_coach_clients_onboarding_welcome() TO service_role;

-- Verify:
--   SELECT tgname FROM pg_trigger WHERE tgrelid = 'public.coach_clients'::regclass AND NOT tgisinternal;
