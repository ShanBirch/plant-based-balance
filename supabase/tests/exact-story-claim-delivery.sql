-- Isolated session-local fixtures: no public row, lease, lead or message is mutated.
CREATE TEMP TABLE ig_next_actions (LIKE public.ig_next_actions INCLUDING DEFAULTS INCLUDING CONSTRAINTS) ON COMMIT DROP;
CREATE UNIQUE INDEX ON ig_next_actions(id);
CREATE TEMP TABLE ig_next_action_receipts (LIKE public.ig_next_action_receipts INCLUDING DEFAULTS INCLUDING CONSTRAINTS) ON COMMIT DROP;
CREATE UNIQUE INDEX ON ig_next_action_receipts(action_id,action_version);
CREATE TEMP TABLE ig_browser_shift_runs (LIKE public.ig_browser_shift_runs INCLUDING DEFAULTS INCLUDING CONSTRAINTS) ON COMMIT DROP;
CREATE TEMP TABLE ig_messages (LIKE public.ig_messages INCLUDING DEFAULTS INCLUDING CONSTRAINTS) ON COMMIT DROP;
CREATE TEMP TABLE ig_threads (id uuid,ig_username text) ON COMMIT DROP;
CREATE TEMP TABLE coach_alerts (LIKE public.coach_alerts INCLUDING DEFAULTS) ON COMMIT DROP;
CREATE FUNCTION pg_temp.ig_mbs_free_zoom_invite_eligible(a pg_temp.ig_next_actions) RETURNS boolean LANGUAGE sql AS $$ SELECT false $$;
CREATE FUNCTION pg_temp.ig_user_requested_checkin_eligible(a pg_temp.ig_next_actions) RETURNS boolean LANGUAGE sql AS $$ SELECT false $$;
CREATE FUNCTION pg_temp.ig_browser_surface_owned(p_run_id text,p_surface text) RETURNS boolean LANGUAGE sql AS $$
 SELECT EXISTS(SELECT 1 FROM pg_temp.ig_browser_shift_runs WHERE run_id=p_run_id AND browser_surface=p_surface AND status='running' AND lease_expires_at>now() AND heartbeat_at>now()-interval '5 minutes' AND started_at>now()-interval '30 minutes')
$$;
CREATE FUNCTION pg_temp.ig_browser_action_owned(p_run_id text,p_surface text,p_tab_id text,p_action_id uuid,p_action_version integer,p_claim_token uuid,p_source_message_id uuid) RETURNS boolean LANGUAGE sql AS $$
 SELECT pg_temp.ig_browser_surface_owned(p_run_id,p_surface) AND EXISTS(
 SELECT 1 FROM pg_temp.ig_next_actions a JOIN pg_temp.ig_browser_shift_runs r ON a.claim_run_id=r.run_id
 WHERE r.run_id=p_run_id AND r.browser_binding->>'tab_id'=p_tab_id AND a.id=p_action_id AND a.action_version=p_action_version AND a.claim_token=p_claim_token AND a.status='claimed' AND a.claim_expires_at>now() AND a.source_message_id IS NOT DISTINCT FROM p_source_message_id)
$$;
-- The test runner inserts the migration's function bodies below with public references
-- replaced by pg_temp, retaining every actual candidate/reservation/reconciliation condition.

DO $test$
DECLARE a uuid:=gen_random_uuid(); attempted uuid:=gen_random_uuid(); retired uuid:=gen_random_uuid(); token uuid; tid uuid:=gen_random_uuid();
 cid uuid:=gen_random_uuid(); result jsonb; v_reason jsonb; n integer; before_row jsonb; proof jsonb; failed boolean;
BEGIN
 INSERT INTO pg_temp.ig_browser_shift_runs(run_id,lane,slot,status,lease_expires_at,browser_surface,browser_binding,cursor_current)
 VALUES('exact-test','active_client_instagram_community',0,'running',now()+interval '5 minutes','instagram',
 '{"tab_id":"test-tab","account":"shan_n_sunny"}','{"logical_base_id":"logical-test"}');
 v_reason:=jsonb_build_object('story_id','123456','story_url','https://www.instagram.com/stories/test-person/123456/',
 'final_text','That looks fun. Where is it?','is_dm',true,'reviewed_private_story_authorization',true,
 'native_following_verified',true,'native_account','shan_n_sunny','run_id','exact-test','logical_base_id','logical-test',
 'authorization_source','isolated regression fixture','reviewed_at',now(),'client_matches',0,'purchase_matches',0,'personal_contacts',0);
 v_reason:=v_reason||jsonb_build_object('one_send_only',true,'authorization_scope','fixture','native_history_review','fixture full history','native_conversation_url','https://www.instagram.com/direct/t/123/','content_review',jsonb_build_object('kind','static','observed','fixture'));
 INSERT INTO pg_temp.ig_next_actions(id,subject_key,ig_username,owner,status,action_type,reason,priority)
 VALUES(a,'ig:test-person','test-person','story_operator','ready','story_reply',v_reason,1);
 INSERT INTO pg_temp.ig_next_actions(id,subject_key,ig_username,owner,status,action_type,priority,claim_owner,claim_token,claim_run_id,claim_expires_at,receipt)
 VALUES(attempted,'ig:attempted','attempted','story_operator','claimed','story_reply',9999,'story_operator',gen_random_uuid(),'old-run',now()-interval '1 minute','{"outbound_attempted":true,"no_repeat":true}');
 SELECT to_jsonb(q) INTO before_row FROM pg_temp.ig_next_actions q WHERE id=attempted;
 SELECT count(*) INTO n FROM pg_temp.claim_ig_story_action(a,2,'exact-test','test-tab','test-person','123456','That looks fun. Where is it?'); ASSERT n=0,'wrong version';
 SELECT count(*) INTO n FROM pg_temp.claim_ig_story_action(a,1,'exact-test','test-tab','test-person','999','That looks fun. Where is it?'); ASSERT n=0,'wrong source';
 SELECT count(*) INTO n FROM pg_temp.claim_ig_story_action(a,1,'exact-test','test-tab','test-person','123456','different'); ASSERT n=0,'wrong text';
 SELECT count(*) INTO n FROM pg_temp.claim_ig_story_action(a,1,'exact-test','test-tab','other-person','123456','That looks fun. Where is it?'); ASSERT n=0,'wrong recipient';
 failed:=false; BEGIN PERFORM pg_temp.claim_ig_story_action(a,1,'exact-test','other-tab','test-person','123456','That looks fun. Where is it?'); EXCEPTION WHEN raise_exception THEN failed:=true; END; ASSERT failed,'wrong tab';
 UPDATE pg_temp.ig_browser_shift_runs SET lease_expires_at=now()-interval '1 second';
 failed:=false; BEGIN PERFORM pg_temp.claim_ig_story_action(a,1,'exact-test','test-tab','test-person','123456','That looks fun. Where is it?'); EXCEPTION WHEN raise_exception THEN failed:=true; END; ASSERT failed,'expired lease';
 UPDATE pg_temp.ig_browser_shift_runs SET lease_expires_at=now()+interval '5 minutes';
 UPDATE pg_temp.ig_next_actions SET reason=reason||'{"reviewed_at":"2020-01-01T00:00:00Z"}' WHERE id=a;
 SELECT count(*) INTO n FROM pg_temp.claim_ig_story_action(a,1,'exact-test','test-tab','test-person','123456','That looks fun. Where is it?'); ASSERT n=0,'stale review';
 UPDATE pg_temp.ig_next_actions SET reason=reason||jsonb_build_object('reviewed_at',now(),'client_matches',1) WHERE id=a;
 SELECT count(*) INTO n FROM pg_temp.claim_ig_story_action(a,1,'exact-test','test-tab','test-person','123456','That looks fun. Where is it?'); ASSERT n=0,'client';
 UPDATE pg_temp.ig_next_actions SET reason=reason||'{"client_matches":0}' WHERE id=a;
 INSERT INTO pg_temp.ig_next_action_receipts(action_id,action_version,subject_key,ig_username,owner,action_type,terminal_status,receipt,completed_at)
 VALUES(gen_random_uuid(),1,'ig:test-person','test-person','dm_manager','reply_inbound','completed','{"no_repeat":true}',now());
 SELECT claim_token INTO token FROM pg_temp.claim_ig_story_action(a,1,'exact-test','test-tab','test-person','123456','That looks fun. Where is it?');
 ASSERT token IS NOT NULL,'NULL-thread exact candidate selected';
 ASSERT (SELECT to_jsonb(q)=before_row FROM pg_temp.ig_next_actions q WHERE id=attempted),'higher-priority attempted row unchanged';
 SELECT count(*) INTO n FROM pg_temp.claim_ig_story_action(a,1,'exact-test','test-tab','test-person','123456','That looks fun. Where is it?'); ASSERT n=0,'second claim fails';
 result:=pg_temp.reserve_ig_story_send(a,1,gen_random_uuid(),'exact-test','test-tab'); ASSERT result->>'reserved'='false','wrong token reserve fails';
 result:=pg_temp.reserve_ig_story_send(a,1,token,'exact-test','test-tab'); ASSERT result->>'reserved'='true','one original reservation';
 result:=pg_temp.reserve_ig_story_send(a,1,token,'exact-test','test-tab'); ASSERT result->>'reserved'='false','second reservation fails';
 UPDATE pg_temp.ig_next_actions SET status='ready',receipt='{}',claim_owner=NULL,claim_token=NULL,claim_run_id=NULL,claim_expires_at=NULL WHERE id=a;
 SELECT count(*) INTO n FROM pg_temp.claim_ig_story_action(a,1,'exact-test','test-tab','test-person','123456','That looks fun. Where is it?'); ASSERT n=0,'archived reservation blocks even if live receipt empty';
 SELECT count(*) INTO n FROM pg_temp.claim_ig_next_actions('story_operator',1,300,'exact-test'); ASSERT n=0,'generic claim rejects live attempted and archived reservation';
 -- Simulate immediate inbound superseding the original action.
 UPDATE pg_temp.ig_next_actions SET action_version=2,owner='dm_manager',action_type='reply_inbound',reason='{"source":"fresh inbound"}',receipt='{}',status='ready' WHERE id=a;
 SELECT to_jsonb(q) INTO before_row FROM pg_temp.ig_next_actions q WHERE id=a;
 INSERT INTO pg_temp.ig_threads VALUES(tid,'test-person');
 INSERT INTO pg_temp.ig_messages(id,thread_id,direction,text,source) VALUES(cid,tid,'out','replied to their story (story media attached) That looks fun. Where is it?','fixture');
 proof:=jsonb_build_object('native_reloaded_verified',true,'native_account','shan_n_sunny','ig_username','test-person','story_id','123456','final_text','That looks fun. Where is it?','native_screenshot','fixture.png','native_conversation_url','https://www.instagram.com/direct/t/123/');
 failed:=false; BEGIN PERFORM pg_temp.reconcile_ig_story_delivery(a,1,gen_random_uuid(),'exact-test',cid,proof); EXCEPTION WHEN raise_exception THEN failed:=true; END; ASSERT failed,'wrong original token reconcile';
 failed:=false; BEGIN PERFORM pg_temp.reconcile_ig_story_delivery(a,1,token,'exact-test',cid,proof-'native_screenshot'); EXCEPTION WHEN raise_exception THEN failed:=true; END; ASSERT failed,'missing native proof';
 result:=pg_temp.reconcile_ig_story_delivery(a,1,token,'exact-test',cid,proof||'{"no_repeat":false,"run_id":"forged","original_claim_token":"forged"}'); ASSERT result->>'verified'='true','superseded original delivery reconciles';
 ASSERT result->'receipt'->>'no_repeat'='true' AND result->'receipt'->>'run_id'='exact-test' AND result->'receipt'->>'original_claim_token'=token::text,'proof cannot overwrite original provenance';
 ASSERT (SELECT to_jsonb(q)=before_row FROM pg_temp.ig_next_actions q WHERE id=a),'fresh inbound action byte-for-byte unchanged';
 result:=pg_temp.reconcile_ig_story_delivery(a,1,token,'exact-test',cid,proof); ASSERT result->>'already_recorded'='true','idempotent proof no extra credit';
 ASSERT (SELECT count(*)=1 FROM pg_temp.ig_next_action_receipts WHERE receipt->>'target_credit'='1'),'exactly one target credit';
 ASSERT pg_temp.ig_story_receipt_attempted('{"sent_observed_at":"now"}'),'pending native send terminal';
 ASSERT NOT pg_temp.ig_story_receipt_attempted('{}'),'clean receipt';
 INSERT INTO pg_temp.ig_next_actions(id,subject_key,ig_username,owner,status,action_type,reason)
 VALUES(retired,'ig:retired','retired','story_operator','ready','story_reply',v_reason||'{"story_id":"654321","story_url":"https://www.instagram.com/stories/retired/654321/"}');
 INSERT INTO pg_temp.ig_next_action_receipts(action_id,action_version,subject_key,ig_username,owner,action_type,terminal_status,receipt,completed_at)
 VALUES(retired,1,'ig:retired','retired','story_operator','story_reply','cancelled','{"story_id":"654321","decision":"inspected_not_sent"}',now());
 SELECT count(*) INTO n FROM pg_temp.claim_ig_story_action(retired,1,'exact-test','test-tab','retired','654321','That looks fun. Where is it?'); ASSERT n=0,'retired exact source stays terminal without attempted flag';
 SELECT count(*) INTO n FROM pg_temp.claim_ig_next_actions('story_operator',1,300,'exact-test'); ASSERT n=0,'legacy claim also excludes retired exact source';
END $test$;

