CREATE OR REPLACE FUNCTION public.ig_mbs_user_requested_checkin_eligible(a public.ig_next_actions)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=public,pg_temp AS $gate$
DECLARE target public.ig_threads;
BEGIN
 IF a.owner IS DISTINCT FROM 'manual' OR a.action_type IS DISTINCT FROM 'reactivation'
 OR a.reason->>'policy' IS DISTINCT FROM 'user_requested_checkin_v1'
 OR a.reason->>'explicit_user_authorization' IS DISTINCT FROM 'true'
 OR nullif(trim(a.reason->>'authorization_request_id'),'') IS NULL
 OR nullif(trim(a.reason->>'final_text'),'') IS NULL OR length(a.reason->>'final_text')>500
 OR a.reason->>'full_thread_reviewed' IS DISTINCT FROM 'true'
 OR a.reason->>'native_identity_verified' IS DISTINCT FROM 'true'
 OR a.reason->>'independent_holds_checked' IS DISTINCT FROM 'true'
 OR nullif(trim(a.reason->>'native_conversation_id'),'') IS NULL THEN RETURN false; END IF;
 IF nullif(a.reason->>'authorization_expires_at','') IS NULL
 OR (a.reason->>'authorization_expires_at')::timestamptz<=now()
 OR (a.reason->>'authorization_expires_at')::timestamptz>now()+interval '24 hours' THEN RETURN false; END IF;
 SELECT * INTO target FROM public.ig_threads WHERE id=a.thread_id;
 IF NOT FOUND OR target.channel IS DISTINCT FROM 'messenger' OR target.linked_user_id IS NOT NULL
 OR nullif(target.subscriber_id,'') IS NULL
 OR target.custom_data#>>'{manychat_business,page_id}' IS DISTINCT FROM '561122130919678'
 OR a.reason->>'page_id' IS DISTINCT FROM '561122130919678' THEN RETURN false; END IF;
 IF EXISTS(SELECT 1 FROM public.ig_personal_contacts contact WHERE lower(contact.ig_username)=lower(target.ig_username)) THEN RETURN false; END IF;
 IF EXISTS(SELECT 1 FROM public.ig_threads other_thread
 WHERE (other_thread.id=target.id OR (other_thread.channel='messenger' AND other_thread.subscriber_id=target.subscriber_id)
 OR (nullif(target.ig_username,'') IS NOT NULL AND lower(other_thread.ig_username)=lower(target.ig_username)))
 AND (other_thread.linked_user_id IS NOT NULL OR other_thread.custom_data->>'client_community_support_enabled'='false'
 OR EXISTS(SELECT 1 FROM jsonb_each(coalesce(other_thread.custom_data,'{}'::jsonb)) flag
 WHERE flag.key IN ('manual_only','manual_review_only','friend_manual_only','codex_ai_opt_out','ai_automation_opt_out',
 'do_not_follow_up','blocked_by_shannon','human_takeover','personal_outreach') AND flag.value='true'::jsonb))) THEN RETURN false; END IF;
 RETURN coalesce(a.reason->>'expected_latest_message_id'=(SELECT message.id::text
 FROM public.ig_messages message JOIN public.ig_threads sibling ON sibling.id=message.thread_id
 WHERE sibling.channel='messenger' AND sibling.subscriber_id=target.subscriber_id
 ORDER BY message.created_at DESC,message.id DESC LIMIT 1),false);
EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN RETURN false;
END $gate$;
REVOKE ALL ON FUNCTION public.ig_mbs_user_requested_checkin_eligible(public.ig_next_actions) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ig_mbs_user_requested_checkin_eligible(public.ig_next_actions) TO service_role;

DO $patch$
DECLARE definition text; previous text; replacement text;
BEGIN
 SELECT pg_get_functiondef('public.claim_ig_next_actions(text,integer,integer,text,uuid[])'::regprocedure) INTO definition;
 previous:='OR public.ig_mbs_review_followup_eligible(q)))';
 replacement:='OR public.ig_mbs_review_followup_eligible(q) OR public.ig_mbs_user_requested_checkin_eligible(q)))';
 IF position(previous IN definition)=0 THEN RAISE EXCEPTION 'Unexpected claim function; review before changing'; END IF;
 EXECUTE replace(definition,previous,replacement);
 SELECT pg_get_functiondef('public.ig_browser_action_owned(text,text,text,uuid,integer,uuid,uuid)'::regprocedure) INTO definition;
 previous:='OR public.ig_mbs_review_followup_eligible(a)))';
 replacement:='OR public.ig_mbs_review_followup_eligible(a) OR public.ig_mbs_user_requested_checkin_eligible(a)))';
 IF position(previous IN definition)=0 THEN RAISE EXCEPTION 'Unexpected ownership function; review before changing'; END IF;
 EXECUTE replace(definition,previous,replacement);
END $patch$;
