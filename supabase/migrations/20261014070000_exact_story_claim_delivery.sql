-- Exact Story selection and immutable send reservations. No lease/policy relaxation.
CREATE OR REPLACE FUNCTION public.ig_story_receipt_attempted(p_receipt jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path=public,pg_temp AS $$
 SELECT coalesce(p_receipt,'{}'::jsonb) <> '{}'::jsonb AND (
  coalesce(p_receipt->>'outbound_attempted','false')='true'
  OR coalesce(p_receipt->>'native_action_attempted','false')='true'
  OR coalesce(p_receipt->>'no_repeat','false')='true'
  OR coalesce(p_receipt->>'terminal_no_repeat','false')='true'
  OR nullif(p_receipt->>'attempt_reserved_at','') IS NOT NULL
  OR nullif(p_receipt->>'sent_observed_at','') IS NOT NULL
  OR nullif(p_receipt->>'canonical_outbound_message_id','') IS NOT NULL
  OR nullif(p_receipt->>'canonical_message_id','') IS NOT NULL
  OR coalesce(p_receipt->>'native_verified','false')='true'
 );
$$;

CREATE OR REPLACE FUNCTION public.claim_ig_story_action(
 p_action_id uuid,p_action_version integer,p_run_id text,p_tab_id text,
 p_ig_username text,p_story_id text,p_final_text text,p_lease_seconds integer DEFAULT 300)
RETURNS SETOF public.ig_next_actions LANGUAGE plpgsql SECURITY DEFINER
SET search_path=public,pg_temp AS $$
DECLARE a public.ig_next_actions%ROWTYPE; r public.ig_browser_shift_runs%ROWTYPE;
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
  OR a.reason->>'client_matches' IS DISTINCT FROM '0'
  OR a.reason->>'purchase_matches' IS DISTINCT FROM '0'
  OR a.reason->>'personal_contacts' IS DISTINCT FROM '0'
  OR a.reason->>'run_id' IS DISTINCT FROM p_run_id
  OR a.reason->>'logical_base_id' IS DISTINCT FROM r.cursor_current->>'logical_base_id'
  OR nullif(a.reason->>'authorization_source','') IS NULL
  OR nullif(a.reason->>'authorization_scope','') IS NULL
  OR nullif(a.reason->>'native_history_review','') IS NULL
  OR coalesce(a.reason->>'native_conversation_url','') !~ '^https://www.instagram.com/direct/t/[0-9]+/?$'
  OR jsonb_typeof(a.reason->'content_review') IS DISTINCT FROM 'object'
  OR a.reason->'content_review'='{}'::jsonb
  OR nullif(a.reason->>'reviewed_at','') IS NULL THEN RETURN; END IF;
 IF (a.reason->>'reviewed_at')::timestamptz NOT BETWEEN now()-interval '5 minutes' AND now()+interval '30 seconds' THEN RETURN; END IF;
 -- Exact recipient/thread uniqueness remains enforced by the existing queue.
 -- Archived attempts stay terminal forever for the same source and seven days for the person.
 IF EXISTS (SELECT 1 FROM public.ig_next_action_receipts h
  WHERE public.ig_story_receipt_attempted(h.receipt) AND (
   (h.action_id=a.id AND h.action_version=a.action_version)
   OR (h.ig_username=a.ig_username AND h.receipt->>'story_id'=p_story_id)
   OR ((h.subject_key=a.subject_key OR h.ig_username=a.ig_username
       OR (a.thread_id IS NOT NULL AND h.thread_id=a.thread_id))
       AND coalesce(nullif(h.receipt->>'attempt_reserved_at','')::timestamptz,h.completed_at,h.archived_at)>now()-interval '7 days')
  )) THEN RETURN; END IF;
 RETURN QUERY UPDATE public.ig_next_actions SET status='claimed',claim_owner='story_operator',
  claim_token=gen_random_uuid(),claim_run_id=p_run_id,
  claim_expires_at=least(r.lease_expires_at,now()+make_interval(secs=>least(greatest(coalesce(p_lease_seconds,300),60),300)))
 WHERE id=a.id AND action_version=p_action_version RETURNING *;
END $$;

CREATE OR REPLACE FUNCTION public.reserve_ig_story_send(
 p_action_id uuid,p_action_version integer,p_claim_token uuid,p_run_id text,p_tab_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE a public.ig_next_actions%ROWTYPE; v_receipt jsonb; v_inserted integer;
BEGIN
 SELECT * INTO a FROM public.ig_next_actions WHERE id=p_action_id FOR UPDATE;
 IF NOT FOUND OR a.action_version IS DISTINCT FROM p_action_version
  OR a.action_type<>'story_reply' OR a.owner<>'story_operator'
  OR NOT public.ig_browser_action_owned(p_run_id,'instagram',p_tab_id,p_action_id,p_action_version,p_claim_token,a.source_message_id)
  OR coalesce(a.receipt,'{}'::jsonb)<>'{}'::jsonb THEN
  RETURN jsonb_build_object('reserved',false,'reason','not_fresh_exact_owned_action'); END IF;
 v_receipt := jsonb_build_object('run_id',p_run_id,'claim_run_id',p_run_id,
  'original_claim_token',p_claim_token,'logical_base_id',a.reason->>'logical_base_id',
  'story_id',a.reason->>'story_id','story_url',a.reason->>'story_url',
  'final_text',a.reason->>'final_text','native_account','shan_n_sunny',
  'attempt_reserved_at',now(),'outbound_attempted',true,'no_repeat',true,
  'native_status','activation_reserved','canonical_status','pending',
  'reconciliation_required',true,'target_credit',0,'reservation_version',1);
 INSERT INTO public.ig_next_action_receipts(action_id,action_version,subject_key,thread_id,
  ig_username,owner,action_type,terminal_status,receipt,archived_at)
 VALUES(a.id,a.action_version,a.subject_key,a.thread_id,a.ig_username,a.owner,a.action_type,'waiting',v_receipt,now())
 ON CONFLICT(action_id,action_version) DO NOTHING;
 GET DIAGNOSTICS v_inserted=ROW_COUNT;
 IF v_inserted<>1 THEN RETURN jsonb_build_object('reserved',false,'reason','prior_version_receipt'); END IF;
 UPDATE public.ig_next_actions SET receipt=v_receipt WHERE id=a.id AND action_version=a.action_version;
 RETURN jsonb_build_object('reserved',true,'action_id',a.id,'action_version',a.action_version,'receipt',v_receipt);
END $$;

CREATE OR REPLACE FUNCTION public.reconcile_ig_story_delivery(
 p_action_id uuid,p_action_version integer,p_claim_token uuid,p_run_id text,
 p_canonical_message_id uuid,p_native_proof jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE h public.ig_next_action_receipts%ROWTYPE; m public.ig_messages%ROWTYPE;
 v_receipt jsonb; v_matches integer; v_at timestamptz; v_handle text;
BEGIN
 -- This records proof only. It cannot grant a lease, claim or send.
 PERFORM pg_advisory_xact_lock(hashtextextended('story-delivery:'||p_canonical_message_id::text,0));
 -- Match the queue/archive lock order used by inbound supersession.
 PERFORM 1 FROM public.ig_next_actions WHERE id=p_action_id FOR UPDATE;
 SELECT * INTO h FROM public.ig_next_action_receipts
 WHERE action_id=p_action_id AND action_version=p_action_version FOR UPDATE;
 IF NOT FOUND OR h.owner<>'story_operator' OR h.action_type<>'story_reply'
  OR h.receipt->>'original_claim_token' IS DISTINCT FROM p_claim_token::text
  OR h.receipt->>'run_id' IS DISTINCT FROM p_run_id
  OR h.receipt->>'outbound_attempted' IS DISTINCT FROM 'true'
  OR h.receipt->>'no_repeat' IS DISTINCT FROM 'true'
  OR h.receipt->>'native_account' IS DISTINCT FROM 'shan_n_sunny' THEN
  RAISE EXCEPTION 'immutable original Story reservation required'; END IF;
 IF h.receipt->>'canonical_outbound_message_id'=p_canonical_message_id::text
  AND h.receipt->>'native_status'='native_reloaded_verified' THEN
  RETURN jsonb_build_object('verified',true,'already_recorded',true,'receipt',h.receipt); END IF;
 IF h.receipt->>'native_rejection' IS NOT NULL
  OR nullif(h.receipt->>'canonical_outbound_message_id','') IS NOT NULL
  OR p_native_proof->>'native_reloaded_verified' IS DISTINCT FROM 'true'
  OR p_native_proof->>'native_account' IS DISTINCT FROM 'shan_n_sunny'
  OR p_native_proof->>'ig_username' IS DISTINCT FROM h.ig_username
  OR p_native_proof->>'story_id' IS DISTINCT FROM h.receipt->>'story_id'
  OR p_native_proof->>'final_text' IS DISTINCT FROM h.receipt->>'final_text'
  OR nullif(p_native_proof->>'native_screenshot','') IS NULL
  OR coalesce(p_native_proof->>'native_conversation_url','') !~ '^https://www.instagram.com/direct/t/[0-9]+/$' THEN
  RAISE EXCEPTION 'exact full-reload native delivery proof required'; END IF;
 v_at:=(h.receipt->>'attempt_reserved_at')::timestamptz;
 SELECT * INTO m FROM public.ig_messages WHERE id=p_canonical_message_id AND direction='out';
 SELECT ig_username INTO v_handle FROM public.ig_threads WHERE id=m.thread_id;
 IF m.id IS NULL OR v_handle IS DISTINCT FROM h.ig_username
  OR (h.thread_id IS NOT NULL AND m.thread_id<>h.thread_id)
  OR m.text NOT IN (h.receipt->>'final_text','replied to their story (story media attached) '||(h.receipt->>'final_text'))
  OR m.created_at NOT BETWEEN v_at-interval '10 seconds' AND v_at+interval '10 minutes' THEN
  RAISE EXCEPTION 'canonical outbound does not match original Story send'; END IF;
 SELECT count(*) INTO v_matches FROM public.ig_messages
 WHERE thread_id=m.thread_id AND direction='out'
 AND text IN (h.receipt->>'final_text','replied to their story (story media attached) '||(h.receipt->>'final_text'))
 AND created_at BETWEEN v_at-interval '10 seconds' AND v_at+interval '10 minutes';
 IF v_matches<>1 OR EXISTS(SELECT 1 FROM public.ig_next_action_receipts other
  WHERE (other.action_id,other.action_version)<>(h.action_id,h.action_version)
  AND other.receipt->>'canonical_outbound_message_id'=m.id::text) THEN
  RAISE EXCEPTION 'ambiguous or already credited canonical delivery'; END IF;
 -- Only native proof fields may be added; callers cannot replace original provenance.
 v_receipt:=h.receipt || jsonb_build_object(
  'native_screenshot',p_native_proof->>'native_screenshot',
  'native_conversation_url',p_native_proof->>'native_conversation_url',
  'native_reloaded_verified',true,'sent_observed_at',p_native_proof->>'sent_observed_at',
  'native_status','native_reloaded_verified','native_verified',true,
  'canonical_status','unique_correct_echo','canonical_echo_unique',true,
  'canonical_outbound_message_id',m.id,'canonical_thread_id',m.thread_id,
  'canonical_at',m.created_at,'reconciliation_required',false,'target_credit',1,
  'delivery_outcome','sent_verified','verified_at',now());
 UPDATE public.ig_next_action_receipts SET receipt=v_receipt,terminal_status='completed',completed_at=m.created_at WHERE id=h.id;
 -- A new inbound may have superseded this version. Never alter its owner, claim or receipt.
 UPDATE public.ig_next_actions SET receipt=v_receipt,status='completed',completed_at=m.created_at,
  claim_owner=NULL,claim_token=NULL,claim_run_id=NULL,claim_expires_at=NULL
 WHERE id=h.action_id AND action_version=h.action_version AND owner='story_operator'
 AND action_type='story_reply' AND claim_token=p_claim_token AND claim_run_id=p_run_id;
 RETURN jsonb_build_object('verified',true,'receipt',v_receipt);
END $$;
REVOKE ALL ON FUNCTION public.ig_story_receipt_attempted(jsonb),
 public.claim_ig_story_action(uuid,integer,text,text,text,text,text,integer),
 public.reserve_ig_story_send(uuid,integer,uuid,text,text),
 public.reconcile_ig_story_delivery(uuid,integer,uuid,text,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ig_story_receipt_attempted(jsonb),
 public.claim_ig_story_action(uuid,integer,text,text,text,text,text,integer),
 public.reserve_ig_story_send(uuid,integer,uuid,text,text),
 public.reconcile_ig_story_delivery(uuid,integer,uuid,text,uuid,jsonb) TO service_role;

-- Existing callers must never reclaim a Story with an activation reservation.
CREATE OR REPLACE FUNCTION public.claim_ig_next_actions(p_owner text, p_limit integer DEFAULT 20, p_lease_seconds integer DEFAULT 900, p_run_id text DEFAULT NULL::text, p_thread_ids uuid[] DEFAULT NULL::uuid[])
 RETURNS SETOF ig_next_actions
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    v_surface text;
    v_browser boolean;
BEGIN
    SELECT browser_surface INTO v_surface FROM public.ig_browser_shift_runs WHERE run_id=p_run_id;
    v_browser := FOUND;
    IF v_browser AND NOT public.ig_browser_surface_owned(p_run_id,v_surface) THEN
        RAISE EXCEPTION 'browser surface lease missing, legacy or expired';
    END IF;
    IF NOT v_browser AND p_owner IN ('browser_dispatcher','story_operator','external_comment_operator','follower_operator','feed_operator','discovery_operator', 'personal_operator') THEN
        RAISE EXCEPTION 'browser operator requires a verified surface run';
    END IF;
    IF p_owner NOT IN (
        'dm_manager', 'codex_live_worker', 'browser_dispatcher',
        'story_operator', 'external_comment_operator', 'follower_operator',
        'feed_operator', 'discovery_operator', 'personal_operator', 'onboarding', 'manual'
    ) THEN
        RAISE EXCEPTION 'invalid queue owner';
    END IF;

    RETURN QUERY
    WITH candidates AS (
        SELECT q.id
        FROM public.ig_next_actions q
        WHERE q.owner = p_owner
 AND (NOT v_browser OR p_owner='personal_operator' OR NOT EXISTS (SELECT 1 FROM public.ig_browser_shift_runs pr WHERE pr.run_id=p_run_id AND pr.lane='personal_discovery_follows'))
 AND (p_owner <> 'personal_operator' OR EXISTS (SELECT 1 FROM public.ig_browser_shift_runs pr WHERE pr.run_id=p_run_id AND pr.lane='personal_discovery_follows'))
          AND (NOT v_browser OR (v_surface='meta_business_suite' AND (q.action_type IN ('reply_inbound','close_sale','wait','no_action') OR public.ig_mbs_free_zoom_invite_eligible(q)))
               OR (v_surface='instagram' AND (q.action_type IN ('discovery_follow','feed_engagement','story_reply','reply_external_comment','welcome_follower','wait','no_action') OR public.ig_user_requested_checkin_eligible(q))))
          AND (q.action_type <> 'story_reply' OR NOT public.ig_story_receipt_attempted(q.receipt))
          AND (q.action_type <> 'story_reply' OR NOT EXISTS (
              SELECT 1 FROM public.ig_next_action_receipts h
              WHERE public.ig_story_receipt_attempted(h.receipt)
              AND ((h.action_id=q.id AND h.action_version=q.action_version)
                OR (h.ig_username=q.ig_username AND h.receipt->>'story_id'=q.reason->>'story_id'))))
          AND (p_thread_ids IS NULL OR q.thread_id = ANY(p_thread_ids))
          AND q.due_at <= NOW()
          AND COALESCE(q.safe_after, '-infinity'::TIMESTAMPTZ) <= NOW()
          AND (
              q.status IN ('waiting', 'claimed')
              OR coalesce(q.receipt, '{}'::JSONB) = '{}'::JSONB
              OR (
                  q.status = 'cooldown'
                  AND q.safe_after <= NOW()
                  AND q.receipt->>'cloud_dm_manager_fallback' = 'true'
                  AND coalesce(q.receipt->>'outbound_attempted', 'false') <> 'true'
                  AND NOT EXISTS (
                      SELECT 1
                      FROM public.coach_alerts scheduled_alert
                      WHERE scheduled_alert.id::text = q.receipt->>'alert_id'
                        AND scheduled_alert.status = 'scheduled'
                  )
              )
          )
          AND (
              q.status = 'ready'
              OR (q.status = 'waiting' AND q.safe_after <= NOW())
              OR (q.status = 'claimed' AND q.claim_expires_at <= NOW())
              OR (q.status = 'cooldown' AND q.safe_after <= NOW())
          )
        ORDER BY q.priority DESC, q.due_at ASC, q.created_at ASC
        LIMIT LEAST(GREATEST(COALESCE(p_limit, 20), 1), 100)
        FOR UPDATE SKIP LOCKED
    )
    UPDATE public.ig_next_actions q
    SET status = 'claimed',
        claim_owner = p_owner,
        claim_token = gen_random_uuid(),
        claim_run_id = NULLIF(trim(p_run_id), ''),
        claim_expires_at = NOW() + make_interval(
            secs => LEAST(GREATEST(COALESCE(p_lease_seconds, 900), 60), 7200)
        )
    FROM candidates c
    WHERE q.id = c.id
    RETURNING q.*;
END;
$function$
