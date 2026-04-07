-- Migration: Fix Admin Messaging Permissions
-- Purpose: Allow admins to send messages to clients and correctly identify the coach account.

-- 1. Ensure shannonrhysbirch@gmail.com is an admin
INSERT INTO public.admin_users (user_id, role, permissions)
SELECT au.id, 'admin', '["view_users", "view_conversations", "view_analytics", "approve_responses"]'::jsonb
FROM auth.users au
WHERE au.email = 'shannonrhysbirch@gmail.com'
AND NOT EXISTS (
    SELECT 1 FROM public.admin_users WHERE user_id = au.id
);

-- 2. Add INSERT policy for admins on conversations table
-- This allows admins to send messages to any user
CREATE POLICY "Admins can insert all conversations" ON public.conversations
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.admin_users WHERE admin_users.user_id = auth.uid()
    )
  );

-- 3. Add UPDATE policy for admins on conversations table
-- This allows admins to edit/manage all conversations
CREATE POLICY "Admins can update all conversations" ON public.conversations
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.admin_users WHERE admin_users.user_id = auth.uid()
    )
  );

-- 4. Fix Nudges policy to allow admins to send from any ID
-- Currently, nudges check (auth.uid() = sender_id)
-- We add a policy that bypasses this check for admins
CREATE POLICY "Admins can send nudges for any user" ON public.nudges
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.admin_users WHERE admin_users.user_id = auth.uid()
    )
  );

-- 5. Add UPDATE policy for admins on nudges (for completeness)
CREATE POLICY "Admins can update all nudges" ON public.nudges
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.admin_users WHERE admin_users.user_id = auth.uid()
    )
  );
