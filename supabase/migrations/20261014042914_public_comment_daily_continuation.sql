-- Shannon requested fifty/day with continuation on 14 October 2026.
DROP INDEX public.ig_public_comment_one_daily_pass;
CREATE OR REPLACE FUNCTION public.claim_ig_public_comment(p_run_id text,p_tab_id text,p_action_id uuid,p_action_version integer,p_username text,p_post_url text,p_final_text text)
RETURNS public.ig_next_actions LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE a public.ig_next_actions%ROWTYPE; r public.ig_public_comment_runs%ROWTYPE; v_reserved timestamptz:=now();
BEGIN
 SELECT * INTO r FROM public.ig_public_comment_runs WHERE run_id=p_run_id FOR UPDATE;
 IF NOT FOUND OR NOT public.ig_public_comment_run_owned(p_run_id,p_tab_id) OR r.started_at<=now()-interval '25 minutes' THEN
  RAISE EXCEPTION 'owned public comment run required';
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('ig_public_comment_daily_capacity',0));
 IF (SELECT count(*) FROM public.ig_public_comment_attempts WHERE
  (reserved_at AT TIME ZONE 'Australia/Brisbane')::date=(now() AT TIME ZONE 'Australia/Brisbane')::date)>=50
 OR (r.mode='pilot' AND (SELECT count(*) FROM public.ig_public_comment_attempts x JOIN public.ig_public_comment_runs y USING(run_id) WHERE y.mode='pilot')>=5) THEN
  RAISE EXCEPTION 'public comment capacity reserved';
 END IF;
 SELECT * INTO a FROM public.ig_next_actions WHERE id=p_action_id FOR UPDATE SKIP LOCKED;
 IF NOT FOUND OR a.action_version IS DISTINCT FROM p_action_version OR a.ig_username IS DISTINCT FROM p_username
 OR a.subject_key IS DISTINCT FROM ('ig:'||p_username) OR a.owner<>'feed_operator' OR a.action_type<>'feed_engagement'
 OR a.status<>'ready' OR a.due_at>now() OR coalesce(a.safe_after,'-infinity'::timestamptz)>now()
 OR a.receipt<>'{}'::jsonb OR a.source_message_id IS NOT NULL
 OR a.reason->>'post_url' IS DISTINCT FROM p_post_url OR a.reason->>'final_text' IS DISTINCT FROM p_final_text
 OR a.reason->>'run_id' IS DISTINCT FROM p_run_id OR a.reason->>'is_dm' IS DISTINCT FROM 'false'
 OR a.reason->>'native_following_verified' IS DISTINCT FROM 'true'
 OR a.reason->>'eligibility_review' IS NULL OR a.reason->>'authorization_source' IS NULL
 OR a.reason->>'content_review' IS NULL OR a.reason->>'history_review' IS NULL
 OR nullif(a.reason->>'reviewed_at','') IS NULL THEN RAISE EXCEPTION 'exact reviewed public action required'; END IF;
 IF (a.reason->>'reviewed_at')::timestamptz NOT BETWEEN now()-interval '5 minutes' AND now()+interval '30 seconds'
 OR (a.reason->>'post_published_at') IS NULL
 OR (a.reason->>'post_published_at')::timestamptz NOT BETWEEN now()-interval '72 hours' AND now()+interval '30 seconds'
 OR p_username IN ('shan_n_sunny','cavazzanafrancesca','lara_lessmann')
 OR EXISTS(SELECT 1 FROM public.ig_personal_contacts WHERE ig_username=p_username)
 OR EXISTS(SELECT 1 FROM public.ig_threads t WHERE lower(ltrim(t.ig_username,'@'))=p_username AND (
  t.custom_data->>'manual_only'='true' OR t.custom_data->>'manual_review_only'='true'
  OR t.custom_data->>'friend_manual_only'='true' OR t.custom_data->>'do_not_follow_up'='true'
  OR t.custom_data->>'blocked_by_shannon'='true' OR t.custom_data->>'opt_out'='true' OR t.custom_data->>'opted_out'='true'
  OR t.custom_data->>'ai_automation_opt_out'='true' OR t.custom_data->>'codex_ai_opt_out'='true'
  OR t.custom_data->>'client_community_support_enabled'='false' OR t.auto_send_enabled=false
  OR t.last_outbound_at>now()-interval '24 hours'
  OR (t.last_inbound_at IS NOT NULL AND (t.last_outbound_at IS NULL OR t.last_inbound_at>t.last_outbound_at)))) THEN
  RAISE EXCEPTION 'public comment recipient or freshness hold';
 END IF;
 IF EXISTS(SELECT 1 FROM public.ig_public_comment_attempts WHERE post_url=p_post_url
  OR (ig_username=p_username AND reserved_at>now()-interval '7 days'))
 OR EXISTS(SELECT 1 FROM public.ig_next_action_receipts h WHERE (h.ig_username=p_username OR (a.thread_id IS NOT NULL AND h.thread_id=a.thread_id))
  AND public.ig_story_receipt_attempted(h.receipt) AND (h.receipt->>'post_url'=p_post_url OR coalesce(h.completed_at,h.archived_at)>now()-interval '7 days')) THEN
  RAISE EXCEPTION 'public comment duplicate or person cooldown';
 END IF;
 UPDATE public.ig_next_actions SET status='claimed',claim_owner='feed_operator',claim_token=gen_random_uuid(),claim_run_id=p_run_id,
 claim_expires_at=least(r.lease_expires_at,now()+interval '5 minutes'),
 receipt=jsonb_build_object('attempt_reserved_at',v_reserved,'post_url',p_post_url,'final_text',p_final_text,'no_repeat',true,'native_verified',false)
 WHERE id=a.id RETURNING * INTO a;
 INSERT INTO public.ig_public_comment_attempts(run_id,action_id,action_version,ig_username,post_url,final_text,reserved_at)
 VALUES(p_run_id,a.id,a.action_version,p_username,p_post_url,p_final_text,v_reserved);
 RETURN a;
END $$;

