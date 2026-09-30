CREATE OR REPLACE FUNCTION public.valid_ig_browser_surface(b jsonb,lane text) RETURNS boolean
 LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
BEGIN
 IF b IS NULL OR jsonb_typeof(b)<>'object' OR nullif(b->>'browser_id','') IS NULL
 OR nullif(b->>'tab_id','') IS NULL OR b->>'account' IS DISTINCT FROM 'shan_n_sunny'
 OR coalesce(b->>'verified_at','')='' THEN RETURN false; END IF;
 IF (b->>'verified_at')::timestamptz < now()-interval '5 minutes'
 OR (b->>'verified_at')::timestamptz > now()+interval '30 seconds' THEN RETURN false; END IF;
 RETURN coalesce((b->>'kind'='meta_business_suite' AND lane='missed_dm_audit'
 AND b->>'page_id'='561122130919678' AND b->>'url' ~ '^https://business[.]facebook[.]com(/|$)')
 OR (b->>'kind'='instagram' AND lane IN ('plant_based_discovery_follows','active_client_instagram_community')
 AND b->>'url' ~ '^https://(www[.])?instagram[.]com(/|$)'),false);
EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN RETURN false;
END $$;


CREATE OR REPLACE FUNCTION public.ig_browser_action_owned(p_run_id text,p_surface text,p_tab_id text,p_action_id uuid,p_action_version integer,p_claim_token uuid,p_source_message_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public,pg_temp AS $$
 SELECT public.ig_browser_surface_owned(p_run_id,p_surface) AND EXISTS(
 SELECT 1 FROM public.ig_browser_shift_runs r JOIN public.ig_next_actions a ON a.claim_run_id=r.run_id
 WHERE r.run_id=p_run_id AND r.browser_binding->>'tab_id'=p_tab_id
 AND a.id=p_action_id AND a.action_version=p_action_version AND a.claim_token=p_claim_token
 AND a.source_message_id IS NOT DISTINCT FROM p_source_message_id
 AND a.status='claimed' AND a.claim_expires_at>now()
 AND ((p_surface='meta_business_suite' AND a.action_type IN ('reply_inbound','close_sale'))
 OR (p_surface='instagram' AND a.action_type IN ('discovery_follow','feed_engagement','story_reply','reply_external_comment','welcome_follower'))));
$$;
REVOKE ALL ON FUNCTION public.ig_browser_action_owned(text,text,text,uuid,integer,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ig_browser_action_owned(text,text,text,uuid,integer,uuid,uuid) TO service_role;

