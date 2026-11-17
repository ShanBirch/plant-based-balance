CREATE OR REPLACE FUNCTION public.claim_ig_story_action(p_action_id uuid, p_action_version integer, p_run_id text, p_tab_id text, p_ig_username text, p_story_id text, p_final_text text, p_lease_seconds integer DEFAULT 300)
 RETURNS SETOF ig_next_actions
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE a public.ig_next_actions%ROWTYPE; r public.ig_browser_shift_runs%ROWTYPE; v_alias_threads uuid[]; v_unanswered integer; v_latest_attempt timestamptz;
BEGIN
 SELECT * INTO r FROM public.ig_browser_shift_runs WHERE run_id=p_run_id FOR SHARE;
 IF NOT FOUND OR NOT public.ig_browser_surface_owned(p_run_id,'instagram')
  OR r.browser_binding->>'tab_id' IS DISTINCT FROM p_tab_id
  OR r.browser_binding->>'account' IS DISTINCT FROM 'shan_n_sunny'
  OR r.lane IS DISTINCT FROM 'active_client_instagram_community' THEN
  RAISE EXCEPTION 'verified Story surface ownership required';
 END IF;
 SELECT * INTO a FROM public.ig_next_actions WHERE id=p_action_id FOR UPDATE SKIP LOCKED;
 IF NOT FOUND THEN RETURN; END IF;
 IF a.action_version IS DISTINCT FROM p_action_version
  OR a.ig_username IS DISTINCT FROM p_ig_username
  OR a.owner IS DISTINCT FROM 'story_operator' OR a.action_type IS DISTINCT FROM 'story_reply'
  OR NOT (a.status='ready' OR (a.status='claimed' AND a.claim_expires_at<=now()))
  OR a.due_at>now() OR coalesce(a.safe_after,'-infinity'::timestamptz)>now()
  OR coalesce(a.receipt,'{}'::jsonb)<>'{}'::jsonb
  OR a.reason->>'story_id' IS DISTINCT FROM p_story_id OR coalesce(p_story_id,'') !~ '^[0-9]+$'
  OR a.reason->>'story_url' IS DISTINCT FROM ('https://www.instagram.com/stories/'||p_ig_username||'/'||p_story_id||'/')
  OR a.reason->>'final_text' IS DISTINCT FROM p_final_text OR length(trim(coalesce(p_final_text,'')))=0
  OR a.reason->>'is_dm' IS DISTINCT FROM 'true'
  OR a.reason->>'one_send_only' IS DISTINCT FROM 'true'
  OR a.reason->>'reviewed_private_story_authorization' IS DISTINCT FROM 'true'
  OR a.reason->>'native_following_verified' IS DISTINCT FROM 'true'
  OR a.reason->>'native_account' IS DISTINCT FROM 'shan_n_sunny'
  OR (CASE WHEN a.reason->>'history_policy'='supabase_primary_tray_v1' THEN
    a.reason->>'story_client_policy' IS DISTINCT FROM 'shane_nat_only_v1'
    OR a.reason->>'excluded_client_matches' IS DISTINCT FROM '0'
    OR coalesce(a.reason->>'client_matches','') !~ '^[0-9]+$'
    OR coalesce(a.reason->>'purchase_matches','') !~ '^[0-9]+$'
  ELSE a.reason->>'client_matches' IS DISTINCT FROM '0' OR a.reason->>'purchase_matches' IS DISTINCT FROM '0' END)
  OR a.reason->>'personal_contacts' IS DISTINCT FROM '0'
  OR a.reason->>'run_id' IS DISTINCT FROM p_run_id
  OR a.reason->>'logical_base_id' IS DISTINCT FROM r.cursor_current->>'logical_base_id'
  OR nullif(a.reason->>'authorization_source','') IS NULL
  OR nullif(a.reason->>'authorization_scope','') IS NULL
  OR (CASE WHEN a.reason->>'history_policy'='supabase_primary_tray_v1' THEN
    a.reason->>'canonical_review_complete' IS DISTINCT FROM 'true'
    OR nullif(a.reason->>'canonical_history_review','') IS NULL
    OR nullif(a.reason->>'canonical_review_ref','') IS NULL
  ELSE nullif(a.reason->>'native_history_review','') IS NULL
    OR coalesce(a.reason->>'native_conversation_url','') !~ '^https://www.instagram.com/direct/t/[0-9]+(/[1-9][0-9]*)?/?$' END)
  OR jsonb_typeof(a.reason->'content_review') IS DISTINCT FROM 'object'
  OR a.reason->'content_review'='{}'::jsonb
  OR nullif(a.reason->>'reviewed_at','') IS NULL THEN RETURN; END IF;
 IF (a.reason->>'reviewed_at')::timestamptz NOT BETWEEN now()-interval '5 minutes' AND now()+interval '30 seconds' THEN RETURN; END IF;
 SELECT coalesce(array_agg(DISTINCT t.id),'{}'::uuid[]) INTO v_alias_threads
 FROM public.ig_threads t JOIN public.ig_threads seed ON
   (seed.id=a.thread_id OR lower(seed.ig_username)=lower(a.ig_username))
   AND (t.id=seed.id OR (seed.linked_user_id IS NOT NULL AND t.linked_user_id=seed.linked_user_id)
     OR (nullif(seed.custom_data#>>'{instagram_graph,ig_graph_user_id}','') IS NOT NULL
       AND t.custom_data#>>'{instagram_graph,ig_graph_user_id}'=seed.custom_data#>>'{instagram_graph,ig_graph_user_id}'
       AND t.custom_data#>>'{instagram_graph,account_id}'=seed.custom_data#>>'{instagram_graph,account_id}'));
 IF lower(a.ig_username) IN ('shane_minahan','mrs_natty_t') OR EXISTS(SELECT 1 FROM public.ig_threads t WHERE t.id=ANY(v_alias_threads) AND (lower(t.ig_username) IN ('shane_minahan','mrs_natty_t') OR t.linked_user_id IN ('83661229-aacd-4020-a765-ffdbe500c2da'::uuid,'e1403726-19bc-4663-85d4-59b668791a80'::uuid))) THEN RETURN; END IF;
 IF a.reason->>'history_policy'='supabase_primary_tray_v1' AND cardinality(v_alias_threads)=0 THEN RETURN; END IF;
 IF a.reason->>'story_contact_policy'='responsive_daily_silent_three_v1' THEN
  WITH events AS (
    SELECT m.id::text contact_key,m.created_at event_at,(m.text ILIKE 'replied to their story%') proactive
    FROM public.ig_messages m JOIN public.ig_threads t ON t.id=m.thread_id
    WHERE m.direction='out' AND (t.id=ANY(v_alias_threads) OR t.ig_username=a.ig_username OR t.id=a.thread_id) AND m.created_at<=now()
    UNION ALL
    SELECT coalesce(nullif(h.receipt->>'canonical_outbound_message_id',''),nullif(h.receipt->>'canonical_message_id',''),nullif(h.receipt->>'canonical_id',''),nullif(h.receipt->>'canonical_outbound_id',''),h.action_id::text||':'||h.action_version::text),
      coalesce(nullif(h.receipt->>'attempt_reserved_at','')::timestamptz,h.completed_at,h.archived_at),true
    FROM public.ig_next_action_receipts h
    WHERE h.action_type IN ('story_reply','welcome_follower','reactivation','feed_engagement') AND public.ig_story_receipt_attempted(h.receipt)
      AND (h.subject_key=a.subject_key OR h.ig_username=a.ig_username OR h.thread_id=ANY(v_alias_threads))
      AND coalesce(nullif(h.receipt->>'attempt_reserved_at','')::timestamptz,h.completed_at,h.archived_at)<=now()
    UNION ALL
    SELECT 'native:'||(e.value->>'id'),((e.value->>'date')||'T23:59:59.999Z')::timestamptz,true
    FROM public.ig_threads t CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(t.custom_data->'story_reviewed_native_attempts')='array' THEN t.custom_data->'story_reviewed_native_attempts' ELSE '[]'::jsonb END) e(value)
    WHERE t.id=ANY(v_alias_threads) AND e.value->'verified'='true'::jsonb
      AND e.value->>'direction'='out' AND e.value->'proactive'='true'::jsonb AND e.value->>'time_precision'='day'
      AND e.value->>'date' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
      AND nullif(e.value->>'id','') IS NOT NULL AND nullif(e.value->>'evidence_ref','') IS NOT NULL
      AND ((e.value->>'date')||'T23:59:59.999Z')::timestamptz<=now()
  ), dedup AS (
    SELECT contact_key,min(event_at) event_at,bool_or(proactive) proactive FROM events GROUP BY contact_key
  ), inbound AS (
    SELECT coalesce(max(mi.created_at),'-infinity'::timestamptz) last_at FROM public.ig_messages mi
    WHERE mi.direction='in' AND mi.thread_id=ANY(v_alias_threads) AND mi.created_at<=now()
      AND regexp_replace((CASE WHEN mi.text LIKE '%Raw IG message:%' THEN regexp_replace(mi.text,'^[\s\S]*Raw IG message:\s*','') ELSE mi.text END),'^replied to your story \(story media attached\)\s*','','i') ~ '[[:alpha:]]'
      AND regexp_replace((CASE WHEN mi.text LIKE '%Raw IG message:%' THEN regexp_replace(mi.text,'^[\s\S]*Raw IG message:\s*','') ELSE mi.text END),'^replied to your story \(story media attached\)\s*','','i') !~ '^\[(attachment|image|video|audio|voice|reaction)\]'
      AND NOT EXISTS (
       SELECT 1 FROM (
        SELECT thread_id,ig_username,action_type,status,receipt,completed_at FROM public.ig_next_actions
        UNION ALL
        SELECT thread_id,ig_username,action_type,terminal_status,receipt,completed_at FROM public.ig_next_action_receipts
       ) c
       WHERE c.action_type='reply_inbound' AND c.status IN ('cancelled','completed')
        AND (c.thread_id=mi.thread_id OR lower(c.ig_username)=(SELECT lower(ct.ig_username) FROM public.ig_threads ct WHERE ct.id=mi.thread_id))
        AND (((c.receipt->'no_send'='true'::jsonb OR c.receipt->'sent'='false'::jsonb)
          AND (c.receipt->>'decision'='acknowledged_closed' OR c.receipt->>'result'='acknowledged_closed'))
         OR (c.receipt->>'result'='reviewed_no_send' AND c.receipt->>'classification'='completed_exchange'
          AND c.receipt->'outbound_attempted'='false'::jsonb
          AND c.receipt->'history_proof_validated'='true'::jsonb
          AND c.receipt->'native_history_reviewed'='true'::jsonb
          AND c.receipt->'canonical_history_reviewed'='true'::jsonb))
        AND c.receipt#>>'{conversation_review,disposition}'='close'
        AND c.receipt#>>'{conversation_review,closureReason}'='completed_exchange'
        AND c.receipt->>'source_message_id'=mi.id::text
        AND c.completed_at>=mi.created_at AND c.completed_at<=now()
      )
  ) SELECT count(*) FILTER(WHERE proactive AND event_at>last_at),max(event_at) FILTER(WHERE proactive) INTO v_unanswered,v_latest_attempt FROM dedup CROSS JOIN inbound;
  
IF v_unanswered>=3 OR v_latest_attempt>now()-public.ig_story_silent_wait(v_unanswered) THEN RETURN; END IF;
-- A new inbound of any type requires the sole responder's review first.
-- Emoji/media/voice do not silently reset the proactive budget.
IF EXISTS (
 SELECT 1 FROM public.ig_messages mi
 WHERE mi.thread_id=ANY(v_alias_threads) AND mi.direction='in'
 AND mi.created_at>greatest(coalesce(v_latest_attempt,'-infinity'::timestamptz),
   coalesce((SELECT max(mo.created_at) FROM public.ig_messages mo
     WHERE mo.thread_id=ANY(v_alias_threads) AND mo.direction='out' AND mo.created_at<=now()),'-infinity'::timestamptz))
 AND mi.created_at<=now()
 AND NOT EXISTS (
  SELECT 1 FROM (
   SELECT receipt,completed_at FROM public.ig_next_actions
   WHERE action_type='reply_inbound' AND status IN ('completed','cancelled')
   UNION ALL
   SELECT receipt,completed_at FROM public.ig_next_action_receipts
   WHERE action_type='reply_inbound' AND terminal_status IN ('completed','cancelled')
  ) reviewed
  WHERE (reviewed.receipt->>'source_message_id'=mi.id::text
    OR (jsonb_typeof(reviewed.receipt#>'{conversation_review,sourceMessageIds}')='array'
        AND (reviewed.receipt#>'{conversation_review,sourceMessageIds}') ? mi.id::text))
  AND reviewed.completed_at>=mi.created_at
 )
) THEN RETURN; END IF;

 END IF;
 -- Exact recipient/thread uniqueness remains enforced by the existing queue.
 -- Exact sources remain terminal; responsive contacts may resume on a later Brisbane day under the explicitly reviewed policy. The reviewed rolling24h policy has no month-reset override.
 IF EXISTS (SELECT 1 FROM public.ig_next_action_receipts h
  WHERE (
   -- An inspected/retired exact Story is never reused, even if it was not sent.
   (h.action_type='story_reply' AND h.ig_username=a.ig_username AND h.receipt->>'story_id'=p_story_id)
   OR (public.ig_story_receipt_attempted(h.receipt) AND (
   (h.action_id=a.id AND h.action_version=a.action_version)
   OR (h.ig_username=a.ig_username AND h.receipt->>'story_id'=p_story_id)
   OR (h.action_type IN ('story_reply','welcome_follower','reactivation','feed_engagement')
       AND (h.subject_key=a.subject_key OR h.ig_username=a.ig_username
       OR (h.thread_id=ANY(v_alias_threads)))
       AND coalesce(nullif(h.receipt->>'attempt_reserved_at','')::timestamptz,h.completed_at,h.archived_at)>now()-
         CASE WHEN a.reason->>'story_contact_policy'='responsive_daily_silent_three_v1'
              THEN interval '24 hours' ELSE interval '7 days' END)
  )))) THEN RETURN; END IF;
 RETURN QUERY UPDATE public.ig_next_actions SET status='claimed',claim_owner='story_operator',
  claim_token=gen_random_uuid(),claim_run_id=p_run_id,
  claim_expires_at=least(r.lease_expires_at,now()+make_interval(secs=>least(greatest(coalesce(p_lease_seconds,300),60),300)))
 WHERE id=a.id AND action_version=p_action_version RETURNING *;
END $function$
;
