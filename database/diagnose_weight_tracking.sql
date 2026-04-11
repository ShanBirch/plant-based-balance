-- ============================================================
-- DIAGNOSTIC: Weight Loss Challenge Not Tracking Weigh-Ins
--
-- Run these one at a time in Supabase SQL Editor to see what's
-- actually in the DB. Replace the UUIDs at the top with your own.
-- ============================================================

-- Find your user id (look for your name / email)
SELECT id, name, email
FROM public.users
ORDER BY created_at DESC
LIMIT 10;

-- ============================================================
-- Set these before running the rest:
-- ============================================================
-- \set my_user_id 'REPLACE-WITH-YOUR-USER-ID'
-- \set my_challenge_id 'REPLACE-WITH-CHALLENGE-ID'

-- Or just paste the UUIDs inline below.

-- 1. Does the weight_goal column exist on challenge_participants?
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'challenge_participants'
ORDER BY ordinal_position;

-- 2. List your active weight loss challenges
SELECT
    c.id AS challenge_id,
    c.name,
    c.challenge_type,
    c.status,
    c.start_date,
    c.end_date,
    cp.status AS my_status,
    cp.current_points AS my_current_points,
    cp.challenge_points AS my_challenge_points,
    cp.weight_goal
FROM public.challenges c
JOIN public.challenge_participants cp ON cp.challenge_id = c.id
WHERE c.challenge_type = 'weight_loss'
AND cp.user_id = 'REPLACE-WITH-YOUR-USER-ID'
ORDER BY c.start_date DESC;

-- 3. List your daily weigh-ins in the last 60 days
SELECT
    weigh_in_date,
    weight_kg,
    created_at
FROM public.daily_weigh_ins
WHERE user_id = 'REPLACE-WITH-YOUR-USER-ID'
AND weigh_in_date >= CURRENT_DATE - 60
ORDER BY weigh_in_date DESC;

-- 4. Try calling the leaderboard RPC directly and see what it returns
SELECT *
FROM get_challenge_leaderboard_v2(
    'REPLACE-WITH-CHALLENGE-ID'::UUID,
    'REPLACE-WITH-YOUR-USER-ID'::UUID
);

-- 5. Manually refresh YOUR points and check the result
SELECT update_challenge_participant_points('REPLACE-WITH-YOUR-USER-ID'::UUID);

SELECT
    cp.user_id,
    u.name,
    cp.current_points AS raw_points,
    cp.challenge_points,
    cp.weight_goal
FROM public.challenge_participants cp
JOIN public.users u ON u.id = cp.user_id
WHERE cp.challenge_id = 'REPLACE-WITH-CHALLENGE-ID'::UUID
AND cp.status = 'accepted';

-- 6. Check which version of update_challenge_participant_points is live
--    (look for "weight_loss" logic and confirm it doesn't use -99999999)
SELECT pg_get_functiondef(oid)
FROM pg_proc
WHERE proname = 'update_challenge_participant_points';
