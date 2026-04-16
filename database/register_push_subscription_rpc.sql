-- register_push_subscription RPC
--
-- Safely register a device's push endpoint under the currently authenticated
-- user, taking over the endpoint if it was previously attached to a different
-- user on the same device (typical case: same phone, multiple admin accounts
-- — Shannon's personal gmail account + the Coach Shannon account).
--
-- Why we need this: the direct client-side upsert
--
--     supabase.from('push_subscriptions').upsert(..., { onConflict: 'endpoint' })
--
-- silently fails under RLS when the target row exists and its user_id does not
-- match auth.uid(). Supabase applies the UPDATE policy BEFORE the upsert
-- resolves the conflict, and the policy requires auth.uid() = user_id on the
-- EXISTING row (which is now the OLD user). So the takeover is rejected,
-- no INSERT runs (the row exists), and no new subscription ever lands for
-- the newly-signed-in user. This manifests in production as
-- "Found 0 subscriptions for user ..." from send-dm-notification.
--
-- This function runs SECURITY DEFINER so it can:
--   1. Delete any orphan row for this endpoint belonging to a DIFFERENT user
--   2. Insert (or update) the row under auth.uid()
--   3. Clean up any OTHER endpoints the caller owns (stale tokens from
--      previous installs / web push leftovers)
--
-- All in one atomic, auth-scoped call. Returns {ok, user_id, endpoint}.
--
-- Applied 2026-04-16. Safe to re-run.

CREATE OR REPLACE FUNCTION public.register_push_subscription(
    p_endpoint text,
    p_token text,
    p_p256dh text DEFAULT 'native'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    uid uuid := auth.uid();
BEGIN
    IF uid IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
    END IF;

    -- Evict any stale owner of this endpoint (same device, previous user)
    DELETE FROM public.push_subscriptions
    WHERE endpoint = p_endpoint
      AND user_id IS DISTINCT FROM uid;

    -- Insert or refresh the caller's row
    INSERT INTO public.push_subscriptions (user_id, endpoint, p256dh, auth, is_admin, updated_at)
    VALUES (uid, p_endpoint, p_p256dh, p_token, false, NOW())
    ON CONFLICT (endpoint) DO UPDATE
    SET user_id    = EXCLUDED.user_id,
        auth       = EXCLUDED.auth,
        p256dh     = EXCLUDED.p256dh,
        updated_at = NOW();

    -- Drop any other subscriptions this user owns — FCM tokens change on
    -- reinstall; web push from a WebView can't deliver when the app is
    -- closed. We only keep the current endpoint.
    DELETE FROM public.push_subscriptions
    WHERE user_id = uid
      AND endpoint <> p_endpoint;

    RETURN jsonb_build_object(
        'ok', true,
        'user_id', uid::text,
        'endpoint', p_endpoint
    );
END;
$$;

REVOKE ALL ON FUNCTION public.register_push_subscription(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_push_subscription(text, text, text) TO authenticated, service_role;
