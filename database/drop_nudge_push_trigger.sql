-- Drop the nudge push notification trigger to prevent double notifications.
-- Push notifications are now sent exclusively by the client-side
-- sendDMNotification() call after inserting a nudge.
-- The database trigger was a safety net but caused every DM to fire
-- two push notifications (one from the client, one from the trigger).
--
-- Run this in your Supabase SQL Editor.

DROP TRIGGER IF EXISTS trigger_nudge_push_notification ON public.nudges;
DROP FUNCTION IF EXISTS notify_nudge_recipient();
