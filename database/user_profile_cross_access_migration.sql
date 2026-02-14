-- Migration: Allow friends to view each other's profile data
-- Purpose: Enable the User Profile Page feature where users can view
-- a friend's personal bests, points/level, milestones, and posts

-- ============================================================
-- PERSONAL BESTS: Allow friends to view each other's PBs
-- ============================================================
CREATE POLICY "Friends can view personal bests" ON public.personal_bests
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.friendships
      WHERE status = 'accepted'
      AND (
        (friendships.user_id = auth.uid() AND friendships.friend_id = personal_bests.user_id)
        OR
        (friendships.friend_id = auth.uid() AND friendships.user_id = personal_bests.user_id)
      )
    )
  );

-- ============================================================
-- USER POINTS: Allow friends to view each other's points/level
-- ============================================================
CREATE POLICY "Friends can view points" ON public.user_points
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.friendships
      WHERE status = 'accepted'
      AND (
        (friendships.user_id = auth.uid() AND friendships.friend_id = user_points.user_id)
        OR
        (friendships.friend_id = auth.uid() AND friendships.user_id = user_points.user_id)
      )
    )
  );

-- NOTE: workout_milestones table does not exist in production yet.
-- When it is created, add a similar policy for it.
