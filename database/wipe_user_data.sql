-- FULLY DYNAMIC account wipe for shannonrhysbirch@gmail.com
-- This discovers ALL foreign key references automatically - no hardcoded column names
-- Run this in Supabase SQL Editor

-- STEP 1: Delete all public.* data using dynamic FK discovery
DO $$
DECLARE
    uid UUID := '3df8700e-1524-4a13-9448-557afaac5d9e';
    r RECORD;
    sql_cmd TEXT;
    del_count INT;
BEGIN
    RAISE NOTICE 'Starting full wipe for user %', uid;

    -- Loop through every FK that references auth.users or public.users
    FOR r IN
        SELECT DISTINCT
            ccu.table_schema AS src_schema,
            ccu.table_name AS src_table,
            kcu.column_name AS src_column
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage ccu
            ON tc.constraint_name = ccu.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND (
              (ccu.table_schema = 'auth' AND ccu.table_name = 'users')
              OR (ccu.table_schema = 'public' AND ccu.table_name = 'users')
          )
          AND kcu.table_schema = 'public'
        ORDER BY kcu.table_name
    LOOP
        -- Skip public.users itself (we delete that last)
        IF r.src_table = 'users' AND r.src_schema = 'public' THEN
            CONTINUE;
        END IF;

        sql_cmd := format(
            'DELETE FROM %I.%I WHERE %I = %L',
            'public', r.src_table, r.src_column, uid
        );
        RAISE NOTICE 'Running: %', sql_cmd;

        BEGIN
            EXECUTE sql_cmd;
            GET DIAGNOSTICS del_count = ROW_COUNT;
            RAISE NOTICE '  -> deleted % rows from %.%', del_count, r.src_table, r.src_column;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE '  -> SKIPPED %.% (error: %)', r.src_table, r.src_column, SQLERRM;
        END;
    END LOOP;

    -- Now also catch any UUID columns that might not have formal FKs
    -- (belt and suspenders approach)
    FOR r IN
        SELECT table_name, column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND data_type = 'uuid'
          AND column_name IN ('user_id', 'sender_id', 'receiver_id', 'viewer_id',
                              'friend_id', 'challenger_id', 'opponent_id',
                              'referrer_user_id', 'referred_user_id', 'created_by',
                              'winner_id', 'loser_id', 'owner_id')
          AND table_name != 'users'
        ORDER BY table_name
    LOOP
        sql_cmd := format(
            'DELETE FROM public.%I WHERE %I = %L',
            r.table_name, r.column_name, uid
        );

        BEGIN
            EXECUTE sql_cmd;
            GET DIAGNOSTICS del_count = ROW_COUNT;
            IF del_count > 0 THEN
                RAISE NOTICE 'Extra cleanup: deleted % rows from %.%', del_count, r.table_name, r.column_name;
            END IF;
        EXCEPTION WHEN OTHERS THEN
            -- silently skip if column doesn't match
            NULL;
        END;
    END LOOP;

    -- Finally delete the public.users row
    DELETE FROM public.users WHERE id = uid;
    RAISE NOTICE 'Deleted public.users row';

    RAISE NOTICE '=== ALL PUBLIC DATA DELETED ===';
END $$;

-- STEP 2: Delete the auth account (run separately if step 1 succeeds)
DELETE FROM auth.users WHERE id = '3df8700e-1524-4a13-9448-557afaac5d9e';
