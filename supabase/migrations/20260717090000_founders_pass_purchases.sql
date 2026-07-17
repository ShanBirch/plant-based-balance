CREATE TABLE IF NOT EXISTS public.founders_pass_purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stripe_checkout_session_id TEXT NOT NULL UNIQUE,
    stripe_payment_intent_id TEXT,
    stripe_customer_id TEXT,
    email TEXT NOT NULL,
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    amount_minor INTEGER NOT NULL DEFAULT 9900 CHECK (amount_minor >= 0),
    currency TEXT NOT NULL DEFAULT 'aud',
    status TEXT NOT NULL DEFAULT 'paid' CHECK (status IN ('paid', 'refunded', 'disputed')),
    purchased_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    claimed_at TIMESTAMPTZ,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_founders_pass_purchases_email
    ON public.founders_pass_purchases (LOWER(email));

CREATE INDEX IF NOT EXISTS idx_founders_pass_purchases_user_id
    ON public.founders_pass_purchases (user_id);

ALTER TABLE public.founders_pass_purchases ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.founders_pass_purchases FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.founders_pass_purchases TO service_role;

DROP TRIGGER IF EXISTS update_founders_pass_purchases_updated_at ON public.founders_pass_purchases;
CREATE TRIGGER update_founders_pass_purchases_updated_at
    BEFORE UPDATE ON public.founders_pass_purchases
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.founders_pass_purchases IS
    'Stripe-backed one-time Balance Vegan Fitness Founders Pass purchases. Service-role only.';
