-- Personal contacts share browser/action locks, but never business reply ownership.
CREATE TABLE public.ig_personal_contacts (
 ig_username text PRIMARY KEY CHECK (ig_username ~ '^[a-z0-9_.]{1,30}$'),
 created_at timestamptz NOT NULL DEFAULT now(),
 follow_reserved_at timestamptz,
 follow_verified_at timestamptz,
 introduction_reserved_at timestamptz,
 introduction_verified_at timestamptz,
 receipt jsonb NOT NULL DEFAULT '{}'::jsonb
);
ALTER TABLE public.ig_personal_contacts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ig_personal_contacts FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.ig_personal_contacts TO service_role;

-- Extend installed coordination in place without replacing its current fixes.
DO $migration$
DECLARE d text; c text;
BEGIN
 SELECT pg_get_constraintdef(oid) INTO c FROM pg_constraint
 WHERE conrelid='public.ig_browser_shift_runs'::regclass AND conname='ig_browser_shift_runs_lane_check';
 ALTER TABLE public.ig_browser_shift_runs DROP CONSTRAINT ig_browser_shift_runs_lane_check;
 c:=replace(c,'''active_client_instagram_community''::text','''active_client_instagram_community''::text, ''personal_discovery_follows''::text');
 EXECUTE 'ALTER TABLE public.ig_browser_shift_runs ADD CONSTRAINT ig_browser_shift_runs_lane_check '||c;
 SELECT pg_get_constraintdef(oid) INTO c FROM pg_constraint
 WHERE conrelid='public.ig_next_actions'::regclass AND conname='ig_next_actions_owner_check';
 ALTER TABLE public.ig_next_actions DROP CONSTRAINT ig_next_actions_owner_check;
 c:=replace(c,'''manual''::text','''manual''::text, ''personal_operator''::text');
 EXECUTE 'ALTER TABLE public.ig_next_actions ADD CONSTRAINT ig_next_actions_owner_check '||c;
 SELECT pg_get_functiondef('public.valid_ig_browser_surface(jsonb,text)'::regprocedure) INTO d;
 IF strpos(d,'''active_client_instagram_community''')=0 THEN RAISE EXCEPTION 'unexpected surface validator'; END IF;
 EXECUTE replace(d,'''active_client_instagram_community''','''active_client_instagram_community'',''personal_discovery_follows''');
 SELECT pg_get_functiondef('public.start_ig_browser_shift(text,text,integer,jsonb,integer)'::regprocedure) INTO d;
 IF strpos(d,'''active_client_instagram_community''')=0 THEN RAISE EXCEPTION 'unexpected shift starter'; END IF;
 EXECUTE replace(d,'''active_client_instagram_community''','''active_client_instagram_community'',''personal_discovery_follows''');
 SELECT pg_get_functiondef('public.claim_ig_next_actions(text,integer,integer,text,uuid[])'::regprocedure) INTO d;
 IF strpos(d,'WHERE q.owner = p_owner')=0 THEN RAISE EXCEPTION 'unexpected queue claimer'; END IF;
 d:=replace(d,'''discovery_operator''','''discovery_operator'', ''personal_operator''');
 d:=replace(d,'WHERE q.owner = p_owner',E'WHERE q.owner = p_owner\n AND (p_owner <> ''personal_operator'' OR EXISTS (SELECT 1 FROM public.ig_browser_shift_runs pr WHERE pr.run_id=p_run_id AND pr.lane=''personal_discovery_follows''))');
 EXECUTE d;
END $migration$;

CREATE FUNCTION public.protect_ig_personal_thread() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF lower(coalesce(NEW.channel,''))='instagram' AND EXISTS (
  SELECT 1 FROM public.ig_personal_contacts WHERE ig_username=lower(ltrim(NEW.ig_username,'@'))
 ) THEN
  NEW.auto_send_enabled:=false;
  NEW.custom_data:=coalesce(NEW.custom_data,'{}'::jsonb)||jsonb_build_object(
   'personal_outreach',true,'friend_manual_only',true,
   'codex_lead_flow_override',coalesce(NEW.custom_data->'codex_lead_flow_override','{}'::jsonb)||
      jsonb_build_object('decision','friend_manual_only','friend_manual_only',true));
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER protect_ig_personal_thread BEFORE INSERT OR UPDATE ON public.ig_threads
FOR EACH ROW EXECUTE FUNCTION public.protect_ig_personal_thread();

CREATE FUNCTION public.protect_ig_personal_action() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF EXISTS (SELECT 1 FROM public.ig_personal_contacts pc WHERE pc.ig_username=lower(ltrim(NEW.ig_username,'@')))
 OR EXISTS (SELECT 1 FROM public.ig_threads t WHERE t.id=NEW.thread_id AND t.custom_data->>'personal_outreach'='true') THEN
  IF NOT (NEW.owner='personal_operator' AND NEW.action_type IN ('discovery_follow','welcome_follower')
      AND NEW.reason->>'scope'='personal' AND NEW.source_message_id IS NULL) THEN
   NEW.owner:='manual'; NEW.status:='needs_you'; NEW.action_type:='no_action';
   NEW.reason:=coalesce(NEW.reason,'{}'::jsonb)||jsonb_build_object('personal_manual_only',true,'why','Personal reply belongs to account owner');
   NEW.claim_owner:=NULL; NEW.claim_token:=NULL; NEW.claim_run_id:=NULL; NEW.claim_expires_at:=NULL;
  END IF;
 ELSIF NEW.owner='personal_operator' THEN
  RAISE EXCEPTION 'personal action requires registered contact';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER protect_ig_personal_action BEFORE INSERT OR UPDATE ON public.ig_next_actions
FOR EACH ROW EXECUTE FUNCTION public.protect_ig_personal_action();

CREATE FUNCTION public.prepare_ig_personal_action(p_username text,p_run_id text,p_action_type text,p_evidence jsonb)
RETURNS public.ig_next_actions LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE h text:=lower(ltrim(trim(p_username),'@')); pc public.ig_personal_contacts%ROWTYPE;
BEGIN
 IF h IS NULL OR h !~ '^[a-z0-9_.]{1,30}$' THEN RAISE EXCEPTION 'invalid handle'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.ig_browser_shift_runs WHERE run_id=p_run_id AND lane='personal_discovery_follows')
 OR NOT public.ig_browser_surface_owned(p_run_id,'instagram') THEN RAISE EXCEPTION 'owned personal run required'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('ig_personal_daily_caps',0));
 SELECT * INTO pc FROM public.ig_personal_contacts WHERE ig_username=h FOR UPDATE;
 IF p_action_type='discovery_follow' THEN
  IF FOUND THEN RAISE EXCEPTION 'already registered, no repeat follow'; END IF;
  IF p_evidence->>'eligibility_verified' IS DISTINCT FROM 'true'
   OR p_evidence->>'native_history_clear' IS DISTINCT FROM 'true'
   OR p_evidence->>'exclusions_clear' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'eligibility and exclusions required'; END IF;
  IF EXISTS (SELECT 1 FROM public.ig_threads WHERE lower(ltrim(ig_username,'@'))=h)
   OR EXISTS (SELECT 1 FROM public.ig_next_actions WHERE subject_key='ig:'||h) THEN RAISE EXCEPTION 'existing relationship or action'; END IF;
  IF (SELECT count(*) FROM public.ig_personal_contacts WHERE (follow_reserved_at AT TIME ZONE 'Australia/Brisbane')::date=(now() AT TIME ZONE 'Australia/Brisbane')::date)>=10 THEN RAISE EXCEPTION 'daily follow cap'; END IF;
  INSERT INTO public.ig_personal_contacts(ig_username,follow_reserved_at) VALUES(h,now());
 ELSIF p_action_type='welcome_follower' THEN
  IF NOT FOUND OR pc.follow_verified_at IS NULL OR pc.introduction_reserved_at IS NOT NULL THEN RAISE EXCEPTION 'follow unverified or introduction already reserved'; END IF;
  IF p_evidence->>'follow_back_verified' IS DISTINCT FROM 'true'
    OR nullif(p_evidence->>'verified_at','') IS NULL
    OR (p_evidence->>'verified_at')::timestamptz < now()-interval '5 minutes'
    OR (p_evidence->>'verified_at')::timestamptz > now()+interval '30 seconds'
    OR p_evidence->>'native_history_clear' IS DISTINCT FROM 'true'
    OR p_evidence->>'exclusions_clear' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'fresh follow-back, history and exclusion proof required'; END IF;
  IF EXISTS (SELECT 1 FROM public.ig_threads WHERE lower(ltrim(ig_username,'@'))=h) THEN RAISE EXCEPTION 'conversation already exists'; END IF;
  IF (SELECT count(*) FROM public.ig_personal_contacts WHERE (introduction_reserved_at AT TIME ZONE 'Australia/Brisbane')::date=(now() AT TIME ZONE 'Australia/Brisbane')::date)>=10 THEN RAISE EXCEPTION 'daily introduction cap'; END IF;
  UPDATE public.ig_personal_contacts SET introduction_reserved_at=now() WHERE ig_username=h;
 ELSE RAISE EXCEPTION 'invalid personal action'; END IF;
 RETURN public.upsert_ig_next_action(NULL,h,'personal','personal_operator',p_action_type,100,now(),now(),
  p_evidence||jsonb_build_object('scope','personal','run_id',p_run_id),NULL,false);
END $$;

-- Add run/category isolation to the existing final action-time gate.
DO $migration$
DECLARE d text;
BEGIN
 SELECT pg_get_functiondef('public.ig_browser_action_owned(text,text,text,uuid,integer,uuid,uuid)'::regprocedure) INTO d;
 IF strpos(d,'AND a.id=p_action_id')=0 THEN RAISE EXCEPTION 'unexpected final ownership gate'; END IF;
 d:=replace(d,'AND a.id=p_action_id',E'AND ((r.lane=''personal_discovery_follows'' AND a.owner=''personal_operator'' AND a.reason->>''scope''=''personal'' AND a.action_type IN (''discovery_follow'',''welcome_follower'')) OR (r.lane<>''personal_discovery_follows'' AND a.owner<>''personal_operator''))\n AND a.id=p_action_id');
 EXECUTE d;
END $migration$;
REVOKE ALL ON FUNCTION public.protect_ig_personal_thread(),public.protect_ig_personal_action(),public.prepare_ig_personal_action(text,text,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_ig_personal_action(text,text,text,jsonb) TO service_role;
