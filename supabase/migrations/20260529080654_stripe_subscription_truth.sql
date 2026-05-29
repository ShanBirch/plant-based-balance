CREATE SCHEMA IF NOT EXISTS private;

CREATE TABLE IF NOT EXISTS public.stripe_subscription_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    email TEXT,
    email_key TEXT,
    stripe_customer_id TEXT NOT NULL,
    stripe_subscription_id TEXT NOT NULL,
    stripe_price_id TEXT,
    subscription_status TEXT NOT NULL,
    subscription_plan TEXT,
    current_period_end TIMESTAMPTZ,
    cancel_at_period_end BOOLEAN DEFAULT FALSE,
    latest_invoice_id TEXT,
    latest_payment_intent_id TEXT,
    last_event_id TEXT,
    last_event_type TEXT,
    raw_summary JSONB DEFAULT jsonb_build_object(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (stripe_subscription_id)
);

CREATE INDEX IF NOT EXISTS idx_stripe_subscription_links_user_id
    ON public.stripe_subscription_links(user_id);

CREATE INDEX IF NOT EXISTS idx_stripe_subscription_links_email_key
    ON public.stripe_subscription_links(email_key);

CREATE INDEX IF NOT EXISTS idx_stripe_subscription_links_customer
    ON public.stripe_subscription_links(stripe_customer_id);

ALTER TABLE public.stripe_subscription_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view stripe subscription links" ON public.stripe_subscription_links;
CREATE POLICY "Admins can view stripe subscription links"
    ON public.stripe_subscription_links
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.admin_users
            WHERE admin_users.user_id = auth.uid()
        )
    );

GRANT SELECT ON public.stripe_subscription_links TO authenticated;

DROP TRIGGER IF EXISTS trg_stripe_subscription_links_updated_at ON public.stripe_subscription_links;
CREATE TRIGGER trg_stripe_subscription_links_updated_at
    BEFORE UPDATE ON public.stripe_subscription_links
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION private.apply_stripe_subscription_link_to_user()
RETURNS TRIGGER AS $$
DECLARE
    subscription_record RECORD;
BEGIN
    IF NEW.email IS NULL OR length(trim(NEW.email)) = 0 THEN
        RETURN NEW;
    END IF;

    SELECT *
    INTO subscription_record
    FROM public.stripe_subscription_links
    WHERE email_key = lower(trim(NEW.email))
      AND subscription_status IN ('active', 'trialing')
    ORDER BY updated_at DESC
    LIMIT 1;

    IF FOUND THEN
        NEW.stripe_customer_id := subscription_record.stripe_customer_id;
        NEW.subscription_status := subscription_record.subscription_status;
        NEW.subscription_plan := COALESCE(subscription_record.subscription_plan, NEW.subscription_plan);

    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private;

REVOKE ALL ON FUNCTION private.apply_stripe_subscription_link_to_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.apply_stripe_subscription_link_to_user() FROM anon;
REVOKE ALL ON FUNCTION private.apply_stripe_subscription_link_to_user() FROM authenticated;

DROP TRIGGER IF EXISTS trigger_apply_stripe_subscription_link_to_user ON public.users;
CREATE TRIGGER trigger_apply_stripe_subscription_link_to_user
    BEFORE INSERT OR UPDATE OF email ON public.users
    FOR EACH ROW EXECUTE FUNCTION private.apply_stripe_subscription_link_to_user();

CREATE OR REPLACE FUNCTION private.attach_stripe_subscription_link_to_user()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.email IS NULL OR length(trim(NEW.email)) = 0 THEN
        RETURN NEW;
    END IF;

    UPDATE public.stripe_subscription_links
    SET user_id = NEW.id,
        updated_at = NOW()
    WHERE email_key = lower(trim(NEW.email))
      AND subscription_status IN ('active', 'trialing')
      AND user_id IS DISTINCT FROM NEW.id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private;

REVOKE ALL ON FUNCTION private.attach_stripe_subscription_link_to_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.attach_stripe_subscription_link_to_user() FROM anon;
REVOKE ALL ON FUNCTION private.attach_stripe_subscription_link_to_user() FROM authenticated;

DROP TRIGGER IF EXISTS trigger_attach_stripe_subscription_link_to_user ON public.users;
CREATE TRIGGER trigger_attach_stripe_subscription_link_to_user
    AFTER INSERT OR UPDATE OF email ON public.users
    FOR EACH ROW EXECUTE FUNCTION private.attach_stripe_subscription_link_to_user();
