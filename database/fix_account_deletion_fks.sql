-- Fix account deletion: several FKs reference public.users(id) without
-- ON DELETE CASCADE/SET NULL, which blocks the cascade from auth.users.
-- Re-create them with ON DELETE SET NULL so users can be deleted cleanly.
--
-- Symptom this fixes:
--   {"code":500,"error_code":"unexpected_failure",
--    "msg":"Database error deleting user"}
-- on /auth/v1/admin/users/{id}.

DO $$
DECLARE
  rec RECORD;
  cname TEXT;
BEGIN
  FOR rec IN
    SELECT * FROM (VALUES
      ('public', 'users',                    'referred_by_user_id'),
      ('public', 'challenges',               'winner_id'),
      ('public', 'game_matches',             'winner_id'),
      ('public', 'tamagotchi_battles',       'winner_id'),
      ('public', 'quiz_battles',             'winner_id'),
      ('public', 'workout_duels',            'winner_id'),
      ('public', 'pending_coach_responses',  'approved_by')
    ) AS t(table_schema, table_name, column_name)
  LOOP
    -- Find existing FK on this column (if any) and drop it.
    SELECT tc.constraint_name INTO cname
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
     AND tc.table_schema    = kcu.table_schema
    WHERE tc.table_schema    = rec.table_schema
      AND tc.table_name      = rec.table_name
      AND tc.constraint_type = 'FOREIGN KEY'
      AND kcu.column_name    = rec.column_name
    LIMIT 1;

    IF cname IS NOT NULL THEN
      EXECUTE format('ALTER TABLE %I.%I DROP CONSTRAINT %I',
                     rec.table_schema, rec.table_name, cname);
    END IF;

    -- Re-add with ON DELETE SET NULL.
    EXECUTE format(
      'ALTER TABLE %I.%I
         ADD CONSTRAINT %I
         FOREIGN KEY (%I) REFERENCES public.users(id) ON DELETE SET NULL',
      rec.table_schema, rec.table_name,
      rec.table_name || '_' || rec.column_name || '_fkey',
      rec.column_name
    );
  END LOOP;
END $$;
