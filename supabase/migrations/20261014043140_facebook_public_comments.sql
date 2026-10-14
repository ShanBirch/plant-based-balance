-- Personal Facebook public comments only, independently owned and budgeted.
CREATE TABLE public.fb_public_comment_runs (
 run_id text PRIMARY KEY, binding jsonb NOT NULL,
 started_at timestamptz NOT NULL DEFAULT now(), heartbeat_at timestamptz NOT NULL DEFAULT now(),
 lease_expires_at timestamptz NOT NULL DEFAULT now()+interval '5 minutes',
 status text NOT NULL DEFAULT 'running' CHECK(status IN ('running','partial','completed','blocked','expired')),
 cursor jsonb NOT NULL DEFAULT '{}' CHECK(jsonb_typeof(cursor)='object')
);
CREATE UNIQUE INDEX fb_public_comment_one_owner ON public.fb_public_comment_runs((true)) WHERE status='running';
CREATE TABLE public.fb_public_comment_attempts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), run_id text NOT NULL REFERENCES public.fb_public_comment_runs,
 person_key text NOT NULL CHECK(length(person_key)>0), post_key text NOT NULL UNIQUE CHECK(length(post_key)>0),
 post_url text NOT NULL CHECK(post_url ~ '^https://www[.]facebook[.]com/'),
 final_text text NOT NULL CHECK(length(trim(final_text)) BETWEEN 1 AND 500),
 reserved_at timestamptz NOT NULL DEFAULT now(), status text NOT NULL DEFAULT 'reserved'
 CHECK(status IN ('reserved','activated','verified','uncertain')),
 evidence jsonb NOT NULL, proof jsonb NOT NULL DEFAULT '{}'
);
CREATE INDEX fb_public_comment_person ON public.fb_public_comment_attempts(person_key,reserved_at DESC);
ALTER TABLE public.fb_public_comment_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fb_public_comment_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.fb_public_comment_runs,public.fb_public_comment_attempts FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.fb_public_comment_runs,public.fb_public_comment_attempts TO service_role;

CREATE FUNCTION public.fb_public_comment_owned(p_run text,p_tab text) RETURNS boolean
LANGUAGE sql STABLE SET search_path=public,pg_temp AS $$
 SELECT EXISTS(SELECT 1 FROM public.fb_public_comment_runs WHERE run_id=p_run AND binding->>'tab_id'=p_tab
 AND status='running' AND lease_expires_at>now() AND started_at>now()-interval '30 minutes');
$$;
CREATE FUNCTION public.start_fb_public_comment_run(p_run text,p_binding jsonb,p_cursor jsonb DEFAULT '{}')
RETURNS public.fb_public_comment_runs LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE r public.fb_public_comment_runs;
BEGIN
 IF nullif(trim(p_run),'') IS NULL OR p_binding->>'kind' IS DISTINCT FROM 'facebook'
 OR p_binding->>'account' IS DISTINCT FROM 'shazbirch' OR p_binding->>'profile_url' IS DISTINCT FROM 'https://www.facebook.com/shazbirch'
 OR nullif(p_binding->>'browser_id','') IS NULL OR nullif(p_binding->>'tab_id','') IS NULL
 OR (p_binding->>'verified_at') IS NULL OR (p_binding->>'verified_at')::timestamptz NOT BETWEEN now()-interval '5 minutes' AND now()+interval '30 seconds'
 OR jsonb_typeof(p_cursor) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'fresh verified Shannon personal Facebook binding required'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('ig_browser_shift_dispatcher',0));
 IF EXISTS(SELECT 1 FROM public.ig_browser_shift_runs WHERE status='running' AND lease_expires_at>now()
 AND (browser_surface='legacy' OR (browser_binding->>'browser_id'=p_binding->>'browser_id' AND browser_binding->>'tab_id'=p_binding->>'tab_id')))
 OR EXISTS(SELECT 1 FROM public.ig_public_comment_runs WHERE status='running' AND lease_expires_at>now()
 AND browser_binding->>'browser_id'=p_binding->>'browser_id' AND browser_binding->>'tab_id'=p_binding->>'tab_id') THEN
 RAISE EXCEPTION 'foreign tab ownership'; END IF;
 UPDATE public.fb_public_comment_runs SET status='expired' WHERE status='running' AND lease_expires_at<=now();
 INSERT INTO public.fb_public_comment_runs(run_id,binding,cursor) VALUES(p_run,p_binding,p_cursor) RETURNING * INTO r;
 RETURN r;
END $$;
CREATE FUNCTION public.checkpoint_fb_public_comment_run(p_run text,p_tab text,p_cursor jsonb,p_status text DEFAULT 'running')
RETURNS public.fb_public_comment_runs LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE r public.fb_public_comment_runs;
BEGIN
 IF NOT public.fb_public_comment_owned(p_run,p_tab) OR p_status NOT IN ('running','partial','completed','blocked')
 OR jsonb_typeof(p_cursor) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'owned checkpoint required'; END IF;
 UPDATE public.fb_public_comment_runs SET cursor=p_cursor,status=p_status,heartbeat_at=now(),
 lease_expires_at=least(started_at+interval '30 minutes',now()+interval '5 minutes') WHERE run_id=p_run RETURNING * INTO r;
 RETURN r;
END $$;
CREATE FUNCTION public.reserve_fb_public_comment(p_run text,p_tab text,p_person text,p_post_key text,p_url text,p_text text,p_evidence jsonb)
RETURNS public.fb_public_comment_attempts LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE a public.fb_public_comment_attempts;
BEGIN
 PERFORM 1 FROM public.fb_public_comment_runs WHERE run_id=p_run FOR UPDATE;
 IF NOT public.fb_public_comment_owned(p_run,p_tab) OR NOT EXISTS(SELECT 1 FROM public.fb_public_comment_runs
 WHERE run_id=p_run AND started_at>now()-interval '25 minutes') THEN RAISE EXCEPTION 'owned unexpired Facebook run required'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('fb_public_comment_capacity',0));
 IF (SELECT count(*) FROM public.fb_public_comment_attempts WHERE (reserved_at AT TIME ZONE 'Australia/Brisbane')::date=(now() AT TIME ZONE 'Australia/Brisbane')::date)>=50
 OR EXISTS(SELECT 1 FROM public.fb_public_comment_attempts WHERE post_key=p_post_key OR (person_key=p_person AND reserved_at>now()-interval '7 days')) THEN
 RAISE EXCEPTION 'Facebook capacity or no-repeat hold'; END IF;
 IF p_evidence->>'following_verified' IS DISTINCT FROM 'true' OR p_evidence->>'history_complete' IS DISTINCT FROM 'true'
 OR p_evidence->>'eligibility_clear' IS DISTINCT FROM 'true' OR p_evidence->>'media_understood' IS DISTINCT FROM 'true'
 OR p_evidence->>'cross_worker_clear' IS DISTINCT FROM 'true' OR p_evidence->>'organic' IS DISTINCT FROM 'true'
 OR p_evidence->>'person_key' IS DISTINCT FROM p_person OR p_evidence->>'post_key' IS DISTINCT FROM p_post_key
 OR p_evidence->>'post_url' IS DISTINCT FROM p_url OR p_evidence->>'final_text' IS DISTINCT FROM p_text
 OR nullif(p_evidence->>'authorization_source','') IS NULL OR nullif(p_evidence->>'history_review','') IS NULL
 OR nullif(p_evidence->>'eligibility_review','') IS NULL OR nullif(p_evidence->>'content_review','') IS NULL
 OR (p_evidence->>'reviewed_at') IS NULL OR (p_evidence->>'reviewed_at')::timestamptz NOT BETWEEN now()-interval '5 minutes' AND now()+interval '30 seconds'
 OR (p_evidence->>'published_at') IS NULL OR (p_evidence->>'published_at')::timestamptz NOT BETWEEN now()-interval '72 hours' AND now()+interval '30 seconds'
 THEN RAISE EXCEPTION 'exact fully reviewed organic Facebook post required'; END IF;
 INSERT INTO public.fb_public_comment_attempts(run_id,person_key,post_key,post_url,final_text,evidence)
 VALUES(p_run,p_person,p_post_key,p_url,p_text,p_evidence) RETURNING * INTO a;
 RETURN a;
END $$;
CREATE FUNCTION public.activate_fb_public_comment(p_run text,p_tab text,p_attempt uuid,p_post text,p_text text)
RETURNS uuid LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE v uuid;
BEGIN
 IF NOT public.fb_public_comment_owned(p_run,p_tab) THEN RAISE EXCEPTION 'owned Facebook run required'; END IF;
 UPDATE public.fb_public_comment_attempts SET status='activated' WHERE id=p_attempt AND run_id=p_run AND status='reserved'
 AND post_key=p_post AND final_text=p_text RETURNING id INTO v;
 IF v IS NULL THEN RAISE EXCEPTION 'one-use exact Facebook activation required'; END IF;
 RETURN v;
END $$;
CREATE FUNCTION public.reconcile_fb_public_comment(p_run text,p_tab text,p_attempt uuid,p_proof jsonb,p_verified boolean)
RETURNS public.fb_public_comment_attempts LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE a public.fb_public_comment_attempts;
BEGIN
 IF NOT public.fb_public_comment_owned(p_run,p_tab) THEN RAISE EXCEPTION 'owned Facebook run required'; END IF;
 SELECT * INTO a FROM public.fb_public_comment_attempts WHERE id=p_attempt AND run_id=p_run FOR UPDATE;
 IF NOT FOUND OR a.status NOT IN ('reserved','activated') THEN RAISE EXCEPTION 'unresolved exact Facebook attempt required'; END IF;
 IF p_verified AND (a.status<>'activated' OR p_proof->>'post_key' IS DISTINCT FROM a.post_key
 OR p_proof->>'post_url' IS DISTINCT FROM a.post_url OR p_proof->>'person_key' IS DISTINCT FROM a.person_key
 OR p_proof->>'text' IS DISTINCT FROM a.final_text OR p_proof->>'sender' IS DISTINCT FROM 'shazbirch'
 OR nullif(p_proof->>'native_readback','') IS NULL OR nullif(p_proof->>'native_reload_screenshot','') IS NULL
 OR nullif(p_proof->>'observed_at','') IS NULL) THEN RAISE EXCEPTION 'exact native Facebook reload proof required'; END IF;
 UPDATE public.fb_public_comment_attempts SET status=CASE WHEN p_verified THEN 'verified' ELSE 'uncertain' END,proof=p_proof
 WHERE id=p_attempt RETURNING * INTO a;
 RETURN a;
END $$;
CREATE FUNCTION public.guard_fb_public_comment() RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
 IF TG_TABLE_NAME='fb_public_comment_attempts' THEN
 IF (to_jsonb(NEW)-'status'-'proof') IS DISTINCT FROM (to_jsonb(OLD)-'status'-'proof')
 OR NOT ((OLD.status='reserved' AND NEW.status IN ('activated','uncertain')) OR (OLD.status='activated' AND NEW.status IN ('verified','uncertain')))
 THEN RAISE EXCEPTION 'immutable Facebook attempt'; END IF;
 ELSE
 IF NEW.run_id<>OLD.run_id OR NEW.binding<>OLD.binding OR NEW.started_at<>OLD.started_at THEN RAISE EXCEPTION 'immutable Facebook binding'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER fb_comment_attempt_guard BEFORE UPDATE ON public.fb_public_comment_attempts FOR EACH ROW EXECUTE FUNCTION public.guard_fb_public_comment();
CREATE TRIGGER fb_comment_run_guard BEFORE UPDATE ON public.fb_public_comment_runs FOR EACH ROW EXECUTE FUNCTION public.guard_fb_public_comment();
REVOKE ALL ON FUNCTION public.guard_fb_public_comment(),public.fb_public_comment_owned(text,text),
 public.start_fb_public_comment_run(text,jsonb,jsonb),public.checkpoint_fb_public_comment_run(text,text,jsonb,text),
 public.reserve_fb_public_comment(text,text,text,text,text,text,jsonb),public.activate_fb_public_comment(text,text,uuid,text,text),
 public.reconcile_fb_public_comment(text,text,uuid,jsonb,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.fb_public_comment_owned(text,text),public.start_fb_public_comment_run(text,jsonb,jsonb),
 public.checkpoint_fb_public_comment_run(text,text,jsonb,text),public.reserve_fb_public_comment(text,text,text,text,text,text,jsonb),
 public.activate_fb_public_comment(text,text,uuid,text,text),public.reconcile_fb_public_comment(text,text,uuid,jsonb,boolean) TO service_role;
