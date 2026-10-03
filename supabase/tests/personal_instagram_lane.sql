BEGIN;
DO $$
DECLARE b jsonb; t uuid; a public.ig_next_actions; denied boolean:=false; r jsonb; i integer;
BEGIN
 b:=jsonb_build_object('kind','instagram','browser_id','test','tab_id','test','account','shan_n_sunny','url','https://www.instagram.com/','verified_at',now());
 ASSERT public.valid_ig_browser_surface(b,'personal_discovery_follows'), 'personal surface accepted';
 ASSERT public.valid_ig_browser_surface(b,'plant_based_discovery_follows'), 'business surface retained';
 ASSERT NOT public.valid_ig_browser_surface(b||'{"account":"wrong"}','personal_discovery_follows'), 'wrong account rejected';
 ASSERT NOT public.valid_ig_browser_surface(b||'{"url":"https://instagram.com.attacker.test/"}','personal_discovery_follows'), 'wrong host rejected';
 ASSERT NOT public.valid_ig_browser_surface(b||jsonb_build_object('verified_at',now()-interval '10 minutes'),'personal_discovery_follows'), 'stale proof rejected';
 ASSERT NOT has_table_privilege('anon','public.ig_personal_contacts','SELECT'), 'registry private';
 ASSERT NOT has_function_privilege('authenticated','public.prepare_ig_personal_action(text,text,text,jsonb)','EXECUTE'), 'preparation restricted';
 BEGIN
  PERFORM public.prepare_ig_personal_action('codex_test_personal_fixture','absent','discovery_follow','{}');
 EXCEPTION WHEN raise_exception THEN denied:=true;
 END;
 ASSERT denied,'missing personal lease rejected';
 r:=public.start_ig_browser_shift('codex_personal_rollback_test','personal_discovery_follows',0,jsonb_build_object('browser_surface',b),300);
 ASSERT r->>'acquired'='true','personal run acquires actual shared lease';
 a:=public.prepare_ig_personal_action('codex_test_personal_fixture','codex_personal_rollback_test','discovery_follow',
  '{"eligibility_verified":true,"native_history_clear":true,"exclusions_clear":true}');
 ASSERT a.owner='personal_operator' AND a.reason->>'scope'='personal','personal provenance';
 SELECT * INTO a FROM public.claim_ig_next_actions('personal_operator',1,300,'codex_personal_rollback_test');
 ASSERT a.status='claimed','personal action claimed';
 ASSERT public.ig_browser_action_owned('codex_personal_rollback_test','instagram','test',a.id,a.action_version,a.claim_token,NULL),'exact personal ownership accepted';
 ASSERT NOT public.ig_browser_action_owned('codex_personal_rollback_test','instagram','wrong',a.id,a.action_version,a.claim_token,NULL),'wrong tab rejected';
 PERFORM public.complete_ig_next_action(a.id,a.claim_token,'completed',NULL,'{"test":true}');
 denied:=false;
 BEGIN
  PERFORM public.prepare_ig_personal_action('codex_test_personal_fixture','codex_personal_rollback_test','discovery_follow',
   '{"eligibility_verified":true,"native_history_clear":true,"exclusions_clear":true}');
 EXCEPTION WHEN raise_exception THEN denied:=true;
 END;
 ASSERT denied,'duplicate follow rejected';
 UPDATE public.ig_personal_contacts SET follow_verified_at=now() WHERE ig_username='codex_test_personal_fixture';
 denied:=false;
 BEGIN
  PERFORM public.prepare_ig_personal_action('codex_test_personal_fixture','codex_personal_rollback_test','welcome_follower','{}');
 EXCEPTION WHEN raise_exception THEN denied:=true;
 END;
 ASSERT denied,'unproven follow-back rejected';
 FOR i IN 1..9 LOOP
  INSERT INTO public.ig_personal_contacts(ig_username,follow_reserved_at) VALUES('codex_cap_fixture_'||i,now());
 END LOOP;
 denied:=false;
 BEGIN
  PERFORM public.prepare_ig_personal_action('codex_cap_fixture_11','codex_personal_rollback_test','discovery_follow',
   '{"eligibility_verified":true,"native_history_clear":true,"exclusions_clear":true}');
 EXCEPTION WHEN raise_exception THEN denied:=true;
 END;
 ASSERT denied,'combined daily cap enforced';
 INSERT INTO public.ig_threads(subscriber_id,ig_username,auto_send_enabled,custom_data)
 VALUES('codex_personal_test_rollback','codex_test_personal_fixture',true,'{"preserve_me":true}') RETURNING id INTO t;
 ASSERT (SELECT NOT auto_send_enabled AND custom_data->>'friend_manual_only'='true'
  AND custom_data->>'personal_outreach'='true' AND custom_data->>'preserve_me'='true' FROM public.ig_threads WHERE id=t), 'thread held, data preserved';
 UPDATE public.ig_threads SET auto_send_enabled=true,custom_data='{}' WHERE id=t;
 ASSERT (SELECT NOT auto_send_enabled AND custom_data->>'friend_manual_only'='true' FROM public.ig_threads WHERE id=t), 'hold cannot be overwritten';
 a:=public.upsert_ig_next_action(t,'codex_test_personal_fixture','new','dm_manager','reply_inbound');
 ASSERT a.owner='manual' AND a.status='needs_you' AND a.action_type='no_action','business action held';
 INSERT INTO public.ig_messages(thread_id,direction,text) VALUES(t,'in','can we have a call?');
 ASSERT (SELECT owner='manual' AND status='needs_you' AND action_type='no_action' AND source_message_id IS NOT NULL FROM public.ig_next_actions WHERE thread_id=t), 'inbound call intent remains personal';
 denied:=false;
 BEGIN
  PERFORM public.upsert_ig_next_action(NULL,'codex_test_unregistered','personal','personal_operator','discovery_follow',100,now(),now(),'{"scope":"personal"}');
 EXCEPTION WHEN raise_exception THEN denied:=true;
 END;
 ASSERT denied,'unregistered personal action rejected';
END $$;
ROLLBACK;
