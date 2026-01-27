-- ============================================================
-- GROUP CHAT SYSTEM MIGRATION
-- Create group chats with friends and share messages/wins
-- ============================================================

-- ============================================================
-- GROUP CHATS TABLE (the chat rooms)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.group_chats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Chat metadata
  name TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_group_chats_created_by ON public.group_chats(created_by);

-- Enable RLS
ALTER TABLE public.group_chats ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- GROUP CHAT MEMBERS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.group_chat_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Which chat and which user
  group_chat_id UUID NOT NULL REFERENCES public.group_chats(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- When they joined
  joined_at TIMESTAMPTZ DEFAULT NOW(),

  -- Each user can only be in a chat once
  UNIQUE(group_chat_id, user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_group_chat_members_chat ON public.group_chat_members(group_chat_id);
CREATE INDEX IF NOT EXISTS idx_group_chat_members_user ON public.group_chat_members(user_id);

-- Enable RLS
ALTER TABLE public.group_chat_members ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- GROUP CHAT MESSAGES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.group_chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Which chat and who sent it
  group_chat_id UUID NOT NULL REFERENCES public.group_chats(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- Message content
  message TEXT NOT NULL,

  -- Optional: if this is a win share
  is_win_share BOOLEAN DEFAULT FALSE,
  win_type TEXT, -- 'workout_complete', 'personal_best', 'milestone'
  win_details JSONB, -- {workoutName, exerciseName, improvement, duration, etc.}

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_group_chat_messages_chat ON public.group_chat_messages(group_chat_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_group_chat_messages_user ON public.group_chat_messages(user_id);

-- Enable RLS
ALTER TABLE public.group_chat_messages ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================

-- Group chats: users can see chats they're a member of
CREATE POLICY "Users can view their group chats" ON public.group_chats
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.group_chat_members
      WHERE group_chat_id = id AND user_id = auth.uid()
    )
  );

-- Group chats: users can create chats
CREATE POLICY "Users can create group chats" ON public.group_chats
  FOR INSERT WITH CHECK (auth.uid() = created_by);

-- Group chats: only creator can delete
CREATE POLICY "Creator can delete group chat" ON public.group_chats
  FOR DELETE USING (auth.uid() = created_by);

-- Members: users can view members of chats they're in
CREATE POLICY "Users can view members of their chats" ON public.group_chat_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.group_chat_members gcm
      WHERE gcm.group_chat_id = group_chat_id AND gcm.user_id = auth.uid()
    )
  );

-- Members: chat creator can add members
CREATE POLICY "Creator can add members" ON public.group_chat_members
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.group_chats
      WHERE id = group_chat_id AND created_by = auth.uid()
    )
    OR user_id = auth.uid() -- User can add themselves if invited
  );

-- Members: users can leave (delete their own membership)
CREATE POLICY "Users can leave chats" ON public.group_chat_members
  FOR DELETE USING (auth.uid() = user_id);

-- Messages: users can view messages in chats they're a member of
CREATE POLICY "Users can view messages in their chats" ON public.group_chat_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.group_chat_members
      WHERE group_chat_id = group_chat_messages.group_chat_id AND user_id = auth.uid()
    )
  );

-- Messages: users can send messages to chats they're in
CREATE POLICY "Users can send messages to their chats" ON public.group_chat_messages
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.group_chat_members
      WHERE group_chat_id = group_chat_messages.group_chat_id AND user_id = auth.uid()
    )
  );

-- Messages: users can delete their own messages
CREATE POLICY "Users can delete own messages" ON public.group_chat_messages
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

-- Get all group chats for a user with latest message preview
CREATE OR REPLACE FUNCTION get_user_group_chats(user_uuid UUID)
RETURNS TABLE(
  chat_id UUID,
  chat_name TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ,
  member_count BIGINT,
  member_names TEXT,
  last_message TEXT,
  last_message_at TIMESTAMPTZ,
  last_message_by TEXT
) AS $$
#variable_conflict use_column
BEGIN
  RETURN QUERY
  SELECT
    gc.id as chat_id,
    gc.name as chat_name,
    gc.created_by,
    gc.created_at,
    (SELECT COUNT(*) FROM public.group_chat_members WHERE group_chat_id = gc.id) as member_count,
    (
      SELECT string_agg(u.name, ', ')
      FROM public.group_chat_members gcm
      JOIN public.users u ON u.id = gcm.user_id
      WHERE gcm.group_chat_id = gc.id AND gcm.user_id != user_uuid
      LIMIT 3
    ) as member_names,
    (
      SELECT gcm.message
      FROM public.group_chat_messages gcm
      WHERE gcm.group_chat_id = gc.id
      ORDER BY gcm.created_at DESC
      LIMIT 1
    ) as last_message,
    (
      SELECT gcm.created_at
      FROM public.group_chat_messages gcm
      WHERE gcm.group_chat_id = gc.id
      ORDER BY gcm.created_at DESC
      LIMIT 1
    ) as last_message_at,
    (
      SELECT u.name
      FROM public.group_chat_messages gcm
      JOIN public.users u ON u.id = gcm.user_id
      WHERE gcm.group_chat_id = gc.id
      ORDER BY gcm.created_at DESC
      LIMIT 1
    ) as last_message_by
  FROM public.group_chats gc
  WHERE EXISTS (
    SELECT 1 FROM public.group_chat_members
    WHERE group_chat_id = gc.id AND user_id = user_uuid
  )
  ORDER BY COALESCE(
    (SELECT MAX(msg.created_at) FROM public.group_chat_messages msg WHERE msg.group_chat_id = gc.id),
    gc.created_at
  ) DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get messages for a group chat
CREATE OR REPLACE FUNCTION get_group_chat_messages(chat_uuid UUID, messages_limit INT DEFAULT 100)
RETURNS TABLE(
  message_id UUID,
  sender_id UUID,
  sender_name TEXT,
  sender_photo TEXT,
  message TEXT,
  is_win_share BOOLEAN,
  win_type TEXT,
  win_details JSONB,
  created_at TIMESTAMPTZ
) AS $$
#variable_conflict use_column
BEGIN
  RETURN QUERY
  SELECT
    gcm.id as message_id,
    gcm.user_id as sender_id,
    u.name as sender_name,
    u.profile_photo as sender_photo,
    gcm.message,
    gcm.is_win_share,
    gcm.win_type,
    gcm.win_details,
    gcm.created_at
  FROM public.group_chat_messages gcm
  JOIN public.users u ON u.id = gcm.user_id
  WHERE gcm.group_chat_id = chat_uuid
  ORDER BY gcm.created_at ASC
  LIMIT messages_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get members of a group chat
CREATE OR REPLACE FUNCTION get_group_chat_members(chat_uuid UUID)
RETURNS TABLE(
  member_id UUID,
  member_name TEXT,
  member_photo TEXT,
  joined_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    gcm.user_id as member_id,
    u.name as member_name,
    u.profile_photo as member_photo,
    gcm.joined_at
  FROM public.group_chat_members gcm
  JOIN public.users u ON u.id = gcm.user_id
  WHERE gcm.group_chat_id = chat_uuid
  ORDER BY gcm.joined_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a group chat with members
CREATE OR REPLACE FUNCTION create_group_chat(
  creator_uuid UUID,
  chat_name TEXT,
  member_ids UUID[]
)
RETURNS UUID AS $$
DECLARE
  new_chat_id UUID;
  member_id UUID;
BEGIN
  -- Create the chat
  INSERT INTO public.group_chats (name, created_by)
  VALUES (chat_name, creator_uuid)
  RETURNING id INTO new_chat_id;

  -- Add the creator as a member
  INSERT INTO public.group_chat_members (group_chat_id, user_id)
  VALUES (new_chat_id, creator_uuid);

  -- Add all other members
  FOREACH member_id IN ARRAY member_ids
  LOOP
    IF member_id != creator_uuid THEN
      INSERT INTO public.group_chat_members (group_chat_id, user_id)
      VALUES (new_chat_id, member_id)
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;

  RETURN new_chat_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- COMMENTS
-- ============================================================

COMMENT ON TABLE public.group_chats IS 'Group chat rooms';
COMMENT ON TABLE public.group_chat_members IS 'Members of each group chat';
COMMENT ON TABLE public.group_chat_messages IS 'Messages in group chats';
COMMENT ON COLUMN public.group_chat_messages.is_win_share IS 'True if this message is sharing a workout win';
COMMENT ON COLUMN public.group_chat_messages.win_details IS 'JSON with workout details if this is a win share';
