-- New User Signup Notification Trigger
--
-- Fires AFTER INSERT on public.users (which is itself populated by the
-- on_auth_user_created trigger on auth.users). Calls the
-- notify-admin-new-signup Netlify function which pushes a lock-screen
-- notification to every admin_users row via send-dm-notification.
--
-- Requires pg_net (already enabled).

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.trigger_notify_admin_new_signup()
RETURNS TRIGGER AS $fn$
DECLARE
    site_url TEXT := 'https://plantbased-balance.org';
    request_id BIGINT;
BEGIN
    IF NEW.id IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT net.http_post(
        url := site_url || '/.netlify/functions/notify-admin-new-signup',
        body := jsonb_build_object(
            'userId', NEW.id::text,
            'name',   NEW.name,
            'email',  NEW.email
        ),
        headers := '{"Content-Type": "application/json"}'::jsonb
    ) INTO request_id;

    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'New user signup notify trigger failed: %', SQLERRM;
        RETURN NEW;
END;
$fn$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_notify_admin_new_signup ON public.users;
CREATE TRIGGER trigger_notify_admin_new_signup
    AFTER INSERT ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_notify_admin_new_signup();

GRANT EXECUTE ON FUNCTION public.trigger_notify_admin_new_signup() TO authenticated;
GRANT EXECUTE ON FUNCTION public.trigger_notify_admin_new_signup() TO service_role;
