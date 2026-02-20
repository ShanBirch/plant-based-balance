-- ============================================================
-- CHALLENGE TYPES MIGRATION
-- Adds challenge_type column to challenges table and updates
-- the get_user_challenges RPC to return it
-- Run this in Supabase SQL Editor
-- ============================================================

-- Step 1: Add challenge_type column (defaults to 'xp' for existing challenges)
ALTER TABLE public.challenges
ADD COLUMN IF NOT EXISTS challenge_type TEXT NOT NULL DEFAULT 'xp';

-- Step 2: Add named CHECK constraint separately (drop first if it exists to allow re-runs)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'challenges_challenge_type_check'
  ) THEN
    ALTER TABLE public.challenges
    ADD CONSTRAINT challenges_challenge_type_check
    CHECK (challenge_type IN ('xp', 'workouts', 'volume', 'calories', 'steps', 'streak', 'sleep', 'water'));
  END IF;
END $$;

-- Step 3: Add index for filtering by type
CREATE INDEX IF NOT EXISTS idx_challenges_type ON public.challenges(challenge_type);

-- Step 4: Drop existing function (return type is changing, so CREATE OR REPLACE won't work)
DROP FUNCTION IF EXISTS get_user_challenges(UUID);

-- Step 5: Recreate get_user_challenges with challenge_type in return table
CREATE OR REPLACE FUNCTION get_user_challenges(user_uuid UUID)
RETURNS TABLE(
  challenge_id UUID,
  challenge_name TEXT,
  challenge_type TEXT,
  creator_id UUID,
  creator_name TEXT,
  start_date DATE,
  end_date DATE,
  duration_days INT,
  status TEXT,
  days_remaining INT,
  participant_count INT,
  user_status TEXT,
  user_rank INT,
  user_points INT,
  leader_name TEXT,
  leader_points INT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id as challenge_id,
    c.name as challenge_name,
    c.challenge_type,
    c.creator_id,
    creator.name as creator_name,
    c.start_date,
    c.end_date,
    c.duration_days,
    c.status,
    GREATEST(0, c.end_date - CURRENT_DATE)::INT as days_remaining,
    (SELECT COUNT(*)::INT FROM public.challenge_participants cp2
     WHERE cp2.challenge_id = c.id AND cp2.status = 'accepted') as participant_count,
    cp.status as user_status,
    (SELECT COUNT(*)::INT + 1 FROM public.challenge_participants cp3
     WHERE cp3.challenge_id = c.id AND cp3.status = 'accepted'
     AND cp3.challenge_points > cp.challenge_points) as user_rank,
    cp.challenge_points as user_points,
    (SELECT u.name FROM public.challenge_participants cp4
     JOIN public.users u ON u.id = cp4.user_id
     WHERE cp4.challenge_id = c.id AND cp4.status = 'accepted'
     ORDER BY cp4.challenge_points DESC LIMIT 1) as leader_name,
    (SELECT cp5.challenge_points FROM public.challenge_participants cp5
     WHERE cp5.challenge_id = c.id AND cp5.status = 'accepted'
     ORDER BY cp5.challenge_points DESC LIMIT 1) as leader_points
  FROM public.challenges c
  JOIN public.challenge_participants cp ON cp.challenge_id = c.id AND cp.user_id = user_uuid
  JOIN public.users creator ON creator.id = c.creator_id
  WHERE c.status IN ('pending', 'active')
  ORDER BY
    CASE WHEN cp.status = 'invited' THEN 0 ELSE 1 END,
    c.start_date ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
