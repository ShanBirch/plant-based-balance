-- =====================================================
-- Cardio Sessions Migration
-- Stores cardio workout sessions with activity-specific data
-- =====================================================

-- Create cardio_sessions table
CREATE TABLE IF NOT EXISTS cardio_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Session date and time
    session_date DATE NOT NULL DEFAULT CURRENT_DATE,
    session_time TIME DEFAULT CURRENT_TIME,

    -- Activity details
    activity_type TEXT NOT NULL, -- 'running', 'swimming', 'cycling', 'boxing', 'rowing', 'jump_rope', 'stair_climbing', 'elliptical', 'hiking', 'dancing', 'kickboxing', 'spinning', 'walking', 'hiit', 'other'
    activity_name TEXT, -- Custom name or specific workout (e.g., "Morning Run", "Boxing Class")

    -- Duration and distance
    duration_minutes INTEGER NOT NULL, -- Total duration in minutes
    distance_km DECIMAL(10, 2), -- Distance in kilometers (nullable for activities like boxing)
    distance_unit TEXT DEFAULT 'km', -- 'km' or 'miles' for user preference

    -- Intensity and effort
    intensity_level TEXT CHECK (intensity_level IN ('low', 'moderate', 'high', 'very_high')),
    perceived_effort INTEGER CHECK (perceived_effort >= 1 AND perceived_effort <= 10), -- RPE scale 1-10

    -- Calorie and heart rate data (optional)
    calories_burned INTEGER,
    avg_heart_rate INTEGER,
    max_heart_rate INTEGER,

    -- Activity-specific data stored as JSON
    activity_data JSONB DEFAULT '{}'::jsonb, -- For storing activity-specific metrics
    -- Examples:
    -- Running: { "pace_per_km": "5:30", "elevation_gain": 150, "splits": [...] }
    -- Swimming: { "laps": 40, "pool_length": 25, "stroke_type": "freestyle" }
    -- Boxing: { "rounds": 12, "round_duration": 3, "rest_duration": 1 }
    -- Cycling: { "avg_speed": 25, "max_speed": 45, "elevation_gain": 500 }

    -- Location (optional)
    location_name TEXT, -- "Central Park", "Local Gym", "Home"
    is_outdoor BOOLEAN DEFAULT false,

    -- Notes and tags
    notes TEXT,
    tags TEXT[] DEFAULT '{}', -- Array of tags like ['morning', 'fasted', 'interval']

    -- Photo verification (links to workout_photo_logs)
    photo_log_id UUID REFERENCES workout_photo_logs(id),

    -- Points tracking
    points_eligible BOOLEAN DEFAULT true,
    points_awarded INTEGER DEFAULT 0,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_cardio_sessions_user_id ON cardio_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_cardio_sessions_date ON cardio_sessions(session_date);
CREATE INDEX IF NOT EXISTS idx_cardio_sessions_user_date ON cardio_sessions(user_id, session_date);
CREATE INDEX IF NOT EXISTS idx_cardio_sessions_activity ON cardio_sessions(user_id, activity_type);

-- Enable Row Level Security
ALTER TABLE cardio_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can only see their own cardio sessions
CREATE POLICY "Users can view own cardio sessions"
    ON cardio_sessions
    FOR SELECT
    USING (auth.uid() = user_id);

-- Users can insert their own cardio sessions
CREATE POLICY "Users can insert own cardio sessions"
    ON cardio_sessions
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own cardio sessions
CREATE POLICY "Users can update own cardio sessions"
    ON cardio_sessions
    FOR UPDATE
    USING (auth.uid() = user_id);

-- Users can delete their own cardio sessions
CREATE POLICY "Users can delete own cardio sessions"
    ON cardio_sessions
    FOR DELETE
    USING (auth.uid() = user_id);

-- Admin policies
CREATE POLICY "Admins can view all cardio sessions"
    ON cardio_sessions
    FOR SELECT
    USING (
        EXISTS (SELECT 1 FROM public.admin_users WHERE admin_users.user_id = auth.uid())
    );

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_cardio_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS trigger_cardio_sessions_updated_at ON cardio_sessions;
CREATE TRIGGER trigger_cardio_sessions_updated_at
    BEFORE UPDATE ON cardio_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_cardio_sessions_updated_at();

-- =====================================================
-- Helper Functions for Cardio Sessions
-- =====================================================

-- Get cardio session stats for a user
CREATE OR REPLACE FUNCTION get_cardio_stats(p_user_id UUID)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'total_sessions', COUNT(*),
        'total_duration_minutes', COALESCE(SUM(duration_minutes), 0),
        'total_distance_km', COALESCE(SUM(distance_km), 0),
        'total_calories', COALESCE(SUM(calories_burned), 0),
        'avg_duration', COALESCE(AVG(duration_minutes), 0),
        'avg_intensity', MODE() WITHIN GROUP (ORDER BY intensity_level),
        'favorite_activity', (
            SELECT activity_type
            FROM cardio_sessions
            WHERE user_id = p_user_id
            GROUP BY activity_type
            ORDER BY COUNT(*) DESC
            LIMIT 1
        ),
        'activities_breakdown', (
            SELECT json_agg(activity_stats)
            FROM (
                SELECT json_build_object(
                    'activity', activity_type,
                    'count', COUNT(*),
                    'total_duration', SUM(duration_minutes),
                    'total_distance', SUM(distance_km)
                ) as activity_stats
                FROM cardio_sessions
                WHERE user_id = p_user_id
                GROUP BY activity_type
                ORDER BY COUNT(*) DESC
            ) AS activities
        )
    )
    INTO result
    FROM cardio_sessions
    WHERE user_id = p_user_id;

    IF result IS NULL THEN
        result := json_build_object(
            'total_sessions', 0,
            'total_duration_minutes', 0,
            'total_distance_km', 0,
            'total_calories', 0,
            'avg_duration', 0,
            'avg_intensity', NULL,
            'favorite_activity', NULL,
            'activities_breakdown', '[]'::json
        );
    END IF;

    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get cardio sessions for a date range
CREATE OR REPLACE FUNCTION get_cardio_sessions_range(
    p_user_id UUID,
    p_start_date DATE,
    p_end_date DATE
)
RETURNS SETOF cardio_sessions AS $$
BEGIN
    RETURN QUERY
    SELECT *
    FROM cardio_sessions
    WHERE user_id = p_user_id
      AND session_date >= p_start_date
      AND session_date <= p_end_date
    ORDER BY session_date DESC, session_time DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get cardio streak (consecutive days with cardio sessions)
CREATE OR REPLACE FUNCTION get_cardio_streak(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
    streak INTEGER := 0;
    check_date DATE := CURRENT_DATE;
    session_exists BOOLEAN;
BEGIN
    LOOP
        SELECT EXISTS(
            SELECT 1 FROM cardio_sessions
            WHERE user_id = p_user_id
              AND session_date = check_date
        ) INTO session_exists;

        IF session_exists THEN
            streak := streak + 1;
            check_date := check_date - INTERVAL '1 day';
        ELSE
            EXIT;
        END IF;
    END LOOP;

    RETURN streak;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- Add cardio streak tracking to user_points table
-- =====================================================
ALTER TABLE public.user_points
    ADD COLUMN IF NOT EXISTS cardio_streak INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS longest_cardio_streak INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS last_cardio_date DATE,
    ADD COLUMN IF NOT EXISTS total_cardio_logged INTEGER DEFAULT 0;

-- Update get_user_points_summary to include cardio stats
CREATE OR REPLACE FUNCTION get_user_points_summary(p_user_id UUID)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'current_points', COALESCE(current_points, 0),
        'lifetime_points', COALESCE(lifetime_points, 0),
        'redeemed_points', COALESCE(redeemed_points, 0),
        'current_streak', COALESCE(current_streak, 0),
        'longest_streak', COALESCE(longest_streak, 0),
        'meal_streak', COALESCE(meal_streak, 0),
        'workout_streak', COALESCE(workout_streak, 0),
        'cardio_streak', COALESCE(cardio_streak, 0),
        'longest_cardio_streak', COALESCE(longest_cardio_streak, 0),
        'total_meals_logged', COALESCE(total_meals_logged, 0),
        'total_workouts_logged', COALESCE(total_workouts_logged, 0),
        'total_cardio_logged', COALESCE(total_cardio_logged, 0),
        'weeks_redeemed', COALESCE(weeks_redeemed, 0),
        'last_post_date', last_post_date,
        'last_cardio_date', last_cardio_date
    )
    INTO result
    FROM public.user_points
    WHERE user_id = p_user_id;

    IF result IS NULL THEN
        result := json_build_object(
            'current_points', 0,
            'lifetime_points', 0,
            'redeemed_points', 0,
            'current_streak', 0,
            'longest_streak', 0,
            'meal_streak', 0,
            'workout_streak', 0,
            'cardio_streak', 0,
            'longest_cardio_streak', 0,
            'total_meals_logged', 0,
            'total_workouts_logged', 0,
            'total_cardio_logged', 0,
            'weeks_redeemed', 0,
            'last_post_date', NULL,
            'last_cardio_date', NULL
        );
    END IF;

    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- Grant permissions
-- =====================================================
GRANT ALL ON cardio_sessions TO service_role;
GRANT EXECUTE ON FUNCTION get_cardio_stats TO service_role;
GRANT EXECUTE ON FUNCTION get_cardio_sessions_range TO service_role;
GRANT EXECUTE ON FUNCTION get_cardio_streak TO service_role;

-- Comment on table
COMMENT ON TABLE cardio_sessions IS 'Stores cardio workout sessions including running, swimming, cycling, boxing, and other cardio activities';
