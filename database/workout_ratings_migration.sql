-- Workout Ratings Migration
-- Post-workout feedback system to track how users feel after each session
-- Captures energy level, difficulty, soreness/tightness, mood, and free-text notes
-- Data can be used to adjust training intensity and spot overtraining patterns

-- ============================================
-- 1. Workout Ratings Table
-- ============================================
CREATE TABLE IF NOT EXISTS public.workout_ratings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

    -- Link to the workout or activity that was rated
    workout_date DATE NOT NULL DEFAULT CURRENT_DATE,
    workout_name TEXT,                          -- e.g. "Push Day", "Boxing", "Yoga Flow"
    source_type TEXT NOT NULL DEFAULT 'workout', -- 'workout' or 'activity'
    source_id UUID,                             -- Optional: links to activity_logs.id for activities

    -- Rating questions (1-5 scale)
    overall_feeling INTEGER NOT NULL CHECK (overall_feeling BETWEEN 1 AND 5),    -- 1=Terrible, 5=Amazing
    difficulty INTEGER NOT NULL CHECK (difficulty BETWEEN 1 AND 5),              -- 1=Too Easy, 5=Way Too Hard
    energy_level INTEGER NOT NULL CHECK (energy_level BETWEEN 1 AND 5),          -- 1=Exhausted, 5=Full of Energy

    -- Body feedback
    muscle_soreness INTEGER CHECK (muscle_soreness BETWEEN 1 AND 5),             -- 1=None, 5=Very Sore
    tightness INTEGER CHECK (tightness BETWEEN 1 AND 5),                         -- 1=Loose, 5=Very Tight

    -- Would you change anything?
    would_repeat BOOLEAN DEFAULT true,          -- Would do this workout again as-is
    intensity_preference TEXT CHECK (intensity_preference IN ('lighter', 'perfect', 'harder')),

    -- Free text
    notes TEXT,                                 -- Any additional thoughts

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 2. Indexes
-- ============================================
CREATE INDEX IF NOT EXISTS idx_workout_ratings_user_date
    ON public.workout_ratings (user_id, workout_date DESC);

CREATE INDEX IF NOT EXISTS idx_workout_ratings_user_source
    ON public.workout_ratings (user_id, source_type);

-- ============================================
-- 3. Row Level Security
-- ============================================
ALTER TABLE public.workout_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own workout ratings"
    ON public.workout_ratings FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own workout ratings"
    ON public.workout_ratings FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own workout ratings"
    ON public.workout_ratings FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own workout ratings"
    ON public.workout_ratings FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================
-- 4. Updated_at trigger
-- ============================================
CREATE OR REPLACE FUNCTION update_workout_ratings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_workout_ratings_updated_at
    BEFORE UPDATE ON public.workout_ratings
    FOR EACH ROW
    EXECUTE FUNCTION update_workout_ratings_updated_at();
