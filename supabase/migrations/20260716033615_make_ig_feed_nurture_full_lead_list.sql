-- Make feed nurturing a durable full-lead queue: hot, then warm, then cold /
-- unscored. A like is not a completed feed-nurture action; the goal is a
-- verified, context-specific public comment.

CREATE OR REPLACE FUNCTION public.refresh_ig_feed_next_actions(
    p_limit integer DEFAULT 1000,
    p_run_id text DEFAULT NULL::text
)
RETURNS TABLE(scanned_count integer, ready_count integer, preserved_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    v_candidate record;
    v_action public.ig_next_actions%ROWTYPE;
    v_scanned integer := 0;
    v_ready integer := 0;
    v_preserved integer := 0;
BEGIN
    UPDATE public.ig_next_actions q
    SET status = 'cancelled',
        safe_after = NULL,
        claim_owner = NULL,
        claim_token = NULL,
        claim_run_id = NULL,
        claim_expires_at = NULL,
        reason = coalesce(q.reason, '{}'::jsonb) || jsonb_build_object(
            'feed_refresh_suppressed_at', now(),
            'feed_refresh_suppression', 'relationship_or_safety_gate'
        )
    FROM public.ig_threads t
    WHERE q.thread_id = t.id
      AND q.owner = 'feed_operator'
      AND q.action_type = 'feed_engagement'
      AND q.status IN ('ready', 'waiting', 'blocked', 'needs_you', 'cooldown')
      AND (
          t.linked_user_id IS NOT NULL
          OR lower(coalesce(t.lead_stage, 'new')) NOT IN ('new', 'qualifying', 'invited')
          OR (t.last_inbound_at IS NOT NULL
              AND (t.last_outbound_at IS NULL OR t.last_inbound_at > t.last_outbound_at))
          OR lower(coalesce(t.custom_data ->> 'manual_only', 'false')) = 'true'
          OR lower(coalesce(t.custom_data ->> 'manual_review_only', 'false')) = 'true'
          OR lower(coalesce(t.custom_data ->> 'friend_manual_only', 'false')) = 'true'
          OR lower(coalesce(t.custom_data ->> 'do_not_follow_up', 'false')) = 'true'
          OR lower(coalesce(t.custom_data ->> 'blocked_by_shannon', 'false')) = 'true'
          OR lower(coalesce(t.custom_data ->> 'opt_out', 'false')) = 'true'
          OR lower(coalesce(t.custom_data ->> 'opted_out', 'false')) = 'true'
          OR lower(coalesce(t.custom_data ->> 'ai_automation_opt_out', 'false')) = 'true'
          OR lower(coalesce(t.custom_data ->> 'codex_ai_opt_out', 'false')) = 'true'
          OR EXISTS (
              SELECT 1
              FROM public.coach_alerts a
              WHERE (a.data ->> 'thread_id' = t.id::text
                  OR a.data ->> 'ig_thread_id' = t.id::text)
                AND a.status IN ('pending', 'scheduled')
          )
          OR CASE
              WHEN coalesce(t.custom_data -> 'operator_lock' ->> 'expires_at', '')
                   ~ '^\d{4}-\d{2}-\d{2}T'
              THEN (t.custom_data -> 'operator_lock' ->> 'expires_at')::timestamptz > now()
              ELSE false
          END
      );

    FOR v_candidate IN
        SELECT
            t.id,
            t.ig_username,
            t.lead_stage,
            lower(coalesce(t.qualifier ->> 'warmth_label', '')) AS raw_warmth_label,
            CASE
                WHEN lower(coalesce(t.qualifier ->> 'warmth_label', '')) = 'hot' THEN 'hot'
                WHEN lower(coalesce(t.qualifier ->> 'warmth_label', '')) = 'warm' THEN 'warm'
                ELSE 'cold'
            END AS warmth_label,
            CASE
                WHEN coalesce(t.qualifier ->> 'warmth_score', '') ~ '^-?[0-9]+(?:\.[0-9]+)?$'
                    THEN (t.qualifier ->> 'warmth_score')::numeric
                ELSE 0
            END AS warmth_score
        FROM public.ig_threads t
        WHERE lower(coalesce(t.channel, 'instagram')) = 'instagram'
          AND nullif(trim(coalesce(t.ig_username, '')), '') IS NOT NULL
          AND lower(trim(t.ig_username)) <> 'shan_n_sunny'
          AND t.linked_user_id IS NULL
          AND lower(coalesce(t.lead_stage, 'new')) IN ('new', 'qualifying', 'invited')
          AND NOT (t.last_inbound_at IS NOT NULL
              AND (t.last_outbound_at IS NULL OR t.last_inbound_at > t.last_outbound_at))
          AND lower(coalesce(t.custom_data ->> 'manual_only', 'false')) <> 'true'
          AND lower(coalesce(t.custom_data ->> 'manual_review_only', 'false')) <> 'true'
          AND lower(coalesce(t.custom_data ->> 'friend_manual_only', 'false')) <> 'true'
          AND lower(coalesce(t.custom_data ->> 'do_not_follow_up', 'false')) <> 'true'
          AND lower(coalesce(t.custom_data ->> 'blocked_by_shannon', 'false')) <> 'true'
          AND lower(coalesce(t.custom_data ->> 'internal_account', 'false')) <> 'true'
          AND lower(coalesce(t.custom_data ->> 'opt_out', 'false')) <> 'true'
          AND lower(coalesce(t.custom_data ->> 'opted_out', 'false')) <> 'true'
          AND lower(coalesce(t.custom_data ->> 'ai_automation_opt_out', 'false')) <> 'true'
          AND lower(coalesce(t.custom_data ->> 'codex_ai_opt_out', 'false')) <> 'true'
          AND nullif(trim(coalesce(t.custom_data ->> 'merged_into_thread_id', '')), '') IS NULL
          AND NOT EXISTS (
              SELECT 1 FROM public.coach_alerts a
              WHERE (a.data ->> 'thread_id' = t.id::text
                  OR a.data ->> 'ig_thread_id' = t.id::text)
                AND a.status IN ('pending', 'scheduled')
          )
          AND NOT CASE
              WHEN coalesce(t.custom_data -> 'operator_lock' ->> 'expires_at', '')
                   ~ '^\d{4}-\d{2}-\d{2}T'
              THEN (t.custom_data -> 'operator_lock' ->> 'expires_at')::timestamptz > now()
              ELSE false
          END
        ORDER BY
            CASE lower(coalesce(t.qualifier ->> 'warmth_label', ''))
                WHEN 'hot' THEN 0
                WHEN 'warm' THEN 1
                WHEN 'cold' THEN 2
                ELSE 3
            END,
            CASE
                WHEN coalesce(t.qualifier ->> 'warmth_score', '') ~ '^-?[0-9]+(?:\.[0-9]+)?$'
                    THEN (t.qualifier ->> 'warmth_score')::numeric
                ELSE 0
            END DESC,
            t.id
        LIMIT LEAST(GREATEST(coalesce(p_limit, 1000), 1), 2000)
    LOOP
        v_scanned := v_scanned + 1;
        v_action := public.upsert_ig_next_action(
            v_candidate.id,
            v_candidate.ig_username,
            v_candidate.lead_stage,
            'feed_operator',
            'feed_engagement',
            CASE v_candidate.warmth_label
                WHEN 'hot' THEN 9000
                WHEN 'warm' THEN 7000
                ELSE 5000
            END + least(greatest(round(v_candidate.warmth_score)::integer, 0), 999),
            now(),
            NULL,
            jsonb_build_object(
                'source', 'refresh_ig_feed_next_actions',
                'run_id', nullif(trim(coalesce(p_run_id, '')), ''),
                'warmth_label', v_candidate.warmth_label,
                'raw_warmth_label', v_candidate.raw_warmth_label,
                'warmth_score', v_candidate.warmth_score,
                'why', 'Lead in durable hot-warm-cold feed-comment list'
            ),
            NULL,
            FALSE
        );

        IF v_action.owner = 'feed_operator'
           AND v_action.action_type = 'feed_engagement'
           AND v_action.due_at <= now()
           AND coalesce(v_action.safe_after, '-infinity'::timestamptz) <= now()
           AND (
               v_action.status = 'ready'
               OR (v_action.status = 'claimed' AND v_action.claim_expires_at <= now())
               OR (v_action.status = 'cooldown' AND v_action.safe_after <= now())
           ) THEN
            v_ready := v_ready + 1;
        ELSE
            v_preserved := v_preserved + 1;
        END IF;
    END LOOP;

    RETURN QUERY SELECT v_scanned, v_ready, v_preserved;
END;
$function$;

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
    v_verified_native boolean := false;
    v_verified_feed_comment boolean := false;
    v_technical_retry boolean := false;
BEGIN
    SELECT * INTO v_existing
    FROM public.ig_next_actions
    WHERE id = p_action_id
    FOR UPDATE;

    IF NOT FOUND THEN RAISE EXCEPTION 'queue action not found'; END IF;
    IF v_existing.status <> 'claimed'
       OR v_existing.claim_token IS DISTINCT FROM p_claim_token
       OR v_existing.claim_expires_at <= now() THEN
        RAISE EXCEPTION 'queue action is not claimed by this lease';
    END IF;
    IF v_status NOT IN ('waiting', 'cooldown', 'completed', 'cancelled', 'blocked', 'needs_you') THEN
        RAISE EXCEPTION 'invalid completion status';
    END IF;

    v_receipt_text := lower(concat_ws(' ',
        v_receipt ->> 'decision', v_receipt ->> 'outcome',
        v_receipt ->> 'skip_reason', v_receipt ->> 'reason',
        v_receipt ->> 'detail'
    ));

    v_verified_native :=
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

    v_verified_feed_comment :=
        lower(coalesce(v_receipt ->> 'comment_verified', 'false')) = 'true'
        OR nullif(trim(coalesce(v_receipt ->> 'native_comment_id', '')), '') IS NOT NULL
        OR (
            v_receipt_text ~ '(commented|comment_sent|feed_comment)'
            AND nullif(trim(coalesce(v_receipt ->> 'native_readback', '')), '') IS NOT NULL
        );

    v_technical_retry := v_receipt_text ~
        '(loading|unverifiable|timeout|timed out|stale binding|disconnect|blank page|navigation error|did not expose a stable post url|ui failed|browser reset)';

    IF v_existing.action_type = 'story_reply'
       AND v_status IN ('completed', 'cooldown') THEN
        v_status := CASE WHEN v_verified_native THEN 'completed' ELSE 'cancelled' END;
        v_safe_after := NULL;
    ELSIF v_existing.action_type = 'feed_engagement'
          AND v_status IN ('completed', 'cooldown') THEN
        v_status := 'cooldown';
        IF v_verified_feed_comment THEN
            v_safe_after := greatest(coalesce(v_safe_after, now()), now() + interval '7 days');
        ELSIF v_technical_retry THEN
            v_safe_after := greatest(coalesce(v_safe_after, now()), now() + interval '30 minutes');
        ELSE
            -- No suitable new post or no safe specific hook. Move down the
            -- lead list and revisit later instead of restarting here daily.
            v_safe_after := greatest(coalesce(v_safe_after, now()), now() + interval '72 hours');
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
                'queue_verified_native_action', v_verified_native,
                'queue_verified_feed_comment', v_verified_feed_comment,
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

-- Old like-only feed actions were incorrectly treated as completed comments.
-- Make them eligible for a real comment inspection without undoing the like.
UPDATE public.ig_next_actions
SET safe_after = now(),
    receipt = coalesce(receipt, '{}'::jsonb) || jsonb_build_object(
        'like_only_cooldown_repaired_at', now(),
        'like_only_cooldown_repair', 'requeue_for_comment_inspection'
    )
WHERE owner = 'feed_operator'
  AND action_type = 'feed_engagement'
  AND status = 'cooldown'
  AND (
      lower(coalesce(receipt ->> 'decision', '')) IN ('liked', 'like', 'like_only')
      OR lower(coalesce(receipt ->> 'action_type', '')) IN ('feed_like', 'like')
  )
  AND lower(coalesce(receipt ->> 'comment_verified', 'false')) <> 'true'
  AND nullif(trim(coalesce(receipt ->> 'native_comment_id', '')), '') IS NULL;

-- Seed the whole eligible list now. Future feed shifts refresh it before work.
DO $seed$
BEGIN
    PERFORM * FROM public.refresh_ig_feed_next_actions(
        2000,
        'migration:make_ig_feed_nurture_full_lead_list'
    );
END;
$seed$;
