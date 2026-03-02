-- SQL Script to grant 50,000 coins to the user shannonrhysbirch@gmail.com
-- This script should be run in the Supabase SQL Editor as an administrator.

DO $$
DECLARE
    target_user_id UUID;
    v_balance INTEGER;
BEGIN
    -- 1. Find the user ID by email
    -- Note: We check auth.users first, then public.users
    SELECT id INTO target_user_id FROM auth.users WHERE email = 'shannonrhysbirch@gmail.com';

    IF target_user_id IS NULL THEN
        -- Fallback check in public.users if auth.users is unreachable or if profile exists but auth metadata is different
        SELECT id INTO target_user_id FROM public.users WHERE email = 'shannonrhysbirch@gmail.com';
    END IF;

    -- 2. If user found, credit the coins
    IF target_user_id IS NOT NULL THEN
        SELECT credit_coins(
            target_user_id,
            50000,
            'admin_grant',
            'Admin Grant: 50,000 coins - requested by user',
            NULL
        ) INTO v_balance;

        RAISE NOTICE 'SUCCESS: Granted 50,000 coins to shannonrhysbirch@gmail.com (ID: %). New balance: %', target_user_id, v_balance;
    ELSE
        RAISE EXCEPTION 'ERROR: User with email shannonrhysbirch@gmail.com not found in auth.users or public.users';
    END IF;
END $$;
