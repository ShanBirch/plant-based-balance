-- Phone Usage Tracking Migration
-- Stores daily screen time and per-app usage data (manually entered or auto-synced on Android)

-- ============================================
-- PHONE USAGE LOGS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.phone_usage_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    log_date DATE NOT NULL,

    -- Daily totals
    total_screen_time_minutes INTEGER NOT NULL DEFAULT 0, -- total screen-on time for the day
    pickups INTEGER,                                      -- number of times phone was picked up
    notifications_received INTEGER,                       -- number of notifications received
    first_pickup_time TIME,                               -- time of first phone use (for morning habit tracking)

    -- Per-app breakdown: array of {app_name, category, minutes, opens}
    -- category values: 'social', 'entertainment', 'productivity', 'health', 'communication', 'games', 'other'
    -- Example: [{"app_name": "Instagram", "category": "social", "minutes": 45, "opens": 12}]
    app_usage JSONB DEFAULT '[]'::jsonb,

    -- How was this data entered?
    -- 'manual'       - user typed it in from their iOS Screen Time / Android Digital Wellbeing
    -- 'android_auto' - auto-synced via native Capacitor plugin (Android only, future feature)
    source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'android_auto')),

    notes TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(user_id, log_date)
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_phone_usage_user_date ON public.phone_usage_logs(user_id, log_date DESC);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE public.phone_usage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own phone usage" ON public.phone_usage_logs
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own phone usage" ON public.phone_usage_logs
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own phone usage" ON public.phone_usage_logs
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own phone usage" ON public.phone_usage_logs
    FOR DELETE USING (auth.uid() = user_id);

-- Service role access for edge functions
CREATE POLICY "Service role can manage phone usage" ON public.phone_usage_logs
    FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- PERMISSIONS
-- ============================================

GRANT ALL ON public.phone_usage_logs TO authenticated;
GRANT ALL ON public.phone_usage_logs TO service_role;
