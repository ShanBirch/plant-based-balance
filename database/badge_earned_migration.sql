-- Badge Earned — server-side badge ledger + coach alert type
--
-- Adds:
--   1. public.user_badges — persistent record of every badge a user has earned.
--      Client (dashboard-script-15.js) mirrors this to localStorage for fast
--      UI, but the server ledger is source of truth and survives a storage
--      wipe / new device, so we never re-fire a coach alert for a badge the
--      client has already earned on another device.
--
--   2. 'badge_earned' alert type on coach_alerts, so the AI-drafted
--      congratulations shows up in the admin dashboard feed + Shannon's
--      lockscreen notifications.
--
-- Idempotent — safe to re-run.

-- 1. user_badges ledger ----------------------------------------------------

CREATE TABLE IF NOT EXISTS public.user_badges (
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    badge_id TEXT NOT NULL,
    earned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, badge_id)
);

CREATE INDEX IF NOT EXISTS idx_user_badges_user ON public.user_badges(user_id, earned_at DESC);

ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own badges" ON public.user_badges;
CREATE POLICY "Users can view own badges"
    ON public.user_badges FOR SELECT
    USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can view all badges" ON public.user_badges;
CREATE POLICY "Admins can view all badges"
    ON public.user_badges FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()));

-- Inserts are done by the badge-earned-alert Netlify function using the
-- service role key, which bypasses RLS.
DROP POLICY IF EXISTS "Service role can insert badges" ON public.user_badges;
CREATE POLICY "Service role can insert badges"
    ON public.user_badges FOR INSERT
    WITH CHECK (true);


-- 2. Add 'badge_earned' to coach_alerts.alert_type check -------------------

ALTER TABLE public.coach_alerts DROP CONSTRAINT IF EXISTS coach_alerts_alert_type_check;

ALTER TABLE public.coach_alerts
    ADD CONSTRAINT coach_alerts_alert_type_check CHECK (alert_type IN (
        'inactive_client','unread_message','incoming_dm','challenge_dropout','streak_broken',
        'milestone_near','nutrition_gap','coaching_idea','win_to_celebrate','general_idea',
        'new_user_onboarding','not_in_challenge','level_up','comeback','mood_low','mood_pattern',
        'workout_dropoff','meal_dropoff','wearable_insight','checkin_due',
        'onboarding_welcome','onboarding_day_3','onboarding_day_7','onboarding_day_14','onboarding_day_30',
        'morning_pulse',
        'first_workout',
        'weekly_checkin',
        'weekly_digest',
        'plateau_reassess',
        -- NEW: fired when a client earns one or more milestone badges
        -- (e.g. 10th meal tracked, 30-day streak, level 50). Batched: a
        -- single alert may cover multiple badges earned in the same moment.
        'badge_earned'
    ));
