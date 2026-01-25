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

-- Get friend activity feed (workouts, meals, achievements)
CREATE OR REPLACE FUNCTION get_friend_activity_feed(user_uuid UUID, days_back INT DEFAULT 7)
RETURNS TABLE(
  activity_id TEXT,
  activity_type TEXT,
  user_id UUID,
  user_name TEXT,
  user_photo TEXT,
  activity_title TEXT,
  activity_details TEXT,
  activity_value INT,
  activity_time TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM (
    -- Workouts completed by friends
    SELECT
      'workout_' || w.id::TEXT as activity_id,
      'workout'::TEXT as activity_type,
      u.id as user_id,
      u.name as user_name,
      u.profile_photo as user_photo,
      COALESCE(w.workout_name, 'Workout')::TEXT as activity_title,
      COALESCE(w.duration_minutes || ' mins', '')::TEXT as activity_details,
      COALESCE(w.duration_minutes, 0)::INT as activity_value,
      COALESCE(w.completed_at, w.created_at) as activity_time
    FROM public.workouts w
    JOIN public.users u ON u.id = w.user_id
    WHERE w.workout_type = 'history'
    AND w.workout_date >= CURRENT_DATE - days_back
    AND w.user_id IN (
      SELECT f.friend_id FROM public.friendships f WHERE f.user_id = user_uuid AND f.status = 'accepted'
      UNION
      SELECT f.user_id FROM public.friendships f WHERE f.friend_id = user_uuid AND f.status = 'accepted'
    )

    UNION ALL

    -- Meals logged by friends (daily summary)
    SELECT
      'meal_' || dn.id::TEXT as activity_id,
      'meal'::TEXT as activity_type,
      u.id as user_id,
      u.name as user_name,
      u.profile_photo as user_photo,
      'Logged meals'::TEXT as activity_title,
      dn.total_calories || ' cal'::TEXT as activity_details,
      COALESCE(dn.total_calories, 0)::INT as activity_value,
      dn.updated_at as activity_time
    FROM public.daily_nutrition dn
    JOIN public.users u ON u.id = dn.user_id
    WHERE dn.date >= CURRENT_DATE - days_back
    AND dn.total_calories > 0
    AND dn.user_id IN (
      SELECT f.friend_id FROM public.friendships f WHERE f.user_id = user_uuid AND f.status = 'accepted'
      UNION
      SELECT f.user_id FROM public.friendships f WHERE f.friend_id = user_uuid AND f.status = 'accepted'
    )

    UNION ALL

    -- Streak milestones (7, 14, 30, 60, 100 days)
    SELECT
      'streak_' || up.user_id::TEXT || '_' || up.current_streak::TEXT as activity_id,
      'achievement'::TEXT as activity_type,
      u.id as user_id,
      u.name as user_name,
      u.profile_photo as user_photo,
      (up.current_streak || '-day streak!')::TEXT as activity_title,
      'Keep it up!'::TEXT as activity_details,
      up.current_streak::INT as activity_value,
      up.updated_at as activity_time
    FROM public.user_points up
    JOIN public.users u ON u.id = up.user_id
    WHERE up.current_streak IN (7, 14, 21, 30, 60, 90, 100, 365)
    AND up.updated_at >= NOW() - INTERVAL '24 hours'
    AND up.user_id IN (
      SELECT f.friend_id FROM public.friendships f WHERE f.user_id = user_uuid AND f.status = 'accepted'
      UNION
      SELECT f.user_id FROM public.friendships f WHERE f.friend_id = user_uuid AND f.status = 'accepted'
    )
  ) AS activity_union
  ORDER BY activity_time DESC
  LIMIT 50;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
