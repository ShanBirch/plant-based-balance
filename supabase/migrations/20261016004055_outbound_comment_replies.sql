-- Reactive public replies belong to the SAME existing platform commenter/run.
-- They never create DM sources, proactive quota credit, or another sender.
CREATE TABLE public.outbound_comment_replies (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 channel text NOT NULL CHECK(channel IN ('instagram','facebook')),
 root_attempt_id uuid NOT NULL, run_id text NOT NULL, tab_id text NOT NULL,
 person_key text NOT NULL CHECK(length(trim(person_key))>0),
 ig_username text, post_url text NOT NULL, root_comment_id text NOT NULL,
 inbound_comment_id text NOT NULL CHECK(length(trim(inbound_comment_id))>0),
 replying_to_comment_id text NOT NULL, inbound_text text NOT NULL,
 final_text text NOT NULL CHECK(length(trim(final_text)) BETWEEN 1 AND 500),
 reserved_at timestamptz NOT NULL DEFAULT now(), activated_at timestamptz,
 status text NOT NULL DEFAULT 'reserved' CHECK(status IN ('reserved','activated','verified','uncertain')),
 evidence jsonb NOT NULL, proof jsonb NOT NULL DEFAULT '{}',
 UNIQUE(channel,inbound_comment_id)
);
CREATE INDEX outbound_comment_reply_person ON public.outbound_comment_replies(ig_username,status);
ALTER TABLE public.outbound_comment_replies ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.outbound_comment_replies FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.outbound_comment_replies TO service_role;

CREATE FUNCTION public.outbound_comment_reply_owned(p_channel text,p_run text,p_tab text)
RETURNS boolean LANGUAGE sql STABLE SET search_path=public,pg_temp AS $$
 SELECT CASE p_channel WHEN 'instagram' THEN public.ig_public_comment_run_owned(p_run,p_tab)
 WHEN 'facebook' THEN public.fb_public_comment_owned(p_run,p_tab) ELSE false END;
$$;

CREATE FUNCTION public.check_outbound_comment_reply(p_channel text,p_run text,p_tab text,p_username text,p_evidence jsonb)
RETURNS void LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
 IF NOT public.outbound_comment_reply_owned(p_channel,p_run,p_tab) THEN RAISE EXCEPTION 'existing platform commenter ownership required'; END IF;
 IF jsonb_typeof(p_evidence) IS DISTINCT FROM 'object'
 OR p_evidence->>'history_complete' IS DISTINCT FROM 'true'
 OR p_evidence->>'eligibility_clear' IS DISTINCT FROM 'true'
 OR p_evidence->>'cross_worker_clear' IS DISTINCT FROM 'true'
 OR p_evidence->>'expanded_replies_reviewed' IS DISTINCT FROM 'true'
 OR p_evidence->>'unanswered' IS DISTINCT FROM 'true'
 OR p_evidence->>'public_context_understood' IS DISTINCT FROM 'true'
 OR nullif(trim(p_evidence->>'native_source_screenshot'),'') IS NULL
 OR nullif(trim(p_evidence->>'history_review'),'') IS NULL
 OR nullif(trim(p_evidence->>'eligibility_review'),'') IS NULL
 OR nullif(trim(p_evidence->>'authorization_source'),'') IS NULL
 OR nullif(p_evidence->>'reviewed_at','') IS NULL
 OR (p_evidence->>'reviewed_at')::timestamptz NOT BETWEEN now()-interval '5 minutes' AND now()+interval '30 seconds'
 THEN RAISE EXCEPTION 'fresh complete native reply review required'; END IF;
 IF p_channel='instagram' AND (p_username IS NULL OR p_username !~ '^[a-z0-9_.]+$') THEN RAISE EXCEPTION 'exact Instagram author required'; END IF;
 IF p_username IS NOT NULL AND (
 p_username IN ('shan_n_sunny','cavazzanafrancesca','lara_lessmann','mrs_natty_t')
 OR EXISTS(SELECT 1 FROM public.ig_personal_contacts WHERE ig_username=p_username)
 OR EXISTS(SELECT 1 FROM public.ig_threads t WHERE lower(ltrim(t.ig_username,'@'))=p_username AND (
 t.auto_send_enabled=false OR t.custom_data->>'manual_only'='true' OR t.custom_data->>'manual_review_only'='true'
 OR t.custom_data->>'friend_manual_only'='true' OR t.custom_data->>'do_not_follow_up'='true'
 OR t.custom_data->>'human_takeover'='true' OR t.custom_data->>'human_takeover_active'='true'
 OR t.custom_data->>'manual_hold'='true' OR t.custom_data->>'personal_contact'='true' OR t.custom_data->>'dating_contact'='true' OR t.custom_data->>'personal_outreach'='true'
 OR t.custom_data->>'blocked_by_shannon'='true' OR t.custom_data->>'opt_out'='true' OR t.custom_data->>'opted_out'='true'
 OR t.custom_data->>'ai_automation_opt_out'='true' OR t.custom_data->>'codex_ai_opt_out'='true'
 OR t.custom_data->>'client_community_support_enabled'='false'))
 OR EXISTS(SELECT 1 FROM public.ig_next_actions WHERE ig_username=p_username AND status='claimed' AND claim_expires_at>now())
 ) THEN RAISE EXCEPTION 'independent recipient hold or foreign claim'; END IF;
END $$;

CREATE FUNCTION public.reserve_outbound_comment_reply(p_channel text,p_run text,p_tab text,p_root uuid,
 p_person text,p_username text,p_post_url text,p_root_comment text,p_inbound text,p_parent text,p_inbound_text text,p_text text,p_evidence jsonb)
RETURNS public.outbound_comment_replies LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE a public.outbound_comment_replies; root_proof jsonb; root_url text;
BEGIN
 -- Serialize with new generic recipient claims, including MBS/Story claims.
 PERFORM pg_advisory_xact_lock(hashtextextended('outbound_comment_reply_claim',0));
 PERFORM public.check_outbound_comment_reply(p_channel,p_run,p_tab,p_username,p_evidence);
 IF p_channel='instagram' AND p_person IS DISTINCT FROM p_username THEN RAISE EXCEPTION 'exact incoming person/handle required'; END IF;
 IF p_channel='instagram' THEN
  PERFORM 1 FROM public.ig_public_comment_runs WHERE run_id=p_run AND started_at>now()-interval '25 minutes' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'new reply cutoff'; END IF;
  SELECT proof,post_url INTO root_proof,root_url FROM public.ig_public_comment_attempts WHERE id=p_root AND status='verified';
 ELSE
  PERFORM 1 FROM public.fb_public_comment_runs WHERE run_id=p_run AND started_at>now()-interval '25 minutes' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'new reply cutoff'; END IF;
  SELECT proof,post_url INTO root_proof,root_url FROM public.fb_public_comment_attempts WHERE id=p_root AND status='verified';
 END IF;
 IF root_url IS DISTINCT FROM p_post_url OR nullif(p_root_comment,'') IS NULL
 OR coalesce(root_proof->>'native_comment_id',root_proof->>'comment_id') IS DISTINCT FROM p_root_comment
 OR p_root_comment=p_inbound OR p_inbound=p_parent
 OR (p_parent IS DISTINCT FROM p_root_comment AND NOT EXISTS(SELECT 1 FROM public.outbound_comment_replies
  WHERE channel=p_channel AND root_attempt_id=p_root AND status='verified' AND proof->>'native_comment_id'=p_parent))
 THEN RAISE EXCEPTION 'verified outbound parent and exact incoming reply required'; END IF;
 IF EXISTS(SELECT 1 FROM public.outbound_comment_replies WHERE channel=p_channel AND person_key=p_person
 AND status IN ('reserved','activated','uncertain')) THEN RAISE EXCEPTION 'unresolved public reply no-repeat'; END IF;
 INSERT INTO public.outbound_comment_replies(channel,root_attempt_id,run_id,tab_id,person_key,ig_username,post_url,
 root_comment_id,inbound_comment_id,replying_to_comment_id,inbound_text,final_text,evidence)
 VALUES(p_channel,p_root,p_run,p_tab,p_person,p_username,p_post_url,p_root_comment,p_inbound,p_parent,p_inbound_text,p_text,p_evidence) RETURNING * INTO a;
 RETURN a;
END $$;

CREATE FUNCTION public.activate_outbound_comment_reply(p_run text,p_tab text,p_attempt uuid,p_inbound text,p_text text,p_review jsonb)
RETURNS uuid LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE a public.outbound_comment_replies;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('outbound_comment_reply_claim',0));
 SELECT * INTO a FROM public.outbound_comment_replies WHERE id=p_attempt AND run_id=p_run AND tab_id=p_tab FOR UPDATE;
 IF NOT FOUND OR a.status<>'reserved' OR a.inbound_comment_id IS DISTINCT FROM p_inbound OR a.final_text IS DISTINCT FROM p_text
 THEN RAISE EXCEPTION 'one-use exact reply activation required'; END IF;
 PERFORM public.check_outbound_comment_reply(a.channel,p_run,p_tab,a.ig_username,p_review);
 UPDATE public.outbound_comment_replies SET status='activated',activated_at=now() WHERE id=a.id;
 RETURN a.id;
END $$;

CREATE FUNCTION public.reconcile_outbound_comment_reply(p_attempt uuid,p_proof jsonb,p_verified boolean)
RETURNS public.outbound_comment_replies LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE a public.outbound_comment_replies;
BEGIN
 -- Read-only native reconciliation may finish after lease expiry; no send right.
 SELECT * INTO a FROM public.outbound_comment_replies WHERE id=p_attempt FOR UPDATE;
 IF NOT FOUND OR a.status NOT IN ('reserved','activated','uncertain') THEN RAISE EXCEPTION 'unresolved reply required'; END IF;
 IF p_verified AND (a.activated_at IS NULL OR p_proof->>'inbound_comment_id' IS DISTINCT FROM a.inbound_comment_id
 OR p_proof->>'post_url' IS DISTINCT FROM a.post_url OR p_proof->>'text' IS DISTINCT FROM a.final_text
 OR p_proof->>'sender' IS DISTINCT FROM CASE a.channel WHEN 'instagram' THEN 'shan_n_sunny' ELSE 'shazbirch' END
 OR nullif(trim(p_proof->>'native_comment_id'),'') IS NULL
 OR p_proof->>'native_comment_id' IN (a.root_comment_id,a.inbound_comment_id)
 OR p_proof->>'reply_to_comment_id' IS DISTINCT FROM a.inbound_comment_id
 OR nullif(trim(p_proof->>'native_reload_screenshot'),'') IS NULL
 OR nullif(trim(p_proof->>'native_readback'),'') IS NULL OR nullif(p_proof->>'observed_at','') IS NULL)
 THEN RAISE EXCEPTION 'exact saved native reply proof required'; END IF;
 UPDATE public.outbound_comment_replies SET status=CASE WHEN p_verified THEN 'verified' ELSE 'uncertain' END,proof=p_proof WHERE id=a.id RETURNING * INTO a;
 RETURN a;
END $$;

CREATE FUNCTION public.guard_outbound_comment_reply() RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
 IF (to_jsonb(NEW)-'status'-'proof'-'activated_at') IS DISTINCT FROM (to_jsonb(OLD)-'status'-'proof'-'activated_at')
 OR (NEW.activated_at IS DISTINCT FROM OLD.activated_at AND NOT (OLD.status='reserved' AND NEW.status='activated' AND NEW.activated_at=now()))
 OR NOT ((OLD.status='reserved' AND NEW.status IN ('activated','uncertain'))
 OR (OLD.status='activated' AND NEW.status IN ('verified','uncertain')) OR (OLD.status='uncertain' AND NEW.status='verified'))
 THEN RAISE EXCEPTION 'immutable reply source and terminal no-repeat'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER outbound_comment_reply_guard BEFORE UPDATE ON public.outbound_comment_replies FOR EACH ROW EXECUTE FUNCTION public.guard_outbound_comment_reply();

CREATE FUNCTION public.guard_claim_during_public_reply() RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
 IF NEW.status='claimed' AND (TG_OP='INSERT' OR OLD.status IS DISTINCT FROM 'claimed' OR NEW.claim_token IS DISTINCT FROM OLD.claim_token) THEN
  PERFORM pg_advisory_xact_lock(hashtextextended('outbound_comment_reply_claim',0));
  IF EXISTS(SELECT 1 FROM public.outbound_comment_replies r WHERE r.ig_username=NEW.ig_username AND r.status IN ('reserved','activated')
  AND public.outbound_comment_reply_owned(r.channel,r.run_id,r.tab_id)) THEN RAISE EXCEPTION 'recipient has owned public reply'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER public_reply_recipient_claim_guard BEFORE INSERT OR UPDATE ON public.ig_next_actions FOR EACH ROW EXECUTE FUNCTION public.guard_claim_during_public_reply();

REVOKE ALL ON FUNCTION public.outbound_comment_reply_owned(text,text,text),public.check_outbound_comment_reply(text,text,text,text,jsonb),
 public.reserve_outbound_comment_reply(text,text,text,uuid,text,text,text,text,text,text,text,text,jsonb),
 public.activate_outbound_comment_reply(text,text,uuid,text,text,jsonb),public.reconcile_outbound_comment_reply(uuid,jsonb,boolean),
 public.guard_outbound_comment_reply(),public.guard_claim_during_public_reply() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.outbound_comment_reply_owned(text,text,text),public.check_outbound_comment_reply(text,text,text,text,jsonb),
 public.reserve_outbound_comment_reply(text,text,text,uuid,text,text,text,text,text,text,text,text,jsonb),
 public.activate_outbound_comment_reply(text,text,uuid,text,text,jsonb),public.reconcile_outbound_comment_reply(uuid,jsonb,boolean) TO service_role;
