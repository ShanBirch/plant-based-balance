-- Test accounts stay hidden from everyone else's Feed, but must still see
-- their own posts after they share a set or story.
CREATE OR REPLACE FUNCTION public.get_network_active_stories(user_uuid uuid)
RETURNS TABLE(
  story_id uuid,
  user_id uuid,
  user_name text,
  user_email text,
  profile_photo text,
  media_type text,
  media_url text,
  thumbnail_url text,
  caption text,
  duration integer,
  background_color text,
  view_count integer,
  created_at timestamp with time zone,
  expires_at timestamp with time zone,
  has_viewed boolean,
  story_count integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
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
    (s.user_id = user_uuid OR EXISTS (
      SELECT 1 FROM public.story_views sv
      WHERE sv.story_id = s.id AND sv.viewer_id = user_uuid
    )) AS has_viewed,
    COUNT(*) OVER (PARTITION BY s.user_id)::INTEGER AS story_count
  FROM public.stories s
  JOIN public.users u ON u.id = s.user_id
  WHERE s.expires_at > NOW()
    AND (COALESCE(u.is_test_account, FALSE) = FALSE OR s.user_id = user_uuid)
  ORDER BY s.created_at DESC;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_network_active_stories(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_network_active_stories(uuid) TO authenticated;
