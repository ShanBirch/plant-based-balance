-- ============================================================
-- Community Feed Visibility
-- ============================================================
-- The feed used to be restricted to accepted friends. For motivation and
-- social proof, the Balance feed should now show active posts from the wider
-- app community while keeping test accounts out of the normal feed.
--
-- The frontend already calls get_network_active_stories(user_uuid), so keep
-- that RPC name for compatibility and change its visibility rule.
-- ============================================================

-- Replace friend-only story SELECT visibility with community visibility.
DROP POLICY IF EXISTS "Users can view network stories" ON public.stories;
DROP POLICY IF EXISTS "Users can view friends stories" ON public.stories;
DROP POLICY IF EXISTS "Authenticated users can view community stories" ON public.stories;

CREATE POLICY "Authenticated users can view community stories" ON public.stories
  FOR SELECT
  TO authenticated
  USING (
    -- Users can always view their own stories.
    auth.uid() = user_id
    OR
    -- Active non-test-account posts are visible to the app community.
    (
      expires_at > NOW()
      AND EXISTS (
        SELECT 1
        FROM public.users u
        WHERE u.id = stories.user_id
          AND COALESCE(u.is_test_account, FALSE) = FALSE
      )
    )
  );

-- Keep the RPC name stable for the app, but return the community feed.
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

REVOKE ALL ON FUNCTION get_network_active_stories(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_network_active_stories(UUID) TO authenticated;

COMMENT ON FUNCTION get_network_active_stories IS
  'Returns all active non-test-account stories for the Balance community feed. Keeps the legacy RPC name used by the app.';
