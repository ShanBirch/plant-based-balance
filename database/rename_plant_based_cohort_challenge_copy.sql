-- Rename the plant_based_30 cohort's user-facing challenge copy.
-- This keeps future auto-created cohorts aligned with the current neutral
-- "30 Day Challenge" positioning.

DO $$
DECLARE
  ddl text;
BEGIN
  SELECT pg_get_functiondef('public.auto_enroll_user_in_cohort(uuid,text)'::regprocedure)
    INTO ddl;

  ddl := replace(ddl, '''30-Day Plant-Based Challenge''', '''30 Day Challenge''');
  ddl := replace(ddl, '''30-Day Plant-Based Transformation Challenge''', '''30 Day Challenge''');

  EXECUTE ddl;
END $$;
