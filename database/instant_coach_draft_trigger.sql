-- Instant Coach Draft Trigger
--
-- Fires the moment a client DM is inserted into `nudges` where the receiver
-- is an admin/coach. Calls the `instant-coach-draft` Netlify function which:
--   1. Generates an AI draft reply in Shannon's voice (fine-tuned Vertex v7)
--   2. Queues it as a coach_alerts row (type='incoming_dm', priority='high')
--   3. Sends Shannon a push with the original message + the drafted reply
--
-- This is separate from `notify_nudge_recipient` (DM push to the client's
-- device) — that one was dropped in `drop_nudge_push_trigger.sql` because
-- push notifications are now handled by the client-side sendDMNotification()
-- call. This new trigger does NOT send a push to the receiver; it only
-- triggers draft generation for admin recipients.
--
-- Requires the pg_net extension (enabled by default on Supabase).
-- Run this in the Supabase SQL Editor.

-- 1. Ensure pg_net is enabled
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- 2. Trigger function: only acts when the receiver is an admin and the
-- sender is NOT an admin (so coach-to-coach chatter doesn't spawn drafts).
CREATE OR REPLACE FUNCTION public.trigger_instant_coach_draft()
RETURNS TRIGGER AS $$
DECLARE
    site_url TEXT := 'https://plantbased-balance.org';
    receiver_is_admin BOOLEAN := FALSE;
    sender_is_admin BOOLEAN := FALSE;
    sender_name TEXT := NULL;
    game_url TEXT := NULL;
    request_id BIGINT;
BEGIN
    -- Cheap early exit: skip if sender and receiver are the same (shouldn't
    -- happen with DMs but defensive)
    IF NEW.sender_id = NEW.receiver_id THEN
        RETURN NEW;
    END IF;

    -- Check receiver is an admin/coach
    SELECT EXISTS (
        SELECT 1 FROM public.admin_users WHERE user_id = NEW.receiver_id
    ) INTO receiver_is_admin;

    IF NOT receiver_is_admin THEN
        RETURN NEW; -- Not a client-to-coach DM; nothing to do
    END IF;

    -- Check sender is NOT an admin (coach-to-coach chatter doesn't need drafts)
    SELECT EXISTS (
        SELECT 1 FROM public.admin_users WHERE user_id = NEW.sender_id
    ) INTO sender_is_admin;

    IF sender_is_admin THEN
        RETURN NEW; -- Admin-to-admin DM; no draft needed
    END IF;

    -- Game nudges are useful notifications, but they are not coach DMs.
    -- Keep the buzz, skip AI drafting and the Unread DM coach_alert queue.
    IF NEW.nudge_type = 'game_invite' THEN
        SELECT COALESCE(name, 'Balance player')
        FROM public.users
        WHERE id = NEW.sender_id
        LIMIT 1
        INTO sender_name;
        sender_name := COALESCE(sender_name, 'Balance player');

        game_url := '/dashboard.html?action=game_invite&sender_id=' || NEW.sender_id::text;
        IF NEW.reference_id IS NOT NULL THEN
            game_url := game_url || '&match_id=' || NEW.reference_id::text;
        END IF;

        SELECT net.http_post(
            url := site_url || '/.netlify/functions/send-dm-notification',
            body := jsonb_build_object(
                'recipientId', NEW.receiver_id::text,
                'senderId',    NEW.sender_id::text,
                'senderName',  sender_name || ' - game turn',
                'messageText', NEW.message,
                'type',        'game_invite',
                'url',         game_url
            ),
            headers := '{"Content-Type": "application/json"}'::jsonb
        ) INTO request_id;

        RETURN NEW;
    END IF;

    -- Fire the Netlify function asynchronously via pg_net. The function handles
    -- dedup, simple-reply detection, Vertex draft generation, alert creation,
    -- and the draft-ready push notification.
    SELECT net.http_post(
        url := site_url || '/.netlify/functions/instant-coach-draft',
        body := jsonb_build_object(
            'nudgeId',     NEW.id::text,
            'senderId',    NEW.sender_id::text,
            'receiverId',  NEW.receiver_id::text,
            'messageText', NEW.message
        ),
        headers := '{"Content-Type": "application/json"}'::jsonb
    ) INTO request_id;

    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Never block the insert if the trigger fails. The 2-hour batch
        -- monitor will still pick the message up as a fallback.
        RAISE WARNING 'Instant coach draft trigger failed: %', SQLERRM;
        RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Install the trigger (INSERT only; replies don't need redrafting)
DROP TRIGGER IF EXISTS trigger_instant_coach_draft ON public.nudges;
CREATE TRIGGER trigger_instant_coach_draft
    AFTER INSERT ON public.nudges
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_instant_coach_draft();

-- 4. Grant execute
GRANT EXECUTE ON FUNCTION public.trigger_instant_coach_draft() TO authenticated;
GRANT EXECUTE ON FUNCTION public.trigger_instant_coach_draft() TO service_role;

-- Verify installation:
--   SELECT tgname FROM pg_trigger WHERE tgrelid = 'public.nudges'::regclass;
-- Should include: trigger_instant_coach_draft
