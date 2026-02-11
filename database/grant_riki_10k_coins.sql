-- Grant 10,000 coins to Riki (rikipreston14@live.com)
-- Run this in the Supabase SQL Editor

SELECT credit_coins(
    (SELECT id FROM public.users WHERE email = 'rikipreston14@live.com'),
    10000,
    'admin_grant',
    'Manual grant - 10,000 coins for Riki',
    NULL
);

-- Verify the balance after granting
SELECT email, name, coin_balance
FROM public.users
WHERE email = 'rikipreston14@live.com';
