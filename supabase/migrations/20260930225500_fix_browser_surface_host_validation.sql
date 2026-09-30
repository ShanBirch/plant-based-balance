CREATE OR REPLACE FUNCTION public.valid_ig_browser_surface(b jsonb,lane text) RETURNS boolean
 LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
BEGIN
 IF b IS NULL OR jsonb_typeof(b)<>'object' OR nullif(b->>'browser_id','') IS NULL
 OR nullif(b->>'tab_id','') IS NULL OR b->>'account'<>'shan_n_sunny'
 OR coalesce(b->>'verified_at','')='' THEN RETURN false; END IF;
 IF (b->>'verified_at')::timestamptz < now()-interval '5 minutes'
 OR (b->>'verified_at')::timestamptz > now()+interval '30 seconds' THEN RETURN false; END IF;
 RETURN coalesce((b->>'kind'='meta_business_suite' AND lane='missed_dm_audit'
 AND b->>'page_id'='561122130919678' AND b->>'url' ~ '^https://business[.]facebook[.]com(/|$)')
 OR (b->>'kind'='instagram' AND lane IN ('plant_based_discovery_follows','active_client_instagram_community')
 AND b->>'url' ~ '^https://(www[.])?instagram[.]com(/|$)'),false);
EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN RETURN false;
END $$;


