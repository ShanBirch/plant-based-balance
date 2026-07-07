-- Feed order: show latest posts first.

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
    u.name AS user_name,
    u.email AS user_email,
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
    (
      s.user_id = user_uuid
      OR EXISTS (
        SELECT 1
        FROM public.story_views sv
        WHERE sv.story_id = s.id
          AND sv.viewer_id = user_uuid
      )
    ) AS has_viewed,
    COUNT(*) OVER (PARTITION BY s.user_id)::INTEGER AS story_count
  FROM public.stories s
  JOIN public.users u ON u.id = s.user_id
  WHERE s.expires_at > NOW()
    AND COALESCE(u.is_test_account, FALSE) = FALSE
  ORDER BY s.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.get_network_active_stories(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_network_active_stories(UUID) TO authenticated;

COMMENT ON FUNCTION public.get_network_active_stories IS
  'Returns all active non-test-account stories for the Balance community feed, ordered from latest to earliest.';
