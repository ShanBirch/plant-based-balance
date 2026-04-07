-- Wearable Integrations Migration
-- Adds support for WHOOP, Oura Ring, and Strava alongside existing Fitbit

-- ============================================
-- WHOOP TABLES
-- ============================================

-- Table: whoop_connections
CREATE TABLE IF NOT EXISTS whoop_connections (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    whoop_user_id TEXT NOT NULL,
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    token_type TEXT DEFAULT 'Bearer',
    expires_at TIMESTAMPTZ NOT NULL,
    scope TEXT,
    connected_at TIMESTAMPTZ DEFAULT NOW(),
    last_sync_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Table: whoop_recovery
CREATE TABLE IF NOT EXISTS whoop_recovery (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    recovery_score INTEGER DEFAULT 0,
    resting_heart_rate INTEGER,
    hrv_rmssd DECIMAL(10,2),
    spo2_percentage DECIMAL(5,2),
    skin_temp_celsius DECIMAL(5,2),
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, date)
);

-- Table: whoop_sleep
CREATE TABLE IF NOT EXISTS whoop_sleep (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    duration_minutes INTEGER DEFAULT 0,
    sleep_efficiency DECIMAL(5,2),
    disturbance_count INTEGER DEFAULT 0,
    light_sleep_minutes INTEGER DEFAULT 0,
    deep_sleep_minutes INTEGER DEFAULT 0,
    rem_sleep_minutes INTEGER DEFAULT 0,
    wake_minutes INTEGER DEFAULT 0,
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, date)
);

-- Table: whoop_workouts
CREATE TABLE IF NOT EXISTS whoop_workouts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    sport_id INTEGER DEFAULT 0,
    strain DECIMAL(5,2) DEFAULT 0,
    avg_heart_rate INTEGER,
    max_heart_rate INTEGER,
    kilojoules DECIMAL(10,2) DEFAULT 0,
    distance_meters DECIMAL(10,2),
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, date)
);

-- ============================================
-- OURA RING TABLES
-- ============================================

-- Table: oura_connections
CREATE TABLE IF NOT EXISTS oura_connections (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    oura_user_id TEXT NOT NULL,
    access_token TEXT NOT NULL,
    refresh_token TEXT DEFAULT '',
    token_type TEXT DEFAULT 'Bearer',
    expires_at TIMESTAMPTZ NOT NULL,
    scope TEXT,
    connected_at TIMESTAMPTZ DEFAULT NOW(),
    last_sync_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Table: oura_daily_activity
CREATE TABLE IF NOT EXISTS oura_daily_activity (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    steps INTEGER DEFAULT 0,
    active_calories INTEGER DEFAULT 0,
    total_calories INTEGER DEFAULT 0,
    distance_meters INTEGER DEFAULT 0,
    active_minutes INTEGER DEFAULT 0,
    low_activity_minutes INTEGER DEFAULT 0,
    medium_activity_minutes INTEGER DEFAULT 0,
    high_activity_minutes INTEGER DEFAULT 0,
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, date)
);

-- Table: oura_sleep
CREATE TABLE IF NOT EXISTS oura_sleep (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    sleep_score INTEGER,
    total_sleep_minutes INTEGER DEFAULT 0,
    deep_minutes INTEGER DEFAULT 0,
    light_minutes INTEGER DEFAULT 0,
    rem_minutes INTEGER DEFAULT 0,
    wake_minutes INTEGER DEFAULT 0,
    efficiency INTEGER,
    lowest_heart_rate INTEGER,
    time_in_bed_minutes INTEGER DEFAULT 0,
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, date)
);

-- Table: oura_readiness
CREATE TABLE IF NOT EXISTS oura_readiness (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    readiness_score INTEGER,
    temperature_deviation DECIMAL(5,2),
    resting_heart_rate_contrib INTEGER,
    hrv_balance_contrib INTEGER,
    body_temperature_contrib INTEGER,
    recovery_index_contrib INTEGER,
    sleep_balance_contrib INTEGER,
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, date)
);

-- ============================================
-- STRAVA TABLES
-- ============================================

-- Table: strava_connections
CREATE TABLE IF NOT EXISTS strava_connections (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    strava_athlete_id TEXT NOT NULL,
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    token_type TEXT DEFAULT 'Bearer',
    expires_at TIMESTAMPTZ NOT NULL,
    scope TEXT,
    connected_at TIMESTAMPTZ DEFAULT NOW(),
    last_sync_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Table: strava_activities
CREATE TABLE IF NOT EXISTS strava_activities (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    strava_activity_id TEXT NOT NULL,
    date DATE NOT NULL,
    name TEXT DEFAULT 'Activity',
    sport_type TEXT DEFAULT 'Unknown',
    distance_meters DECIMAL(12,2) DEFAULT 0,
    moving_time_seconds INTEGER DEFAULT 0,
    elapsed_time_seconds INTEGER DEFAULT 0,
    total_elevation_gain DECIMAL(10,2) DEFAULT 0,
    avg_speed DECIMAL(8,3) DEFAULT 0,
    max_speed DECIMAL(8,3) DEFAULT 0,
    avg_heart_rate INTEGER,
    max_heart_rate INTEGER,
    calories INTEGER DEFAULT 0,
    suffer_score INTEGER,
    start_time TIMESTAMPTZ,
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(strava_activity_id)
);

-- ============================================
-- Row Level Security - WHOOP
-- ============================================
ALTER TABLE whoop_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE whoop_recovery ENABLE ROW LEVEL SECURITY;
ALTER TABLE whoop_sleep ENABLE ROW LEVEL SECURITY;
ALTER TABLE whoop_workouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own whoop_connections"
    ON whoop_connections FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own whoop_connections"
    ON whoop_connections FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own whoop_connections"
    ON whoop_connections FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own whoop_connections"
    ON whoop_connections FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own whoop_recovery"
    ON whoop_recovery FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own whoop_recovery"
    ON whoop_recovery FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view own whoop_sleep"
    ON whoop_sleep FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own whoop_sleep"
    ON whoop_sleep FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view own whoop_workouts"
    ON whoop_workouts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own whoop_workouts"
    ON whoop_workouts FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage whoop_connections"
    ON whoop_connections FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role can manage whoop_recovery"
    ON whoop_recovery FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role can manage whoop_sleep"
    ON whoop_sleep FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role can manage whoop_workouts"
    ON whoop_workouts FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- Row Level Security - OURA
-- ============================================
ALTER TABLE oura_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE oura_daily_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE oura_sleep ENABLE ROW LEVEL SECURITY;
ALTER TABLE oura_readiness ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own oura_connections"
    ON oura_connections FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own oura_connections"
    ON oura_connections FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own oura_connections"
    ON oura_connections FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own oura_connections"
    ON oura_connections FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own oura_daily_activity"
    ON oura_daily_activity FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own oura_daily_activity"
    ON oura_daily_activity FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view own oura_sleep"
    ON oura_sleep FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own oura_sleep"
    ON oura_sleep FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view own oura_readiness"
    ON oura_readiness FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own oura_readiness"
    ON oura_readiness FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage oura_connections"
    ON oura_connections FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role can manage oura_daily_activity"
    ON oura_daily_activity FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role can manage oura_sleep"
    ON oura_sleep FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role can manage oura_readiness"
    ON oura_readiness FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- Row Level Security - STRAVA
-- ============================================
ALTER TABLE strava_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE strava_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own strava_connections"
    ON strava_connections FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own strava_connections"
    ON strava_connections FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own strava_connections"
    ON strava_connections FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own strava_connections"
    ON strava_connections FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own strava_activities"
    ON strava_activities FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own strava_activities"
    ON strava_activities FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage strava_connections"
    ON strava_connections FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role can manage strava_activities"
    ON strava_activities FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- Indexes for Performance
-- ============================================

-- WHOOP indexes
CREATE INDEX IF NOT EXISTS idx_whoop_connections_user ON whoop_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_whoop_recovery_user_date ON whoop_recovery(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_whoop_sleep_user_date ON whoop_sleep(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_whoop_workouts_user_date ON whoop_workouts(user_id, date DESC);

-- Oura indexes
CREATE INDEX IF NOT EXISTS idx_oura_connections_user ON oura_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_oura_daily_activity_user_date ON oura_daily_activity(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_oura_sleep_user_date ON oura_sleep(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_oura_readiness_user_date ON oura_readiness(user_id, date DESC);

-- Strava indexes
CREATE INDEX IF NOT EXISTS idx_strava_connections_user ON strava_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_strava_activities_user_date ON strava_activities(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_strava_activities_strava_id ON strava_activities(strava_activity_id);
