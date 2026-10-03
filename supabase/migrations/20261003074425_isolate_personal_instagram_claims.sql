-- A personal run must not reserve another worker's business queue.
DO $$
DECLARE d text;
BEGIN
 SELECT pg_get_functiondef('public.claim_ig_next_actions(text,integer,integer,text,uuid[])'::regprocedure) INTO d;
 IF strpos(d,'WHERE q.owner = p_owner')=0 THEN RAISE EXCEPTION 'unexpected queue claimer'; END IF;
 d:=replace(d,'WHERE q.owner = p_owner',E'WHERE q.owner = p_owner\n AND (NOT v_browser OR p_owner=''personal_operator'' OR NOT EXISTS (SELECT 1 FROM public.ig_browser_shift_runs pr WHERE pr.run_id=p_run_id AND pr.lane=''personal_discovery_follows''))');
 EXECUTE d;
END $$;
