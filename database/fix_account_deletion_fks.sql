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
BEGIN
  FOR rec IN
    SELECT table_schema, table_name, column_name, fk_table, fk_column
    FROM (VALUES
      ('public', 'users',                    'referred_by_user_id', 'public.users', 'id'),
      ('public', 'challenges',               'winner_id',           'public.users', 'id'),
      ('public', 'game_matches',             'winner_id',           'public.users', 'id'),
      ('public', 'tamagotchi_battles',       'winner_id',           'public.users', 'id'),
      ('public', 'quiz_battles',             'winner_id',           'public.users', 'id'),
      ('public', 'workout_duels',            'winner_id',           'public.users', 'id'),
      ('public', 'pending_coach_responses',  'approved_by',         'public.users', 'id')
    ) AS t(table_schema, table_name, column_name, fk_table, fk_column)
  LOOP
    -- Drop existing FK constraint on this column (if any).
    EXECUTE format($f$
      DO $inner$
      DECLARE
        cname TEXT;
      BEGIN
        SELECT tc.constraint_name INTO cname
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
         AND tc.table_schema = kcu.table_schema
        WHERE tc.table_schema = %L
          AND tc.table_name   = %L
          AND tc.constraint_type = 'FOREIGN KEY'
          AND kcu.column_name = %L
        LIMIT 1;

        IF cname IS NOT NULL THEN
          EXECUTE format('ALTER TABLE %I.%I DROP CONSTRAINT %I',
                         %L, %L, cname);
        END IF;
      END
      $inner$;
    $f$, rec.table_schema, rec.table_name, rec.column_name,
         rec.table_schema, rec.table_name);

    -- Re-add FK with ON DELETE SET NULL.
    EXECUTE format(
      'ALTER TABLE %I.%I
         ADD CONSTRAINT %I
         FOREIGN KEY (%I) REFERENCES %s(%I) ON DELETE SET NULL',
      rec.table_schema, rec.table_name,
      rec.table_name || '_' || rec.column_name || '_fkey',
      rec.column_name, rec.fk_table, rec.fk_column
    );
  END LOOP;
END $$;
