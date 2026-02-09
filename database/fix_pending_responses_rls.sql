-- FIX: Allow users to insert their own pending responses
-- Run this in Supabase SQL Editor

-- Drop the problematic policies if they exist
DROP POLICY IF EXISTS "Service can insert pending responses" ON public.pending_coach_responses;
DROP POLICY IF EXISTS "Users can insert own pending responses" ON public.pending_coach_responses;

-- Allow ANY authenticated user to insert their own pending responses
-- This is needed because when a user sends a message, THEIR browser inserts the pending response
CREATE POLICY "Users can insert own pending responses" ON public.pending_coach_responses
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Also allow users to view their own pending responses (so they know it's pending)
DROP POLICY IF EXISTS "Users can view own pending responses" ON public.pending_coach_responses;
CREATE POLICY "Users can view own pending responses" ON public.pending_coach_responses
  FOR SELECT USING (auth.uid() = user_id);
