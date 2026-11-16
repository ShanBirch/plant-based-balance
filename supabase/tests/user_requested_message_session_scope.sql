-- No rows are changed and no message is sent.
do $test$
declare d text;
begin
 if public.ig_browser_coordination_scope('instagram','user_requested_messages')
 in (public.ig_browser_coordination_scope('instagram','missed_dm_audit'),
 public.ig_browser_coordination_scope('instagram','active_client_instagram_community'))
 then raise exception 'Manual session blocks unrelated automated scope'; end if;
 if not public.valid_ig_browser_surface(jsonb_build_object('kind','instagram','browser_id','test',
 'tab_id','test','account','shan_n_sunny','url','https://www.instagram.com/direct/inbox/','verified_at',now()),'user_requested_messages')
 then raise exception 'Valid manual surface rejected'; end if;
 if public.valid_ig_browser_surface(jsonb_build_object('kind','instagram','browser_id','test',
 'tab_id','test','account','other_account','url','https://www.instagram.com/direct/inbox/','verified_at',now()),'user_requested_messages')
 then raise exception 'Wrong account accepted'; end if;
 select pg_get_functiondef('public.claim_ig_next_actions(text,integer,integer,text,uuid[])'::regprocedure) into d;
 if position('mr.lane=''user_requested_messages''' in d)=0
 or position('q.owner=''manual'' AND public.ig_mbs_instagram_requested_message_eligible(q)' in d)=0
 then raise exception 'Manual lane claim filter missing'; end if;
 select pg_get_functiondef('public.ig_browser_action_owned_before_daily_cap(text,text,text,uuid,integer,uuid,uuid)'::regprocedure) into d;
 if position('r.lane<>''user_requested_messages'' OR (a.owner=''manual'' AND public.ig_mbs_instagram_requested_message_eligible(a))' in d)=0
 then raise exception 'Manual pre-send validator missing'; end if;
 select pg_get_functiondef('public.start_ig_browser_shift(text,text,integer,jsonb,integer)'::regprocedure) into d;
 if position('browser_binding->>''tab_id''=v_binding->>''tab_id''' in d)=0
 then raise exception 'Exact tab collision check missing'; end if;
end $test$;
select 'Passed dedicated manual scope, account and claim/pre-send filtering checks' as result;
