-- Wrapped Archive Migration (legacy table name)
--
-- Stores one immutable recap snapshot per user and period so users can revisit
-- it without later edits shifting the numbers. New Month Wrapped rows use a
-- YYYY-MM period key in the legacy iso_week text column; older weekly rows remain
-- valid history. The weekly-wrapped-push function now runs on the first day of
-- each Brisbane calendar month.
--
-- `data_snapshot` is the full aggregated payload the client renders from —
-- workouts/minutes/PBs/mood/weight/social/xp/coins/streak + trend-line
-- predictions. See `lib/weekly-wrapped.js` buildWeeklyWrappedData().
--
-- One row per user per recap period. New rows use `iso_week` format 'YYYY-MM'.

CREATE TABLE IF NOT EXISTS public.weekly_wrapped (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

    iso_week TEXT NOT NULL,
    data_snapshot JSONB NOT NULL,

    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    viewed_at TIMESTAMPTZ,
    push_sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE (user_id, iso_week)
);

CREATE INDEX IF NOT EXISTS idx_weekly_wrapped_user_week
    ON public.weekly_wrapped(user_id, iso_week DESC);

CREATE INDEX IF NOT EXISTS idx_weekly_wrapped_unviewed
    ON public.weekly_wrapped(user_id)
    WHERE viewed_at IS NULL;

ALTER TABLE public.weekly_wrapped ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own weekly_wrapped"
    ON public.weekly_wrapped FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update own weekly_wrapped"
    ON public.weekly_wrapped FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage weekly_wrapped"
    ON public.weekly_wrapped FOR ALL
    USING (auth.role() = 'service_role');

GRANT ALL ON public.weekly_wrapped TO authenticated;
GRANT ALL ON public.weekly_wrapped TO service_role;
