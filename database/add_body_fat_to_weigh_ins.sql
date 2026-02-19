-- Add body_fat_pct column to daily_weigh_ins table
-- Stores body fat percentage calculated from calliper measurements (Jackson-Pollock 3-site)

ALTER TABLE public.daily_weigh_ins
  ADD COLUMN IF NOT EXISTS body_fat_pct NUMERIC;

COMMENT ON COLUMN public.daily_weigh_ins.body_fat_pct IS
  'Body fat percentage (0-60). Calculated from Jackson-Pollock 3-site skinfold measurements.';
