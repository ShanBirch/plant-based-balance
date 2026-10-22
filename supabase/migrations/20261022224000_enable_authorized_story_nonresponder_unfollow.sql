-- Authorized two-per-run cleanup of unanswered Story outreach.
ALTER TABLE public.ig_next_actions DROP CONSTRAINT ig_next_actions_type_check;
ALTER TABLE public.ig_next_actions ADD CONSTRAINT ig_next_actions_type_check CHECK(action_type = ANY(ARRAY['reply_inbound','close_sale','book_call','send_checkout','onboard_paid_member','story_reply','reply_external_comment','welcome_follower','feed_engagement','discovery_follow','reactivation','client_inactivity_checkin','wait','no_action','discovery_unfollow']));
DO $migration$
DECLARE body text;
BEGIN
 SELECT pg_get_functiondef(oid) INTO STRICT body FROM pg_proc WHERE oid='public.ig_browser_action_owned(text,text,text,uuid,integer,uuid,uuid)'::regprocedure;
 IF position('discovery_unfollow' in body)=0 THEN
  IF position('a.action_type IN (''discovery_follow'',''feed_engagement'',''story_reply'',''reply_external_comment'',''welcome_follower'')' in body)=0 THEN RAISE EXCEPTION 'Unexpected ownership guard; abort'; END IF;
  body:=replace(body,'a.action_type IN (''discovery_follow'',''feed_engagement'',''story_reply'',''reply_external_comment'',''welcome_follower'')','(a.action_type IN (''discovery_follow'',''feed_engagement'',''story_reply'',''reply_external_comment'',''welcome_follower'') OR (a.action_type=''discovery_unfollow'' AND r.lane=''plant_based_discovery_follows'' AND a.owner=''discovery_operator'' AND a.reason->>''policy''=''story_nonresponder_unfollow_7d_v1'' AND a.reason->>''user_authorized''=''true''))');
  EXECUTE body;
 END IF;
END $migration$;
