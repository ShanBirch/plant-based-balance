CREATE OR REPLACE FUNCTION public.ig_user_requested_checkin_eligible(a ig_next_actions)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE t public.ig_threads;
BEGIN
 IF EXISTS(SELECT 1 FROM public.ig_threads WHERE id=a.thread_id
 AND channel='instagram' AND custom_data->>'user_requested_messages_enabled'='true') THEN
   RETURN public.ig_mbs_instagram_requested_message_eligible(a);
 END IF;
 IF a.reason->>'policy'='shortlist_native_direct_20261025_v1' THEN
   RETURN public.ig_shortlist_native_checkin_eligible(a);
 END IF;
 -- Existing canonical-thread policy remains unchanged.
 IF a.owner <> 'manual' OR a.action_type <> 'reactivation' OR a.reason->>'policy' IS DISTINCT FROM 'user_requested_checkin_v1' OR a.reason->>'explicit_user_authorization' IS DISTINCT FROM 'true' OR nullif(a.reason->>'authorization_request_id','') IS NULL OR nullif(a.reason->>'final_text','') IS NULL OR length(a.reason->>'final_text')>500 THEN RETURN false; END IF;
 IF nullif(a.reason->>'authorization_expires_at','') IS NULL OR (a.reason->>'authorization_expires_at')::timestamptz <= now() OR (a.reason->>'authorization_expires_at')::timestamptz > now()+interval '24 hours' THEN RETURN false; END IF;
 SELECT * INTO t FROM public.ig_threads WHERE id=a.thread_id AND lower(ig_username)=lower(a.ig_username);
 IF NOT FOUND OR coalesce(t.channel,'instagram') <> 'instagram' THEN RETURN false; END IF;
 IF EXISTS(SELECT 1 FROM public.ig_personal_contacts p WHERE lower(p.ig_username)=lower(a.ig_username)) THEN RETURN false; END IF;
 IF EXISTS(SELECT 1 FROM public.ig_threads x WHERE lower(x.ig_username)=lower(a.ig_username) AND (x.custom_data->>'do_not_follow_up'='true' OR x.custom_data->>'blocked_by_shannon'='true' OR x.custom_data->>'manual_review_only'='true' OR x.custom_data->>'friend_manual_only'='true' OR x.custom_data->>'personal_outreach'='true' OR x.custom_data->>'client_community_support_enabled'='false')) THEN RETURN false; END IF;
 RETURN a.reason->>'expected_latest_message_id' = (SELECT m.id::text FROM public.ig_messages m JOIN public.ig_threads x ON x.id=m.thread_id WHERE lower(x.ig_username)=lower(a.ig_username) ORDER BY m.created_at DESC,m.id DESC LIMIT 1);
EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN RETURN false;
END $function$
