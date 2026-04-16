-- PB Celebration Trigger
--
-- Fires the moment a new row lands in `pb_history`. The pb_history table is
-- only written when `checkAndUpdatePBs()` in lib/supabase.js detects a genuine
-- new/improved PB (see lib/supabase.js:3027-3086), so every INSERT here is a
-- real celebration moment — no duplicate filtering needed at the trigger level.
--
-- Mirrors the shape of `instant_coach_draft_trigger.sql` (same pg_net +
-- SECURITY DEFINER + EXCEPTION-WHEN-OTHERS pattern). The function is
-- intentionally thin — all the AI/alert/push logic lives in the Netlify
-- function `pb-celebration-draft`.
--
-- Requires the pg_net extension (already enabled on this Supabase project).
-- Run via exec_sql RPC or paste in Supabase SQL Editor.

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.trigger_pb_celebration_draft()
RETURNS TRIGGER AS $fn$
DECLARE
    site_url TEXT := 'https://plantbased-balance.org';
    request_id BIGINT;
BEGIN
    -- Fire the Netlify function asynchronously. The function handles dedup
    -- (against ai-client-monitor's batch output), Vertex draft, alert insert,
    -- and the coach_draft_ready push notification.
    SELECT net.http_post(
        url := site_url || '/.netlify/functions/pb-celebration-draft',
        body := jsonb_build_object(
            'historyId',      NEW.id::text,
            'userId',         NEW.user_id::text,
            'exerciseName',   NEW.exercise_name,
            'pbType',         NEW.pb_type,
            'newValue',       NEW.new_value,
            'newWeightKg',    NEW.new_weight_kg,
            'newReps',        NEW.new_reps,
            'previousValue',  NEW.previous_value,
            'improvement',    NEW.improvement,
            'achievedAt',     NEW.achieved_at
        ),
        headers := '{"Content-Type": "application/json"}'::jsonb
    ) INTO request_id;

    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Never block the PB insert if the trigger fails. The 2-hour batch
        -- ai-client-monitor scan will still pick it up as a fallback.
        RAISE WARNING 'PB celebration draft trigger failed: %', SQLERRM;
        RETURN NEW;
END;
$fn$ LANGUAGE plpgsql SECURITY DEFINER;

-- Install the trigger (INSERT only — we never re-celebrate the same history row)
DROP TRIGGER IF EXISTS trigger_pb_celebration_draft ON public.pb_history;
CREATE TRIGGER trigger_pb_celebration_draft
    AFTER INSERT ON public.pb_history
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_pb_celebration_draft();

GRANT EXECUTE ON FUNCTION public.trigger_pb_celebration_draft() TO authenticated;
GRANT EXECUTE ON FUNCTION public.trigger_pb_celebration_draft() TO service_role;

-- Verify installation:
--   SELECT tgname FROM pg_trigger WHERE tgrelid = 'public.pb_history'::regclass;
-- Should include: trigger_pb_celebration_draft
