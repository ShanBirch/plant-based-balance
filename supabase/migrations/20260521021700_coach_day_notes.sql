-- Short-lived Shannon context for natural "how was your day?" DM replies.
CREATE TABLE IF NOT EXISTS public.coach_day_notes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    coach_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    note_date DATE NOT NULL DEFAULT ((now() AT TIME ZONE 'Australia/Brisbane')::date),
    training TEXT DEFAULT '',
    food TEXT DEFAULT '',
    work TEXT DEFAULT '',
    vibe TEXT DEFAULT '',
    other TEXT DEFAULT '',
    shareable BOOLEAN NOT NULL DEFAULT TRUE,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '2 days'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT coach_day_notes_unique_day UNIQUE (coach_id, note_date)
);

CREATE INDEX IF NOT EXISTS idx_coach_day_notes_coach_date
    ON public.coach_day_notes(coach_id, note_date DESC);

CREATE INDEX IF NOT EXISTS idx_coach_day_notes_active
    ON public.coach_day_notes(coach_id, expires_at DESC)
    WHERE shareable = TRUE;

ALTER TABLE public.coach_day_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Coaches manage own day notes" ON public.coach_day_notes;
CREATE POLICY "Coaches manage own day notes"
    ON public.coach_day_notes
    FOR ALL
    TO authenticated
    USING (coach_id = auth.uid())
    WITH CHECK (coach_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.coach_day_notes TO authenticated;
GRANT ALL ON public.coach_day_notes TO service_role;
