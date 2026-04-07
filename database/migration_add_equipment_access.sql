-- Migration: Add equipment_access column to quiz_results table
-- This column stores the user's equipment selection from onboarding
-- Values: 'none', 'dumbbells', 'home', 'gym'

ALTER TABLE public.quiz_results
ADD COLUMN IF NOT EXISTS equipment_access TEXT DEFAULT 'none';

-- Add comment for documentation
COMMENT ON COLUMN public.quiz_results.equipment_access IS 'User equipment access level: none, dumbbells, home, or gym';
