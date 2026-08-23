-- Reopened delivery-rescue actions are new queue instructions. Preserve the
-- previous action-version receipt in ig_next_action_receipts, but keep the
-- current action receipt empty so claim_ig_next_actions can lease it.

DO $$
DECLARE
    v_definition TEXT;
    v_old_fragment TEXT := $fragment$
                receipt = COALESCE(v_action.receipt, '{}'::JSONB) || jsonb_build_object(
                    'delivery_rescue_reopened_at', v_now,
                    'delivery_rescue_previous_status', v_action.status,
                    'delivery_rescue_previous_owner', v_action.owner
                ),
$fragment$;
    v_new_fragment TEXT := $fragment$
                receipt = '{}'::JSONB,
$fragment$;
BEGIN
    SELECT pg_get_functiondef('public.reconcile_unanswered_dm_delivery_failures(integer,interval,interval)'::regprocedure)
    INTO v_definition;

    IF position(v_old_fragment IN v_definition) = 0 THEN
        RAISE EXCEPTION 'reconcile_unanswered_dm_delivery_failures receipt fragment changed; refusing an unsafe patch';
    END IF;

    v_definition := replace(v_definition, v_old_fragment, v_new_fragment);

    IF position(v_old_fragment IN v_definition) <> 0
       OR position(v_new_fragment IN v_definition) = 0 THEN
        RAISE EXCEPTION 'reconcile_unanswered_dm_delivery_failures receipt patch did not apply exactly once';
    END IF;

    EXECUTE v_definition;
END;
$$;

-- The archive trigger stores each non-empty OLD receipt before this clears the
-- current row. Limit the repair to open browser rescues that satisfy the same
-- exact source/ownership flags required by the dispatcher contract.
UPDATE public.ig_next_actions
SET receipt = '{}'::JSONB,
    reason = COALESCE(reason, '{}'::JSONB) || jsonb_build_object(
        'receipt_normalized_at', clock_timestamp(),
        'receipt_normalization_reason', 'reopened_delivery_rescue_requires_empty_current_receipt'
    ),
    updated_at = clock_timestamp()
WHERE owner = 'browser_dispatcher'
  AND action_type = 'reply_inbound'
  AND status IN ('ready', 'waiting')
  AND lower(COALESCE(reason->>'failed_delivery_rescue', 'false')) = 'true'
  AND lower(COALESCE(reason->>'browser_dispatch_required', 'false')) = 'true'
  AND lower(COALESCE(reason->>'browser_send_allowed', 'false')) = 'true'
  AND source_message_id IS NOT NULL
  AND COALESCE(receipt, '{}'::JSONB) <> '{}'::JSONB;

REVOKE ALL ON FUNCTION public.reconcile_unanswered_dm_delivery_failures(INTEGER, INTERVAL, INTERVAL)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_unanswered_dm_delivery_failures(INTEGER, INTERVAL, INTERVAL)
TO service_role;

COMMENT ON FUNCTION public.reconcile_unanswered_dm_delivery_failures(INTEGER, INTERVAL, INTERVAL)
IS 'Reopens canonically unanswered, safe unlinked-lead delivery failures while archiving the prior action-version receipt and leaving the current rescue claimable by its API or browser owner.';
