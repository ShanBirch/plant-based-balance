-- Exact already-existing empty canonical identity for the final finite shortlist.
-- All original native history, lease, hold and permanent reservation gates retained.
CREATE OR REPLACE FUNCTION public.ig_shortlist_native_checkin_eligible(a public.ig_next_actions)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY INVOKER
SET search_path TO public, pg_temp AS $function$
BEGIN
 IF a.owner IS DISTINCT FROM 'manual' OR a.action_type IS DISTINCT FROM 'reactivation'
 OR a.source_message_id IS NOT NULL
 OR (a.ig_username='yadi.z95' AND a.thread_id IS DISTINCT FROM 'ded9b806-8598-4a44-878a-45e8e94177ef'::uuid)
 OR (a.thread_id IS NOT NULL AND (a.ig_username IS DISTINCT FROM 'yadi.z95'
     OR a.thread_id <> 'ded9b806-8598-4a44-878a-45e8e94177ef'::uuid))
 OR a.reason->>'policy' IS DISTINCT FROM 'shortlist_native_direct_20261025_v1'
 OR a.reason->>'campaign' IS DISTINCT FROM 'shortlist_casual_seven_day_v2'
 OR a.reason->>'authorization_source_chat' IS DISTINCT FROM '01a170d1-9ce1-7600-abb1-c4317adb4642'
 OR a.reason->>'explicit_user_authorization' IS DISTINCT FROM 'true'
 OR a.ig_username IS NULL OR NOT (a.ig_username = ANY(ARRAY[
 'sahil__20__','eli3palazzi','williammcnee','klynto80','allanbogut',
 'leah_draper_','nicholashatzz','mariaauchli','gossboss4','paulio86','tammyctaylor_fitness','yadi.z95']))
 OR coalesce(a.reason->>'run_id','') !~ '^balance-shortlist-dm-20261025-seg[0-9]+$'
 OR nullif(btrim(a.reason->>'authorization_request_id'),'') IS NULL
 OR coalesce(length(btrim(a.reason->>'final_text')),0) NOT BETWEEN 1 AND 120
 OR a.reason->>'native_account' IS DISTINCT FROM 'shan_n_sunny'
 OR coalesce(a.reason->>'native_conversation_id','') !~ '^[0-9]{5,30}$'
 OR nullif(btrim(a.reason->>'native_display_name'),'') IS NULL
 OR nullif(btrim(a.reason->>'native_evidence_ref'),'') IS NULL
 OR nullif(btrim(a.reason->>'canonical_gate_ref'),'') IS NULL
 THEN RETURN false; END IF;
 IF a.thread_id IS NOT NULL AND (
  NOT EXISTS(SELECT 1 FROM public.ig_threads t WHERE t.id=a.thread_id
    AND lower(t.ig_username)=a.ig_username AND coalesce(t.channel,'instagram')='instagram'
    AND t.linked_user_id IS NULL)
  OR EXISTS(SELECT 1 FROM public.ig_messages m JOIN public.ig_threads t ON t.id=m.thread_id
    WHERE t.id=a.thread_id OR lower(t.ig_username)=a.ig_username
      OR lower(t.custom_data#>>'{instagram_graph,username}')=a.ig_username
      OR lower(t.custom_data#>>'{instagram_graph,ig_username}')=a.ig_username)
  OR EXISTS(SELECT 1 FROM public.ig_threads t WHERE t.id=a.thread_id AND (
    t.custom_data->>'do_not_follow_up'='true' OR t.custom_data->>'blocked_by_shannon'='true'
    OR t.custom_data->>'manual_review_only'='true' OR t.custom_data->>'friend_manual_only'='true'
    OR t.custom_data->>'personal_outreach'='true' OR t.custom_data->>'client_community_support_enabled'='false'))
 ) THEN RETURN false; END IF;
 IF a.reason->>'full_thread_reviewed'  IS DISTINCT FROM 'true'
 OR a.reason->>'native_identity_verified' IS DISTINCT FROM 'true'
 OR a.reason->>'native_following_verified' IS DISTINCT FROM 'true'
 OR a.reason->>'independent_holds_checked' IS DISTINCT FROM 'true'
 OR a.reason->>'canonical_history_empty' IS DISTINCT FROM 'true'
 OR a.reason->>'native_pending_inbound' IS DISTINCT FROM 'false'
 OR nullif(a.reason->>'authorization_expires_at','') IS NULL
 OR (a.reason->>'authorization_expires_at')::timestamptz <= now()
 OR (a.reason->>'authorization_expires_at')::timestamptz > now()+interval '24 hours'
 OR nullif(a.reason->>'native_reviewed_at','') IS NULL
 OR (a.reason->>'native_reviewed_at')::timestamptz < now()-interval '5 minutes'
 OR (a.reason->>'native_reviewed_at')::timestamptz > now()+interval '30 seconds'
 THEN RETURN false; END IF;
 IF a.reason->>'native_latest_direction' = 'empty' THEN
   IF a.reason->>'native_history_empty' IS DISTINCT FROM 'true'
   OR nullif(a.reason->>'native_last_outbound_at','') IS NOT NULL THEN RETURN false; END IF;
 ELSIF a.reason->>'native_latest_direction' = 'out' THEN
   IF a.reason->>'native_history_empty' IS DISTINCT FROM 'false'
   OR nullif(a.reason->>'native_last_outbound_at','') IS NULL
   OR (a.reason->>'native_last_outbound_at')::timestamptz >= now()-interval '7 days'
   THEN RETURN false; END IF;
 ELSE RETURN false; END IF;
 -- A newly discovered canonical identity forces a fresh review using the
 -- existing canonical-thread path. Native IDs are never inserted as subscribers.
 IF EXISTS(SELECT 1 FROM public.ig_threads t WHERE (lower(t.ig_username)=a.ig_username
 OR lower(t.custom_data#>>'{instagram_graph,username}')=a.ig_username
 OR lower(t.custom_data#>>'{instagram_graph,ig_username}')=a.ig_username)
 AND t.id IS DISTINCT FROM a.thread_id)
 OR EXISTS(SELECT 1 FROM public.ig_personal_contacts p WHERE lower(p.ig_username)=a.ig_username)
 OR EXISTS(SELECT 1 FROM public.ig_next_actions other WHERE other.id<>a.id
   AND lower(other.ig_username)=a.ig_username
   AND (other.status IN ('ready','waiting','needs_you','blocked','claimed')
     OR (other.receipt->>'campaign'='shortlist_casual_seven_day_v2'
       AND (other.receipt ? 'attempt_reserved_at' OR other.receipt->>'native_send_attempted'='true'
            OR other.receipt->>'native_verified'='true'))))
 OR EXISTS(SELECT 1 FROM public.ig_next_action_receipts h WHERE lower(h.ig_username)=a.ig_username
   AND h.receipt->>'campaign'='shortlist_casual_seven_day_v2'
   AND (h.receipt ? 'attempt_reserved_at' OR h.receipt->>'native_send_attempted'='true'
        OR h.receipt->>'native_verified'='true'))
 THEN RETURN false; END IF;
 -- An existing reservation remains owned only by its still-live exact claim;
 -- an expired reservation cannot become a fresh claim or a retry.
 IF a.receipt ? 'attempt_reserved_at' THEN
   RETURN coalesce(a.status='claimed' AND a.claim_expires_at>now()
    AND a.claim_run_id=a.reason->>'run_id'
    AND a.receipt->>'original_claim_token'=a.claim_token::text
    AND a.receipt->>'action_version'=a.action_version::text,false);
 END IF;
 RETURN true;
EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN RETURN false;
END $function$;
REVOKE ALL ON FUNCTION public.ig_shortlist_native_checkin_eligible(public.ig_next_actions) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ig_shortlist_native_checkin_eligible(public.ig_next_actions) TO service_role;

