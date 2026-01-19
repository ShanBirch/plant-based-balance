-- Migration: Allow admins to insert conversations for any user
-- This is needed for the coach message approval flow where admin
-- inserts approved messages into the user's conversation history

-- Add policy for admins to INSERT conversations for any user
CREATE POLICY "Admins can insert conversations for any user" ON public.conversations
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE admin_users.user_id = auth.uid()
    )
  );

-- Also add policy for admins to UPDATE conversations for any user (if needed)
CREATE POLICY "Admins can update conversations for any user" ON public.conversations
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE admin_users.user_id = auth.uid()
    )
  );

-- Verify the policies were created
SELECT
  policyname,
  cmd,
  permissive
FROM pg_policies
WHERE tablename = 'conversations'
ORDER BY policyname;
