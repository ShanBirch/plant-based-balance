-- ============================================================
-- FRIENDSHIPS SYSTEM MIGRATION
-- Add friend connections to Plant Based Balance
-- ============================================================

-- ============================================================
-- FRIENDSHIPS TABLE (tracks friend relationships)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.friendships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Friend relationship (user_id sends request to friend_id)
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  friend_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- Status tracking
  status TEXT DEFAULT 'pending', -- 'pending', 'accepted', 'declined', 'blocked'

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Prevent duplicate friendships (only one direction needed)
  UNIQUE(user_id, friend_id),

  -- Prevent self-friending
  CHECK (user_id != friend_id)
);
CREATE INDEX IF NOT EXISTS idx_friendships_user ON public.friendships (user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_friendships_friend ON public.friendships (friend_id, status, created_at DESC);

-- Enable RLS on friendships table
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

-- Users can view friendships they're involved in
CREATE POLICY "Users can view own friendships" ON public.friendships
  FOR SELECT USING (
    auth.uid() = user_id OR auth.uid() = friend_id
  );

-- Users can create friend requests
CREATE POLICY "Users can send friend requests" ON public.friendships
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
  );

-- Users can update friendships they're involved in (to accept/decline)
CREATE POLICY "Users can update friendships" ON public.friendships
  FOR UPDATE USING (
    auth.uid() = user_id OR auth.uid() = friend_id
  );

-- Users can delete friendships they're involved in
CREATE POLICY "Users can delete friendships" ON public.friendships
  FOR DELETE USING (
    auth.uid() = user_id OR auth.uid() = friend_id
  );

-- Admins can view all friendships
CREATE POLICY "Admins can view all friendships" ON public.friendships
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE admin_users.user_id = auth.uid()
    )
  );

-- ============================================================
-- TRIGGERS
-- ============================================================

-- Update trigger for friendships table
CREATE TRIGGER update_friendships_updated_at
  BEFORE UPDATE ON public.friendships
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

-- Function to get user's friends (accepted friendships)
CREATE OR REPLACE FUNCTION get_friends(user_uuid UUID)
RETURNS TABLE(
  friend_id UUID,
  friend_name TEXT,
  friend_email TEXT,
  friend_photo TEXT,
  friendship_created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM (
    -- Friends where user sent the request
    SELECT
      u.id as friend_id,
      u.name as friend_name,
      u.email as friend_email,
      u.profile_photo as friend_photo,
      f.created_at as friendship_created_at
    FROM public.friendships f
    JOIN public.users u ON u.id = f.friend_id
    WHERE f.user_id = user_uuid
    AND f.status = 'accepted'

    UNION

    -- Friends where user received the request
    SELECT
      u.id as friend_id,
      u.name as friend_name,
      u.email as friend_email,
      u.profile_photo as friend_photo,
      f.created_at as friendship_created_at
    FROM public.friendships f
    JOIN public.users u ON u.id = f.user_id
    WHERE f.friend_id = user_uuid
    AND f.status = 'accepted'
  ) AS friends_union
  ORDER BY friend_name;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get pending friend requests (requests received)
CREATE OR REPLACE FUNCTION get_pending_friend_requests(user_uuid UUID)
RETURNS TABLE(
  request_id UUID,
  sender_id UUID,
  sender_name TEXT,
  sender_email TEXT,
  sender_photo TEXT,
  sent_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    f.id as request_id,
    u.id as sender_id,
    u.name as sender_name,
    u.email as sender_email,
    u.profile_photo as sender_photo,
    f.created_at as sent_at
  FROM public.friendships f
  JOIN public.users u ON u.id = f.user_id
  WHERE f.friend_id = user_uuid
  AND f.status = 'pending'
  ORDER BY f.created_at DESC;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if two users are friends
CREATE OR REPLACE FUNCTION are_friends(user1_uuid UUID, user2_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.friendships
    WHERE status = 'accepted'
    AND (
      (user_id = user1_uuid AND friend_id = user2_uuid)
      OR
      (user_id = user2_uuid AND friend_id = user1_uuid)
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to search users by email or name (for adding friends)
CREATE OR REPLACE FUNCTION search_users_for_friend(search_query TEXT, current_user_uuid UUID)
RETURNS TABLE(
  user_id UUID,
  user_name TEXT,
  user_email TEXT,
  user_photo TEXT,
  friendship_status TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.id as user_id,
    u.name as user_name,
    u.email as user_email,
    u.profile_photo as user_photo,
    COALESCE(
      (SELECT f.status FROM public.friendships f
       WHERE (f.user_id = current_user_uuid AND f.friend_id = u.id)
          OR (f.friend_id = current_user_uuid AND f.user_id = u.id)
       LIMIT 1),
      'none'
    ) as friendship_status
  FROM public.users u
  WHERE u.id != current_user_uuid
  AND (
    LOWER(u.email) LIKE LOWER('%' || search_query || '%')
    OR LOWER(u.name) LIKE LOWER('%' || search_query || '%')
  )
  LIMIT 10;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- COMMENTS
-- ============================================================

COMMENT ON TABLE public.friendships IS 'Tracks friend connections between users';
COMMENT ON COLUMN public.friendships.user_id IS 'User who sent the friend request';
COMMENT ON COLUMN public.friendships.friend_id IS 'User who received the friend request';
COMMENT ON COLUMN public.friendships.status IS 'Status of the friendship (pending, accepted, declined, blocked)';
