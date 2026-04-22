-- ============================================================
-- $500 XP GIVEAWAY — ENTRIES TABLE
--
-- Stores one row per user who taps "Enter" on the $500 XP
-- Giveaway card. The modal reads this table back to display a
-- live list of every name that has signed up.
--
-- Run this in the Supabase SQL Editor.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.xp_giveaway_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
    user_name TEXT,
    entered_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_xp_giveaway_entries_entered_at
    ON public.xp_giveaway_entries(entered_at DESC);

ALTER TABLE public.xp_giveaway_entries ENABLE ROW LEVEL SECURITY;

-- Any signed-in user can see the list of entrants (names only).
DROP POLICY IF EXISTS "Authenticated can read xp giveaway entries"
    ON public.xp_giveaway_entries;
CREATE POLICY "Authenticated can read xp giveaway entries"
    ON public.xp_giveaway_entries
    FOR SELECT USING (auth.role() = 'authenticated');

-- A user can only insert their own entry.
DROP POLICY IF EXISTS "Users can insert their own xp giveaway entry"
    ON public.xp_giveaway_entries;
CREATE POLICY "Users can insert their own xp giveaway entry"
    ON public.xp_giveaway_entries
    FOR INSERT WITH CHECK (auth.uid() = user_id);
