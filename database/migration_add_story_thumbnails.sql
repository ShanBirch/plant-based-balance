-- Add Thumbnail Support to Stories
-- Run this in your Supabase SQL Editor

-- Add thumbnail_url column to stories table
ALTER TABLE public.stories
ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;

-- Update the get_network_active_stories function to include thumbnail_url
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
    -- Story hasn't expired
    s.expires_at > NOW()
    AND
    -- Story is from user's extended network or self
    (s.user_id = user_uuid OR s.user_id IN (
      SELECT network_user_id FROM get_extended_referral_network(user_uuid)
    ))
  ORDER BY
    -- Unviewed stories first
    has_viewed ASC,
    -- Then by creation time (newest first)
    s.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON COLUMN public.stories.thumbnail_url IS 'Thumbnail for video preview or profile photo fallback';
