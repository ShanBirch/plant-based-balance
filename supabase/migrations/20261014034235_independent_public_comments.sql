-- Shannon explicitly requested independent concurrent public-comment ownership on
-- 14 October 2026. Existing Story/MBS leases, schedules and RPCs are untouched.
CREATE TABLE public.ig_public_comment_runs (
 run_id text PRIMARY KEY,
 browser_binding jsonb NOT NULL,
 started_at timestamptz NOT NULL DEFAULT now(),
 heartbeat_at timestamptz NOT NULL DEFAULT now(),
 lease_expires_at timestamptz NOT NULL DEFAULT now()+interval '5 minutes',
 status text NOT NULL DEFAULT 'running' CHECK(status IN ('running','completed','partial','blocked','expired')),
 mode text NOT NULL CHECK(mode IN ('pilot','daily')),
 cursor jsonb NOT NULL DEFAULT '{}'::jsonb CHECK(jsonb_typeof(cursor)='object'),
 receipt jsonb NOT NULL DEFAULT '{}'::jsonb CHECK(jsonb_typeof(receipt)='object')
);
CREATE UNIQUE INDEX ig_public_comment_one_owner ON public.ig_public_comment_runs((true)) WHERE status='running';
CREATE TABLE public.ig_public_comment_attempts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 run_id text NOT NULL REFERENCES public.ig_public_comment_runs(run_id),
 action_id uuid NOT NULL,
 action_version integer NOT NULL,
 ig_username text NOT NULL,
 post_url text NOT NULL UNIQUE CHECK(post_url ~ '^https://www[.]instagram[.]com/(p|reel)/[A-Za-z0-9_-]+/$'),
 final_text text NOT NULL CHECK(length(trim(final_text)) BETWEEN 1 AND 500),
 reserved_at timestamptz NOT NULL DEFAULT now(),
 status text NOT NULL DEFAULT 'reserved' CHECK(status IN ('reserved','verified','uncertain')),
 proof jsonb NOT NULL DEFAULT '{}'::jsonb,
 UNIQUE(action_id,action_version)
);
ALTER TABLE public.ig_public_comment_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ig_public_comment_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ig_public_comment_runs,public.ig_public_comment_attempts FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.ig_public_comment_runs,public.ig_public_comment_attempts TO service_role;

-- Serialize tab acquisition against the existing start RPC without reserving its
-- surface. Separate tabs may coexist; the same tab or unclassified owner may not.
CREATE FUNCTION public.guard_ig_public_comment_tabs() RETURNS trigger
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('ig_browser_shift_dispatcher',0));
 IF TG_TABLE_NAME='ig_public_comment_runs' THEN
  IF TG_OP='UPDATE' AND (NEW.run_id<>OLD.run_id OR NEW.browser_binding<>OLD.browser_binding OR NEW.mode<>OLD.mode OR NEW.started_at<>OLD.started_at) THEN
   RAISE EXCEPTION 'public comment binding is immutable';
  END IF;
  IF NEW.status='running' AND EXISTS(SELECT 1 FROM public.ig_browser_shift_runs r
   WHERE r.status='running' AND r.lease_expires_at>now() AND (r.browser_surface='legacy'
    OR (r.browser_binding->>'browser_id'=NEW.browser_binding->>'browser_id'
      AND r.browser_binding->>'tab_id'=NEW.browser_binding->>'tab_id'))) THEN
   RAISE EXCEPTION 'tab already owned or legacy ownership unresolved';
  END IF;
 ELSE
  IF NEW.status='running' AND EXISTS(SELECT 1 FROM public.ig_public_comment_runs r
   WHERE r.status='running' AND r.lease_expires_at>now() AND (NEW.browser_surface='legacy'
    OR (r.browser_binding->>'browser_id'=NEW.browser_binding->>'browser_id'
      AND r.browser_binding->>'tab_id'=NEW.browser_binding->>'tab_id'))) THEN
   RAISE EXCEPTION 'tab belongs to independent public commenter';
  END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER ig_public_comment_tab_guard BEFORE INSERT OR UPDATE ON public.ig_public_comment_runs
 FOR EACH ROW EXECUTE FUNCTION public.guard_ig_public_comment_tabs();
CREATE TRIGGER ig_existing_public_comment_tab_guard BEFORE INSERT OR UPDATE ON public.ig_browser_shift_runs
 FOR EACH ROW EXECUTE FUNCTION public.guard_ig_public_comment_tabs();

CREATE FUNCTION public.start_ig_public_comment_run(p_run_id text,p_binding jsonb,p_mode text DEFAULT 'pilot',p_cursor jsonb DEFAULT '{}'::jsonb)
RETURNS public.ig_public_comment_runs LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE r public.ig_public_comment_runs%ROWTYPE;
BEGIN
 IF nullif(trim(p_run_id),'') IS NULL OR p_mode NOT IN ('pilot','daily')
 OR NOT public.valid_ig_browser_surface(p_binding,'active_client_instagram_community')
 OR p_binding->>'kind' IS DISTINCT FROM 'instagram' OR jsonb_typeof(p_cursor) IS DISTINCT FROM 'object' THEN
  RAISE EXCEPTION 'fresh verified dedicated Instagram binding required';
 END IF;
 IF p_mode='daily' AND NOT EXISTS(SELECT 1 FROM public.ig_public_comment_attempts WHERE status='verified') THEN
  RAISE EXCEPTION 'verified pilot required before daily mode';
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('ig_browser_shift_dispatcher',0));
 UPDATE public.ig_public_comment_runs SET status='expired' WHERE status='running' AND lease_expires_at<=now();
 INSERT INTO public.ig_public_comment_runs(run_id,browser_binding,mode,cursor) VALUES(p_run_id,p_binding,p_mode,p_cursor) RETURNING * INTO r;
 RETURN r;
END $$;

CREATE FUNCTION public.ig_public_comment_run_owned(p_run_id text,p_tab_id text) RETURNS boolean
LANGUAGE sql STABLE SET search_path=public,pg_temp AS $$
 SELECT EXISTS(SELECT 1 FROM public.ig_public_comment_runs WHERE run_id=p_run_id AND status='running'
 AND browser_binding->>'tab_id'=p_tab_id AND lease_expires_at>now()
 AND heartbeat_at>now()-interval '5 minutes' AND started_at>now()-interval '30 minutes');
$$;

CREATE FUNCTION public.checkpoint_ig_public_comment_run(p_run_id text,p_tab_id text,p_cursor jsonb,p_status text DEFAULT 'running',p_receipt jsonb DEFAULT '{}'::jsonb)
RETURNS public.ig_public_comment_runs LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE r public.ig_public_comment_runs%ROWTYPE;
BEGIN
 IF NOT public.ig_public_comment_run_owned(p_run_id,p_tab_id) OR p_status NOT IN ('running','completed','partial','blocked')
 OR jsonb_typeof(p_cursor) IS DISTINCT FROM 'object' OR jsonb_typeof(p_receipt) IS DISTINCT FROM 'object' THEN
  RAISE EXCEPTION 'owned unexpired public comment run and typed checkpoint required';
 END IF;
 UPDATE public.ig_public_comment_runs SET cursor=p_cursor,status=p_status,receipt=receipt||p_receipt,
 heartbeat_at=now(),lease_expires_at=least(started_at+interval '30 minutes',now()+interval '5 minutes')
 WHERE run_id=p_run_id RETURNING * INTO r;
 RETURN r;
END $$;

-- Exact queue row/version/handle selector also supports NULL canonical thread.
-- Reservation and shared recipient claim commit together BEFORE any native input.
CREATE FUNCTION public.claim_ig_public_comment(p_run_id text,p_tab_id text,p_action_id uuid,p_action_version integer,p_username text,p_post_url text,p_final_text text)
RETURNS public.ig_next_actions LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE a public.ig_next_actions%ROWTYPE; r public.ig_public_comment_runs%ROWTYPE; v_reserved timestamptz:=now();
BEGIN
 SELECT * INTO r FROM public.ig_public_comment_runs WHERE run_id=p_run_id FOR UPDATE;
 IF NOT FOUND OR NOT public.ig_public_comment_run_owned(p_run_id,p_tab_id) OR r.started_at<=now()-interval '25 minutes' THEN
  RAISE EXCEPTION 'owned public comment run required';
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('ig_public_comment_daily_capacity',0));
 IF (SELECT count(*) FROM public.ig_public_comment_attempts WHERE
  (reserved_at AT TIME ZONE 'Australia/Brisbane')::date=(now() AT TIME ZONE 'Australia/Brisbane')::date)>=10
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

CREATE FUNCTION public.ig_public_comment_action_owned(p_run_id text,p_tab_id text,p_action_id uuid,p_action_version integer,p_claim_token uuid,p_post_url text,p_final_text text)
RETURNS boolean LANGUAGE sql STABLE SET search_path=public,pg_temp AS $$
 SELECT public.ig_public_comment_run_owned(p_run_id,p_tab_id) AND EXISTS(
 SELECT 1 FROM public.ig_next_actions a JOIN public.ig_public_comment_attempts x ON x.action_id=a.id AND x.action_version=a.action_version
 WHERE a.id=p_action_id AND a.action_version=p_action_version AND a.claim_token=p_claim_token AND a.claim_run_id=p_run_id
 AND a.status='claimed' AND a.claim_expires_at>now() AND a.owner='feed_operator' AND a.action_type='feed_engagement'
 AND a.source_message_id IS NULL AND x.run_id=p_run_id AND x.post_url=p_post_url AND x.final_text=p_final_text AND x.status='reserved');
$$;

CREATE FUNCTION public.reconcile_ig_public_comment(p_run_id text,p_tab_id text,p_action_id uuid,p_action_version integer,p_claim_token uuid,p_post_url text,p_final_text text,p_proof jsonb,p_verified boolean)
RETURNS public.ig_next_actions LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE a public.ig_next_actions%ROWTYPE;
BEGIN
 IF NOT public.ig_public_comment_action_owned(p_run_id,p_tab_id,p_action_id,p_action_version,p_claim_token,p_post_url,p_final_text) THEN
  RAISE EXCEPTION 'exact owned public comment reservation required';
 END IF;
 IF p_verified AND (p_proof->>'post_url' IS DISTINCT FROM p_post_url OR p_proof->>'text' IS DISTINCT FROM p_final_text
  OR p_proof->>'sender' IS DISTINCT FROM 'shan_n_sunny' OR nullif(p_proof->>'native_reload_screenshot','') IS NULL
  OR nullif(p_proof->>'native_readback','') IS NULL OR nullif(p_proof->>'observed_at','') IS NULL
  OR p_proof->>'author' IS DISTINCT FROM (SELECT ig_username FROM public.ig_public_comment_attempts WHERE action_id=p_action_id AND action_version=p_action_version)) THEN
  RAISE EXCEPTION 'exact native reload proof required';
 END IF;
 SELECT * INTO a FROM public.complete_ig_next_action(p_action_id,p_claim_token,CASE WHEN p_verified THEN 'completed' ELSE 'blocked' END,
 now()+interval '7 days',jsonb_build_object('post_url',p_post_url,'final_text',p_final_text,'comment_verified',p_verified,
 'native_verified',p_verified,'no_repeat',true,'native_action_attempted',true,'native_readback',p_proof->>'native_readback','native_proof',p_proof));
 UPDATE public.ig_public_comment_attempts SET status=CASE WHEN p_verified THEN 'verified' ELSE 'uncertain' END,proof=p_proof
 WHERE action_id=p_action_id AND action_version=p_action_version;
 RETURN a;
END $$;

-- Reservation identity is immutable even to an interrupted later operator.
CREATE FUNCTION public.guard_ig_public_comment_attempt() RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
 IF (to_jsonb(NEW)-'status'-'proof') IS DISTINCT FROM (to_jsonb(OLD)-'status'-'proof')
 OR OLD.status<>'reserved' OR NEW.status NOT IN ('verified','uncertain') THEN
  RAISE EXCEPTION 'immutable public comment reservation';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER ig_public_comment_attempt_guard BEFORE UPDATE ON public.ig_public_comment_attempts
 FOR EACH ROW EXECUTE FUNCTION public.guard_ig_public_comment_attempt();

REVOKE ALL ON FUNCTION public.guard_ig_public_comment_tabs(),public.guard_ig_public_comment_attempt(),
 public.start_ig_public_comment_run(text,jsonb,text,jsonb),public.ig_public_comment_run_owned(text,text),
 public.checkpoint_ig_public_comment_run(text,text,jsonb,text,jsonb),public.claim_ig_public_comment(text,text,uuid,integer,text,text,text),
 public.ig_public_comment_action_owned(text,text,uuid,integer,uuid,text,text),
 public.reconcile_ig_public_comment(text,text,uuid,integer,uuid,text,text,jsonb,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.start_ig_public_comment_run(text,jsonb,text,jsonb),public.ig_public_comment_run_owned(text,text),
 public.checkpoint_ig_public_comment_run(text,text,jsonb,text,jsonb),public.claim_ig_public_comment(text,text,uuid,integer,text,text,text),
 public.ig_public_comment_action_owned(text,text,uuid,integer,uuid,text,text),
 public.reconcile_ig_public_comment(text,text,uuid,integer,uuid,text,text,jsonb,boolean) TO service_role;
