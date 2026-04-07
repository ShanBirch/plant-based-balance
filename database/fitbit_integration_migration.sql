-- Fitbit Integration Migration
-- Stores OAuth tokens and synced health data from Fitbit

-- ============================================
-- Table: fitbit_connections
-- Stores the OAuth tokens for each user's Fitbit account
-- ============================================
CREATE TABLE IF NOT EXISTS fitbit_connections (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    fitbit_user_id TEXT NOT NULL,
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

-- ============================================
-- Table: fitbit_daily_activity
-- Stores daily step counts, calories burned, distance, etc.
-- ============================================
CREATE TABLE IF NOT EXISTS fitbit_daily_activity (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    steps INTEGER DEFAULT 0,
    calories_burned INTEGER DEFAULT 0,
    distance DECIMAL(10,2) DEFAULT 0, -- in km
    active_minutes INTEGER DEFAULT 0,
    floors INTEGER DEFAULT 0,
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, date)
);

-- ============================================
-- Table: fitbit_sleep
-- Stores nightly sleep data
-- ============================================
CREATE TABLE IF NOT EXISTS fitbit_sleep (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    duration_minutes INTEGER DEFAULT 0,
    efficiency INTEGER, -- sleep efficiency score 0-100
    deep_minutes INTEGER DEFAULT 0,
    light_minutes INTEGER DEFAULT 0,
    rem_minutes INTEGER DEFAULT 0,
    wake_minutes INTEGER DEFAULT 0,
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, date)
);

-- ============================================
-- Table: fitbit_heart_rate
-- Stores daily resting heart rate and heart rate zones
-- ============================================
CREATE TABLE IF NOT EXISTS fitbit_heart_rate (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    resting_heart_rate INTEGER,
    fat_burn_minutes INTEGER DEFAULT 0,
    cardio_minutes INTEGER DEFAULT 0,
    peak_minutes INTEGER DEFAULT 0,
    out_of_range_minutes INTEGER DEFAULT 0,
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, date)
);

-- ============================================
-- Row Level Security
-- ============================================
ALTER TABLE fitbit_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE fitbit_daily_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE fitbit_sleep ENABLE ROW LEVEL SECURITY;
ALTER TABLE fitbit_heart_rate ENABLE ROW LEVEL SECURITY;

-- Users can only see their own Fitbit data
CREATE POLICY "Users can view own fitbit_connections"
    ON fitbit_connections FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own fitbit_connections"
    ON fitbit_connections FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own fitbit_connections"
    ON fitbit_connections FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own fitbit_connections"
    ON fitbit_connections FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own fitbit_daily_activity"
    ON fitbit_daily_activity FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own fitbit_daily_activity"
    ON fitbit_daily_activity FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view own fitbit_sleep"
    ON fitbit_sleep FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own fitbit_sleep"
    ON fitbit_sleep FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view own fitbit_heart_rate"
    ON fitbit_heart_rate FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own fitbit_heart_rate"
    ON fitbit_heart_rate FOR ALL USING (auth.uid() = user_id);

-- Service role needs access for background sync
CREATE POLICY "Service role can manage fitbit_connections"
    ON fitbit_connections FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role can manage fitbit_daily_activity"
    ON fitbit_daily_activity FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role can manage fitbit_sleep"
    ON fitbit_sleep FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role can manage fitbit_heart_rate"
    ON fitbit_heart_rate FOR ALL USING (auth.role() = 'service_role');

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_fitbit_connections_user ON fitbit_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_fitbit_daily_activity_user_date ON fitbit_daily_activity(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_fitbit_sleep_user_date ON fitbit_sleep(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_fitbit_heart_rate_user_date ON fitbit_heart_rate(user_id, date DESC);
