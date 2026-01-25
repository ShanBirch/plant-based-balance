-- ============================================================
-- NUDGES SYSTEM MIGRATION
-- Send friendly reminders to friends who haven't worked out
-- ============================================================

-- ============================================================
-- NUDGES TABLE (tracks nudge notifications between friends)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.nudges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Who sent and received the nudge
  sender_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- Nudge content
  message TEXT NOT NULL,

  -- Status tracking
  read_at TIMESTAMPTZ DEFAULT NULL,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Prevent self-nudging
  CHECK (sender_id != receiver_id)
);

-- Index for fast queries
CREATE INDEX IF NOT EXISTS idx_nudges_receiver ON public.nudges(receiver_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_nudges_sender_date ON public.nudges(sender_id, created_at DESC);

-- Enable RLS
ALTER TABLE public.nudges ENABLE ROW LEVEL SECURITY;

-- Users can view nudges they sent or received
CREATE POLICY "Users can view own nudges" ON public.nudges
  FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- Users can send nudges
CREATE POLICY "Users can send nudges" ON public.nudges
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- Users can update nudges they received (to mark as read)
CREATE POLICY "Users can mark nudges as read" ON public.nudges
  FOR UPDATE USING (auth.uid() = receiver_id);

-- Users can delete nudges they sent or received
CREATE POLICY "Users can delete own nudges" ON public.nudges
  FOR DELETE USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

-- Check if user can nudge a friend (limit 1 per day per friend)
CREATE OR REPLACE FUNCTION can_nudge_friend(sender UUID, receiver UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- Check if a nudge was sent in the last 24 hours
  RETURN NOT EXISTS (
    SELECT 1 FROM public.nudges
    WHERE sender_id = sender
    AND receiver_id = receiver
    AND created_at > NOW() - INTERVAL '24 hours'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get friend's activity status for today
CREATE OR REPLACE FUNCTION get_friend_activity_status(friend_uuid UUID)
RETURNS TABLE(
  has_workout_today BOOLEAN,
  has_meal_today BOOLEAN,
  current_streak INT,
  last_workout_date DATE
) AS $$
DECLARE
  today DATE := CURRENT_DATE;
BEGIN
  RETURN QUERY
  SELECT
    -- Check if they logged a workout today
    EXISTS(
      SELECT 1 FROM public.workouts
      WHERE user_id = friend_uuid
      AND workout_type = 'history'
      AND workout_date = today
    ) as has_workout_today,
    -- Check if they logged a meal today (check calorie_logs or daily_nutrition)
    EXISTS(
      SELECT 1 FROM public.calorie_logs
      WHERE user_id = friend_uuid
      AND DATE(logged_at) = today
    ) as has_meal_today,
    -- Get their current streak from user_points
    COALESCE(
      (SELECT current_streak FROM public.user_points WHERE user_id = friend_uuid),
      0
    )::INT as current_streak,
    -- Get their last workout date
    (
      SELECT MAX(workout_date)::DATE
      FROM public.workouts
      WHERE user_id = friend_uuid
      AND workout_type = 'history'
    ) as last_workout_date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get all friends with their activity status (for friends bar)
CREATE OR REPLACE FUNCTION get_friends_with_status(user_uuid UUID)
RETURNS TABLE(
  friend_id UUID,
  friend_name TEXT,
  friend_email TEXT,
  friend_photo TEXT,
  has_workout_today BOOLEAN,
  has_meal_today BOOLEAN,
  current_streak INT,
  last_workout_date DATE,
  can_nudge BOOLEAN,
  weekly_points INT
) AS $$
DECLARE
  today DATE := CURRENT_DATE;
  week_start DATE := DATE_TRUNC('week', CURRENT_DATE)::DATE;
BEGIN
  RETURN QUERY
  SELECT * FROM (
    -- Get friends where user sent the request
    SELECT
      u.id as friend_id,
      u.name as friend_name,
      u.email as friend_email,
      u.profile_photo as friend_photo,
      EXISTS(
        SELECT 1 FROM public.workouts w
        WHERE w.user_id = u.id AND w.workout_type = 'history' AND w.workout_date = today
      ) as has_workout_today,
      EXISTS(
        SELECT 1 FROM public.daily_nutrition dn
        WHERE dn.user_id = u.id AND dn.nutrition_date = today
      ) as has_meal_today,
      COALESCE((SELECT up.current_streak FROM public.user_points up WHERE up.user_id = u.id), 0)::INT as current_streak,
      (SELECT MAX(w.workout_date)::DATE FROM public.workouts w WHERE w.user_id = u.id AND w.workout_type = 'history') as last_workout_date,
      NOT EXISTS(
        SELECT 1 FROM public.nudges n
        WHERE n.sender_id = user_uuid AND n.receiver_id = u.id
        AND n.created_at > NOW() - INTERVAL '24 hours'
      ) as can_nudge,
      COALESCE((
        SELECT SUM(pt.points)::INT
        FROM public.point_transactions pt
        WHERE pt.user_id = u.id
        AND pt.created_at >= week_start
      ), 0) as weekly_points
    FROM public.friendships f
    JOIN public.users u ON u.id = f.friend_id
    WHERE f.user_id = user_uuid AND f.status = 'accepted'

    UNION

    -- Get friends where user received the request
    SELECT
      u.id as friend_id,
      u.name as friend_name,
      u.email as friend_email,
      u.profile_photo as friend_photo,
      EXISTS(
        SELECT 1 FROM public.workouts w
        WHERE w.user_id = u.id AND w.workout_type = 'history' AND w.workout_date = today
      ) as has_workout_today,
      EXISTS(
        SELECT 1 FROM public.daily_nutrition dn
        WHERE dn.user_id = u.id AND dn.nutrition_date = today
      ) as has_meal_today,
      COALESCE((SELECT up.current_streak FROM public.user_points up WHERE up.user_id = u.id), 0)::INT as current_streak,
      (SELECT MAX(w.workout_date)::DATE FROM public.workouts w WHERE w.user_id = u.id AND w.workout_type = 'history') as last_workout_date,
      NOT EXISTS(
        SELECT 1 FROM public.nudges n
        WHERE n.sender_id = user_uuid AND n.receiver_id = u.id
        AND n.created_at > NOW() - INTERVAL '24 hours'
      ) as can_nudge,
      COALESCE((
        SELECT SUM(pt.points)::INT
        FROM public.point_transactions pt
        WHERE pt.user_id = u.id
        AND pt.created_at >= week_start
      ), 0) as weekly_points
    FROM public.friendships f
    JOIN public.users u ON u.id = f.user_id
    WHERE f.friend_id = user_uuid AND f.status = 'accepted'
  ) AS friends_union
  ORDER BY weekly_points DESC, current_streak DESC, friend_name;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get unread nudges for a user
CREATE OR REPLACE FUNCTION get_unread_nudges(user_uuid UUID)
RETURNS TABLE(
  nudge_id UUID,
  sender_id UUID,
  sender_name TEXT,
  sender_photo TEXT,
  message TEXT,
  sent_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    n.id as nudge_id,
    u.id as sender_id,
    u.name as sender_name,
    u.profile_photo as sender_photo,
    n.message,
    n.created_at as sent_at
  FROM public.nudges n
  JOIN public.users u ON u.id = n.sender_id
  WHERE n.receiver_id = user_uuid
  AND n.read_at IS NULL
  ORDER BY n.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- COMMENTS
-- ============================================================

COMMENT ON TABLE public.nudges IS 'Friendly reminder notifications between friends';
COMMENT ON COLUMN public.nudges.sender_id IS 'User who sent the nudge';
COMMENT ON COLUMN public.nudges.receiver_id IS 'User who received the nudge';
COMMENT ON COLUMN public.nudges.message IS 'The nudge message content';
COMMENT ON COLUMN public.nudges.read_at IS 'When the nudge was read (NULL if unread)';
