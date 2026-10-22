DO $migration$
DECLARE body text;
BEGIN
 SELECT pg_get_functiondef('public.claim_ig_next_actions(text,integer,integer,text,uuid[])'::regprocedure) INTO body;
 IF position('discovery_unfollow' in body)=0 THEN
 IF position('q.action_type IN (''discovery_follow'',''feed_engagement'',''story_reply'',''reply_external_comment'',''welcome_follower'',''wait'',''no_action'')' in body)=0 THEN RAISE EXCEPTION 'Unexpected claim guard'; END IF;
 body:=replace(body,'q.action_type IN (''discovery_follow'',''feed_engagement'',''story_reply'',''reply_external_comment'',''welcome_follower'',''wait'',''no_action'')','(q.action_type IN (''discovery_follow'',''feed_engagement'',''story_reply'',''reply_external_comment'',''welcome_follower'',''wait'',''no_action'') OR (q.action_type=''discovery_unfollow'' AND p_owner=''discovery_operator'' AND q.reason->>''policy''=''story_nonresponder_unfollow_7d_v1'' AND q.reason->>''user_authorized''=''true'' AND EXISTS (SELECT 1 FROM public.ig_browser_shift_runs ur WHERE ur.run_id=p_run_id AND ur.lane=''plant_based_discovery_follows'')))');
 EXECUTE body;
 END IF;
END $migration$;
