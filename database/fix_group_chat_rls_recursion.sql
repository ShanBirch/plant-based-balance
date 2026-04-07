-- ============================================================
-- FIX: Infinite recursion in group_chat_members RLS policy
-- Error: "infinite recursion detected in policy for relation 'group_chat_members'"
-- ============================================================

-- The problem: The RLS policy on group_chat_members queries group_chat_members
-- to check membership, which triggers the same policy, causing infinite recursion.
--
-- The fix: Create a SECURITY DEFINER function that bypasses RLS when checking
-- membership, then use that function in the RLS policies.

-- ============================================================
-- STEP 1: Create helper function with SECURITY DEFINER
-- ============================================================

-- This function checks if a user is a member of a group chat
-- SECURITY DEFINER makes it run with the privileges of the function owner,
-- bypassing RLS policies and preventing the infinite recursion
CREATE OR REPLACE FUNCTION is_group_chat_member(chat_id UUID, check_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.group_chat_members
    WHERE group_chat_id = chat_id AND user_id = check_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION is_group_chat_member IS 'Checks if a user is a member of a group chat (bypasses RLS to prevent recursion)';

-- ============================================================
-- STEP 2: Drop the existing problematic policies
-- ============================================================

-- Drop policies on group_chat_members
DROP POLICY IF EXISTS "Users can view members of their chats" ON public.group_chat_members;

-- Drop policies on group_chat_messages that reference group_chat_members
DROP POLICY IF EXISTS "Users can view messages in their chats" ON public.group_chat_messages;
DROP POLICY IF EXISTS "Users can send messages to their chats" ON public.group_chat_messages;

-- Drop policy on group_chats that references group_chat_members
DROP POLICY IF EXISTS "Users can view their group chats" ON public.group_chats;

-- ============================================================
-- STEP 3: Recreate policies using the helper function
-- ============================================================

-- Group chats: users can see chats they're a member of
CREATE POLICY "Users can view their group chats" ON public.group_chats
  FOR SELECT USING (
    is_group_chat_member(id, auth.uid())
  );

-- Members: users can view members of chats they're in
-- Uses the helper function to prevent infinite recursion
CREATE POLICY "Users can view members of their chats" ON public.group_chat_members
  FOR SELECT USING (
    is_group_chat_member(group_chat_id, auth.uid())
  );

-- Messages: users can view messages in chats they're a member of
CREATE POLICY "Users can view messages in their chats" ON public.group_chat_messages
  FOR SELECT USING (
    is_group_chat_member(group_chat_id, auth.uid())
  );

-- Messages: users can send messages to chats they're in
CREATE POLICY "Users can send messages to their chats" ON public.group_chat_messages
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND is_group_chat_member(group_chat_id, auth.uid())
  );

-- ============================================================
-- DONE! The infinite recursion issue is now fixed.
-- ============================================================
