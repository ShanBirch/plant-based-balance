-- Fix account deletion (round 2): rewrite EVERY foreign key referencing
-- public.users(id) or auth.users(id) so that user deletion cascades correctly.
--
-- Background: many tables in this codebase were created with
-- `CREATE TABLE IF NOT EXISTS ... ON DELETE CASCADE`, but if the table
-- already existed (without the cascade clause), the IF NOT EXISTS was a
-- no-op and the constraint stayed as the default ON DELETE NO ACTION.
-- Result: deleting a user fails with FK violations like
--   "daily_nutrition_user_id_fkey ... Key is still referenced".
--
-- Strategy:
--   * NOT NULL FK column => ON DELETE CASCADE (the row is meaningless
--     without the user, e.g. workouts, daily_nutrition, mood_logs).
--   * Nullable FK column => ON DELETE SET NULL (we want to keep the row
--     but clear the reference, e.g. winner_id, approved_by,
--     referred_by_user_id).
--
-- Special case: public.users.id itself references auth.users(id) -- we
-- leave that as ON DELETE CASCADE (already correct).

DO $$
DECLARE
  rec RECORD;
  new_action TEXT;
  new_clause TEXT;
  new_cname  TEXT;
BEGIN
  FOR rec IN
    SELECT
      con.conname            AS constraint_name,
      nsp.nspname            AS table_schema,
      cls.relname            AS table_name,
      att.attname            AS column_name,
      att.attnotnull         AS is_not_null,
      ref_nsp.nspname        AS ref_schema,
      ref_cls.relname        AS ref_table,
      ref_att.attname        AS ref_column,
      con.confdeltype        AS delete_action  -- 'a'=NO ACTION, 'r'=RESTRICT, 'c'=CASCADE, 'n'=SET NULL, 'd'=SET DEFAULT
    FROM pg_constraint con
    JOIN pg_class cls       ON cls.oid = con.conrelid
    JOIN pg_namespace nsp   ON nsp.oid = cls.relnamespace
    JOIN pg_class ref_cls   ON ref_cls.oid = con.confrelid
    JOIN pg_namespace ref_nsp ON ref_nsp.oid = ref_cls.relnamespace
    JOIN LATERAL unnest(con.conkey)  WITH ORDINALITY AS k(attnum, ord) ON TRUE
    JOIN LATERAL unnest(con.confkey) WITH ORDINALITY AS rk(attnum, ord) ON rk.ord = k.ord
    JOIN pg_attribute att     ON att.attrelid = con.conrelid    AND att.attnum = k.attnum
    JOIN pg_attribute ref_att ON ref_att.attrelid = con.confrelid AND ref_att.attnum = rk.attnum
    WHERE con.contype = 'f'
      AND ref_nsp.nspname IN ('public', 'auth')
      AND ref_cls.relname = 'users'
      AND ref_att.attname = 'id'
      AND array_length(con.conkey, 1) = 1  -- only single-column FKs
      -- skip the public.users -> auth.users link itself; it's already CASCADE
      AND NOT (nsp.nspname = 'public' AND cls.relname = 'users' AND att.attname = 'id')
  LOOP
    -- Decide the desired action.
    IF rec.is_not_null THEN
      new_action := 'c';  -- CASCADE
      new_clause := 'ON DELETE CASCADE';
    ELSE
      new_action := 'n';  -- SET NULL
      new_clause := 'ON DELETE SET NULL';
    END IF;

    -- Already correct? skip.
    IF rec.delete_action = new_action THEN
      CONTINUE;
    END IF;

    RAISE NOTICE 'Fixing FK %.%.% -> %.%(%): % -> %',
      rec.table_schema, rec.table_name, rec.column_name,
      rec.ref_schema, rec.ref_table, rec.ref_column,
      rec.delete_action, new_action;

    EXECUTE format('ALTER TABLE %I.%I DROP CONSTRAINT %I',
                   rec.table_schema, rec.table_name, rec.constraint_name);

    new_cname := rec.table_name || '_' || rec.column_name || '_fkey';
    EXECUTE format(
      'ALTER TABLE %I.%I
         ADD CONSTRAINT %I
         FOREIGN KEY (%I) REFERENCES %I.%I(%I) %s',
      rec.table_schema, rec.table_name,
      new_cname,
      rec.column_name,
      rec.ref_schema, rec.ref_table, rec.ref_column,
      new_clause
    );
  END LOOP;
END $$;
