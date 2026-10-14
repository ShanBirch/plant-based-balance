BEGIN;
SET LOCAL statement_timeout='8s';
SET LOCAL lock_timeout='2s';
DO $test$
DECLARE b jsonb; r public.fb_public_comment_runs; a public.fb_public_comment_attempts; failed boolean;
BEGIN
 b:=jsonb_build_object('kind','facebook','account','shazbirch','profile_url','https://www.facebook.com/shazbirch','browser_id','fb-test','tab_id','fb-test','verified_at',now());
 r:=public.start_fb_public_comment_run('fb-sql-fixture',b,'{}');
 ASSERT public.fb_public_comment_owned(r.run_id,'fb-test');
 ASSERT NOT public.fb_public_comment_owned(r.run_id,'foreign');
 a:=public.reserve_fb_public_comment(r.run_id,'fb-test','fixture-person','fb:post:SQL_FIXTURE','https://www.facebook.com/fixture/posts/SQL_FIXTURE/','Never sent synthetic fixture.',
 jsonb_build_object('following_verified',true,'history_complete',true,'eligibility_clear',true,'media_understood',true,'cross_worker_clear',true,'organic',true,
 'person_key','fixture-person','post_key','fb:post:SQL_FIXTURE','post_url','https://www.facebook.com/fixture/posts/SQL_FIXTURE/','final_text','Never sent synthetic fixture.',
 'authorization_source','rollback fixture','history_review','fixture','eligibility_review','fixture','content_review','fixture','reviewed_at',now(),'published_at',now()));
 PERFORM public.activate_fb_public_comment(r.run_id,'fb-test',a.id,a.post_key,a.final_text);
 failed:=false;
 BEGIN PERFORM public.activate_fb_public_comment(r.run_id,'fb-test',a.id,a.post_key,a.final_text); EXCEPTION WHEN raise_exception THEN failed:=true; END;
 ASSERT failed,'second activation rejected';
 failed:=false;
 BEGIN PERFORM public.reconcile_fb_public_comment(r.run_id,'fb-test',a.id,'{}',true); EXCEPTION WHEN raise_exception THEN failed:=true; END;
 ASSERT failed,'missing native proof rejected';
 a:=public.reconcile_fb_public_comment(r.run_id,'fb-test',a.id,'{"fixture":true}',false);
 ASSERT a.status='uncertain';
 failed:=false;
 BEGIN UPDATE public.fb_public_comment_attempts SET status='reserved' WHERE id=a.id; EXCEPTION WHEN raise_exception THEN failed:=true; END;
 ASSERT failed,'uncertain attempts cannot be retried';
 PERFORM public.checkpoint_fb_public_comment_run(r.run_id,'fb-test','{"verified":0}','partial');
 r:=public.start_fb_public_comment_run('fb-sql-fixture-seg2',b,'{"verified":0}');
 ASSERT (SELECT count(*)=1 FROM public.fb_public_comment_attempts WHERE id=a.id),'continuation retains reservation';
 PERFORM public.checkpoint_fb_public_comment_run(r.run_id,'fb-test','{}','completed');
END $test$;
ROLLBACK;
