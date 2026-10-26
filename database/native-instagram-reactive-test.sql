-- Read-only assertions. No live-person claim, message or synthetic delivery.
do $test$
declare b jsonb; a public.ig_next_actions;
begin
 b:=jsonb_build_object('kind','instagram','browser_id','3','tab_id','test-only',
 'account','shan_n_sunny','url','https://www.instagram.com/direct/inbox/','verified_at',now());
 assert public.valid_ig_browser_surface(b,'missed_dm_audit'), 'native reactive binding rejected';
 assert not public.valid_ig_browser_surface(b||'{"account":"wrong"}', 'missed_dm_audit'), 'wrong account accepted';
 assert not public.valid_ig_browser_surface(b||jsonb_build_object('verified_at',now()-interval '6 minutes'),'missed_dm_audit'), 'stale identity accepted';
 assert not public.valid_ig_browser_surface(b||'{"url":"https://example.com/"}','missed_dm_audit'), 'wrong host accepted';
 assert public.ig_browser_coordination_scope('instagram','missed_dm_audit')=public.ig_browser_coordination_scope('meta_business_suite','missed_dm_audit'), 'old sender can compete';
 assert public.ig_browser_coordination_scope('instagram','active_client_instagram_community')<>public.ig_browser_coordination_scope('instagram','missed_dm_audit'), 'Story ownership blocked';
 assert not public.ig_browser_action_owned('nonexistent-test-run','instagram','test-only',gen_random_uuid(),1,gen_random_uuid(),null), 'missing lease accepted';
 select q.* into a from public.ig_next_actions q join public.ig_threads t on t.id=q.thread_id
 where q.owner='dm_manager' and q.action_type='reply_inbound' and t.channel='instagram'
 and exists(select 1 from public.ig_messages m where m.id=q.source_message_id and m.direction='in') limit 1;
 if found then
  assert public.ig_native_reactive_action_eligible(a), 'ordinary Instagram source rejected';
  a.owner:='story_operator';
  assert not public.ig_native_reactive_action_eligible(a), 'Story operator gained reactive permission';
  a.owner:='dm_manager'; a.source_message_id:=null;
  assert not public.ig_native_reactive_action_eligible(a), 'missing inbound source accepted';
 end if;
 assert position('q.status = ''claimed'' AND q.claim_expires_at <= NOW()' in pg_get_functiondef('public.claim_ig_next_actions(text,integer,integer,text,uuid[])'::regprocedure))>0, 'claim expiry guard lost';
 assert position('a.claim_token=p_claim_token' in pg_get_functiondef('public.ig_browser_action_owned(text,text,text,uuid,integer,uuid,uuid)'::regprocedure))>0, 'exact token guard lost';
 assert not public.ig_native_reactive_action_eligible(null::public.ig_next_actions), 'null action accepted';
end $test$;
