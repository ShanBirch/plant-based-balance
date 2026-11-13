CREATE OR REPLACE FUNCTION public.reserve_ig_story_send(p_action_id uuid, p_action_version integer, p_claim_token uuid, p_run_id text, p_tab_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE a public.ig_next_actions%ROWTYPE; v_receipt jsonb; v_inserted integer; v_story_daily_used integer;
BEGIN
 SELECT * INTO a FROM public.ig_next_actions WHERE id=p_action_id FOR UPDATE;
 IF NOT FOUND OR a.action_version IS DISTINCT FROM p_action_version
  OR a.action_type<>'story_reply' OR a.owner<>'story_operator'
  OR NOT public.ig_browser_action_owned(p_run_id,'instagram',p_tab_id,p_action_id,p_action_version,p_claim_token,a.source_message_id)
  OR coalesce(a.receipt,'{}'::jsonb)<>'{}'::jsonb THEN
  RETURN jsonb_build_object('reserved',false,'reason','not_fresh_exact_owned_action'); END IF;
 -- Authorised 14 November 2026: hard 30 Story DM ceiling per Brisbane day.
 -- Serialize all Story reservations; legacy volume-policy tags grant no bypass.
 PERFORM pg_advisory_xact_lock(hashtextextended('ig-story-daily50:shan_n_sunny:'||(now() AT TIME ZONE 'Australia/Brisbane')::date::text,0));
 WITH receipt_rows AS (
 SELECT id action_id,action_version,receipt,coalesce(completed_at,updated_at) fallback_at FROM public.ig_next_actions WHERE action_type='story_reply' AND coalesce(receipt->>'native_account',receipt->>'bot_account',reason->>'native_account',reason->>'bot_account','shan_n_sunny')='shan_n_sunny'
 UNION ALL
 SELECT action_id,action_version,receipt,coalesce(completed_at,archived_at) FROM public.ig_next_action_receipts WHERE action_type='story_reply' AND coalesce(receipt->>'native_account',receipt->>'bot_account','shan_n_sunny')='shan_n_sunny'
), events AS (
 SELECT coalesce(nullif(receipt->>'canonical_outbound_message_id',''),nullif(receipt->>'canonical_message_id',''),nullif(receipt->>'canonical_id',''),nullif(receipt->>'canonical_outbound_id',''),'reservation:'||action_id::text||':'||action_version::text) contact_key,
 coalesce(nullif(receipt->>'attempt_reserved_at','')::timestamptz,nullif(receipt->>'native_sent_at','')::timestamptz,nullif(receipt->>'sent_observed_at','')::timestamptz,nullif(receipt->>'sent_at','')::timestamptz,fallback_at) event_at
 FROM receipt_rows WHERE public.ig_story_receipt_attempted(receipt)
 UNION ALL
 SELECT m.id::text,m.created_at FROM public.ig_messages m JOIN public.ig_threads t ON t.id=m.thread_id
 WHERE m.direction='out' AND (m.text ILIKE 'replied to their story%' OR m.source='native_story_comment')
 AND t.coach_id='00a6605e-8edb-4917-85ba-24a23f179059'::uuid AND t.channel='instagram'
 AND coalesce(t.custom_data->>'bot_account',t.custom_data#>>'{instagram_graph,bot_account}','shan_n_sunny')='shan_n_sunny'
), daily AS (SELECT DISTINCT contact_key FROM events
 WHERE event_at >= (date_trunc('day',now() AT TIME ZONE 'Australia/Brisbane') AT TIME ZONE 'Australia/Brisbane')
 AND event_at < ((date_trunc('day',now() AT TIME ZONE 'Australia/Brisbane')+interval '1 day') AT TIME ZONE 'Australia/Brisbane'))
 SELECT count(*) INTO v_story_daily_used FROM daily;
 IF v_story_daily_used>=30 THEN
  RETURN jsonb_build_object('reserved',false,'reason','story_daily_30_cap','daily_cap',30,'daily_used',v_story_daily_used,'day',(now() AT TIME ZONE 'Australia/Brisbane')::date);
 END IF;
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
END $function$

