-- Advance Meal Reminders Migration
-- Adds a function to find users who need a 30-minute advance warning
-- before their scheduled meal time. This gives users a heads-up like
-- "Eat within the next 30 minutes to stay in your time window."
--
-- The advance reminder uses a separate meal_type suffix ('_advance')
-- in meal_reminder_log so it doesn't block the at-time reminder.

-- ============================================================
-- ADVANCE REMINDER FUNCTION (30 min before meal time)
-- ============================================================
CREATE OR REPLACE FUNCTION get_users_needing_meal_advance_reminders(
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
      -- 30 minutes before meal time, with a 10-minute send window
      -- (the cron runs every 10 min, so this gives it one chance to fire)
      (p_meal_type = 'breakfast' AND mrp.breakfast_reminder = true
        AND (NOW() AT TIME ZONE COALESCE(mrp.timezone, 'UTC'))::time
            >= mrp.breakfast_time - INTERVAL '30 minutes'
        AND (NOW() AT TIME ZONE COALESCE(mrp.timezone, 'UTC'))::time
            < mrp.breakfast_time - INTERVAL '20 minutes')
      OR
      (p_meal_type = 'lunch' AND mrp.lunch_reminder = true
        AND (NOW() AT TIME ZONE COALESCE(mrp.timezone, 'UTC'))::time
            >= mrp.lunch_time - INTERVAL '30 minutes'
        AND (NOW() AT TIME ZONE COALESCE(mrp.timezone, 'UTC'))::time
            < mrp.lunch_time - INTERVAL '20 minutes')
      OR
      (p_meal_type = 'dinner' AND mrp.dinner_reminder = true
        AND (NOW() AT TIME ZONE COALESCE(mrp.timezone, 'UTC'))::time
            >= mrp.dinner_time - INTERVAL '30 minutes'
        AND (NOW() AT TIME ZONE COALESCE(mrp.timezone, 'UTC'))::time
            < mrp.dinner_time - INTERVAL '20 minutes')
    )
    -- Check they haven't already logged this meal today
    AND NOT has_logged_meal_type(mrp.user_id, p_meal_type,
        (NOW() AT TIME ZONE COALESCE(mrp.timezone, 'UTC'))::date)
    -- Check we haven't already sent an advance reminder today for this meal
    -- (uses '_advance' suffix to not conflict with the at-time reminder log)
    AND NOT EXISTS (
      SELECT 1 FROM public.meal_reminder_log mrl
      WHERE mrl.user_id = mrp.user_id
        AND mrl.meal_type = p_meal_type || '_advance'
        AND mrl.reminder_date = (NOW() AT TIME ZONE COALESCE(mrp.timezone, 'UTC'))::date
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
