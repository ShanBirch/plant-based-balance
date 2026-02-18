-- Mood Tracking Migration
-- Daily mood, energy, and stress logs (multiple entries per day supported)

CREATE TABLE IF NOT EXISTS public.mood_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

    -- Timestamp of the log (not just date — multiple per day)
    logged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    log_date DATE NOT NULL,  -- computed from logged_at for easy querying

    -- Core scores (1–10)
    mood_score   INTEGER NOT NULL CHECK (mood_score   BETWEEN 1 AND 10),
    energy_score INTEGER         CHECK (energy_score  BETWEEN 1 AND 10),
    stress_score INTEGER         CHECK (stress_score  BETWEEN 1 AND 10),

    -- Time of day context
    context TEXT CHECK (context IN ('morning', 'afternoon', 'evening', 'night')),

    notes TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mood_logs_user_date ON public.mood_logs(user_id, log_date DESC);
CREATE INDEX IF NOT EXISTS idx_mood_logs_user_time ON public.mood_logs(user_id, logged_at DESC);

ALTER TABLE public.mood_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own mood logs"   ON public.mood_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own mood logs" ON public.mood_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own mood logs" ON public.mood_logs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own mood logs" ON public.mood_logs FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Service role can manage mood logs" ON public.mood_logs FOR ALL USING (auth.role() = 'service_role');

GRANT ALL ON public.mood_logs TO authenticated;
GRANT ALL ON public.mood_logs TO service_role;
