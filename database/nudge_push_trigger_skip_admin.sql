-- Patch `notify_nudge_recipient` to skip push when the receiver is admin.
--
-- BEFORE this change: every client-to-admin DM fired TWO pushes to Shannon:
--   1. notify_nudge_recipient → raw-DM push ("client: [message]")
--   2. instant-coach-draft → draft-ready push ("💬 client — draft ready ...")
--
-- AFTER: push for admin receivers is owned entirely by instant-coach-draft,
-- which fires ONE rich notification with an inline-reply action. The old
-- trigger still exists for client-to-client DMs (regular peer messaging
-- has no other push path — `sendDirectMessage()` in dashboard-script-6 does
-- NOT call sendDMNotification).
--
-- The full function is defined in nudge_push_trigger.sql; this file only
-- replaces it with the admin-skipping version. Safe to re-run.
--
-- Applied in production on 2026-04-16 via Supabase REST (exec_sql helper).

CREATE OR REPLACE FUNCTION public.notify_nudge_recipient()
RETURNS TRIGGER AS $fn$
DECLARE
    sender_name TEXT;
    site_url TEXT := 'https://plantbased-balance.org';
    request_id BIGINT;
    receiver_is_admin BOOLEAN;
BEGIN
    -- Skip for admin receivers. instant-coach-draft owns that push.
    SELECT EXISTS (
        SELECT 1 FROM public.admin_users WHERE user_id = NEW.receiver_id
    ) INTO receiver_is_admin;

    IF receiver_is_admin THEN
        RETURN NEW;
    END IF;

    -- (unchanged path: look up sender name, fire raw-DM push via pg_net)
    SELECT COALESCE(u.name, u.email, 'Someone')
    INTO sender_name
    FROM public.users u
    WHERE u.id = NEW.sender_id
    LIMIT 1;

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
        RAISE WARNING 'Push notification trigger failed: %', SQLERRM;
        RETURN NEW;
END;
$fn$ LANGUAGE plpgsql SECURITY DEFINER;
