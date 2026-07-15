-- A feed action must not consume the shared queue while an unanswered DM,
-- pending coach action, client relationship, manual flag, or live lock owns
-- the person. Remove stale feed rows before rebuilding the ranked lane.
CREATE OR REPLACE FUNCTION public.refresh_ig_feed_next_actions(
    p_limit INTEGER DEFAULT 50,
    p_run_id TEXT DEFAULT NULL
)
RETURNS TABLE (
    scanned_count INTEGER,
    ready_count INTEGER,
    preserved_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_candidate RECORD;
    v_action public.ig_next_actions%ROWTYPE;
    v_scanned INTEGER := 0;
    v_ready INTEGER := 0;
    v_preserved INTEGER := 0;
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
        SELECT t.id, t.ig_username, t.lead_stage,
            lower(coalesce(t.qualifier ->> 'warmth_label', '')) AS warmth_label,
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
          AND lower(coalesce(t.qualifier ->> 'warmth_label', '')) IN ('hot', 'warm')
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
            CASE lower(coalesce(t.qualifier ->> 'warmth_label', '')) WHEN 'hot' THEN 0 ELSE 1 END,
            CASE
                WHEN coalesce(t.qualifier ->> 'warmth_score', '') ~ '^-?[0-9]+(?:\.[0-9]+)?$'
                    THEN (t.qualifier ->> 'warmth_score')::numeric
                ELSE 0
            END DESC,
            t.updated_at DESC
        LIMIT LEAST(GREATEST(coalesce(p_limit, 50), 1), 100)
    LOOP
        v_scanned := v_scanned + 1;
        v_action := public.upsert_ig_next_action(
            v_candidate.id, v_candidate.ig_username, v_candidate.lead_stage,
            'feed_operator', 'feed_engagement',
            CASE WHEN v_candidate.warmth_label = 'hot' THEN 9000 ELSE 7000 END
                + least(greatest(round(v_candidate.warmth_score)::integer, 0), 999),
            now(), NULL,
            jsonb_build_object(
                'source', 'refresh_ig_feed_next_actions',
                'run_id', nullif(trim(coalesce(p_run_id, '')), ''),
                'warmth_label', v_candidate.warmth_label,
                'warmth_score', v_candidate.warmth_score,
                'why', 'Current hot/warm prospect eligible for feed nurturing'
            ),
            NULL, FALSE
        );

        IF v_action.owner = 'feed_operator'
           AND v_action.action_type = 'feed_engagement'
           AND v_action.status IN ('ready', 'claimed', 'cooldown') THEN
            v_ready := v_ready + 1;
        ELSE
            v_preserved := v_preserved + 1;
        END IF;
    END LOOP;

    RETURN QUERY SELECT v_scanned, v_ready, v_preserved;
END;
$$;

-- A seven-day feed cooldown represents a real, verified feed touch. A
-- relationship block or UI skip must keep its explicit short deferral instead
-- of being silently promoted to seven days.
CREATE OR REPLACE FUNCTION public.complete_ig_next_action(
    p_action_id UUID,
    p_claim_token UUID,
    p_status TEXT DEFAULT 'waiting',
    p_safe_after TIMESTAMPTZ DEFAULT NULL,
    p_receipt JSONB DEFAULT '{}'::JSONB
)
RETURNS public.ig_next_actions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_existing public.ig_next_actions%ROWTYPE;
    v_status TEXT := lower(trim(coalesce(p_status, 'waiting')));
    v_safe_after TIMESTAMPTZ := p_safe_after;
    v_result public.ig_next_actions%ROWTYPE;
BEGIN
    SELECT * INTO v_existing FROM public.ig_next_actions
    WHERE id = p_action_id FOR UPDATE;

    IF NOT FOUND THEN RAISE EXCEPTION 'queue action not found'; END IF;
    IF v_existing.status <> 'claimed'
       OR v_existing.claim_token IS DISTINCT FROM p_claim_token
       OR v_existing.claim_expires_at <= now() THEN
        RAISE EXCEPTION 'queue action is not claimed by this lease';
    END IF;
    IF v_status NOT IN ('waiting', 'cooldown', 'completed', 'cancelled', 'blocked', 'needs_you') THEN
        RAISE EXCEPTION 'invalid completion status';
    END IF;

    IF v_existing.action_type = 'story_reply' THEN
        v_status := 'cooldown';
        v_safe_after := greatest(coalesce(v_safe_after, now()), now() + interval '24 hours');
    ELSIF v_existing.action_type = 'feed_engagement'
          AND v_status IN ('completed', 'cooldown') THEN
        v_status := 'cooldown';
        v_safe_after := greatest(coalesce(v_safe_after, now()), now() + interval '7 days');
    END IF;

    UPDATE public.ig_next_actions
    SET status = v_status,
        safe_after = v_safe_after,
        receipt = coalesce(v_existing.receipt, '{}'::jsonb)
            || coalesce(p_receipt, '{}'::jsonb)
            || jsonb_build_object('completed_at', now(), 'claim_run_id', v_existing.claim_run_id),
        claim_owner = NULL, claim_token = NULL, claim_run_id = NULL,
        claim_expires_at = NULL, completed_at = now()
    WHERE id = v_existing.id
    RETURNING * INTO v_result;

    RETURN v_result;
END;
$$;

-- Repair the current run's sixteen false seven-day relationship cooldowns.
UPDATE public.ig_next_actions
SET status = 'cancelled', safe_after = NULL
WHERE owner = 'feed_operator'
  AND action_type = 'feed_engagement'
  AND status = 'cooldown'
  AND receipt ->> 'decision' = 'blocked_relationship_owned_elsewhere';

REVOKE ALL ON FUNCTION public.refresh_ig_feed_next_actions(INTEGER, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.refresh_ig_feed_next_actions(INTEGER, TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.refresh_ig_feed_next_actions(INTEGER, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_ig_feed_next_actions(INTEGER, TEXT) TO service_role;

REVOKE ALL ON FUNCTION public.complete_ig_next_action(UUID, UUID, TEXT, TIMESTAMPTZ, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.complete_ig_next_action(UUID, UUID, TEXT, TIMESTAMPTZ, JSONB) FROM anon;
REVOKE ALL ON FUNCTION public.complete_ig_next_action(UUID, UUID, TEXT, TIMESTAMPTZ, JSONB) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.complete_ig_next_action(UUID, UUID, TEXT, TIMESTAMPTZ, JSONB) TO service_role;
