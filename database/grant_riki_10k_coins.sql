-- Fix Riki's account (rikipreston14@live.com)
-- Run this in the Supabase SQL Editor

-- 1. Grant 10,000 coins
SELECT credit_coins(
    (SELECT id FROM public.users WHERE email = 'rikipreston14@live.com'),
    10000,
    'admin_grant',
    'Manual grant - 10,000 coins for Riki',
    NULL
);

-- 2. Ensure user_points row exists (required for tamagotchi/FitGotchi level system)
INSERT INTO public.user_points (user_id)
VALUES ((SELECT id FROM public.users WHERE email = 'rikipreston14@live.com'))
ON CONFLICT (user_id) DO NOTHING;

-- 3. Verify everything is set
SELECT u.email, u.name, u.coin_balance, u.sex, u.onboarding_complete,
       p.current_points, p.lifetime_points, p.current_streak
FROM public.users u
LEFT JOIN public.user_points p ON p.user_id = u.id
WHERE u.email = 'rikipreston14@live.com';
