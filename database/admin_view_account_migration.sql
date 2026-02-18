-- Migration: Allow admins to view all user data (for "View Account" feature)
-- Purpose: Enable admin dashboard "View Account" feature where admins can
-- see any user's full account (profile, workouts, meals, check-ins, etc.)
-- Only grants SELECT (read-only) access — admins cannot modify user data.

-- ============================================================
-- ADMIN READ ACCESS: user_facts
-- ============================================================
CREATE POLICY "Admins can view all user_facts" ON public.user_facts
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.admin_users WHERE admin_users.user_id = auth.uid())
  );

-- ============================================================
-- ADMIN READ ACCESS: quiz_results
-- ============================================================
CREATE POLICY "Admins can view all quiz_results" ON public.quiz_results
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.admin_users WHERE admin_users.user_id = auth.uid())
  );

-- ============================================================
-- ADMIN READ ACCESS: workouts
-- ============================================================
CREATE POLICY "Admins can view all workouts" ON public.workouts
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.admin_users WHERE admin_users.user_id = auth.uid())
  );

-- ============================================================
-- ADMIN READ ACCESS: custom_workout_programs
-- ============================================================
CREATE POLICY "Admins can view all custom_workout_programs" ON public.custom_workout_programs
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.admin_users WHERE admin_users.user_id = auth.uid())
  );

-- ============================================================
-- ADMIN READ ACCESS: daily_checkins
-- ============================================================
CREATE POLICY "Admins can view all daily_checkins" ON public.daily_checkins
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.admin_users WHERE admin_users.user_id = auth.uid())
  );

-- ============================================================
-- ADMIN READ ACCESS: reflections
-- ============================================================
CREATE POLICY "Admins can view all reflections" ON public.reflections
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.admin_users WHERE admin_users.user_id = auth.uid())
  );

-- ============================================================
-- ADMIN READ ACCESS: uploads
-- ============================================================
CREATE POLICY "Admins can view all uploads" ON public.uploads
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.admin_users WHERE admin_users.user_id = auth.uid())
  );

-- ============================================================
-- ADMIN READ ACCESS: chat_stats
-- ============================================================
CREATE POLICY "Admins can view all chat_stats" ON public.chat_stats
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.admin_users WHERE admin_users.user_id = auth.uid())
  );

-- ============================================================
-- ADMIN READ ACCESS: user_activity
-- ============================================================
CREATE POLICY "Admins can view all user_activity" ON public.user_activity
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.admin_users WHERE admin_users.user_id = auth.uid())
  );
