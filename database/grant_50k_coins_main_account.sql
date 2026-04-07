-- Grant 50,000 coins to main account (shannonbirch@cocospersonaltraining.com)
-- Uses the credit_coins function with admin_grant transaction type

DO $$
DECLARE
    target_user_id UUID;
    resulting_balance INTEGER;
BEGIN
    -- Look up user by email
    SELECT id INTO target_user_id
    FROM public.users
    WHERE email = 'shannonbirch@cocospersonaltraining.com';

    IF target_user_id IS NULL THEN
        RAISE EXCEPTION 'User with email shannonbirch@cocospersonaltraining.com not found';
    END IF;

    -- Credit 50,000 coins via the credit_coins function
    SELECT credit_coins(
        target_user_id,
        50000,
        'admin_grant',
        'Admin grant: 50,000 coins to main account',
        NULL
    ) INTO resulting_balance;

    RAISE NOTICE 'Credited 50,000 coins to shannonbirch@cocospersonaltraining.com. New balance: %', resulting_balance;
END;
$$;
