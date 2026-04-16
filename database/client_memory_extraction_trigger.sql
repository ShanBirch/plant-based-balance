-- Client Memory Extraction Trigger
--
-- Fires each time a coach_alerts row transitions from status='pending' to
-- status='sent' AND data has a sent_message. Calls the
-- `extract-client-memory` Netlify function which loads the conversation turn,
-- asks Gemini 2.0 Flash to pull out any NEW facts about the client, and
-- upserts them into `client_memory`.
--
-- Mirrors the pg_net + SECURITY DEFINER + EXCEPTION-WHEN-OTHERS pattern of
-- instant_coach_draft_trigger.sql. Fire-and-forget — never blocks the UPDATE.
--
-- Only fires for alert_types where an extraction makes sense ('incoming_dm',
-- 'win_to_celebrate'). Batch-monitor proactive ideas are skipped because they
-- aren't conversation turns.
--
-- Requires pg_net (already enabled).

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.trigger_extract_client_memory()
RETURNS TRIGGER AS $fn$
DECLARE
    site_url TEXT := 'https://plantbased-balance.org';
    request_id BIGINT;
BEGIN
    -- Only fire on pending -> sent transition with a real sent_message
    IF NOT (OLD.status = 'pending' AND NEW.status = 'sent') THEN
        RETURN NEW;
    END IF;
    IF NOT (NEW.data ? 'sent_message') THEN
        RETURN NEW;
    END IF;
    IF NEW.alert_type NOT IN ('incoming_dm', 'win_to_celebrate') THEN
        RETURN NEW;
    END IF;
    IF NEW.coach_id IS NULL OR NEW.client_id IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT net.http_post(
        url := site_url || '/.netlify/functions/extract-client-memory',
        body := jsonb_build_object(
            'alertId', NEW.id::text
        ),
        headers := '{"Content-Type": "application/json"}'::jsonb
    ) INTO request_id;

    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Client memory extraction trigger failed: %', SQLERRM;
        RETURN NEW;
END;
$fn$ LANGUAGE plpgsql SECURITY DEFINER;

-- Install (AFTER UPDATE only — we only care about the status flip)
DROP TRIGGER IF EXISTS trigger_extract_client_memory ON public.coach_alerts;
CREATE TRIGGER trigger_extract_client_memory
    AFTER UPDATE ON public.coach_alerts
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_extract_client_memory();

GRANT EXECUTE ON FUNCTION public.trigger_extract_client_memory() TO authenticated;
GRANT EXECUTE ON FUNCTION public.trigger_extract_client_memory() TO service_role;

-- Verify:
--   SELECT tgname FROM pg_trigger WHERE tgrelid = 'public.coach_alerts'::regclass AND NOT tgisinternal;
-- Should include: trigger_extract_client_memory
