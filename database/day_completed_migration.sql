-- Migration: Add day_completed tracking to daily_nutrition
-- Purpose: Allow users to mark their nutrition day as complete even if
-- they didn't hit their macro goals. This enables the AI coach to know
-- that all meals for the day have been tracked.

-- Add day_completed flag and timestamp
ALTER TABLE public.daily_nutrition
  ADD COLUMN IF NOT EXISTS day_completed BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS day_completed_at TIMESTAMPTZ;

-- Index for querying completed days (useful for AI coach)
CREATE INDEX IF NOT EXISTS idx_daily_nutrition_completed
  ON public.daily_nutrition (user_id, nutrition_date)
  WHERE day_completed = TRUE;
