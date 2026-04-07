-- Nutrition Goals Migration
-- Add height, goal_weight, sex, and calculated nutrition goals to quiz_results table

-- Add new columns to quiz_results table
ALTER TABLE public.quiz_results
ADD COLUMN IF NOT EXISTS height NUMERIC, -- in cm
ADD COLUMN IF NOT EXISTS goal_weight NUMERIC, -- in kg
ADD COLUMN IF NOT EXISTS sex TEXT, -- 'female' or 'male' (for BMR calculation)
ADD COLUMN IF NOT EXISTS bmr NUMERIC, -- Basal Metabolic Rate
ADD COLUMN IF NOT EXISTS tdee NUMERIC, -- Total Daily Energy Expenditure
ADD COLUMN IF NOT EXISTS calorie_goal NUMERIC,
ADD COLUMN IF NOT EXISTS protein_goal_g NUMERIC,
ADD COLUMN IF NOT EXISTS carbs_goal_g NUMERIC,
ADD COLUMN IF NOT EXISTS fat_goal_g NUMERIC;
