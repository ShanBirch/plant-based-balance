-- Push Subscriptions for Admin Notifications
-- Run this in your Supabase SQL Editor

-- Table to store push subscriptions for admin users
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    is_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(endpoint)
);

-- Index for fast admin subscription lookups
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_admin ON public.push_subscriptions(is_admin) WHERE is_admin = TRUE;

-- RLS Policies
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can manage their own subscriptions
CREATE POLICY "Users can insert own subscription"
    ON public.push_subscriptions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own subscription"
    ON public.push_subscriptions FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own subscription"
    ON public.push_subscriptions FOR DELETE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update own subscription"
    ON public.push_subscriptions FOR UPDATE
    USING (auth.uid() = user_id);

-- Service role can read admin subscriptions (for sending notifications)
-- This is handled by using service_role key in the Netlify function

-- Add trigger to update updated_at
CREATE OR REPLACE FUNCTION update_push_subscription_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_push_subscriptions_timestamp
    BEFORE UPDATE ON public.push_subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_push_subscription_timestamp();

-- Grant permissions
GRANT ALL ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;
