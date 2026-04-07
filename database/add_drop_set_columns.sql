-- Migration: Add drop set support to workouts table
-- Purpose: Allow users to record drop sets (multiple weight drops within a single set)

-- Add columns to existing workouts table
ALTER TABLE public.workouts
ADD COLUMN IF NOT EXISTS is_drop_set BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS drop_set_weights TEXT,  -- Comma-separated weights: "30,20,10"
ADD COLUMN IF NOT EXISTS drop_set_reps TEXT;     -- Comma-separated reps: "8,6,8"

-- Add comment for documentation
COMMENT ON COLUMN public.workouts.is_drop_set IS 'Indicates if this set is a drop set';
COMMENT ON COLUMN public.workouts.drop_set_weights IS 'Comma-separated weights for drop set (e.g., "30,20,10")';
COMMENT ON COLUMN public.workouts.drop_set_reps IS 'Comma-separated reps for drop set (e.g., "8,6,8")';
