-- ============================================================
-- GROUP CHAT (WINS FEED) SYSTEM MIGRATION
-- Share workout wins and achievements with friends
-- ============================================================

-- ============================================================
-- GROUP CHAT POSTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.group_chat_posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Who posted
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- Post type: 'workout_complete', 'personal_best', 'milestone', 'custom'
  post_type TEXT NOT NULL DEFAULT 'custom',

  -- Post content
  message TEXT NOT NULL,

  -- Optional workout details (for workout shares)
  workout_name TEXT,
  workout_duration TEXT,
  exercise_name TEXT,
  weight_kg NUMERIC(6,2),
  reps INT,
  improvement_text TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Validate post type
  CHECK (post_type IN ('workout_complete', 'personal_best', 'milestone', 'custom'))
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_group_chat_posts_user ON public.group_chat_posts(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_group_chat_posts_created ON public.group_chat_posts(created_at DESC);

-- Enable RLS
ALTER TABLE public.group_chat_posts ENABLE ROW LEVEL SECURITY;

-- Users can view posts from their friends (or their own posts)
CREATE POLICY "Users can view friends posts" ON public.group_chat_posts
  FOR SELECT USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.friendships
      WHERE status = 'accepted'
      AND (
        (user_id = auth.uid() AND friend_id = group_chat_posts.user_id)
        OR (friend_id = auth.uid() AND user_id = group_chat_posts.user_id)
      )
    )
  );

-- Users can create their own posts
CREATE POLICY "Users can create posts" ON public.group_chat_posts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can delete their own posts
CREATE POLICY "Users can delete own posts" ON public.group_chat_posts
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- GROUP CHAT REACTIONS TABLE (Cheers/Likes)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.group_chat_reactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- The post being reacted to
  post_id UUID NOT NULL REFERENCES public.group_chat_posts(id) ON DELETE CASCADE,

  -- Who reacted
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- Reaction type (for future expansion)
  reaction_type TEXT NOT NULL DEFAULT 'cheer',

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Each user can only react once per post
  UNIQUE(post_id, user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_group_chat_reactions_post ON public.group_chat_reactions(post_id);
CREATE INDEX IF NOT EXISTS idx_group_chat_reactions_user ON public.group_chat_reactions(user_id);

-- Enable RLS
ALTER TABLE public.group_chat_reactions ENABLE ROW LEVEL SECURITY;

-- Users can view reactions on posts they can see
CREATE POLICY "Users can view reactions" ON public.group_chat_reactions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.group_chat_posts gcp
      WHERE gcp.id = post_id
      AND (
        gcp.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.friendships
          WHERE status = 'accepted'
          AND (
            (user_id = auth.uid() AND friend_id = gcp.user_id)
            OR (friend_id = auth.uid() AND user_id = gcp.user_id)
          )
        )
      )
    )
  );

-- Users can add reactions
CREATE POLICY "Users can add reactions" ON public.group_chat_reactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can remove their own reactions
CREATE POLICY "Users can remove own reactions" ON public.group_chat_reactions
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

-- Get group chat feed (posts from friends)
CREATE OR REPLACE FUNCTION get_group_chat_feed(user_uuid UUID, posts_limit INT DEFAULT 50)
RETURNS TABLE(
  post_id UUID,
  poster_id UUID,
  poster_name TEXT,
  poster_photo TEXT,
  post_type TEXT,
  message TEXT,
  workout_name TEXT,
  workout_duration TEXT,
  exercise_name TEXT,
  weight_kg NUMERIC,
  reps INT,
  improvement_text TEXT,
  created_at TIMESTAMPTZ,
  reaction_count BIGINT,
  user_has_reacted BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    gcp.id as post_id,
    gcp.user_id as poster_id,
    u.name as poster_name,
    u.profile_photo as poster_photo,
    gcp.post_type,
    gcp.message,
    gcp.workout_name,
    gcp.workout_duration,
    gcp.exercise_name,
    gcp.weight_kg,
    gcp.reps,
    gcp.improvement_text,
    gcp.created_at,
    COALESCE((SELECT COUNT(*) FROM public.group_chat_reactions gcr WHERE gcr.post_id = gcp.id), 0) as reaction_count,
    EXISTS(SELECT 1 FROM public.group_chat_reactions gcr WHERE gcr.post_id = gcp.id AND gcr.user_id = user_uuid) as user_has_reacted
  FROM public.group_chat_posts gcp
  JOIN public.users u ON u.id = gcp.user_id
  WHERE gcp.user_id = user_uuid
    OR EXISTS (
      SELECT 1 FROM public.friendships f
      WHERE f.status = 'accepted'
      AND (
        (f.user_id = user_uuid AND f.friend_id = gcp.user_id)
        OR (f.friend_id = user_uuid AND f.user_id = gcp.user_id)
      )
    )
  ORDER BY gcp.created_at DESC
  LIMIT posts_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Toggle reaction on a post (add if not exists, remove if exists)
CREATE OR REPLACE FUNCTION toggle_group_chat_reaction(user_uuid UUID, target_post_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  reaction_exists BOOLEAN;
BEGIN
  -- Check if reaction exists
  SELECT EXISTS(
    SELECT 1 FROM public.group_chat_reactions
    WHERE post_id = target_post_id AND user_id = user_uuid
  ) INTO reaction_exists;

  IF reaction_exists THEN
    -- Remove reaction
    DELETE FROM public.group_chat_reactions
    WHERE post_id = target_post_id AND user_id = user_uuid;
    RETURN FALSE; -- Reaction removed
  ELSE
    -- Add reaction
    INSERT INTO public.group_chat_reactions (post_id, user_id, reaction_type)
    VALUES (target_post_id, user_uuid, 'cheer');
    RETURN TRUE; -- Reaction added
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- COMMENTS
-- ============================================================

COMMENT ON TABLE public.group_chat_posts IS 'Posts in the friends group chat/wins feed';
COMMENT ON COLUMN public.group_chat_posts.post_type IS 'Type: workout_complete, personal_best, milestone, or custom';
COMMENT ON COLUMN public.group_chat_posts.message IS 'The main message/content of the post';
COMMENT ON COLUMN public.group_chat_posts.workout_name IS 'Name of workout if sharing workout completion';
COMMENT ON COLUMN public.group_chat_posts.improvement_text IS 'Text describing improvement (e.g., "+5kg")';

COMMENT ON TABLE public.group_chat_reactions IS 'Reactions (cheers) on group chat posts';
COMMENT ON FUNCTION get_group_chat_feed IS 'Get paginated feed of posts from user and friends';
COMMENT ON FUNCTION toggle_group_chat_reaction IS 'Toggle reaction on a post, returns true if added, false if removed';
