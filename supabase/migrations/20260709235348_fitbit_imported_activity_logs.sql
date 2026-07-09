-- Keep imported sessions in the existing activity timeline so imported and
-- manually logged movement share one history and one Feed hand-off.
ALTER TABLE public.activity_logs
    ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual',
    ADD COLUMN IF NOT EXISTS external_activity_id text,
    ADD COLUMN IF NOT EXISTS source_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS imported_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS activity_logs_external_source_unique
    ON public.activity_logs (user_id, source, external_activity_id)
    WHERE external_activity_id IS NOT NULL;
