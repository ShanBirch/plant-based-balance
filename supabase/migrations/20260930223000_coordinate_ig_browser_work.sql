
CREATE TABLE IF NOT EXISTS public.ig_browser_work_requests (
 request_id text PRIMARY KEY,
 worker text NOT NULL CHECK(worker IN ('outreach','engagement')),
 requested_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL DEFAULT now()+interval '45 minutes',
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','running','completed','partial','expired')),
 run_id text UNIQUE,
 receipt jsonb NOT NULL DEFAULT '{}'::jsonb
);
ALTER TABLE public.ig_browser_work_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ig_browser_work_requests FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.ig_browser_work_requests TO service_role;

CREATE OR REPLACE FUNCTION public.request_ig_browser_work(p_request_id text,p_worker text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE v public.ig_browser_work_requests%ROWTYPE;
BEGIN
 IF nullif(trim(p_request_id),'') IS NULL OR p_worker NOT IN ('outreach','engagement') THEN RAISE EXCEPTION 'invalid browser work request'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('ig_browser_shift_dispatcher',0));
 UPDATE public.ig_browser_work_requests SET status='expired' WHERE status='pending' AND expires_at<=now();
 INSERT INTO public.ig_browser_work_requests(request_id,worker) VALUES(trim(p_request_id),p_worker) ON CONFLICT(request_id) DO NOTHING;
 SELECT * INTO v FROM public.ig_browser_work_requests WHERE request_id=trim(p_request_id);
 IF v.worker<>p_worker THEN RAISE EXCEPTION 'request worker mismatch'; END IF;
 RETURN to_jsonb(v);
END $$;

CREATE OR REPLACE FUNCTION public.acquire_ig_browser_work(p_request_id text,p_run_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE v public.ig_browser_work_requests%ROWTYPE; head_id text; result jsonb;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('ig_browser_shift_dispatcher',0));
 UPDATE public.ig_browser_work_requests SET status='expired' WHERE status='pending' AND expires_at<=now();
 SELECT * INTO v FROM public.ig_browser_work_requests WHERE request_id=p_request_id FOR UPDATE;
 IF NOT FOUND OR v.status NOT IN ('pending','running') THEN RETURN jsonb_build_object('acquired',false,'reason','request_not_pending'); END IF;
 IF v.status='running' THEN
   IF v.run_id<>p_run_id THEN RETURN jsonb_build_object('acquired',false,'reason','request_already_owned'); END IF;
   RETURN jsonb_build_object('acquired',exists(select 1 from public.ig_browser_shift_runs where run_id=p_run_id AND status='running' AND lease_expires_at>now()),'idempotent',true);
 END IF;
 SELECT request_id INTO head_id FROM public.ig_browser_work_requests WHERE status='pending' AND expires_at>now() ORDER BY requested_at,CASE worker WHEN 'outreach' THEN 0 ELSE 1 END,request_id LIMIT 1;
 IF head_id<>p_request_id THEN RETURN jsonb_build_object('acquired',false,'reason','earlier_browser_work','head_request',head_id); END IF;
 result:=public.start_ig_browser_shift(p_run_id,CASE v.worker WHEN 'outreach' THEN 'plant_based_discovery_follows' ELSE 'active_client_instagram_community' END,CASE v.worker WHEN 'outreach' THEN 1 ELSE 7 END,jsonb_build_object('worker',v.worker,'browser_work_request',p_request_id),300);
 IF (result->>'acquired')::boolean THEN
   UPDATE public.ig_browser_work_requests SET status='running',run_id=p_run_id WHERE request_id=p_request_id;
 END IF;
 RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.finish_ig_browser_work(p_request_id text,p_run_id text,p_status text,p_receipt jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE v public.ig_browser_work_requests%ROWTYPE;
BEGIN
 IF p_status NOT IN ('completed','partial') OR jsonb_typeof(p_receipt)<>'object' THEN RAISE EXCEPTION 'invalid final work receipt'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('ig_browser_shift_dispatcher',0));
 IF EXISTS(SELECT 1 FROM public.ig_browser_shift_runs WHERE run_id=p_run_id AND status='running' AND lease_expires_at>now()) THEN RAISE EXCEPTION 'finish owned shift before work request'; END IF;
 UPDATE public.ig_browser_work_requests SET status=p_status,receipt=p_receipt WHERE request_id=p_request_id AND run_id=p_run_id AND status='running' RETURNING * INTO v;
 IF NOT FOUND THEN RAISE EXCEPTION 'work request ownership mismatch'; END IF;
 RETURN to_jsonb(v);
END $$;
REVOKE ALL ON FUNCTION public.request_ig_browser_work(text,text),public.acquire_ig_browser_work(text,text),public.finish_ig_browser_work(text,text,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.request_ig_browser_work(text,text),public.acquire_ig_browser_work(text,text),public.finish_ig_browser_work(text,text,text,jsonb) TO service_role;

-- Preserve the existing global exclusion; only prevent idle dispatcher reacquisition
-- while live queued work waits. Busy reactive operators must explicitly supply
-- fresh due-source/session evidence in their provided cursor.
DO $migration$
DECLARE definition text; anchor text := E'    SELECT * INTO v_handoff\n';
BEGIN
 SELECT pg_get_functiondef(oid) INTO definition FROM pg_proc WHERE oid='public.start_ig_browser_shift(text,text,integer,jsonb,integer)'::regprocedure;
 IF position('queued_instagram_work' IN definition)=0 THEN
   IF position(anchor IN definition)=0 THEN RAISE EXCEPTION 'shift function insertion anchor missing'; END IF;
   definition:=replace(definition,anchor,
 E'    IF p_lane = ''missed_dm_audit'' AND COALESCE(p_cursor_start->>''reactive_due'', ''false'') <> ''true''\n'
 ||E'       AND EXISTS(SELECT 1 FROM public.ig_browser_work_requests WHERE status=''pending'' AND expires_at>now()) THEN\n'
 ||E'        RETURN jsonb_build_object(''acquired'',false,''reason'',''queued_instagram_work'');\n'
 ||E'    END IF;\n\n'||anchor);
   EXECUTE definition;
 END IF;
END $migration$;

