-- Meal Timing XP Bonus Migration
-- Awards 1 bonus XP when a meal is logged within 30 minutes of the user's scheduled meal time
-- Leverages the existing meal_reminder_preferences table for schedule storage

-- ============================================================
-- ADD meal_timing_bonus COLUMN TO point_transactions
-- Track which points were awarded as meal timing bonuses
-- ============================================================
-- (No schema change needed - we use transaction_type = 'earn_meal_timing' in point_transactions)

-- ============================================================
-- FUNCTION: Check if a meal was logged on time
-- Returns true if the meal_time is within 30 minutes of the scheduled time
-- ============================================================
CREATE OR REPLACE FUNCTION check_meal_on_time(
  p_user_id UUID,
  p_meal_type TEXT,
  p_meal_time TIME
)
RETURNS BOOLEAN AS $$
DECLARE
  scheduled_time TIME;
  time_diff INTERVAL;
BEGIN
  -- Get the user's scheduled time for this meal type
  SELECT
    CASE p_meal_type
      WHEN 'breakfast' THEN breakfast_time
      WHEN 'lunch' THEN lunch_time
      WHEN 'dinner' THEN dinner_time
      ELSE NULL
    END
  INTO scheduled_time
  FROM public.meal_reminder_preferences
  WHERE user_id = p_user_id;

  -- No schedule set or snack type = no bonus
  IF scheduled_time IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Calculate absolute time difference
  time_diff := CASE
    WHEN p_meal_time >= scheduled_time THEN p_meal_time - scheduled_time
    ELSE scheduled_time - p_meal_time
  END;

  -- Check if within 30 minutes
  RETURN time_diff <= INTERVAL '30 minutes';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION check_meal_on_time TO service_role;
GRANT EXECUTE ON FUNCTION check_meal_on_time TO authenticated;
