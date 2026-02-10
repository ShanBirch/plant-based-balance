-- Activity Log Migration
-- Supports logging non-gym activities (fitness classes, boxing, tennis, swimming, running, cycling, walking, yoga, dance, etc.)
-- XP only awarded for activities with verifiable venue photos

-- ============================================
-- 1. Activity Logs Table
-- ============================================
CREATE TABLE IF NOT EXISTS public.activity_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

    -- Activity details
    activity_type TEXT NOT NULL,          -- boxing, tennis, swimming, running, cycling, walking, yoga, dance, fitness_class, hiking, pilates, martial_arts, other
    activity_label TEXT,                  -- Custom label e.g. "Morning Boxing Session", "Barry's Bootcamp"
    duration_minutes INTEGER NOT NULL,
    intensity TEXT DEFAULT 'moderate' CHECK (intensity IN ('light', 'moderate', 'vigorous')),

    -- Calorie estimation
    estimated_calories INTEGER,           -- Calculated from MET * weight * duration
    met_value NUMERIC(4,2),              -- MET value used for calculation

    -- Photo & verification
    photo_url TEXT,                       -- Photo URL (base64 or storage)
    photo_verified BOOLEAN DEFAULT false,
    venue_type TEXT,                      -- AI-detected: indoor_gym, studio, court, pool, track, treadmill, outdoor_park, street, home, unknown
    venue_verifiable BOOLEAN DEFAULT false, -- true = photo proves user was at fitness venue
    ai_confidence TEXT,                   -- high, medium, low
    detected_elements JSONB DEFAULT '[]'::jsonb,

    -- XP
    xp_eligible BOOLEAN DEFAULT false,   -- Based on venue_verifiable + activity rules
    xp_awarded BOOLEAN DEFAULT false,

    -- Notes
    notes TEXT,

    -- Activity date
    activity_date DATE NOT NULL DEFAULT CURRENT_DATE,

    -- Feed sharing
    shared_to_feed BOOLEAN DEFAULT false,
    story_id UUID,                        -- Reference to stories table if shared

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 2. Indexes
-- ============================================
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_date
    ON public.activity_logs (user_id, activity_date DESC);

CREATE INDEX IF NOT EXISTS idx_activity_logs_user_type
    ON public.activity_logs (user_id, activity_type);

-- ============================================
-- 3. Row Level Security
-- ============================================
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Users can view their own activity logs
CREATE POLICY "Users can view own activity logs"
    ON public.activity_logs FOR SELECT
    USING (auth.uid() = user_id);

-- Users can insert their own activity logs
CREATE POLICY "Users can insert own activity logs"
    ON public.activity_logs FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own activity logs
CREATE POLICY "Users can update own activity logs"
    ON public.activity_logs FOR UPDATE
    USING (auth.uid() = user_id);

-- Users can delete their own activity logs
CREATE POLICY "Users can delete own activity logs"
    ON public.activity_logs FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================
-- 4. Updated_at trigger
-- ============================================
CREATE OR REPLACE FUNCTION update_activity_logs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_activity_logs_updated_at
    BEFORE UPDATE ON public.activity_logs
    FOR EACH ROW
    EXECUTE FUNCTION update_activity_logs_updated_at();
