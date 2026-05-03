-- Prevent stale dashboard clients from silently hiding real unread DM alerts.
-- Manual dismiss paths must stamp data.dismissed_via or data.dismiss_reason.

CREATE OR REPLACE FUNCTION public.guard_dm_alert_silent_dismissal()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF OLD.status = 'pending'
       AND NEW.status = 'dismissed'
       AND OLD.alert_type IN ('incoming_dm', 'ig_incoming_dm', 'fb_incoming_dm', 'unread_message')
       AND NOT (
           COALESCE(NEW.data, '{}'::jsonb) ? 'dismissed_via'
           OR COALESCE(NEW.data, '{}'::jsonb) ? 'dismiss_reason'
       )
    THEN
        RAISE EXCEPTION 'Silent dismiss blocked for DM alert %. Reload the admin dashboard and dismiss explicitly.', OLD.id;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_dm_alert_silent_dismissal_on_coach_alerts ON public.coach_alerts;

CREATE TRIGGER guard_dm_alert_silent_dismissal_on_coach_alerts
BEFORE UPDATE OF status ON public.coach_alerts
FOR EACH ROW
EXECUTE FUNCTION public.guard_dm_alert_silent_dismissal();
