-- Give Queensland gym outreach its own lease without changing recipient claims.
-- Rebuild the expression index atomically when its immutable function changes.
BEGIN;
SET LOCAL lock_timeout='5s';
SELECT pg_advisory_xact_lock(hashtextextended('ig_browser_shift_dispatcher',0));
CREATE OR REPLACE FUNCTION public.ig_browser_coordination_scope(surface text, work_lane text)
RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path=public,pg_temp AS $$
 SELECT CASE
 WHEN surface='instagram' AND work_lane='follower_notifications' THEN 'instagram_follower_welcomes'
 WHEN surface='instagram' AND work_lane='plant_based_discovery_follows' THEN 'instagram_gym_outreach'
 ELSE surface END;
$$;
REVOKE ALL ON FUNCTION public.ig_browser_coordination_scope(text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ig_browser_coordination_scope(text,text) TO service_role;
REINDEX INDEX public.ig_browser_shift_runs_one_surface_running_idx;
COMMIT;
