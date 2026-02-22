-- Automatic push notification trigger for the nudges table.
-- When a new DM is inserted, this trigger calls the Netlify function
-- to send a push notification to the recipient.
--
-- This is a safety net: even if the sender's client fails to call
-- sendDMNotification(), the database trigger ensures the push is sent.
--
-- Requires the pg_net extension (enabled by default on Supabase).
-- Run this in the Supabase SQL Editor.

-- 1. Enable pg_net if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- 2. Create the trigger function
CREATE OR REPLACE FUNCTION notify_nudge_recipient()
RETURNS TRIGGER AS $$
DECLARE
    sender_name TEXT;
    site_url TEXT := 'https://plantbased-balance.org';
    request_id BIGINT;
BEGIN
    -- Look up sender name
    SELECT COALESCE(u.name, u.email, 'Someone')
    INTO sender_name
    FROM public.users u
    WHERE u.id = NEW.sender_id
    LIMIT 1;

    -- Call the Netlify function via pg_net to send push notification
    SELECT net.http_post(
        url := site_url || '/.netlify/functions/send-dm-notification',
        body := json_build_object(
            'recipientId', NEW.receiver_id::text,
            'senderId', NEW.sender_id::text,
            'senderName', COALESCE(sender_name, 'Someone'),
            'messageText', LEFT(NEW.message, 200)
        )::jsonb,
        headers := '{"Content-Type": "application/json"}'::jsonb
    ) INTO request_id;

    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Don't block the insert if notification fails
        RAISE WARNING 'Push notification trigger failed: %', SQLERRM;
        RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Create the trigger (only on INSERT, not UPDATE)
DROP TRIGGER IF EXISTS trigger_nudge_push_notification ON public.nudges;
CREATE TRIGGER trigger_nudge_push_notification
    AFTER INSERT ON public.nudges
    FOR EACH ROW
    EXECUTE FUNCTION notify_nudge_recipient();

-- 4. Grant execute permission
GRANT EXECUTE ON FUNCTION notify_nudge_recipient() TO authenticated;
GRANT EXECUTE ON FUNCTION notify_nudge_recipient() TO service_role;
