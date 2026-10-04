CREATE OR REPLACE FUNCTION public.ig_user_requested_checkin_eligible(a public.ig_next_actions) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=public,pg_temp AS $gate$
DECLARE t public.ig_threads;
BEGIN
 IF a.owner <> 'manual' OR a.action_type <> 'reactivation' OR a.reason->>'policy' IS DISTINCT FROM 'user_requested_checkin_v1' OR a.reason->>'explicit_user_authorization' IS DISTINCT FROM 'true' OR nullif(a.reason->>'authorization_request_id','') IS NULL OR nullif(a.reason->>'final_text','') IS NULL OR length(a.reason->>'final_text')>500 THEN RETURN false; END IF;
 IF nullif(a.reason->>'authorization_expires_at','') IS NULL OR (a.reason->>'authorization_expires_at')::timestamptz <= now() OR (a.reason->>'authorization_expires_at')::timestamptz > now()+interval '24 hours' THEN RETURN false; END IF;
 SELECT * INTO t FROM public.ig_threads WHERE id=a.thread_id AND lower(ig_username)=lower(a.ig_username);
 IF NOT FOUND OR coalesce(t.channel,'instagram') <> 'instagram' THEN RETURN false; END IF;
 IF EXISTS(SELECT 1 FROM public.ig_personal_contacts p WHERE lower(p.ig_username)=lower(a.ig_username)) THEN RETURN false; END IF;
 IF EXISTS(SELECT 1 FROM public.ig_threads x WHERE lower(x.ig_username)=lower(a.ig_username) AND (x.custom_data->>'do_not_follow_up'='true' OR x.custom_data->>'blocked_by_shannon'='true' OR x.custom_data->>'manual_review_only'='true' OR x.custom_data->>'friend_manual_only'='true' OR x.custom_data->>'personal_outreach'='true' OR x.custom_data->>'client_community_support_enabled'='false')) THEN RETURN false; END IF;
 RETURN a.reason->>'expected_latest_message_id' = (SELECT m.id::text FROM public.ig_messages m JOIN public.ig_threads x ON x.id=m.thread_id WHERE lower(x.ig_username)=lower(a.ig_username) ORDER BY m.created_at DESC,m.id DESC LIMIT 1);
EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN RETURN false;
END $gate$;
REVOKE ALL ON FUNCTION public.ig_user_requested_checkin_eligible(public.ig_next_actions) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ig_user_requested_checkin_eligible(public.ig_next_actions) TO service_role;

CREATE OR REPLACE FUNCTION public.claim_ig_next_actions(p_owner text, p_limit integer DEFAULT 20, p_lease_seconds integer DEFAULT 900, p_run_id text DEFAULT NULL::text, p_thread_ids uuid[] DEFAULT NULL::uuid[])
 RETURNS SETOF ig_next_actions
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    v_surface text;
    v_browser boolean;
BEGIN
    SELECT browser_surface INTO v_surface FROM public.ig_browser_shift_runs WHERE run_id=p_run_id;
    v_browser := FOUND;
    IF v_browser AND NOT public.ig_browser_surface_owned(p_run_id,v_surface) THEN
        RAISE EXCEPTION 'browser surface lease missing, legacy or expired';
    END IF;
    IF NOT v_browser AND p_owner IN ('browser_dispatcher','story_operator','external_comment_operator','follower_operator','feed_operator','discovery_operator', 'personal_operator') THEN
        RAISE EXCEPTION 'browser operator requires a verified surface run';
    END IF;
    IF p_owner NOT IN (
        'dm_manager', 'codex_live_worker', 'browser_dispatcher',
        'story_operator', 'external_comment_operator', 'follower_operator',
        'feed_operator', 'discovery_operator', 'personal_operator', 'onboarding', 'manual'
    ) THEN
        RAISE EXCEPTION 'invalid queue owner';
    END IF;

    RETURN QUERY
    WITH candidates AS (
        SELECT q.id
        FROM public.ig_next_actions q
        WHERE q.owner = p_owner
 AND (NOT v_browser OR p_owner='personal_operator' OR NOT EXISTS (SELECT 1 FROM public.ig_browser_shift_runs pr WHERE pr.run_id=p_run_id AND pr.lane='personal_discovery_follows'))
 AND (p_owner <> 'personal_operator' OR EXISTS (SELECT 1 FROM public.ig_browser_shift_runs pr WHERE pr.run_id=p_run_id AND pr.lane='personal_discovery_follows'))
          AND (NOT v_browser OR (v_surface='meta_business_suite' AND q.action_type IN ('reply_inbound','close_sale','wait','no_action'))
               OR (v_surface='instagram' AND (q.action_type IN ('discovery_follow','feed_engagement','story_reply','reply_external_comment','welcome_follower','wait','no_action') OR public.ig_user_requested_checkin_eligible(q))))
          AND (p_thread_ids IS NULL OR q.thread_id = ANY(p_thread_ids))
          AND q.due_at <= NOW()
          AND COALESCE(q.safe_after, '-infinity'::TIMESTAMPTZ) <= NOW()
          AND (
              q.status IN ('waiting', 'claimed')
              OR coalesce(q.receipt, '{}'::JSONB) = '{}'::JSONB
              OR (
                  q.status = 'cooldown'
                  AND q.safe_after <= NOW()
                  AND q.receipt->>'cloud_dm_manager_fallback' = 'true'
                  AND coalesce(q.receipt->>'outbound_attempted', 'false') <> 'true'
                  AND NOT EXISTS (
                      SELECT 1
                      FROM public.coach_alerts scheduled_alert
                      WHERE scheduled_alert.id::text = q.receipt->>'alert_id'
                        AND scheduled_alert.status = 'scheduled'
                  )
              )
          )
          AND (
              q.status = 'ready'
              OR (q.status = 'waiting' AND q.safe_after <= NOW())
              OR (q.status = 'claimed' AND q.claim_expires_at <= NOW())
              OR (q.status = 'cooldown' AND q.safe_after <= NOW())
          )
        ORDER BY q.priority DESC, q.due_at ASC, q.created_at ASC
        LIMIT LEAST(GREATEST(COALESCE(p_limit, 20), 1), 100)
        FOR UPDATE SKIP LOCKED
    )
    UPDATE public.ig_next_actions q
    SET status = 'claimed',
        claim_owner = p_owner,
        claim_token = gen_random_uuid(),
        claim_run_id = NULLIF(trim(p_run_id), ''),
        claim_expires_at = NOW() + make_interval(
            secs => LEAST(GREATEST(COALESCE(p_lease_seconds, 900), 60), 7200)
        )
    FROM candidates c
    WHERE q.id = c.id
    RETURNING q.*;
END;
$function$;

CREATE OR REPLACE FUNCTION public.ig_browser_action_owned(p_run_id text, p_surface text, p_tab_id text, p_action_id uuid, p_action_version integer, p_claim_token uuid, p_source_message_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
 SELECT public.ig_browser_surface_owned(p_run_id,p_surface) AND EXISTS(
 SELECT 1 FROM public.ig_browser_shift_runs r JOIN public.ig_next_actions a ON a.claim_run_id=r.run_id
 WHERE r.run_id=p_run_id AND r.browser_binding->>'tab_id'=p_tab_id
 AND ((r.lane='personal_discovery_follows' AND a.owner='personal_operator' AND a.reason->>'scope'='personal' AND a.action_type IN ('discovery_follow','welcome_follower')) OR (r.lane<>'personal_discovery_follows' AND a.owner<>'personal_operator'))
 AND a.id=p_action_id AND a.action_version=p_action_version AND a.claim_token=p_claim_token
 AND a.source_message_id IS NOT DISTINCT FROM p_source_message_id
 AND a.status='claimed' AND a.claim_expires_at>now()
 AND (a.reason->>'policy' IS DISTINCT FROM 'meal_plan_call_followup_v1' OR public.ig_meal_plan_action_eligible(a.id))
 AND ((p_surface='meta_business_suite' AND a.action_type IN ('reply_inbound','close_sale'))
 OR (p_surface='instagram' AND (a.action_type IN ('discovery_follow','feed_engagement','story_reply','reply_external_comment','welcome_follower') OR public.ig_user_requested_checkin_eligible(a)))));
$function$;

