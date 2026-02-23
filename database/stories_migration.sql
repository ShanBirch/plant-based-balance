-- ============================================================
-- STORIES FEATURE MIGRATION
-- Instagram-style stories with friend-of-friend visibility
-- ============================================================

-- ============================================================
-- EXTENDED NETWORK FUNCTION (Friends + Friends of Friends)
-- ============================================================

-- Function to get user's extended network (2-degree connections)
CREATE OR REPLACE FUNCTION get_extended_referral_network(user_uuid UUID)
RETURNS TABLE(network_user_id UUID, degree INTEGER, relationship TEXT, user_name TEXT, user_email TEXT, profile_photo TEXT) AS $$
BEGIN
  RETURN QUERY

  -- FIRST DEGREE: People this user invited
  SELECT
    u.id as network_user_id,
    1 as degree,
    'invited' as relationship,
    u.name as user_name,
    u.email as user_email,
    u.profile_photo
  FROM public.users u
  WHERE u.referred_by_user_id = user_uuid

  UNION

  -- FIRST DEGREE: Person who invited this user
  SELECT
    u.id as network_user_id,
    1 as degree,
    'invited_by' as relationship,
    u.name as user_name,
    u.email as user_email,
    u.profile_photo
  FROM public.users u
  WHERE u.id = (SELECT referred_by_user_id FROM public.users WHERE id = user_uuid)
  AND u.id IS NOT NULL

  UNION

  -- SECOND DEGREE: People invited by people this user invited
  SELECT DISTINCT
    u.id as network_user_id,
    2 as degree,
    'friend_of_friend' as relationship,
    u.name as user_name,
    u.email as user_email,
    u.profile_photo
  FROM public.users u
  WHERE u.referred_by_user_id IN (
    SELECT id FROM public.users WHERE referred_by_user_id = user_uuid
  )
  AND u.id != user_uuid  -- Don't include self

  UNION

  -- SECOND DEGREE: People who invited people this user invited
  SELECT DISTINCT
    u.id as network_user_id,
    2 as degree,
    'friend_of_friend' as relationship,
    u.name as user_name,
    u.email as user_email,
    u.profile_photo
  FROM public.users u
  WHERE u.id IN (
    SELECT referred_by_user_id
    FROM public.users
    WHERE referred_by_user_id IS NOT NULL
    AND id IN (SELECT id FROM public.users WHERE referred_by_user_id = user_uuid)
  )
  AND u.id != user_uuid  -- Don't include self

  UNION

  -- SECOND DEGREE: People invited by person who invited this user
  SELECT DISTINCT
    u.id as network_user_id,
    2 as degree,
    'friend_of_friend' as relationship,
    u.name as user_name,
    u.email as user_email,
    u.profile_photo
  FROM public.users u
  WHERE u.referred_by_user_id = (
    SELECT referred_by_user_id FROM public.users WHERE id = user_uuid
  )
  AND u.referred_by_user_id IS NOT NULL
  AND u.id != user_uuid  -- Don't include self

  UNION

  -- SECOND DEGREE: Person who invited the person who invited this user
  SELECT DISTINCT
    u.id as network_user_id,
    2 as degree,
    'friend_of_friend' as relationship,
    u.name as user_name,
    u.email as user_email,
    u.profile_photo
  FROM public.users u
  WHERE u.id = (
    SELECT referred_by_user_id
    FROM public.users
    WHERE id = (SELECT referred_by_user_id FROM public.users WHERE id = user_uuid)
  )
  AND u.id IS NOT NULL
  AND u.id != user_uuid;  -- Don't include self

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- STORIES TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.stories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- User who posted the story
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- Story content
  media_type TEXT NOT NULL CHECK (media_type IN ('image', 'video', 'workout_card', 'nutrition_card', 'level_up_card')),
  media_url TEXT NOT NULL,  -- Base64 or Supabase Storage URL
  thumbnail_url TEXT,  -- Thumbnail for video preview or profile photo fallback
  caption TEXT,

  -- Story metadata
  duration INTEGER DEFAULT 5,  -- Duration in seconds for viewing
  background_color TEXT DEFAULT '#000000',

  -- View tracking
  view_count INTEGER DEFAULT 0,

  -- Expiration (24 hours from creation)
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes separately
CREATE INDEX IF NOT EXISTS idx_stories_user_id ON public.stories(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stories_expires_at ON public.stories(expires_at);

-- Enable RLS on stories table
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;

-- Users can view stories from their extended network
CREATE POLICY "Users can view network stories" ON public.stories
  FOR SELECT USING (
    -- Can view own stories
    auth.uid() = user_id
    OR
    -- Can view stories from extended network (friends + friends of friends)
    user_id IN (
      SELECT network_user_id FROM get_extended_referral_network(auth.uid())
    )
  );

-- Users can insert their own stories
CREATE POLICY "Users can create own stories" ON public.stories
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own stories
CREATE POLICY "Users can update own stories" ON public.stories
  FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own stories
CREATE POLICY "Users can delete own stories" ON public.stories
  FOR DELETE USING (auth.uid() = user_id);

-- Admins can view all stories
CREATE POLICY "Admins can view all stories" ON public.stories
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE admin_users.user_id = auth.uid()
    )
  );

-- ============================================================
-- STORY VIEWS TABLE (Track who viewed each story)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.story_views (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  story_id UUID NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  viewer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  viewed_at TIMESTAMPTZ DEFAULT NOW(),

  -- Prevent duplicate views
  UNIQUE(story_id, viewer_id)
);

-- Create indexes separately
CREATE INDEX IF NOT EXISTS idx_story_views_story_id ON public.story_views(story_id, viewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_story_views_viewer_id ON public.story_views(viewer_id, viewed_at DESC);

-- Enable RLS on story_views table
ALTER TABLE public.story_views ENABLE ROW LEVEL SECURITY;

-- Story owner can view who viewed their story
CREATE POLICY "Story owners can view story views" ON public.story_views
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.stories
      WHERE stories.id = story_id
      AND stories.user_id = auth.uid()
    )
  );

-- Users can insert their own views
CREATE POLICY "Users can create own views" ON public.story_views
  FOR INSERT WITH CHECK (auth.uid() = viewer_id);

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

-- Function to increment view count on a story
CREATE OR REPLACE FUNCTION increment_story_view_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.stories
  SET view_count = view_count + 1
  WHERE id = NEW.story_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_story_view_created
  AFTER INSERT ON public.story_views
  FOR EACH ROW
  EXECUTE FUNCTION increment_story_view_count();

-- Function to get active stories from user's network
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

-- Function to clean up expired stories (can be run via cron or manually)
CREATE OR REPLACE FUNCTION cleanup_expired_stories()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.stories
  WHERE expires_at <= NOW();

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Update trigger for stories table
CREATE TRIGGER update_stories_updated_at
  BEFORE UPDATE ON public.stories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- COMMENTS
-- ============================================================

COMMENT ON TABLE public.stories IS 'User stories visible to friends and friends of friends (24hr expiration)';
COMMENT ON TABLE public.story_views IS 'Tracks which users have viewed which stories';
COMMENT ON FUNCTION get_extended_referral_network IS 'Returns friends + friends of friends (2-degree network)';
COMMENT ON FUNCTION get_network_active_stories IS 'Returns all active stories from users extended network';
COMMENT ON FUNCTION cleanup_expired_stories IS 'Deletes stories older than 24 hours';
