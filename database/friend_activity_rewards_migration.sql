-- ============================================================
-- FRIEND ACTIVITY REWARDS MIGRATION
-- Adds free week redemptions and referral rewards to activity feed
-- Run this in Supabase SQL Editor
-- ============================================================

-- Update get_friend_activity_feed to include rewards
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

    -- Workout story posts by friends
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

    UNION ALL

    -- Free week redemptions (200 points -> 1 week free)
    SELECT
      'free_week_' || pt.id::TEXT as activity_id,
      'free_week'::TEXT as activity_type,
      u.id as user_id,
      u.name as user_name,
      u.profile_photo as user_photo,
      'Earned a free week!'::TEXT as activity_title,
      'Redeemed 200 points'::TEXT as activity_details,
      7 as activity_value,
      pt.created_at as activity_time
    FROM public.point_transactions pt
    JOIN public.users u ON u.id = pt.user_id
    WHERE pt.transaction_type = 'redeem_week'
    AND pt.created_at >= NOW() - (days_back || ' days')::INTERVAL
    AND pt.user_id IN (
      SELECT f.friend_id FROM public.friendships f WHERE f.user_id = user_uuid AND f.status = 'accepted'
      UNION
      SELECT f.user_id FROM public.friendships f WHERE f.friend_id = user_uuid AND f.status = 'accepted'
    )

    UNION ALL

    -- Referral rewards (14 days free for inviting a friend)
    SELECT
      'referral_' || r.id::TEXT as activity_id,
      'referral_reward'::TEXT as activity_type,
      u.id as user_id,
      u.name as user_name,
      u.profile_photo as user_photo,
      'Got 2 weeks free!'::TEXT as activity_title,
      'Friend joined via referral'::TEXT as activity_details,
      r.reward_days as activity_value,
      r.created_at as activity_time
    FROM public.referrals r
    JOIN public.users u ON u.id = r.referrer_user_id
    WHERE r.reward_granted = TRUE
    AND r.created_at >= NOW() - (days_back || ' days')::INTERVAL
    AND r.referrer_user_id IN (
      SELECT f.friend_id FROM public.friendships f WHERE f.user_id = user_uuid AND f.status = 'accepted'
      UNION
      SELECT f.user_id FROM public.friendships f WHERE f.friend_id = user_uuid AND f.status = 'accepted'
    )

  ) AS activity_union
  ORDER BY activity_time DESC
  LIMIT 50;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment
COMMENT ON FUNCTION get_friend_activity_feed IS 'Returns activity feed for friends including workouts, meals, stories, achievements, free week redemptions, and referral rewards';
