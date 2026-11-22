-- Reuse the feed worker's exact recipient claims and one-use activation.
-- Action kind is immutable with its reservation. One action per post and existing cooldowns apply.
ALTER TABLE public.ig_public_comment_attempts ADD COLUMN action_kind text NOT NULL DEFAULT 'comment'
 CHECK (action_kind IN ('comment', 'like', 'repost'));

CREATE FUNCTION public.ig_public_engagement_reserved_today() RETURNS bigint
LANGUAGE sql STABLE SET search_path=public,pg_temp AS $$
 SELECT (SELECT count(*) FROM public.ig_public_comment_attempts
          WHERE (reserved_at AT TIME ZONE 'Australia/Brisbane')::date =
                (now() AT TIME ZONE 'Australia/Brisbane')::date)
      + (SELECT count(*) FROM public.outbound_comment_replies
          WHERE channel='instagram' AND (reserved_at AT TIME ZONE 'Australia/Brisbane')::date =
                (now() AT TIME ZONE 'Australia/Brisbane')::date);
$$;

CREATE FUNCTION public.guard_ig_public_engagement_capacity() RETURNS trigger
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
 IF TG_TABLE_NAME='outbound_comment_replies' THEN
  IF NEW.channel <> 'instagram' THEN RETURN NEW; END IF;
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('ig_public_comment_daily_capacity',0));
 IF public.ig_public_engagement_reserved_today() >= 50 THEN
  RAISE EXCEPTION 'shared Instagram public engagement capacity reserved';
 END IF;
 RETURN NEW;
END $$;

CREATE TRIGGER ig_public_engagement_capacity BEFORE INSERT ON public.ig_public_comment_attempts
 FOR EACH ROW EXECUTE FUNCTION public.guard_ig_public_engagement_capacity();
CREATE TRIGGER ig_public_engagement_reply_capacity BEFORE INSERT ON public.outbound_comment_replies
 FOR EACH ROW EXECUTE FUNCTION public.guard_ig_public_engagement_capacity();

REVOKE ALL ON FUNCTION public.ig_public_engagement_reserved_today(),
 public.guard_ig_public_engagement_capacity() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ig_public_engagement_reserved_today(),
 public.guard_ig_public_engagement_capacity() TO service_role;

CREATE OR REPLACE FUNCTION public.claim_ig_public_comment(p_run_id text, p_tab_id text, p_action_id uuid, p_action_version integer, p_username text, p_post_url text, p_final_text text)
 RETURNS ig_next_actions
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE a public.ig_next_actions%ROWTYPE; r public.ig_public_comment_runs%ROWTYPE; v_reserved timestamptz:=now(); v_kind text;
BEGIN
 SELECT * INTO r FROM public.ig_public_comment_runs WHERE run_id=p_run_id FOR UPDATE;
 IF NOT FOUND OR NOT public.ig_public_comment_run_owned(p_run_id,p_tab_id) OR r.started_at<=now()-interval '25 minutes' THEN
  RAISE EXCEPTION 'owned public comment run required';
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('ig_public_comment_daily_capacity',0));
 IF public.ig_public_engagement_reserved_today() >= 50
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
 v_kind := coalesce(a.reason->>'public_action_kind','comment');
 IF v_kind NOT IN ('comment','like','repost') OR (v_kind <> 'comment' AND p_final_text IS DISTINCT FROM v_kind) THEN
  RAISE EXCEPTION 'exact public action kind required';
 END IF;
 IF (a.reason->>'reviewed_at')::timestamptz NOT BETWEEN now()-interval '5 minutes' AND now()+interval '30 seconds'
 OR (a.reason->>'post_published_at') IS NULL
 OR (
 (a.reason->>'post_published_at')::timestamptz > now()+interval '30 seconds'
 OR ((a.reason->>'post_published_at')::timestamptz < now()-interval '72 hours'
 AND NOT (
  coalesce(r.cursor->>'warm_only','')='true'
  AND coalesce(r.cursor->>'older_posts_allowed','')='true'
  AND coalesce(a.reason->>'older_post_authorization','')='shannon_20261024'
  AND nullif(btrim(a.reason->>'warm_audience_evidence'),'') IS NOT NULL
 )))
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
 receipt=jsonb_build_object('attempt_reserved_at',v_reserved,'post_url',p_post_url,'final_text',p_final_text,'public_action_kind',v_kind,'no_repeat',true,'native_verified',false)
 WHERE id=a.id RETURNING * INTO a;
 INSERT INTO public.ig_public_comment_attempts(run_id,action_id,action_version,ig_username,post_url,final_text,reserved_at,action_kind)
 VALUES(p_run_id,a.id,a.action_version,p_username,p_post_url,p_final_text,v_reserved,v_kind);
 RETURN a;
END $function$;
-- A reservation must consume capacity on the date it can be activated.
CREATE FUNCTION public.guard_ig_public_engagement_activation_day() RETURNS trigger
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
 IF TG_TABLE_NAME='outbound_comment_replies' THEN
  IF NEW.channel <> 'instagram' THEN RETURN NEW; END IF;
 END IF;
 IF NEW.status='activated' AND OLD.status='reserved'
 AND (OLD.reserved_at AT TIME ZONE 'Australia/Brisbane')::date
     <> (clock_timestamp() AT TIME ZONE 'Australia/Brisbane')::date THEN
  RAISE EXCEPTION 'Instagram public reservation expired at Brisbane midnight';
 END IF;
 RETURN NEW;
END $$;

CREATE TRIGGER ig_public_engagement_activation_day BEFORE UPDATE OF status ON public.ig_public_comment_attempts
 FOR EACH ROW EXECUTE FUNCTION public.guard_ig_public_engagement_activation_day();
CREATE TRIGGER ig_public_engagement_reply_activation_day BEFORE UPDATE OF status ON public.outbound_comment_replies
 FOR EACH ROW EXECUTE FUNCTION public.guard_ig_public_engagement_activation_day();
REVOKE ALL ON FUNCTION public.guard_ig_public_engagement_activation_day() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guard_ig_public_engagement_activation_day() TO service_role;

CREATE OR REPLACE FUNCTION public.reconcile_ig_public_comment(p_run_id text, p_tab_id text, p_action_id uuid, p_action_version integer, p_claim_token uuid, p_post_url text, p_final_text text, p_proof jsonb, p_verified boolean)
 RETURNS ig_next_actions
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE a public.ig_next_actions%ROWTYPE; v_kind text;
BEGIN
 IF NOT public.ig_public_comment_action_owned(p_run_id,p_tab_id,p_action_id,p_action_version,p_claim_token,p_post_url,p_final_text) THEN
  RAISE EXCEPTION 'exact owned public comment reservation required';
 END IF;
 SELECT action_kind INTO STRICT v_kind FROM public.ig_public_comment_attempts
 WHERE action_id=p_action_id AND action_version=p_action_version;
 IF p_verified AND v_kind <> 'comment' AND (
  p_proof->>'action_kind' IS DISTINCT FROM v_kind
  OR p_proof->'active_after_reload' IS DISTINCT FROM 'true'::jsonb
  OR p_proof->'active_before' IS DISTINCT FROM 'false'::jsonb
 ) THEN RAISE EXCEPTION 'exact native state transition required'; END IF;
 IF p_verified AND (p_proof->>'post_url' IS DISTINCT FROM p_post_url OR (v_kind='comment' AND p_proof->>'text' IS DISTINCT FROM p_final_text)
  OR p_proof->>'sender' IS DISTINCT FROM 'shan_n_sunny' OR nullif(p_proof->>'native_reload_screenshot','') IS NULL
  OR nullif(p_proof->>'native_readback','') IS NULL OR nullif(p_proof->>'observed_at','') IS NULL
  OR p_proof->>'author' IS DISTINCT FROM (SELECT ig_username FROM public.ig_public_comment_attempts WHERE action_id=p_action_id AND action_version=p_action_version)) THEN
  RAISE EXCEPTION 'exact native reload proof required';
 END IF;
 SELECT * INTO a FROM public.complete_ig_next_action(p_action_id,p_claim_token,CASE WHEN p_verified THEN 'completed' ELSE 'blocked' END,
 now()+interval '7 days',jsonb_build_object('post_url',p_post_url,'final_text',p_final_text,'comment_verified',p_verified AND v_kind='comment','public_action_kind',v_kind,
 'native_verified',p_verified,'no_repeat',true,'native_action_attempted',true,'native_readback',p_proof->>'native_readback','native_proof',p_proof));
 UPDATE public.ig_public_comment_attempts SET status=CASE WHEN p_verified THEN 'verified' ELSE 'uncertain' END,proof=p_proof
 WHERE action_id=p_action_id AND action_version=p_action_version;
 RETURN a;
END $function$;
