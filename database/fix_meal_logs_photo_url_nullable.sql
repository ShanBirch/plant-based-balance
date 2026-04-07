-- Fix: Allow photo_url to be NULL in meal_logs
-- Text and voice meal entries don't have photos, so this column must be nullable.
-- This resolves: "null value in column photo_url violates not-null constraint"

ALTER TABLE public.meal_logs ALTER COLUMN photo_url DROP NOT NULL;
ALTER TABLE public.meal_logs ALTER COLUMN storage_path DROP NOT NULL;
