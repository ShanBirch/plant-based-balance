-- coach_alerts: scheduled-send support
--
-- Lets Shannon tap "Later" on an incoming-DM draft notification, pick a delay
-- (5/15/30/60/120 min etc.), and have the reply auto-fire from the server when
-- the time comes. Server-side scheduling so it survives reboots / phone-off /
-- app-uninstall, and works identically for in-app DMs, Instagram, and Messenger.
--
-- New status values:
--   'scheduled' — reply queued; scheduled-coach-reply-worker fires when due
--   'canceled'  — reply was scheduled but canceled (manually OR superseded by
--                 a new client message before the timer fired)
--
-- New columns on coach_alerts:
--   scheduled_for         TIMESTAMPTZ — when the worker should fire this alert
--   scheduled_reply_text  TEXT        — the (possibly edited) text to send when
--                                       the timer fires; mirrors what
--                                       send-coach-reply expects as replyText
--   scheduled_at          TIMESTAMPTZ — when Shannon hit Schedule (analytics)
--
-- The existing data JSONB carries cancel_reason, scheduled_via, etc. so we
-- don't add narrow columns for those.
--
-- Safe to re-run.

ALTER TABLE public.coach_alerts
    ADD COLUMN IF NOT EXISTS scheduled_for        TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS scheduled_reply_text TEXT,
    ADD COLUMN IF NOT EXISTS scheduled_at         TIMESTAMPTZ;

-- Replace the status CHECK constraint so it accepts the new values. Listing
-- every prior value too — replacing with anything less than the existing
-- whitelist would violate live rows.
ALTER TABLE public.coach_alerts
    DROP CONSTRAINT IF EXISTS coach_alerts_status_check;

ALTER TABLE public.coach_alerts
    ADD CONSTRAINT coach_alerts_status_check CHECK (status IN (
        'pending',
        'sent',
        'dismissed',
        'snoozed',
        'scheduled',     -- queued for delayed send (NEW)
        'canceled'       -- scheduled then canceled (NEW)
    ));

-- Index for the worker: find scheduled alerts whose fire time has arrived,
-- ordered oldest-first so back-pressure doesn't matter.
CREATE INDEX IF NOT EXISTS idx_coach_alerts_scheduled_due
    ON public.coach_alerts (scheduled_for)
    WHERE status = 'scheduled';

-- Index for the cancel-on-new-message lookup in instant-coach-draft.js +
-- ig-instant-draft.js: find any scheduled alert for a (coach, client) pair.
CREATE INDEX IF NOT EXISTS idx_coach_alerts_scheduled_per_client
    ON public.coach_alerts (coach_id, client_id)
    WHERE status = 'scheduled';

COMMENT ON COLUMN public.coach_alerts.scheduled_for IS
    'When scheduled-coach-reply-worker should fire this alert. NULL unless status=scheduled.';
COMMENT ON COLUMN public.coach_alerts.scheduled_reply_text IS
    'The (possibly edited) reply text the worker will send. Captured at schedule time so a later draft regen does not change what gets sent.';
COMMENT ON COLUMN public.coach_alerts.scheduled_at IS
    'Timestamp Shannon tapped Send later. NULL unless status has ever been scheduled.';
