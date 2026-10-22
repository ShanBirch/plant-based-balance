BEGIN;
-- Synthetic database fixtures only; all changes roll back and no native messages are sent.
UPDATE public.ig_browser_shift_runs SET status='interrupted' WHERE status='running';
DO $test$
DECLARE b jsonb; r jsonb; aid uuid:=gen_random_uuid(); tok uuid:=gen_random_uuid(); failed boolean;
BEGIN
 b:=jsonb_build_object('kind','instagram','browser_id','fixture-browser','tab_id','fixture-story','account','shan_n_sunny','url','https://www.instagram.com/','verified_at',now());
 ASSERT NOT public.valid_ig_browser_surface(b||'{"account":"wrong"}','follower_notifications'),'wrong account denied';
 ASSERT NOT public.valid_ig_browser_surface(b||jsonb_build_object('verified_at',now()-interval '6 minutes'),'follower_notifications'),'stale identity denied';
 r:=public.start_ig_browser_shift('follower-test-story','active_client_instagram_community',0,jsonb_build_object('browser_surface',b),300);
 ASSERT (r->>'acquired')::boolean,'story fixture acquired';
 r:=public.start_ig_browser_shift('follower-test-same-tab','follower_notifications',1,jsonb_build_object('browser_surface',b),300);
 ASSERT NOT (r->>'acquired')::boolean,'same tab denied across lanes';
 b:=b||'{"tab_id":"fixture-welcome"}';
 r:=public.start_ig_browser_shift('follower-test-welcome','follower_notifications',1,jsonb_build_object('browser_surface',b),300);
 ASSERT (r->>'acquired')::boolean,'separate follower tab acquired alongside story';
 ASSERT public.ig_browser_surface_owned('follower-test-story','instagram'),'story ownership unchanged';
 ASSERT (SELECT count(*) FROM public.claim_ig_next_actions('story_operator',1,300,'follower-test-welcome'))=0,'follower run cannot claim story work';
 failed:=false;
 BEGIN UPDATE public.ig_browser_shift_runs SET lane='active_client_instagram_community' WHERE run_id='follower-test-welcome'; EXCEPTION WHEN raise_exception THEN failed:=true; END;
 ASSERT failed,'lane cannot change under an existing lease';
 r:=public.start_ig_browser_shift('follower-test-second','follower_notifications',1,jsonb_build_object('browser_surface',b||'{"tab_id":"fixture-second"}'),300);
 ASSERT NOT (r->>'acquired')::boolean,'second follower worker denied';
 r:=public.start_ig_browser_shift('follower-test-second-story','active_client_instagram_community',0,jsonb_build_object('browser_surface',b||'{"tab_id":"fixture-second-story"}'),300);
 ASSERT NOT (r->>'acquired')::boolean,'second story worker denied';
 INSERT INTO public.ig_next_actions(id,subject_key,owner,status,action_type,claim_owner,claim_token,claim_run_id,claim_expires_at,action_version)
 VALUES(aid,'follower-coordination-fixture','follower_operator','claimed','welcome_follower','follower_operator',tok,'follower-test-welcome',now()+interval '5 minutes',1);
 ASSERT public.ig_browser_action_owned('follower-test-welcome','instagram','fixture-welcome',aid,1,tok,NULL),'exact welcome accepted';
 ASSERT NOT public.ig_browser_action_owned('follower-test-story','instagram','fixture-story',aid,1,tok,NULL),'story cannot use follower claim';
 ASSERT NOT public.ig_browser_action_owned('follower-test-welcome','instagram','fixture-story',aid,1,tok,NULL),'wrong tab denied';
 ASSERT NOT public.ig_browser_action_owned('follower-test-welcome','instagram','fixture-welcome',aid,1,gen_random_uuid(),NULL),'wrong token denied';
 ASSERT NOT public.ig_browser_action_owned('follower-test-welcome','instagram','fixture-welcome',aid,2,tok,NULL),'stale version denied';
 ASSERT NOT public.ig_browser_action_owned('follower-test-welcome','instagram','fixture-welcome',aid,1,tok,gen_random_uuid()),'changed source denied';
 UPDATE public.ig_next_actions SET owner='story_operator',action_type='story_reply' WHERE id=aid;
 ASSERT NOT public.ig_browser_action_owned('follower-test-welcome','instagram','fixture-welcome',aid,1,tok,NULL),'follower lease cannot send story';
 failed:=false;
 BEGIN INSERT INTO public.ig_next_actions(subject_key,owner,status,action_type) VALUES('follower-coordination-fixture','dm_manager','ready','reply_inbound');
 EXCEPTION WHEN unique_violation THEN failed:=true; END;
 ASSERT failed,'global recipient uniqueness preserved';
 PERFORM public.finish_ig_browser_shift('follower-test-welcome','completed');
 ASSERT public.ig_browser_surface_owned('follower-test-story','instagram'),'follower finish preserves story';
END $test$;
SELECT 'passed: separate tabs coexist; same-tab, duplicate workers, wrong action/source/token/version and duplicate recipient denied; Story ownership preserved' result;
ROLLBACK;
