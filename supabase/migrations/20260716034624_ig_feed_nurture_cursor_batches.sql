CREATE OR REPLACE FUNCTION public.get_ig_feed_nurture_batch(
    p_after_tier_rank integer DEFAULT -1,
    p_after_warmth_score numeric DEFAULT 1000000,
    p_after_thread_id uuid DEFAULT NULL,
    p_limit integer DEFAULT 25
)
RETURNS TABLE(
    thread_id uuid,
    ig_username text,
    lead_stage text,
    warmth_tier text,
    tier_rank integer,
    warmth_score numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
WITH eligible AS (
    SELECT
        t.id AS thread_id,
        t.ig_username,
        t.lead_stage,
        CASE
            WHEN lower(coalesce(t.qualifier ->> 'warmth_label', '')) = 'hot' THEN 'hot'
            WHEN lower(coalesce(t.qualifier ->> 'warmth_label', '')) = 'warm' THEN 'warm'
            ELSE 'cold'
        END AS warmth_tier,
        CASE
            WHEN lower(coalesce(t.qualifier ->> 'warmth_label', '')) = 'hot' THEN 0
            WHEN lower(coalesce(t.qualifier ->> 'warmth_label', '')) = 'warm' THEN 1
            ELSE 2
        END AS tier_rank,
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
      AND NOT EXISTS (
          SELECT 1
          FROM public.ig_next_actions q
          WHERE (q.thread_id = t.id OR lower(q.ig_username) = lower(t.ig_username))
            AND q.action_type = 'feed_engagement'
            AND (
                lower(coalesce(q.receipt ->> 'queue_verified_feed_comment', 'false')) = 'true'
                OR nullif(trim(coalesce(q.receipt ->> 'native_comment_id', '')), '') IS NOT NULL
            )
            AND q.completed_at > now() - interval '7 days'
      )
), after_cursor AS (
    SELECT *
    FROM eligible e
    WHERE p_after_tier_rank < 0
       OR e.tier_rank > p_after_tier_rank
       OR (
           e.tier_rank = p_after_tier_rank
           AND (
               e.warmth_score < coalesce(p_after_warmth_score, 1000000)
               OR (
                   e.warmth_score = coalesce(p_after_warmth_score, 1000000)
                   AND (p_after_thread_id IS NULL OR e.thread_id > p_after_thread_id)
               )
           )
       )
)
SELECT a.thread_id, a.ig_username, a.lead_stage, a.warmth_tier,
       a.tier_rank, a.warmth_score
FROM after_cursor a
ORDER BY a.tier_rank, a.warmth_score DESC, a.thread_id
LIMIT least(greatest(coalesce(p_limit, 25), 1), 100);
$function$;

REVOKE ALL ON FUNCTION public.get_ig_feed_nurture_batch(integer, numeric, uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_ig_feed_nurture_batch(integer, numeric, uuid, integer) FROM anon;
REVOKE ALL ON FUNCTION public.get_ig_feed_nurture_batch(integer, numeric, uuid, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_ig_feed_nurture_batch(integer, numeric, uuid, integer) TO service_role;
