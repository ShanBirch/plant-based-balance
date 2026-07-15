-- Feed engagement is a consumer lane, so it needs a safe producer to turn
-- current hot/warm prospect rankings into queue actions before each run.
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
    FOR v_candidate IN
        SELECT
            t.id,
            t.ig_username,
            t.lead_stage,
            lower(coalesce(t.qualifier ->> 'warmth_label', '')) AS warmth_label,
            CASE
                WHEN coalesce(t.qualifier ->> 'warmth_score', '') ~ '^-?[0-9]+(?:\.[0-9]+)?$'
                    THEN (t.qualifier ->> 'warmth_score')::NUMERIC
                ELSE 0
            END AS warmth_score
        FROM public.ig_threads t
        WHERE lower(coalesce(t.channel, 'instagram')) = 'instagram'
          AND NULLIF(trim(coalesce(t.ig_username, '')), '') IS NOT NULL
          AND lower(trim(t.ig_username)) <> 'shan_n_sunny'
          AND t.linked_user_id IS NULL
          AND lower(coalesce(t.lead_stage, 'new')) IN ('new', 'qualifying', 'invited')
          AND lower(coalesce(t.qualifier ->> 'warmth_label', '')) IN ('hot', 'warm')
          AND lower(coalesce(t.custom_data ->> 'manual_only', 'false')) <> 'true'
          AND lower(coalesce(t.custom_data ->> 'manual_review_only', 'false')) <> 'true'
          AND lower(coalesce(t.custom_data ->> 'friend_manual_only', 'false')) <> 'true'
          AND lower(coalesce(t.custom_data ->> 'do_not_follow_up', 'false')) <> 'true'
          AND lower(coalesce(t.custom_data ->> 'blocked_by_shannon', 'false')) <> 'true'
          AND lower(coalesce(t.custom_data ->> 'internal_account', 'false')) <> 'true'
          AND lower(coalesce(t.custom_data ->> 'ai_automation_opt_out', 'false')) <> 'true'
          AND lower(coalesce(t.custom_data ->> 'codex_ai_opt_out', 'false')) <> 'true'
          AND NULLIF(trim(coalesce(t.custom_data ->> 'merged_into_thread_id', '')), '') IS NULL
        ORDER BY
            CASE lower(coalesce(t.qualifier ->> 'warmth_label', ''))
                WHEN 'hot' THEN 0 ELSE 1
            END,
            CASE
                WHEN coalesce(t.qualifier ->> 'warmth_score', '') ~ '^-?[0-9]+(?:\.[0-9]+)?$'
                    THEN (t.qualifier ->> 'warmth_score')::NUMERIC
                ELSE 0
            END DESC,
            t.updated_at DESC
        LIMIT LEAST(GREATEST(coalesce(p_limit, 50), 1), 100)
    LOOP
        v_scanned := v_scanned + 1;

        v_action := public.upsert_ig_next_action(
            v_candidate.id,
            v_candidate.ig_username,
            v_candidate.lead_stage,
            'feed_operator',
            'feed_engagement',
            CASE WHEN v_candidate.warmth_label = 'hot' THEN 9000 ELSE 7000 END
                + LEAST(GREATEST(round(v_candidate.warmth_score)::INTEGER, 0), 999),
            NOW(),
            NULL,
            jsonb_build_object(
                'source', 'refresh_ig_feed_next_actions',
                'run_id', NULLIF(trim(coalesce(p_run_id, '')), ''),
                'warmth_label', v_candidate.warmth_label,
                'warmth_score', v_candidate.warmth_score,
                'why', 'Current hot/warm prospect eligible for feed nurturing'
            ),
            NULL,
            FALSE
        );

        IF v_action.owner = 'feed_operator'
           AND v_action.action_type = 'feed_engagement'
           AND v_action.status IN ('ready', 'claimed', 'cooldown') THEN
            v_ready := v_ready + 1;
        ELSE
            -- A DM, Story, manual action, active lease, or other relationship
            -- owner already has this person. Non-forced upsert preserves it.
            v_preserved := v_preserved + 1;
        END IF;
    END LOOP;

    RETURN QUERY SELECT v_scanned, v_ready, v_preserved;
END;
$$;

COMMENT ON FUNCTION public.refresh_ig_feed_next_actions(INTEGER, TEXT) IS
    'Seeds hot then warm prospect feed actions without superseding active DM, Story, manual, cooldown, or claimed work.';

REVOKE ALL ON FUNCTION public.refresh_ig_feed_next_actions(INTEGER, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.refresh_ig_feed_next_actions(INTEGER, TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.refresh_ig_feed_next_actions(INTEGER, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_ig_feed_next_actions(INTEGER, TEXT) TO service_role;
