-- ============================================================
-- FIX: Add 'quiz' and 'milestone' to challenge_type constraint
-- The original constraint only had 8 types but the app supports
-- 'quiz' (Health IQ Challenge) and 'milestone' challenge types.
-- Run this in Supabase SQL Editor.
-- ============================================================

ALTER TABLE public.challenges
DROP CONSTRAINT IF EXISTS challenges_challenge_type_check;

ALTER TABLE public.challenges
ADD CONSTRAINT challenges_challenge_type_check
CHECK (challenge_type IN ('xp', 'workouts', 'volume', 'calories', 'steps', 'streak', 'sleep', 'water', 'milestone', 'quiz'));
