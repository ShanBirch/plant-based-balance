-- Identifies genuine Shannon messages captured as native Instagram inbox
-- echoes, without mixing them with Balance-generated Graph sends. These fields
-- make high-quality voice-training exports filterable without parsing source
-- strings or joining through coach_alerts.

ALTER TABLE public.ig_messages
    ADD COLUMN IF NOT EXISTS author_type TEXT,
    ADD COLUMN IF NOT EXISTS delivery_origin TEXT,
    ADD COLUMN IF NOT EXISTS training_eligible BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS training_provenance TEXT;

ALTER TABLE public.ig_messages
    DROP CONSTRAINT IF EXISTS ig_messages_author_type_check,
    ADD CONSTRAINT ig_messages_author_type_check
        CHECK (author_type IS NULL OR author_type IN ('lead', 'shannon', 'balance_system', 'unknown')),
    DROP CONSTRAINT IF EXISTS ig_messages_delivery_origin_check,
    ADD CONSTRAINT ig_messages_delivery_origin_check
        CHECK (delivery_origin IS NULL OR delivery_origin IN (
            'instagram_native_inbox',
            'instagram_graph_api',
            'instagram_graph_webhook',
            'manychat',
            'manual_import',
            'unknown'
        )),
    DROP CONSTRAINT IF EXISTS ig_messages_training_provenance_check,
    ADD CONSTRAINT ig_messages_training_provenance_check
        CHECK (training_provenance IS NULL OR training_provenance IN (
            'graph_echo_verified',
            'legacy_graph_echo_inferred',
            'system_generated',
            'manual_import',
            'unknown'
        ));

COMMENT ON COLUMN public.ig_messages.author_type IS
    'Who authored the message. Use author_type = ''shannon'' for Shannon voice training.';
COMMENT ON COLUMN public.ig_messages.delivery_origin IS
    'Capture or delivery route, including Instagram native inbox echoes.';
COMMENT ON COLUMN public.ig_messages.training_eligible IS
    'Whether the message is eligible for Shannon voice-training exports.';
COMMENT ON COLUMN public.ig_messages.training_provenance IS
    'Confidence/source of the training label. Prefer graph_echo_verified for strict datasets.';

-- The historic generic Graph outbound records are native inbox echoes in this
-- pipeline, except for the small number already tied to an alert. Preserve the
-- distinction with an inferred label, so exports can choose verified-only data
-- or deliberately include the valuable historic corpus.
UPDATE public.ig_messages
SET
    author_type = 'shannon',
    delivery_origin = 'instagram_native_inbox',
    training_eligible = TRUE,
    training_provenance = 'legacy_graph_echo_inferred'
WHERE direction = 'out'
  AND source = 'instagram_graph'
  AND alert_id IS NULL
  AND author_type IS NULL;

CREATE INDEX IF NOT EXISTS idx_ig_messages_training_eligible_recent
    ON public.ig_messages (created_at DESC)
    WHERE training_eligible = TRUE AND author_type = 'shannon';
