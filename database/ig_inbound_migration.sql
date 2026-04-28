-- Instagram inbound conversation storage for the ManyChat coach pipeline.
--
-- Mirrors the in-app coach flow (instant-coach-draft → coach_alerts →
-- send-coach-reply via push RemoteInput) but for Instagram leads who don't
-- have a users.id yet. ManyChat hits netlify/functions/manychat-inbound with
-- an inbound DM, that function upserts ig_threads + ig_messages and fires
-- ig-instant-draft, which writes a coach_alerts row with alert_type
-- 'ig_incoming_dm' and data.channel='instagram'. send-coach-reply then
-- detects the channel and routes the outbound through send-ig-reply (which
-- POSTs to ManyChat) instead of the in-app nudges path.
--
-- Run this in the Supabase SQL Editor BEFORE deploying the new functions.
-- Safe to re-run.

CREATE TABLE IF NOT EXISTS public.ig_threads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- ManyChat subscriber id — one per IG conversation. Unique so the
    -- inbound webhook can find-or-create idempotently.
    subscriber_id TEXT NOT NULL UNIQUE,

    -- Which coach owns this lead (Shannon for now). Nullable so the
    -- webhook can fall back to "first admin" when ManyChat hasn't been
    -- configured to send a coach hint.
    coach_id UUID REFERENCES public.users(id) ON DELETE SET NULL,

    -- IG profile fields populated from ManyChat custom fields. Best-effort
    -- — null when ManyChat hasn't surfaced them yet.
    ig_username TEXT,
    profile_name TEXT,
    profile_pic_url TEXT,

    -- Funnel stage. Lets the prompt branch later without a schema change.
    -- Defaults to 'new' for cold inbounds.
    lead_stage TEXT NOT NULL DEFAULT 'new' CHECK (lead_stage IN (
        'new',           -- cold inbound, no prior context
        'qualifying',    -- a few back-and-forth, gauging fit
        'invited',       -- pitched the wellness challenge / app invite
        'in_app',        -- signed up — keep IG thread synced with coaching
        'churned'        -- went cold / explicitly opted out
    )),

    -- Set once the lead signs up to the app. Joins to client_memory so the
    -- IG draft producer can reuse relationship facts after conversion.
    linked_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,

    last_inbound_at TIMESTAMPTZ,
    last_outbound_at TIMESTAMPTZ,

    -- Whatever ManyChat hands us about the subscriber (custom fields, tags,
    -- referrer ad name, etc). Free-form so we don't migrate every time we
    -- wire a new ManyChat field.
    custom_data JSONB DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ig_threads_coach_recent
    ON public.ig_threads(coach_id, last_inbound_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_ig_threads_linked_user
    ON public.ig_threads(linked_user_id) WHERE linked_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ig_threads_lead_stage
    ON public.ig_threads(lead_stage);

CREATE TABLE IF NOT EXISTS public.ig_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id UUID NOT NULL REFERENCES public.ig_threads(id) ON DELETE CASCADE,

    direction TEXT NOT NULL CHECK (direction IN ('in', 'out')),
    text TEXT NOT NULL,

    -- For inbound: the ManyChat message id when supplied — used for
    -- idempotent re-delivery handling. Unique partial index below.
    manychat_message_id TEXT,

    -- For outbound: the coach_alert that produced this message, so the
    -- voice-match feedback loop can score whether Shannon edited the draft.
    alert_id UUID REFERENCES public.coach_alerts(id) ON DELETE SET NULL,

    -- How the message landed:
    --   inbound:  'manychat'
    --   outbound: 'inline_reply'   (Shannon hit Send on the push)
    --             | 'auto_send'    (auto_send_enabled — IG variant TBD)
    --             | 'manual_compose' (admin dashboard typed it manually)
    source TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ig_messages_thread_recent
    ON public.ig_messages(thread_id, created_at DESC);

-- ManyChat re-delivers events when the webhook 5xx's. Dedup by
-- manychat_message_id so retries don't double-store the inbound (and the
-- ig-instant-draft idempotency_key keeps the alert single-fire too).
CREATE UNIQUE INDEX IF NOT EXISTS idx_ig_messages_manychat_id_unique
    ON public.ig_messages(manychat_message_id)
    WHERE manychat_message_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.set_ig_threads_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ig_threads_updated_at ON public.ig_threads;
CREATE TRIGGER trg_ig_threads_updated_at
    BEFORE UPDATE ON public.ig_threads
    FOR EACH ROW
    EXECUTE FUNCTION public.set_ig_threads_updated_at();

-- RLS — admins only (mirrors coach_alerts).
ALTER TABLE public.ig_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ig_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read ig_threads" ON public.ig_threads;
CREATE POLICY "Admins can read ig_threads"
    ON public.ig_threads FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Admins can update ig_threads" ON public.ig_threads;
CREATE POLICY "Admins can update ig_threads"
    ON public.ig_threads FOR UPDATE
    USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Service role can insert ig_threads" ON public.ig_threads;
CREATE POLICY "Service role can insert ig_threads"
    ON public.ig_threads FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can read ig_messages" ON public.ig_messages;
CREATE POLICY "Admins can read ig_messages"
    ON public.ig_messages FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Service role can insert ig_messages" ON public.ig_messages;
CREATE POLICY "Service role can insert ig_messages"
    ON public.ig_messages FOR INSERT WITH CHECK (true);
