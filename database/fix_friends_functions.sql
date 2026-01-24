-- ============================================================
-- FIX: UNION/ORDER BY issue in friends functions
-- Run this in Supabase SQL Editor to fix the friends list error
-- ============================================================

-- Fix get_friends function (wrap UNION in subquery for ORDER BY)
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

-- Fix get_friends_with_status function (wrap UNION in subquery for ORDER BY)
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
        SELECT 1 FROM public.calorie_logs cl
        WHERE cl.user_id = u.id AND DATE(cl.logged_at) = today
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
        SELECT 1 FROM public.calorie_logs cl
        WHERE cl.user_id = u.id AND DATE(cl.logged_at) = today
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
