-- Migration: Add dietary_preference column to quiz_results table
-- Run this in the Supabase SQL editor

ALTER TABLE public.quiz_results
ADD COLUMN IF NOT EXISTS dietary_preference TEXT;

COMMENT ON COLUMN public.quiz_results.dietary_preference IS 'User dietary preference: omnivore, flexitarian, pescatarian, vegetarian, vegan';
