ALTER TABLE public.ig_public_comment_attempts DROP CONSTRAINT ig_public_comment_attempts_status_check;
ALTER TABLE public.ig_public_comment_attempts ADD CHECK(status IN ('reserved','activated','verified','uncertain'));
-- /p/ and /reel/ can identify the same shortcode; both remain lifetime no-repeat.
CREATE UNIQUE INDEX ig_public_comment_exact_shortcode ON public.ig_public_comment_attempts((split_part(post_url,'/',5)));
CREATE OR REPLACE FUNCTION public.guard_ig_public_comment_attempt() RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
 IF (to_jsonb(NEW)-'status'-'proof') IS DISTINCT FROM (to_jsonb(OLD)-'status'-'proof')
 OR NOT ((OLD.status='reserved' AND NEW.status IN ('activated','uncertain'))
  OR (OLD.status='activated' AND NEW.status IN ('verified','uncertain'))) THEN
  RAISE EXCEPTION 'immutable public comment reservation';
 END IF;
 RETURN NEW;
END $$;
CREATE FUNCTION public.reserve_ig_public_comment_send(p_run_id text,p_tab_id text,p_action_id uuid,p_action_version integer,p_claim_token uuid,p_post_url text,p_final_text text)
RETURNS uuid LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE attempt_id uuid;
BEGIN
 IF NOT public.ig_public_comment_action_owned(p_run_id,p_tab_id,p_action_id,p_action_version,p_claim_token,p_post_url,p_final_text) THEN
  RAISE EXCEPTION 'fresh exact owned public comment required';
 END IF;
 UPDATE public.ig_public_comment_attempts SET status='activated'
 WHERE action_id=p_action_id AND action_version=p_action_version AND status='reserved' RETURNING id INTO attempt_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'public comment send already reserved; never retry'; END IF;
 RETURN attempt_id;
END $$;
CREATE OR REPLACE FUNCTION public.ig_public_comment_action_owned(p_run_id text,p_tab_id text,p_action_id uuid,p_action_version integer,p_claim_token uuid,p_post_url text,p_final_text text)
RETURNS boolean LANGUAGE sql STABLE SET search_path=public,pg_temp AS $$
 SELECT public.ig_public_comment_run_owned(p_run_id,p_tab_id) AND EXISTS(
 SELECT 1 FROM public.ig_next_actions a JOIN public.ig_public_comment_attempts x ON x.action_id=a.id AND x.action_version=a.action_version
 WHERE a.id=p_action_id AND a.action_version=p_action_version AND a.claim_token=p_claim_token AND a.claim_run_id=p_run_id
 AND a.status='claimed' AND a.claim_expires_at>now() AND a.owner='feed_operator' AND a.action_type='feed_engagement'
 AND a.source_message_id IS NULL AND x.run_id=p_run_id AND x.post_url=p_post_url AND x.final_text=p_final_text AND x.status IN ('reserved','activated'));
$$;
-- Verified reconciliation additionally requires the one-use pre-send reservation.
CREATE FUNCTION public.guard_ig_public_comment_verified() RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
 IF NEW.status='verified' AND OLD.status<>'activated' THEN RAISE EXCEPTION 'one-use send reservation required'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER ig_public_comment_verified_guard BEFORE UPDATE ON public.ig_public_comment_attempts
 FOR EACH ROW EXECUTE FUNCTION public.guard_ig_public_comment_verified();
REVOKE ALL ON FUNCTION public.reserve_ig_public_comment_send(text,text,uuid,integer,uuid,text,text),public.guard_ig_public_comment_verified() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_ig_public_comment_send(text,text,uuid,integer,uuid,text,text) TO service_role;
