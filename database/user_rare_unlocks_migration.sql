-- ============================================================
-- USER RARE UNLOCKS MIGRATION
--
-- Persists each user's unlocked rare skins (e.g. 'optimus' = Robot,
-- 'steve_irwin' = Croc Man, 'ronny', 'cbum', etc.) in Supabase so
-- they survive localStorage resets (WebView purges, cache clears,
-- app reinstalls, device switches).
--
-- Before this table existed, unlocks lived only in
-- localStorage.user_rares_unlocked and would silently disappear
-- when the OS evicted WKWebView storage or a user signed in on
-- another device.
--
-- Run this in the Supabase SQL Editor.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.user_rare_unlocks (
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    rare_id TEXT NOT NULL,
    unlocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, rare_id)
);

CREATE INDEX IF NOT EXISTS idx_user_rare_unlocks_user
    ON public.user_rare_unlocks(user_id);

ALTER TABLE public.user_rare_unlocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own rare unlocks" ON public.user_rare_unlocks;
CREATE POLICY "Users can read own rare unlocks" ON public.user_rare_unlocks
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own rare unlocks" ON public.user_rare_unlocks;
CREATE POLICY "Users can insert own rare unlocks" ON public.user_rare_unlocks
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Deletes are intentionally not permitted from the client: unlocks
-- are permanent rewards. Admins can clean up via service role if
-- ever needed.

GRANT SELECT, INSERT ON public.user_rare_unlocks TO authenticated;
