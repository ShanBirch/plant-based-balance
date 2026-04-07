-- Weather Logging Migration
-- Auto-fetched daily from Open-Meteo (no API key required) and stored for
-- correlation with mood, sleep, workouts, and energy scores.

CREATE TABLE IF NOT EXISTS public.weather_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    log_date DATE NOT NULL,

    -- Temperature
    temp_c          NUMERIC(5,1),   -- actual temperature in °C
    feels_like_c    NUMERIC(5,1),   -- apparent/feels-like temperature

    -- Conditions
    weather_code    INTEGER,         -- WMO weather interpretation code
    condition       TEXT,            -- human-readable: "Sunny", "Rainy", etc.
    is_day          BOOLEAN,

    -- Environment
    humidity_pct    INTEGER,         -- relative humidity %
    precipitation_mm NUMERIC(6,2),  -- total precipitation mm
    wind_speed_kmh  NUMERIC(6,1),
    uv_index        NUMERIC(4,1),

    -- Location context (stored so we know what location the reading is for)
    latitude        NUMERIC(9,6),
    longitude       NUMERIC(9,6),
    timezone        TEXT,

    fetched_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, log_date)
);

CREATE INDEX IF NOT EXISTS idx_weather_logs_user_date ON public.weather_logs(user_id, log_date DESC);

ALTER TABLE public.weather_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own weather logs"   ON public.weather_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own weather logs" ON public.weather_logs FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Service role can manage weather logs" ON public.weather_logs FOR ALL USING (auth.role() = 'service_role');

GRANT ALL ON public.weather_logs TO authenticated;
GRANT ALL ON public.weather_logs TO service_role;
