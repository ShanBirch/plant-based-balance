-- Migration: Fix Learning System Empty Arrays
-- Purpose: Fix get_learning_summary to return proper empty arrays instead of '{}' strings
-- Run this if you already have the learning system tables created
-- Created: February 2026

-- Update the get_learning_summary function to return proper empty arrays
CREATE OR REPLACE FUNCTION get_learning_summary(p_user_id UUID)
RETURNS JSON AS $$
DECLARE
  progress_record RECORD;
  daily_check JSON;
BEGIN
  SELECT * INTO progress_record
  FROM public.user_learning_progress
  WHERE user_id = p_user_id;

  daily_check := can_do_lesson_today(p_user_id);

  IF progress_record IS NULL THEN
    -- Return proper empty arrays instead of '{}' string literals
    RETURN json_build_object(
      'total_lessons_completed', 0,
      'total_xp_from_learning', 0,
      'modules_completed', ARRAY[]::TEXT[],
      'units_completed', ARRAY[]::TEXT[],
      'lessons_completed', ARRAY[]::TEXT[],
      'current_streak', 0,
      'longest_streak', 0,
      'daily_status', daily_check
    );
  END IF;

  RETURN json_build_object(
    'total_lessons_completed', progress_record.total_lessons_completed,
    'total_xp_from_learning', progress_record.total_xp_from_learning,
    'modules_completed', progress_record.modules_completed,
    'units_completed', progress_record.units_completed,
    'lessons_completed', progress_record.lessons_completed,
    'current_streak', progress_record.current_learning_streak,
    'longest_streak', progress_record.longest_learning_streak,
    'daily_status', daily_check
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-grant execute permissions
GRANT EXECUTE ON FUNCTION get_learning_summary TO authenticated;
GRANT EXECUTE ON FUNCTION get_learning_summary TO service_role;
