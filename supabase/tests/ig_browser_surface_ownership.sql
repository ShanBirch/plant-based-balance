BEGIN;
-- All fixtures and temporary owner states roll back; no native action is taken.
UPDATE public.ig_browser_shift_runs SET status='interrupted' WHERE status='running';
DO $test$
DECLARE m jsonb; i jsonb; r jsonb; failed boolean; row public.ig_browser_shift_runs; action_id uuid:=gen_random_uuid(); token uuid:=gen_random_uuid();
BEGIN
 m:=jsonb_build_object('kind','meta_business_suite','browser_id','test-browser','tab_id','mbs-tab','account','shan_n_sunny','page_id','561122130919678','url','https://business.facebook.com/latest/inbox','verified_at',now());
 i:=jsonb_build_object('kind','instagram','browser_id','test-browser','tab_id','ig-tab','account','shan_n_sunny','url','https://www.instagram.com/','verified_at',now());
 ASSERT NOT public.valid_ig_browser_surface(m-'account','missed_dm_audit'),'missing account rejected';
 ASSERT NOT public.valid_ig_browser_surface(NULL,'missed_dm_audit'),'missing surface rejected';
 ASSERT NOT public.valid_ig_browser_surface(m||'{"url":"https://business.facebook.com.evil.test/"}','missed_dm_audit'),'host spoof rejected';
 ASSERT NOT public.valid_ig_browser_surface(m||jsonb_build_object('verified_at',now()-interval '6 minutes'),'missed_dm_audit'),'stale proof rejected';
 ASSERT NOT public.valid_ig_browser_surface(i,'missed_dm_audit'),'lane mismatch rejected';
 r:=public.start_ig_browser_shift('surface-test-mbs','missed_dm_audit',0,jsonb_build_object('browser_surface',m),300);
 ASSERT (r->>'acquired')::boolean,'MBS acquired';
 r:=public.start_ig_browser_shift('surface-test-ig','plant_based_discovery_follows',1,jsonb_build_object('browser_surface',i),300);
 ASSERT (r->>'acquired')::boolean,'Instagram acquired alongside MBS';
 r:=public.start_ig_browser_shift('surface-test-duplicate','active_client_instagram_community',7,jsonb_build_object('browser_surface',i||'{"tab_id":"ig-second"}'),300);
 ASSERT NOT (r->>'acquired')::boolean,'second Instagram owner rejected';
 ASSERT public.ig_browser_surface_owned('surface-test-mbs','meta_business_suite'),'MBS remains independently owned';
 ASSERT NOT public.ig_browser_surface_owned('surface-test-mbs','instagram'),'wrong surface rejected';
 failed:=false;
 BEGIN
  UPDATE public.ig_browser_shift_runs SET browser_binding=i WHERE run_id='surface-test-mbs';
 EXCEPTION WHEN raise_exception THEN failed:=true; END;
 ASSERT failed,'tab binding immutable';
 row:=public.heartbeat_ig_browser_shift('surface-test-mbs',p_lease_seconds=>3600);
 ASSERT row.lease_expires_at<=now()+interval '5 minutes','lease capped';
 INSERT INTO public.ig_next_actions(id,subject_key,owner,status,action_type,claim_owner,claim_token,claim_run_id,claim_expires_at,action_version)
 VALUES(action_id,'surface-test-person','discovery_operator','claimed','discovery_follow','discovery_operator',token,'surface-test-ig',now()+interval '5 minutes',1);
 ASSERT public.ig_browser_action_owned('surface-test-ig','instagram','ig-tab',action_id,1,token,NULL),'exact action claim validates';
 ASSERT NOT public.ig_browser_action_owned('surface-test-ig','instagram','wrong-tab',action_id,1,token,NULL),'wrong tab rejected';
 ASSERT NOT public.ig_browser_action_owned('surface-test-ig','instagram','ig-tab',action_id,2,token,NULL),'wrong version rejected';
 ASSERT NOT public.ig_browser_action_owned('surface-test-ig','instagram','ig-tab',action_id,1,gen_random_uuid(),NULL),'wrong token rejected';
 ASSERT NOT public.ig_browser_action_owned('surface-test-ig','instagram','ig-tab',action_id,1,token,gen_random_uuid()),'changed source rejected';
 ASSERT NOT public.ig_browser_action_owned('surface-test-mbs','meta_business_suite','mbs-tab',action_id,1,token,NULL),'foreign surface cannot use action';
 failed:=false;
 BEGIN INSERT INTO public.ig_next_actions(subject_key,owner,status,action_type) VALUES('surface-test-person','dm_manager','ready','reply_inbound');
 EXCEPTION WHEN unique_violation THEN failed:=true; END;
 ASSERT failed,'shared recipient uniqueness prevents competing queue row';
 PERFORM public.finish_ig_browser_shift('surface-test-ig','completed');
 ASSERT public.ig_browser_surface_owned('surface-test-mbs','meta_business_suite'),'IG finish preserves MBS';
 r:=public.start_ig_browser_shift('surface-test-expired','plant_based_discovery_follows',1,jsonb_build_object('browser_surface',i),300);
 UPDATE public.ig_browser_shift_runs SET lease_expires_at=now()-interval '1 second' WHERE run_id='surface-test-expired';
 failed:=false;
 BEGIN PERFORM public.heartbeat_ig_browser_shift('surface-test-expired'); EXCEPTION WHEN raise_exception THEN failed:=true; END;
 ASSERT failed,'expired run cannot heartbeat';
 failed:=false;
 BEGIN PERFORM public.claim_ig_next_actions('discovery_operator',1,300,'surface-test-expired',ARRAY[]::uuid[]); EXCEPTION WHEN raise_exception THEN failed:=true; END;
 ASSERT failed,'expired run cannot claim';
 PERFORM public.finish_ig_browser_shift('surface-test-mbs','completed');
 UPDATE public.ig_browser_shift_runs SET status='interrupted' WHERE status='running';
 INSERT INTO public.ig_browser_shift_runs(run_id,lane,slot,lease_expires_at) VALUES('surface-test-legacy','missed_dm_audit',0,now()+interval '5 minutes');
 r:=public.start_ig_browser_shift('surface-test-legacy-blocked','plant_based_discovery_follows',1,jsonb_build_object('browser_surface',i),300);
 ASSERT NOT (r->>'acquired')::boolean,'healthy legacy owner excludes both surfaces';
 failed:=false;
 BEGIN PERFORM public.heartbeat_ig_browser_shift('surface-test-legacy'); EXCEPTION WHEN raise_exception THEN failed:=true; END;
 ASSERT failed,'legacy cannot renew';
END $test$;
SELECT 'passed: parallel surfaces, serialization, immutable bindings, expiry, legacy fail closed, claim ownership' AS result;
ROLLBACK;

