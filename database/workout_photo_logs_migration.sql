-- =====================================================
-- Workout Photo Logs Migration
-- Stores workout photos with AI verification data
-- =====================================================

-- Create workout_photo_logs table
CREATE TABLE IF NOT EXISTS workout_photo_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    workout_date DATE NOT NULL DEFAULT CURRENT_DATE,
    workout_time TIME NOT NULL DEFAULT CURRENT_TIME,

    -- Photo storage
    photo_url TEXT NOT NULL,
    storage_path TEXT,

    -- AI Analysis Results
    is_workout_photo BOOLEAN DEFAULT false,
    workout_type TEXT, -- 'gym', 'home', 'outdoor', 'yoga', 'cardio', 'strength', 'sports', 'unknown'
    detected_elements JSONB DEFAULT '[]'::jsonb, -- Array of detected workout elements
    suspicious_indicators JSONB DEFAULT '[]'::jsonb, -- Any suspicious elements found
    ai_confidence TEXT CHECK (ai_confidence IN ('high', 'medium', 'low')),
    ai_notes TEXT, -- AI explanation of assessment
    analysis_timestamp TIMESTAMPTZ,

    -- Points eligibility
    points_eligible BOOLEAN DEFAULT false,
    points_awarded INTEGER DEFAULT 0,

    -- Anti-cheat
    photo_hash TEXT, -- SHA-256 hash for duplicate detection

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_workout_photo_logs_user_id ON workout_photo_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_workout_photo_logs_date ON workout_photo_logs(workout_date);
CREATE INDEX IF NOT EXISTS idx_workout_photo_logs_user_date ON workout_photo_logs(user_id, workout_date);
CREATE INDEX IF NOT EXISTS idx_workout_photo_logs_hash ON workout_photo_logs(photo_hash);

-- Enable Row Level Security
ALTER TABLE workout_photo_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can only see their own workout photo logs
CREATE POLICY "Users can view own workout photo logs"
    ON workout_photo_logs
    FOR SELECT
    USING (auth.uid() = user_id);

-- Users can insert their own workout photo logs
CREATE POLICY "Users can insert own workout photo logs"
    ON workout_photo_logs
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own workout photo logs
CREATE POLICY "Users can update own workout photo logs"
    ON workout_photo_logs
    FOR UPDATE
    USING (auth.uid() = user_id);

-- Users can delete their own workout photo logs
CREATE POLICY "Users can delete own workout photo logs"
    ON workout_photo_logs
    FOR DELETE
    USING (auth.uid() = user_id);

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_workout_photo_logs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS trigger_workout_photo_logs_updated_at ON workout_photo_logs;
CREATE TRIGGER trigger_workout_photo_logs_updated_at
    BEFORE UPDATE ON workout_photo_logs
    FOR EACH ROW
    EXECUTE FUNCTION update_workout_photo_logs_updated_at();

-- Comment on table
COMMENT ON TABLE workout_photo_logs IS 'Stores workout photos with Gemini AI verification data for points eligibility';
