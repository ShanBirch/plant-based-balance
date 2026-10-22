BEGIN;
CREATE TEMP TABLE outreach_coordination_test(surface text,lane text,browser_id text,tab_id text,status text) ON COMMIT DROP;
CREATE UNIQUE INDEX ON outreach_coordination_test(public.ig_browser_coordination_scope(surface,lane)) WHERE status='running';
CREATE UNIQUE INDEX ON outreach_coordination_test(browser_id,tab_id) WHERE status='running';
DO $test$
DECLARE rejected boolean;
BEGIN
 INSERT INTO outreach_coordination_test VALUES
 ('instagram','active_client_instagram_community','fixture','story','running'),
 ('instagram','plant_based_discovery_follows','fixture','outreach','running'),
 ('instagram','follower_notifications','fixture','welcomes','running'),
 ('meta_business_suite','missed_dm_audit','fixture','reactive','running');
 ASSERT (SELECT count(*) FROM outreach_coordination_test)=4,'all four workers coexist';
 rejected:=false;
 BEGIN INSERT INTO outreach_coordination_test VALUES ('instagram','plant_based_discovery_follows','fixture','other','running');
 EXCEPTION WHEN unique_violation THEN rejected:=true; END;
 ASSERT rejected,'duplicate outreach owner blocked';
 rejected:=false;
 BEGIN INSERT INTO outreach_coordination_test VALUES ('instagram','personal_discovery_follows','fixture','outreach','running');
 EXCEPTION WHEN unique_violation THEN rejected:=true; END;
 ASSERT rejected,'same tab blocked';
 ASSERT public.ig_browser_coordination_scope('instagram','unknown')='instagram','unknown lane not exempted';
 ASSERT NOT has_function_privilege('anon','public.ig_browser_coordination_scope(text,text)','execute'),'public access denied';
END $test$;
SELECT 'passed: four independent scopes, duplicate owner and same tab blocked, public access denied' result;
ROLLBACK;
