BEGIN;
SET LOCAL statement_timeout='8s';
SET LOCAL lock_timeout='2s';
-- Synthetic regression fixtures only, always rolled back. No foreign lease or
-- recipient is updated, no browser is used, and no delivery is simulated as real.
DO $test$
DECLARE b jsonb; r public.ig_public_comment_runs; a public.ig_next_actions; failed boolean; foreign_before jsonb;
BEGIN
 SELECT coalesce(jsonb_agg(jsonb_build_array(run_id,browser_binding,status) ORDER BY run_id),'[]'::jsonb) INTO foreign_before
 FROM public.ig_browser_shift_runs x WHERE status='running';
 b:=jsonb_build_object('kind','instagram','browser_id','public-comment-sql-fixture','tab_id','fixture-owned-tab',
 'account','shan_n_sunny','url','https://www.instagram.com/','verified_at',now());
 r:=public.start_ig_public_comment_run('public-comment-sql-fixture',b,'pilot','{}');
 ASSERT public.ig_public_comment_run_owned(r.run_id,'fixture-owned-tab'),'independent lease acquired alongside actual Story/MBS owners';
 ASSERT NOT public.ig_public_comment_run_owned(r.run_id,'foreign-tab'),'tab mismatch rejected';
 failed:=false;
 BEGIN PERFORM public.start_ig_public_comment_run('public-comment-sql-fixture-2',b||'{"tab_id":"different"}','pilot','{}');
 EXCEPTION WHEN unique_violation THEN failed:=true; END;
 ASSERT failed,'duplicate public worker rejected';
 failed:=false;
 BEGIN UPDATE public.ig_public_comment_runs SET browser_binding=b||'{"tab_id":"changed"}' WHERE run_id=r.run_id;
 EXCEPTION WHEN raise_exception THEN failed:=true; END;
 ASSERT failed,'tab binding immutable';
 a:=public.upsert_ig_next_action(NULL,'public_comment_sql_fixture','new','feed_operator','feed_engagement',1,now(),NULL,
 jsonb_build_object('run_id',r.run_id,'post_url','https://www.instagram.com/p/SQL_FIXTURE_ONLY/',
 'final_text','Synthetic SQL fixture, never sent.','is_dm',false,'native_following_verified',true,
 'eligibility_review','synthetic fixture','authorization_source','SQL rollback regression only',
 'content_review','synthetic fixture','history_review','synthetic fixture','reviewed_at',now(),'post_published_at',now()),NULL,false);
 failed:=false;
 BEGIN PERFORM public.claim_ig_public_comment(r.run_id,'fixture-owned-tab',a.id,a.action_version+1,a.ig_username,
 a.reason->>'post_url',a.reason->>'final_text'); EXCEPTION WHEN raise_exception THEN failed:=true; END;
 ASSERT failed,'stale exact action version rejected';
 a:=public.claim_ig_public_comment(r.run_id,'fixture-owned-tab',a.id,a.action_version,a.ig_username,a.reason->>'post_url',a.reason->>'final_text');
 ASSERT a.thread_id IS NULL AND a.status='claimed','exact-handle NULL-thread action supported';
 ASSERT public.ig_public_comment_action_owned(r.run_id,'fixture-owned-tab',a.id,a.action_version,a.claim_token,a.reason->>'post_url',a.reason->>'final_text'),'exact tuple owned';
 ASSERT NOT public.ig_public_comment_action_owned(r.run_id,'fixture-owned-tab',a.id,a.action_version,gen_random_uuid(),a.reason->>'post_url',a.reason->>'final_text'),'wrong token rejected';
 ASSERT NOT public.ig_public_comment_action_owned(r.run_id,'fixture-owned-tab',a.id,a.action_version,a.claim_token,'https://www.instagram.com/p/OTHER/',a.reason->>'final_text'),'changed post rejected';
 failed:=false;
 BEGIN PERFORM public.reconcile_ig_public_comment(r.run_id,'fixture-owned-tab',a.id,a.action_version,a.claim_token,a.reason->>'post_url',a.reason->>'final_text','{}',true);
 EXCEPTION WHEN raise_exception THEN failed:=true; END;
 ASSERT failed,'missing native proof cannot produce verified result';
 PERFORM public.reserve_ig_public_comment_send(r.run_id,'fixture-owned-tab',a.id,a.action_version,a.claim_token,a.reason->>'post_url',a.reason->>'final_text');
 failed:=false;
 BEGIN PERFORM public.reserve_ig_public_comment_send(r.run_id,'fixture-owned-tab',a.id,a.action_version,a.claim_token,a.reason->>'post_url',a.reason->>'final_text');
 EXCEPTION WHEN raise_exception THEN failed:=true; END;
 ASSERT failed,'second native send reservation rejected';
 a:=public.reconcile_ig_public_comment(r.run_id,'fixture-owned-tab',a.id,a.action_version,a.claim_token,a.reason->>'post_url',a.reason->>'final_text',
 '{"reason":"synthetic unknown outcome; no actual send"}',false);
 ASSERT a.status='blocked' AND a.receipt->>'no_repeat'='true','uncertainty is terminal no-repeat';
 ASSERT (SELECT status='uncertain' FROM public.ig_public_comment_attempts WHERE action_id=a.id),'uncertain reservation retained';
 failed:=false;
 BEGIN UPDATE public.ig_public_comment_attempts SET final_text='changed' WHERE action_id=a.id;
 EXCEPTION WHEN raise_exception THEN failed:=true; END;
 ASSERT failed,'reservation tuple immutable';
 r:=public.checkpoint_ig_public_comment_run(r.run_id,'fixture-owned-tab','{"partial":true}','completed','{"sql_fixture":true}');
 ASSERT NOT public.ig_public_comment_run_owned(r.run_id,'fixture-owned-tab'),'finalization releases only own lease';
 INSERT INTO public.ig_public_comment_runs(run_id,browser_binding,status,mode)
 VALUES('public-comment-daily-sql-fixture',b,'completed','daily');
 INSERT INTO public.ig_public_comment_runs(run_id,browser_binding,status,mode)
 VALUES('public-comment-daily-sql-fixture-restart',b,'completed','daily');
 ASSERT (SELECT count(*)=2 FROM public.ig_public_comment_runs WHERE run_id LIKE 'public-comment-daily-sql-fixture%'),'ended daily segments allow continuation without deleting receipts';
 ASSERT foreign_before=(SELECT coalesce(jsonb_agg(jsonb_build_array(run_id,browser_binding,status) ORDER BY run_id),'[]'::jsonb)
 FROM public.ig_browser_shift_runs x WHERE status='running'),'foreign ownership/bindings unchanged';
END $test$;
ROLLBACK;
