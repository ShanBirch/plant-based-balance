-- Retire proactive Instagram messages triggered only by Balance login inactivity.
-- Historical sent receipts remain intact, but no queued or claimed touch may send.

UPDATE public.ig_next_actions
SET
    status = 'cancelled',
    receipt = COALESCE(receipt, '{}'::JSONB) || jsonb_build_object(
        'decision', 'cancelled',
        'outcome', 'client_inactivity_outreach_retired',
        'retired_at', NOW(),
        'retired_reason', 'login inactivity lacks sufficient client context'
    ),
    claim_owner = NULL,
    claim_token = NULL,
    claim_run_id = NULL,
    claim_expires_at = NULL,
    completed_at = COALESCE(completed_at, NOW()),
    updated_at = NOW()
WHERE action_type = 'client_inactivity_checkin'
  AND status IN ('ready', 'waiting', 'claimed', 'needs_you', 'blocked');

DROP FUNCTION IF EXISTS public.complete_ig_client_inactivity_checkin(
    UUID,
    UUID,
    UUID,
    TEXT,
    TEXT,
    TEXT,
    TIMESTAMPTZ
);
DROP FUNCTION IF EXISTS public.refresh_ig_client_inactivity_checkins(
    INTEGER,
    TIMESTAMPTZ
);
DROP FUNCTION IF EXISTS public.ig_client_checkin_delivery_time(TIMESTAMPTZ);
DROP FUNCTION IF EXISTS public.ig_add_business_days(TIMESTAMPTZ, INTEGER);
DROP FUNCTION IF EXISTS public.ig_business_days_between(TIMESTAMPTZ, TIMESTAMPTZ);
