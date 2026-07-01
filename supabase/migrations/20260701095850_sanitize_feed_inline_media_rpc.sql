-- Keep the community feed RPC lightweight enough for mobile WebViews.
-- Some legacy/fallback posts stored base64 data URLs directly in stories.media_url
-- or stories.thumbnail_url. Returning those through the feed RPC can make the
-- Feed tab download and parse multi-megabyte JSON before rendering anything.

CREATE OR REPLACE FUNCTION public.get_network_active_stories(user_uuid UUID)
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
    s.id AS story_id,
    s.user_id,
    u.name::TEXT AS user_name,
    u.email::TEXT AS user_email,
    u.profile_photo::TEXT AS profile_photo,
    s.media_type::TEXT AS media_type,
    CASE
      WHEN s.media_url IS NULL THEN NULL
      WHEN s.media_url LIKE 'data:%' THEN NULL
      ELSE s.media_url::TEXT
    END AS media_url,
    CASE
      WHEN s.thumbnail_url IS NULL THEN NULL
      WHEN s.thumbnail_url LIKE 'data:%' THEN NULL
      ELSE s.thumbnail_url::TEXT
    END AS thumbnail_url,
    s.caption::TEXT AS caption,
    s.duration::INTEGER AS duration,
    s.background_color::TEXT AS background_color,
    COALESCE(s.view_count, 0)::INTEGER AS view_count,
    s.created_at,
    s.expires_at,
    EXISTS(
      SELECT 1
      FROM public.story_views sv
      WHERE sv.story_id = s.id
        AND sv.viewer_id = user_uuid
    ) AS has_viewed,
    COUNT(*) OVER (PARTITION BY s.user_id)::INTEGER AS story_count
  FROM public.stories s
  JOIN public.users u ON u.id = s.user_id
  WHERE s.expires_at > NOW()
    AND COALESCE(u.is_test_account, FALSE) = FALSE
  ORDER BY
    has_viewed ASC,
    s.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.get_network_active_stories(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_network_active_stories(UUID) TO authenticated;

COMMENT ON FUNCTION public.get_network_active_stories(UUID) IS
  'Returns active non-test-account stories for the Balance community feed without inline data URL media payloads.';
