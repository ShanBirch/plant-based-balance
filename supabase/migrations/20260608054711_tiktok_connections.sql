CREATE TABLE IF NOT EXISTS public.tiktok_connections (
    connection_key TEXT PRIMARY KEY DEFAULT 'balance_owner',
    open_id TEXT,
    display_name TEXT,
    avatar_url TEXT,
    scope TEXT,
    token_type TEXT DEFAULT 'Bearer',
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    refresh_expires_at TIMESTAMPTZ,
    last_connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_refreshed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.tiktok_connections ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS update_tiktok_connections_updated_at ON public.tiktok_connections;
CREATE TRIGGER update_tiktok_connections_updated_at
    BEFORE UPDATE ON public.tiktok_connections
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.tiktok_uploads (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    connection_key TEXT NOT NULL DEFAULT 'balance_owner' REFERENCES public.tiktok_connections(connection_key) ON DELETE CASCADE,
    mode TEXT NOT NULL CHECK (mode IN ('draft', 'publish')),
    publish_id TEXT,
    caption TEXT,
    privacy_level TEXT,
    file_name TEXT,
    file_size BIGINT,
    content_type TEXT,
    tiktok_error JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.tiktok_uploads ENABLE ROW LEVEL SECURITY;
