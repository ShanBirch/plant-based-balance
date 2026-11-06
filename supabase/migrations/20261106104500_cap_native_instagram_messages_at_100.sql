-- Shannon's 6 November 2026 correction: 100 account-wide outgoing messages per Brisbane day.
-- Count already-sent manual/automated messages and reserve uncertain sends conservatively.
CREATE TABLE public.ig_daily_message_limits (
    account text PRIMARY KEY,
    max_messages integer NOT NULL CHECK (max_messages BETWEEN 1 AND 10000),
    timezone text NOT NULL DEFAULT 'Australia/Brisbane' CHECK (timezone = 'Australia/Brisbane'),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.ig_daily_message_reservations (
    account text NOT NULL REFERENCES public.ig_daily_message_limits(account),
    local_day date NOT NULL,
    action_id uuid NOT NULL,
    action_version integer NOT NULL,
    run_id text NOT NULL,
    source_message_id uuid,
    reserved_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (account, local_day, action_id, action_version)
);
ALTER TABLE public.ig_daily_message_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ig_daily_message_reservations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ig_daily_message_limits, public.ig_daily_message_reservations FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.ig_daily_message_limits, public.ig_daily_message_reservations TO service_role;
CREATE POLICY ig_daily_limits_service ON public.ig_daily_message_limits
    FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY ig_daily_reservations_service ON public.ig_daily_message_reservations
    FOR ALL TO service_role USING (true) WITH CHECK (true);
INSERT INTO public.ig_daily_message_limits(account,max_messages)
VALUES ('shan_n_sunny',100);

CREATE FUNCTION public.ig_daily_message_budget_status(
    p_account text DEFAULT 'shan_n_sunny', p_at timestamptz DEFAULT now()
) RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = public, pg_temp AS $function$
WITH limits AS (
    SELECT *, (p_at AT TIME ZONE timezone)::date AS local_day
    FROM public.ig_daily_message_limits WHERE account = p_account
), bounds AS (
    SELECT *, local_day::timestamp AT TIME ZONE timezone AS day_start,
        (local_day + 1)::timestamp AT TIME ZONE timezone AS day_end FROM limits
), delivered AS (
    SELECT m.id FROM public.ig_messages m
    JOIN public.ig_threads t ON t.id=m.thread_id CROSS JOIN bounds b
    WHERE m.direction='out' AND m.created_at>=b.day_start AND m.created_at<b.day_end
      AND t.custom_data->>'bot_account'=b.account
), reserved AS (
    SELECT r.* FROM public.ig_daily_message_reservations r JOIN bounds b
      ON r.account=b.account AND r.local_day=b.local_day
    WHERE NOT EXISTS (
        SELECT 1 FROM (
            SELECT a.receipt FROM public.ig_next_actions a
            WHERE a.id=r.action_id AND a.action_version=r.action_version
              AND a.completed_at>=r.reserved_at
            UNION ALL
            SELECT h.receipt FROM public.ig_next_action_receipts h
            WHERE h.action_id=r.action_id AND h.action_version=r.action_version
              AND h.completed_at>=r.reserved_at
        ) proof
        WHERE (
            proof.receipt->>'no_send'='true'
            AND coalesce(proof.receipt->>'outbound_attempted','false')='false'
        ) OR (
            proof.receipt->>'kind'='native_message_reaction'
            AND proof.receipt->>'native_verified'='true'
            AND coalesce(proof.receipt->>'outbound_attempted','false')='false'
        ) OR EXISTS (
            SELECT 1 FROM delivered d WHERE d.id::text IN (
                proof.receipt->>'canonical_outbound_message_id',
                proof.receipt->>'canonical_message_id'
            )
        )
    )
), usage AS (
    SELECT (SELECT count(*) FROM delivered)::integer AS sent,
        (SELECT count(*) FROM reserved)::integer AS reserved
)
SELECT jsonb_build_object(
    'account',b.account,'timezone',b.timezone,'local_day',b.local_day,
    'limit',b.max_messages,'sent',u.sent,'reserved',u.reserved,
    'used',u.sent+u.reserved,
    'remaining',greatest(0,b.max_messages-u.sent-u.reserved),
    'exhausted',u.sent+u.reserved>=b.max_messages,
    'resets_at',b.day_end
) FROM bounds b CROSS JOIN usage u;
$function$;
REVOKE ALL ON FUNCTION public.ig_daily_message_budget_status(text,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ig_daily_message_budget_status(text,timestamptz) TO service_role;

-- Reservation only: this function grants no recipient, source, lease or send authority.
CREATE FUNCTION public.ig_reserve_daily_message_slot(
    p_account text,p_action_id uuid,p_action_version integer,p_run_id text,p_source_message_id uuid
) RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY INVOKER
SET search_path = public, pg_temp AS $function$
DECLARE
    v_day date;
    v_budget jsonb;
BEGIN
    SELECT (now() AT TIME ZONE timezone)::date INTO v_day
    FROM public.ig_daily_message_limits WHERE account=p_account;
    IF NOT FOUND THEN RETURN true; END IF; -- Other accounts retain their existing rules.
    IF p_action_id IS NULL OR p_action_version IS NULL OR nullif(p_run_id,'') IS NULL
        THEN RETURN false; END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended(
        'ig_daily_message_budget:'||p_account||':'||v_day::text,0));
    v_budget:=public.ig_daily_message_budget_status(p_account);
    IF EXISTS (
        SELECT 1 FROM public.ig_daily_message_reservations
        WHERE account=p_account AND local_day=v_day
          AND action_id=p_action_id AND action_version=p_action_version
          AND run_id=p_run_id AND source_message_id IS NOT DISTINCT FROM p_source_message_id
    ) THEN
        -- The pre-paste and immediate pre-Send checks share one slot.
        RETURN (v_budget->>'used')::integer <= (v_budget->>'limit')::integer;
    END IF;
    IF (v_budget->>'remaining')::integer <= 0 THEN RETURN false; END IF;
    INSERT INTO public.ig_daily_message_reservations
        (account,local_day,action_id,action_version,run_id,source_message_id)
    VALUES(p_account,v_day,p_action_id,p_action_version,p_run_id,p_source_message_id)
    ON CONFLICT DO NOTHING;
    RETURN FOUND;
END;
$function$;
REVOKE ALL ON FUNCTION public.ig_reserve_daily_message_slot(text,uuid,integer,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ig_reserve_daily_message_slot(text,uuid,integer,text,uuid) TO service_role;

-- Preserve the existing RPC OID so cached/dependent callers also receive the new gate.
CREATE OR REPLACE FUNCTION public.ig_browser_action_owned_before_daily_cap(p_run_id text, p_surface text, p_tab_id text, p_action_id uuid, p_action_version integer, p_claim_token uuid, p_source_message_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
 SELECT public.ig_browser_surface_owned(p_run_id,p_surface) AND EXISTS(
 SELECT 1 FROM public.ig_browser_shift_runs r JOIN public.ig_next_actions a ON a.claim_run_id=r.run_id
 WHERE r.run_id=p_run_id AND r.browser_binding->>'tab_id'=p_tab_id
 AND (r.lane<>'follower_notifications' OR (a.owner='follower_operator' AND a.action_type='welcome_follower'))
 AND ((r.lane='personal_discovery_follows' AND a.owner='personal_operator' AND a.reason->>'scope'='personal' AND a.action_type IN ('discovery_follow','welcome_follower')) OR (r.lane<>'personal_discovery_follows' AND a.owner<>'personal_operator'))
 AND (p_surface<>'instagram' OR r.lane<>'missed_dm_audit' OR public.ig_native_reactive_action_eligible(a))
 AND a.id=p_action_id AND a.action_version=p_action_version AND a.claim_token=p_claim_token
 AND a.source_message_id IS NOT DISTINCT FROM p_source_message_id
 AND a.status='claimed' AND a.claim_expires_at>now()
 AND (a.reason->>'policy' IS DISTINCT FROM 'meal_plan_call_followup_v1' OR public.ig_meal_plan_action_eligible(a.id))
 AND ((p_surface='meta_business_suite' AND (a.action_type IN ('reply_inbound','close_sale') OR public.ig_mbs_free_zoom_invite_eligible(a) OR public.ig_mbs_review_followup_eligible(a) OR (public.ig_mbs_user_requested_checkin_eligible(a) OR (public.ig_workout_accountability_action_eligible(a) OR (public.ig_free_coaching_ready_eligible(a) OR public.ig_client_onboarding_support_eligible(a))))))
 OR (p_surface='instagram' AND ((r.lane='missed_dm_audit' AND public.ig_native_reactive_action_eligible(a)) OR (a.action_type IN ('discovery_follow','feed_engagement','story_reply','reply_external_comment','welcome_follower') OR (a.action_type='discovery_unfollow' AND r.lane='plant_based_discovery_follows' AND a.owner='discovery_operator' AND (a.reason->>'policy'='story_nonresponder_unfollow_7d_v1' OR public.ig_clear_decline_unfollow_eligible(a)) AND a.reason->>'user_authorized'='true')) OR public.ig_user_requested_checkin_eligible(a)))));
$function$;

REVOKE ALL ON FUNCTION public.ig_browser_action_owned_before_daily_cap(text,text,text,uuid,integer,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ig_browser_action_owned_before_daily_cap(text,text,text,uuid,integer,uuid,uuid) TO service_role;
CREATE OR REPLACE FUNCTION public.ig_browser_action_owned(
    p_run_id text,p_surface text,p_tab_id text,p_action_id uuid,
    p_action_version integer,p_claim_token uuid,p_source_message_id uuid
) RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY INVOKER
SET search_path = public, pg_temp AS $function$
DECLARE
    v_account text;
    v_type text;
BEGIN
    IF NOT coalesce(public.ig_browser_action_owned_before_daily_cap(
        p_run_id,p_surface,p_tab_id,p_action_id,p_action_version,p_claim_token,p_source_message_id
    ),false) THEN RETURN false; END IF;
    SELECT lower(trim(r.browser_binding->>'account')),a.action_type
    INTO v_account,v_type FROM public.ig_browser_shift_runs r
    JOIN public.ig_next_actions a ON a.claim_run_id=r.run_id
    WHERE r.run_id=p_run_id AND a.id=p_action_id;
    IF v_type NOT IN ('reply_inbound','story_reply','welcome_follower','close_sale','reactivation')
        THEN RETURN true; END IF;
    IF nullif(v_account,'') IS NULL THEN RETURN false; END IF;
    RETURN public.ig_reserve_daily_message_slot(
        v_account,p_action_id,p_action_version,p_run_id,p_source_message_id
    );
END;
$function$;
REVOKE ALL ON FUNCTION public.ig_browser_action_owned(text,text,text,uuid,integer,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ig_browser_action_owned(text,text,text,uuid,integer,uuid,uuid) TO service_role;
COMMENT ON FUNCTION public.ig_browser_action_owned(text,text,text,uuid,integer,uuid,uuid)
IS 'Existing exact send authority plus atomic shared daily message reservation. A daily reservation never overrides old ownership or independent holds.';
