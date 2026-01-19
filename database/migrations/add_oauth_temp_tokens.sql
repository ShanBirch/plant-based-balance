-- OAuth Temporary Tokens Table
-- Used for OAuth 1.0a flows (like Garmin) to store temporary tokens

CREATE TABLE IF NOT EXISTS public.oauth_temp_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- OAuth details
  provider TEXT NOT NULL, -- 'garmin', etc.
  oauth_token TEXT NOT NULL,
  oauth_token_secret TEXT NOT NULL,

  -- Expiration
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '10 minutes'),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Index for quick lookup
  INDEX idx_oauth_temp_tokens_token (oauth_token, provider),
  INDEX idx_oauth_temp_tokens_expires (expires_at)
);

-- Enable RLS
ALTER TABLE public.oauth_temp_tokens ENABLE ROW LEVEL SECURITY;

-- Only allow backend operations (no user access)
CREATE POLICY "Service role can manage temp tokens" ON public.oauth_temp_tokens
  FOR ALL USING (true);

-- Auto-cleanup expired tokens (run periodically)
CREATE OR REPLACE FUNCTION cleanup_expired_oauth_tokens()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.oauth_temp_tokens
  WHERE expires_at < NOW();

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;
