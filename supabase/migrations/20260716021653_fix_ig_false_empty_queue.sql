-- Keep exact Story frames terminal and reserve seven-day feed cooldowns for
-- interactions that were actually verified in Instagram.
CREATE OR REPLACE FUNCTION public.complete_ig_next_action(
    p_action_id uuid,
    p_claim_token uuid,
    p_status text DEFAULT 'waiting'::text,
    p_safe_after timestamp with time zone DEFAULT NULL::timestamp with time zone,
    p_receipt jsonb DEFAULT '{}'::jsonb
)
RETURNS public.ig_next_actions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    v_existing public.ig_next_actions%ROWTYPE;
    v_status text := lower(trim(coalesce(p_status, 'waiting')));
    v_safe_after timestamptz := p_safe_after;
    v_result public.ig_next_actions%ROWTYPE;
    v_receipt jsonb := coalesce(p_receipt, '{}'::jsonb);
    v_receipt_text text;
    v_verified boolean := false;
    v_technical_retry boolean := false;
BEGIN
    SELECT * INTO v_existing
    FROM public.ig_next_actions
    WHERE id = p_action_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'queue action not found';
    END IF;
    IF v_existing.status <> 'claimed'
       OR v_existing.claim_token IS DISTINCT FROM p_claim_token
       OR v_existing.claim_expires_at <= now() THEN
        RAISE EXCEPTION 'queue action is not claimed by this lease';
    END IF;
    IF v_status NOT IN ('waiting', 'cooldown', 'completed', 'cancelled', 'blocked', 'needs_you') THEN
        RAISE EXCEPTION 'invalid completion status';
    END IF;

    v_receipt_text := lower(concat_ws(' ',
        v_receipt ->> 'decision',
        v_receipt ->> 'outcome',
        v_receipt ->> 'skip_reason',
        v_receipt ->> 'reason',
        v_receipt ->> 'detail'
    ));

    v_verified :=
        CASE
            WHEN coalesce(v_receipt ->> 'verified_action_count', '') ~ '^[0-9]+$'
                THEN (v_receipt ->> 'verified_action_count')::integer > 0
            ELSE false
        END
        OR lower(coalesce(v_receipt ->> 'native_verified', 'false')) = 'true'
        OR lower(coalesce(v_receipt ->> 'native_receipt_verified', 'false')) = 'true'
        OR lower(coalesce(v_receipt ->> 'comment_verified', 'false')) = 'true'
        OR lower(coalesce(v_receipt ->> 'like_verified', 'false')) = 'true'
        OR lower(coalesce(v_receipt ->> 'readback_verified', 'false')) = 'true'
        OR nullif(trim(coalesce(v_receipt ->> 'native_comment_id', '')), '') IS NOT NULL;

    v_technical_retry := v_receipt_text ~
        '(loading|unverifiable|timeout|timed out|stale binding|disconnect|blank page|navigation error|did not expose a stable post url|ui failed|browser reset)';

    IF v_existing.action_type = 'story_reply'
       AND v_status IN ('completed', 'cooldown') THEN
        -- A queue row represents one exact Story frame. Once inspected it must
        -- never become claimable again after that frame expires. A later live
        -- frame is inserted by candidate generation as a new action version.
        IF v_verified THEN
            v_status := 'completed';
        ELSE
            v_status := 'cancelled';
        END IF;
        v_safe_after := NULL;
    ELSIF v_existing.action_type = 'feed_engagement'
          AND v_status IN ('completed', 'cooldown') THEN
        v_status := 'cooldown';
        IF v_verified THEN
            v_safe_after := greatest(coalesce(v_safe_after, now()), now() + interval '7 days');
        ELSIF v_technical_retry THEN
            v_safe_after := greatest(coalesce(v_safe_after, now()), now() + interval '30 minutes');
        ELSE
            v_safe_after := greatest(coalesce(v_safe_after, now()), now() + interval '12 hours');
        END IF;
    END IF;

    UPDATE public.ig_next_actions
    SET status = v_status,
        safe_after = v_safe_after,
        receipt = coalesce(v_existing.receipt, '{}'::jsonb)
            || v_receipt
            || jsonb_build_object(
                'completed_at', now(),
                'claim_run_id', v_existing.claim_run_id,
                'queue_verified_native_action', v_verified,
                'queue_technical_retry', v_technical_retry
            ),
        claim_owner = NULL,
        claim_token = NULL,
        claim_run_id = NULL,
        claim_expires_at = NULL,
        completed_at = now()
    WHERE id = v_existing.id
    RETURNING * INTO v_result;

    RETURN v_result;
END;
$function$;

-- Repair the concrete false cooldowns already created by browser loading or
-- unverifiable-UI skips. These become due after a short retry window, not a week.
UPDATE public.ig_next_actions
SET safe_after = least(
        coalesce(safe_after, now() + interval '30 minutes'),
        now() + interval '30 minutes'
    ),
    receipt = coalesce(receipt, '{}'::jsonb) || jsonb_build_object(
        'false_cooldown_repaired_at', now(),
        'false_cooldown_repair', 'technical_skip_short_retry'
    )
WHERE owner = 'feed_operator'
  AND action_type = 'feed_engagement'
  AND status = 'cooldown'
  AND coalesce(receipt ->> 'verified_action_count', '0') ~ '^[0-9]+$'
  AND coalesce(receipt ->> 'verified_action_count', '0')::integer = 0
  AND lower(coalesce(receipt ->> 'native_verified', 'false')) <> 'true'
  AND lower(coalesce(receipt ->> 'native_receipt_verified', 'false')) <> 'true'
  AND lower(coalesce(receipt ->> 'comment_verified', 'false')) <> 'true'
  AND lower(coalesce(receipt ->> 'like_verified', 'false')) <> 'true'
  AND lower(coalesce(receipt ->> 'readback_verified', 'false')) <> 'true'
  AND nullif(trim(coalesce(receipt ->> 'native_comment_id', '')), '') IS NULL
  AND lower(concat_ws(' ',
        receipt ->> 'decision',
        receipt ->> 'skip_reason',
        receipt ->> 'reason',
        receipt ->> 'detail'
      )) ~ '(loading|unverifiable|timeout|timed out|stale binding|disconnect|blank page|navigation error|did not expose a stable post url|ui failed|browser reset)';
