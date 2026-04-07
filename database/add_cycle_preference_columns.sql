-- Migration: Add cycle body response and sync preference columns to quiz_results
-- Date: 2026-01-22
-- Description: Adds two new fields to store user preferences for cycle-based workout recommendations

-- Add cycle_body_response column
ALTER TABLE public.quiz_results
ADD COLUMN IF NOT EXISTS cycle_body_response TEXT;

-- Add cycle_sync_preference column
ALTER TABLE public.quiz_results
ADD COLUMN IF NOT EXISTS cycle_sync_preference TEXT;

-- Add comments for documentation
COMMENT ON COLUMN public.quiz_results.cycle_body_response IS 'How the user feels during their cycle: strong or tired';
COMMENT ON COLUMN public.quiz_results.cycle_sync_preference IS 'Whether user wants workouts synced to cycle: yes or no';
