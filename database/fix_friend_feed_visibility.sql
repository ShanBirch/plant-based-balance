-- ============================================================
-- FIX: FRIEND FEED VISIBILITY
-- ============================================================
-- Bug: The social feed was using the REFERRAL network
-- (get_extended_referral_network, based on users.referred_by_user_id)
-- instead of the FRIENDSHIPS table. This meant users who explicitly
-- added each other as friends (e.g. a coach and her clients) could
-- not see each other's posts, because neither had invited the other
-- via a referral link.
--
-- Fix: Use the friendships table (accepted friendships in either
-- direction) to determine whose posts show up on the feed. Users
-- can see posts from:
--   1. Themselves
--   2. Anyone they have an accepted friendship with
--
-- Run this in the Supabase SQL Editor.
-- ============================================================

-- ============================================================
-- 1. Replace the RLS policy on public.stories
-- ============================================================
DROP POLICY IF EXISTS "Users can view network stories" ON public.stories;

CREATE POLICY "Users can view friends stories" ON public.stories
  FOR SELECT USING (
    -- Can view own stories
    auth.uid() = user_id
    OR
    -- Can view stories from accepted friends (either direction)
    EXISTS (
      SELECT 1 FROM public.friendships f
      WHERE f.status = 'accepted'
        AND (
          (f.user_id = auth.uid() AND f.friend_id = stories.user_id)
          OR
          (f.friend_id = auth.uid() AND f.user_id = stories.user_id)
        )
    )
  );

-- ============================================================
-- 2. Replace get_network_active_stories to use friendships
-- ============================================================
-- This is the RPC that window.loadPhotoFeed() calls to populate the
-- home-page feed grid. It previously filtered by the referral
-- network; now it filters by accepted friendships.
-- ============================================================
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
      SELECT 1 FROM public.story_views sv
      WHERE sv.story_id = s.id AND sv.viewer_id = user_uuid
    ) AS has_viewed,
    COUNT(*) OVER (PARTITION BY s.user_id)::INTEGER AS story_count
  FROM public.stories s
  JOIN public.users u ON u.id = s.user_id
  WHERE
    -- Story hasn't expired
    s.expires_at > NOW()
    AND (
      -- Own stories
      s.user_id = user_uuid
      OR
      -- Stories from accepted friends (either direction of the friendship row)
      s.user_id IN (
        SELECT f.friend_id
        FROM public.friendships f
        WHERE f.user_id = user_uuid AND f.status = 'accepted'
        UNION
        SELECT f.user_id
        FROM public.friendships f
        WHERE f.friend_id = user_uuid AND f.status = 'accepted'
      )
    )
  ORDER BY
    -- Unviewed stories first
    has_viewed ASC,
    -- Then by creation time (newest first)
    s.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_network_active_stories(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_network_active_stories(UUID) TO anon;

-- ============================================================
-- COMMENTS
-- ============================================================
COMMENT ON FUNCTION get_network_active_stories IS
  'Returns all active (non-expired) stories from the caller and their accepted friends (friendships table, either direction). Replaces the earlier referral-network-based implementation.';
