-- Client Memory auto-send toggle
--
-- Adds a per-(coach, client) autonomy switch. When enabled, any drafted
-- coach reply for that pair is auto-sent to the client instead of landing
-- as a coach_draft_ready notification for Shannon to approve.
--
-- Default FALSE — existing clients stay on the approve-gate path. Shannon
-- opts specific clients in once he trusts the voice match.
--
-- Consumed by: all functions that produce coach_draft_ready alerts
-- (instant-coach-draft, pb-celebration-draft, onboarding-welcome-draft,
-- onboarding-scheduled-scan, morning-pulse-scan, weekly-checkin-scan,
-- plateau-detection-scan, first-workout-celebration).
--
-- Run via exec_sql RPC. Idempotent.

ALTER TABLE public.client_memory
    ADD COLUMN IF NOT EXISTS auto_send_enabled BOOLEAN NOT NULL DEFAULT FALSE;

-- Verify:
--   SELECT column_name, data_type, column_default, is_nullable
--   FROM information_schema.columns
--   WHERE table_name = 'client_memory' AND column_name = 'auto_send_enabled';
