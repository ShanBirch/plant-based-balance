-- ============================================================
-- PRIVATE MESSAGES SYSTEM MIGRATION
-- 1-on-1 private chat between friends
-- ============================================================

-- ============================================================
-- PRIVATE MESSAGES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.private_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Sender and receiver
  sender_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- Message content
  message_text TEXT NOT NULL,

  -- Read status
  read_at TIMESTAMPTZ DEFAULT NULL,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Prevent self-messaging
  CHECK (sender_id != receiver_id)
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_private_messages_conversation
  ON public.private_messages(LEAST(sender_id, receiver_id), GREATEST(sender_id, receiver_id), created_at DESC);
CREATE INDEX IF NOT EXISTS idx_private_messages_receiver
  ON public.private_messages(receiver_id, read_at, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_private_messages_sender
  ON public.private_messages(sender_id, created_at DESC);

-- Enable RLS
ALTER TABLE public.private_messages ENABLE ROW LEVEL SECURITY;

-- Users can only view messages they sent or received
CREATE POLICY "Users can view own messages" ON public.private_messages
  FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- Users can send messages (only if friends)
CREATE POLICY "Users can send messages to friends" ON public.private_messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM public.friendships
      WHERE status = 'accepted'
      AND (
        (user_id = auth.uid() AND friend_id = receiver_id)
        OR (friend_id = auth.uid() AND user_id = receiver_id)
      )
    )
  );

-- Users can update messages they received (to mark as read)
CREATE POLICY "Users can mark messages as read" ON public.private_messages
  FOR UPDATE USING (auth.uid() = receiver_id);

-- Users can delete messages they sent
CREATE POLICY "Users can delete own messages" ON public.private_messages
  FOR DELETE USING (auth.uid() = sender_id);

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

-- Get conversation between two users
CREATE OR REPLACE FUNCTION get_conversation(user1_uuid UUID, user2_uuid UUID, msg_limit INT DEFAULT 50)
RETURNS TABLE(
  message_id UUID,
  sender_id UUID,
  sender_name TEXT,
  sender_photo TEXT,
  message_text TEXT,
  is_mine BOOLEAN,
  read_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    pm.id as message_id,
    pm.sender_id,
    u.name as sender_name,
    u.profile_photo as sender_photo,
    pm.message_text,
    (pm.sender_id = user1_uuid) as is_mine,
    pm.read_at,
    pm.created_at as sent_at
  FROM public.private_messages pm
  JOIN public.users u ON u.id = pm.sender_id
  WHERE (pm.sender_id = user1_uuid AND pm.receiver_id = user2_uuid)
     OR (pm.sender_id = user2_uuid AND pm.receiver_id = user1_uuid)
  ORDER BY pm.created_at DESC
  LIMIT msg_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get all conversations for a user (with last message preview)
CREATE OR REPLACE FUNCTION get_conversations_list(user_uuid UUID)
RETURNS TABLE(
  friend_id UUID,
  friend_name TEXT,
  friend_email TEXT,
  friend_photo TEXT,
  last_message TEXT,
  last_message_time TIMESTAMPTZ,
  last_message_is_mine BOOLEAN,
  unread_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  WITH conversation_partners AS (
    -- Get all unique conversation partners
    SELECT DISTINCT
      CASE
        WHEN pm.sender_id = user_uuid THEN pm.receiver_id
        ELSE pm.sender_id
      END as partner_id
    FROM public.private_messages pm
    WHERE pm.sender_id = user_uuid OR pm.receiver_id = user_uuid
  ),
  latest_messages AS (
    -- Get the latest message for each conversation
    SELECT DISTINCT ON (
      LEAST(pm.sender_id, pm.receiver_id),
      GREATEST(pm.sender_id, pm.receiver_id)
    )
      pm.id,
      pm.sender_id,
      pm.receiver_id,
      pm.message_text,
      pm.created_at,
      pm.read_at
    FROM public.private_messages pm
    WHERE pm.sender_id = user_uuid OR pm.receiver_id = user_uuid
    ORDER BY
      LEAST(pm.sender_id, pm.receiver_id),
      GREATEST(pm.sender_id, pm.receiver_id),
      pm.created_at DESC
  ),
  unread_counts AS (
    -- Count unread messages per conversation
    SELECT
      pm.sender_id as from_user,
      COUNT(*) as cnt
    FROM public.private_messages pm
    WHERE pm.receiver_id = user_uuid
    AND pm.read_at IS NULL
    GROUP BY pm.sender_id
  )
  SELECT
    cp.partner_id as friend_id,
    u.name as friend_name,
    u.email as friend_email,
    u.profile_photo as friend_photo,
    lm.message_text as last_message,
    lm.created_at as last_message_time,
    (lm.sender_id = user_uuid) as last_message_is_mine,
    COALESCE(uc.cnt, 0) as unread_count
  FROM conversation_partners cp
  JOIN public.users u ON u.id = cp.partner_id
  LEFT JOIN latest_messages lm ON (
    (lm.sender_id = user_uuid AND lm.receiver_id = cp.partner_id)
    OR (lm.receiver_id = user_uuid AND lm.sender_id = cp.partner_id)
  )
  LEFT JOIN unread_counts uc ON uc.from_user = cp.partner_id
  -- Only show conversations with friends
  WHERE EXISTS (
    SELECT 1 FROM public.friendships f
    WHERE f.status = 'accepted'
    AND (
      (f.user_id = user_uuid AND f.friend_id = cp.partner_id)
      OR (f.friend_id = user_uuid AND f.user_id = cp.partner_id)
    )
  )
  ORDER BY lm.created_at DESC NULLS LAST;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get total unread message count for a user
CREATE OR REPLACE FUNCTION get_unread_messages_count(user_uuid UUID)
RETURNS BIGINT AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)
    FROM public.private_messages pm
    WHERE pm.receiver_id = user_uuid
    AND pm.read_at IS NULL
    -- Only count messages from friends
    AND EXISTS (
      SELECT 1 FROM public.friendships f
      WHERE f.status = 'accepted'
      AND (
        (f.user_id = user_uuid AND f.friend_id = pm.sender_id)
        OR (f.friend_id = user_uuid AND f.user_id = pm.sender_id)
      )
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Mark all messages in a conversation as read
CREATE OR REPLACE FUNCTION mark_conversation_read(user_uuid UUID, friend_uuid UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.private_messages
  SET read_at = NOW()
  WHERE receiver_id = user_uuid
  AND sender_id = friend_uuid
  AND read_at IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- COMMENTS
-- ============================================================

COMMENT ON TABLE public.private_messages IS 'Private 1-on-1 messages between friends';
COMMENT ON COLUMN public.private_messages.sender_id IS 'User who sent the message';
COMMENT ON COLUMN public.private_messages.receiver_id IS 'User who received the message';
COMMENT ON COLUMN public.private_messages.message_text IS 'The message content';
COMMENT ON COLUMN public.private_messages.read_at IS 'When the message was read (NULL if unread)';
