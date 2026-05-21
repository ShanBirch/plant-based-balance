-- Simplify Your Day notes into one free-text body while preserving older structured fields.
ALTER TABLE public.coach_day_notes
    ADD COLUMN IF NOT EXISTS note TEXT DEFAULT '';

ALTER TABLE public.coach_day_notes
    ALTER COLUMN expires_at SET DEFAULT (now() + INTERVAL '1 day');

UPDATE public.coach_day_notes
SET note = trim(both E'\n' from concat_ws(E'\n',
        NULLIF(trim(training), ''),
        NULLIF(trim(food), ''),
        NULLIF(trim(work), ''),
        NULLIF(trim(vibe), ''),
        NULLIF(trim(other), '')
    ))
WHERE NULLIF(trim(COALESCE(note, '')), '') IS NULL
  AND (
      NULLIF(trim(training), '') IS NOT NULL
      OR NULLIF(trim(food), '') IS NOT NULL
      OR NULLIF(trim(work), '') IS NOT NULL
      OR NULLIF(trim(vibe), '') IS NOT NULL
      OR NULLIF(trim(other), '') IS NOT NULL
  );

NOTIFY pgrst, 'reload schema';
