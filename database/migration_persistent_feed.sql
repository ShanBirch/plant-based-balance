-- ============================================================
-- PERSISTENT FEED MIGRATION
-- Makes feed posts permanent instead of expiring after 24 hours
-- ============================================================

-- 1. Drop the media_type CHECK constraint so we can use
--    'workout_card', 'nutrition_card', 'level_up_card', 'meal' etc.
ALTER TABLE public.stories DROP CONSTRAINT IF EXISTS stories_media_type_check;

-- 2. Make expires_at nullable and default to NULL (no expiration)
ALTER TABLE public.stories ALTER COLUMN expires_at DROP NOT NULL;
ALTER TABLE public.stories ALTER COLUMN expires_at SET DEFAULT NULL;

-- 3. Remove expiration from existing posts so they reappear
UPDATE public.stories SET expires_at = NULL WHERE expires_at <= NOW();

-- 4. Drop and recreate get_network_active_stories WITHOUT expiration filter
DROP FUNCTION IF EXISTS get_network_active_stories(uuid);

CREATE OR REPLACE FUNCTION get_network_active_stories(user_uuid UUID)
RETURNS TABLE(
  story_id UUID,
  user_id UUID,
  user_name TEXT,
  user_email TEXT,
  profile_photo TEXT,
  media_type TEXT,
  media_url TEXT,
  thumbnail_url TEXT,
  caption TEXT,
  duration INTEGER,
  background_color TEXT,
  view_count INTEGER,
  created_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  has_viewed BOOLEAN,
  story_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id as story_id,
    s.user_id,
    u.name as user_name,
    u.email as user_email,
    u.profile_photo,
    s.media_type,
    s.media_url,
    s.thumbnail_url,
    s.caption,
    s.duration,
    s.background_color,
    s.view_count,
    s.created_at,
    s.expires_at,
    EXISTS(
      SELECT 1 FROM public.story_views sv
      WHERE sv.story_id = s.id AND sv.viewer_id = user_uuid
    ) as has_viewed,
    COUNT(*) OVER (PARTITION BY s.user_id)::INTEGER as story_count
  FROM public.stories s
  JOIN public.users u ON u.id = s.user_id
  WHERE
    -- No expiration filter — feed posts are permanent
    -- Story is from user's extended network or self
    (s.user_id = user_uuid OR s.user_id IN (
      SELECT network_user_id FROM get_extended_referral_network(user_uuid)
    ))
  ORDER BY
    -- Newest first
    s.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Replace cleanup function — only delete posts older than 90 days
--    to prevent unbounded growth, but keep content much longer
CREATE OR REPLACE FUNCTION cleanup_expired_stories()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.stories
  WHERE created_at < NOW() - INTERVAL '90 days';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- 6. Update comments
COMMENT ON TABLE public.stories IS 'User feed posts (photos, workout cards, nutrition cards, level-up cards)';
COMMENT ON FUNCTION get_network_active_stories IS 'Returns all feed posts from users extended network (no expiration filter)';
COMMENT ON FUNCTION cleanup_expired_stories IS 'Deletes feed posts older than 90 days to prevent unbounded growth';
