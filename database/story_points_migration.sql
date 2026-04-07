-- ============================================================
-- STORY POINTS MIGRATION
-- Adds support for awarding points for workout-related story posts
-- Run this in Supabase SQL Editor
-- ============================================================

-- Add points tracking columns to stories table
ALTER TABLE public.stories
ADD COLUMN IF NOT EXISTS points_awarded INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS workout_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS workout_type TEXT;

-- Add story tracking to user_points table
ALTER TABLE public.user_points
ADD COLUMN IF NOT EXISTS total_stories_posted INTEGER DEFAULT 0;

-- Create index for finding stories that earned points
CREATE INDEX IF NOT EXISTS idx_stories_workout_verified
ON public.stories(user_id, workout_verified)
WHERE workout_verified = TRUE;

-- Add comments
COMMENT ON COLUMN public.stories.points_awarded IS 'Points awarded for this workout story (0 if not workout-related)';
COMMENT ON COLUMN public.stories.workout_verified IS 'Whether AI verified this as a workout post';
COMMENT ON COLUMN public.stories.workout_type IS 'Type of workout detected: gym/home/outdoor/yoga/cardio/strength/sports/recovery';
COMMENT ON COLUMN public.user_points.total_stories_posted IS 'Total number of stories posted by user';

-- ============================================================
-- HELPER FUNCTION: Get user story stats
-- ============================================================
CREATE OR REPLACE FUNCTION get_user_story_stats(user_uuid UUID)
RETURNS TABLE(
  total_stories INT,
  workout_stories INT,
  total_story_points INT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::INT as total_stories,
    COUNT(*) FILTER (WHERE workout_verified = TRUE)::INT as workout_stories,
    COALESCE(SUM(points_awarded), 0)::INT as total_story_points
  FROM public.stories
  WHERE user_id = user_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- UPDATE: get_friend_activity_feed to include story posts
-- ============================================================
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
      COALESCE(w.exercise_name, 'Workout')::TEXT as activity_title,
      COALESCE(w.time_duration || ' mins', '')::TEXT as activity_details,
      COALESCE(NULLIF(w.time_duration, '')::INT, 0) as activity_value,
      w.created_at as activity_time
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

    -- Meals logged by friends (using daily_nutrition with nutrition_date)
    SELECT
      'meal_' || dn.id::TEXT as activity_id,
      'meal'::TEXT as activity_type,
      u.id as user_id,
      u.name as user_name,
      u.profile_photo as user_photo,
      'Tracked nutrition'::TEXT as activity_title,
      COALESCE(dn.calorie_goal::INT || ' cal goal', 'Logged today')::TEXT as activity_details,
      COALESCE(dn.calorie_goal::INT, 0) as activity_value,
      dn.updated_at as activity_time
    FROM public.daily_nutrition dn
    JOIN public.users u ON u.id = dn.user_id
    WHERE dn.nutrition_date >= CURRENT_DATE - days_back
    AND dn.user_id IN (
      SELECT f.friend_id FROM public.friendships f WHERE f.user_id = user_uuid AND f.status = 'accepted'
      UNION
      SELECT f.user_id FROM public.friendships f WHERE f.friend_id = user_uuid AND f.status = 'accepted'
    )

    UNION ALL

    -- Workout story posts by friends (NEW!)
    SELECT
      'story_' || s.id::TEXT as activity_id,
      'story'::TEXT as activity_type,
      u.id as user_id,
      u.name as user_name,
      u.profile_photo as user_photo,
      COALESCE('Workout story: ' || s.workout_type, 'Shared workout story')::TEXT as activity_title,
      ('+' || s.points_awarded || ' points')::TEXT as activity_details,
      COALESCE(s.points_awarded, 0) as activity_value,
      s.created_at as activity_time
    FROM public.stories s
    JOIN public.users u ON u.id = s.user_id
    WHERE s.workout_verified = TRUE
    AND s.created_at >= NOW() - (days_back || ' days')::INTERVAL
    AND s.user_id IN (
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
