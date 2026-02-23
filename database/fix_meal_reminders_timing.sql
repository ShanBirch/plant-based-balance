-- Fix meal reminder timing: send notifications AT meal time, not 30 min after
-- Previously, reminder_delay_minutes (default 30) caused a 30-minute delay
-- BEFORE any notification was sent, which meant the XP bonus window was
-- already half-expired or fully expired by the time the user got notified.
--
-- Changes:
-- 1. SQL function now fires reminders AT meal_time with a 60-minute send window
--    (gives the 10-min cron plenty of chances to catch it)
-- 2. Default reminder_delay_minutes changed to 0 (no delay)
-- 3. Existing users with delay=30 are reset to 0

-- ============================================================
-- UPDATE THE SQL FUNCTION
-- ============================================================
CREATE OR REPLACE FUNCTION get_users_needing_meal_reminders(
  p_meal_type TEXT,
  p_current_time TIME DEFAULT NULL
)
RETURNS TABLE (
  user_id UUID,
  push_endpoint TEXT,
  push_p256dh TEXT,
  push_auth TEXT,
  user_timezone TEXT,
  user_local_date DATE
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    mrp.user_id,
    ps.endpoint,
    ps.p256dh,
    ps.auth,
    COALESCE(mrp.timezone, 'UTC')::TEXT,
    (NOW() AT TIME ZONE COALESCE(mrp.timezone, 'UTC'))::date
  FROM public.meal_reminder_preferences mrp
  JOIN public.push_subscriptions ps ON ps.user_id = mrp.user_id
  WHERE mrp.reminders_enabled = true
    AND (
      (p_meal_type = 'breakfast' AND mrp.breakfast_reminder = true
        AND (NOW() AT TIME ZONE COALESCE(mrp.timezone, 'UTC'))::time
            >= mrp.breakfast_time
        AND (NOW() AT TIME ZONE COALESCE(mrp.timezone, 'UTC'))::time
            < mrp.breakfast_time + INTERVAL '60 minutes')
      OR
      (p_meal_type = 'lunch' AND mrp.lunch_reminder = true
        AND (NOW() AT TIME ZONE COALESCE(mrp.timezone, 'UTC'))::time
            >= mrp.lunch_time
        AND (NOW() AT TIME ZONE COALESCE(mrp.timezone, 'UTC'))::time
            < mrp.lunch_time + INTERVAL '60 minutes')
      OR
      (p_meal_type = 'dinner' AND mrp.dinner_reminder = true
        AND (NOW() AT TIME ZONE COALESCE(mrp.timezone, 'UTC'))::time
            >= mrp.dinner_time
        AND (NOW() AT TIME ZONE COALESCE(mrp.timezone, 'UTC'))::time
            < mrp.dinner_time + INTERVAL '60 minutes')
    )
    -- Check they haven't already logged this meal today (in their local date)
    AND NOT has_logged_meal_type(mrp.user_id, p_meal_type,
        (NOW() AT TIME ZONE COALESCE(mrp.timezone, 'UTC'))::date)
    -- Check we haven't already sent a reminder today for this meal (in their local date)
    AND NOT EXISTS (
      SELECT 1 FROM public.meal_reminder_log mrl
      WHERE mrl.user_id = mrp.user_id
        AND mrl.meal_type = p_meal_type
        AND mrl.reminder_date = (NOW() AT TIME ZONE COALESCE(mrp.timezone, 'UTC'))::date
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- FIX DEFAULT DELAY AND RESET EXISTING USERS
-- ============================================================
ALTER TABLE public.meal_reminder_preferences
  ALTER COLUMN reminder_delay_minutes SET DEFAULT 0;

-- Reset existing users who still have the old 30-min delay
UPDATE public.meal_reminder_preferences
  SET reminder_delay_minutes = 0
  WHERE reminder_delay_minutes = 30;
