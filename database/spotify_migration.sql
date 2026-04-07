-- Spotify Integration Migration
-- Stores OAuth connection and daily listening summaries

-- ── Connection ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.spotify_connections (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    spotify_user_id TEXT NOT NULL,
    display_name TEXT,
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

-- ── Daily listening summary ──────────────────────────────────────────────────
-- One row per user per day. Aggregated from recently-played history.
CREATE TABLE IF NOT EXISTS public.spotify_daily_listening (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    date DATE NOT NULL,

    total_listening_minutes INTEGER DEFAULT 0,  -- sum of track durations played that day
    track_count INTEGER DEFAULT 0,              -- distinct tracks heard

    -- JSONB arrays for rich display
    -- top_tracks:   [{name, artist, album_art_url, duration_ms}]
    -- top_artists:  [{name, image_url}]
    -- top_genres:   ["pop", "indie", ...]  (from user's top artists endpoint)
    top_tracks  JSONB DEFAULT '[]'::jsonb,
    top_artists JSONB DEFAULT '[]'::jsonb,
    top_genres  JSONB DEFAULT '[]'::jsonb,

    synced_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, date)
);

-- ── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_spotify_connections_user ON public.spotify_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_spotify_listening_user_date ON public.spotify_daily_listening(user_id, date DESC);

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE public.spotify_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spotify_daily_listening ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own spotify_connections"   ON public.spotify_connections FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own spotify_connections" ON public.spotify_connections FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own spotify_connections" ON public.spotify_connections FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own spotify_connections" ON public.spotify_connections FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Service role can manage spotify_connections" ON public.spotify_connections FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Users can view own spotify_listening"   ON public.spotify_daily_listening FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own spotify_listening" ON public.spotify_daily_listening FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Service role can manage spotify_listening" ON public.spotify_daily_listening FOR ALL USING (auth.role() = 'service_role');

GRANT ALL ON public.spotify_connections TO authenticated;
GRANT ALL ON public.spotify_connections TO service_role;
GRANT ALL ON public.spotify_daily_listening TO authenticated;
GRANT ALL ON public.spotify_daily_listening TO service_role;
