-- Separate follower-welcome coordination from Story work on distinct verified tabs.
-- Exact recipient/source claims, existing Story scope, and one-owner-per-tab remain global.
CREATE OR REPLACE FUNCTION public.guard_ig_browser_surface()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('ig_browser_shift_dispatcher',0));
 IF TG_OP='UPDATE' AND (NEW.browser_surface<>OLD.browser_surface OR NEW.browser_binding<>OLD.browser_binding OR NEW.lane<>OLD.lane) THEN
  RAISE EXCEPTION 'browser surface binding is immutable; use a fresh run';
 END IF;
 IF NEW.status='running' AND (TG_OP='INSERT' OR OLD.status<>'running') THEN
  IF EXISTS(SELECT 1 FROM public.ig_browser_shift_runs r WHERE r.status='running'
   AND r.lease_expires_at>now() AND r.run_id<>NEW.run_id
   AND (r.browser_surface='legacy' OR NEW.browser_surface='legacy'
        OR public.ig_browser_coordination_scope(r.browser_surface,r.lane)=public.ig_browser_coordination_scope(NEW.browser_surface,NEW.lane))) THEN
   RAISE EXCEPTION 'browser surface already owned';
  END IF;
 END IF;
 RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.ig_browser_coordination_scope(surface text, work_lane text)
RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path=public,pg_temp AS $$
 SELECT CASE WHEN surface='instagram' AND work_lane='follower_notifications'
 THEN 'instagram_follower_welcomes' ELSE surface END;
$$;
REVOKE ALL ON FUNCTION public.ig_browser_coordination_scope(text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ig_browser_coordination_scope(text,text) TO service_role;
DROP INDEX public.ig_browser_shift_runs_one_surface_running_idx;
CREATE UNIQUE INDEX ig_browser_shift_runs_one_surface_running_idx
 ON public.ig_browser_shift_runs(public.ig_browser_coordination_scope(browser_surface,lane)) WHERE status='running';

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
          AND (NOT v_browser OR NOT EXISTS (SELECT 1 FROM public.ig_browser_shift_runs fr WHERE fr.run_id=p_run_id AND fr.lane='follower_notifications') OR (p_owner='follower_operator' AND q.action_type='welcome_follower'))
 AND (NOT v_browser OR p_owner='personal_operator' OR NOT EXISTS (SELECT 1 FROM public.ig_browser_shift_runs pr WHERE pr.run_id=p_run_id AND pr.lane='personal_discovery_follows'))
 AND (p_owner <> 'personal_operator' OR EXISTS (SELECT 1 FROM public.ig_browser_shift_runs pr WHERE pr.run_id=p_run_id AND pr.lane='personal_discovery_follows'))
          AND (NOT v_browser OR (v_surface='meta_business_suite' AND (q.action_type IN ('reply_inbound','close_sale','wait','no_action') OR public.ig_mbs_free_zoom_invite_eligible(q) OR public.ig_mbs_review_followup_eligible(q) OR public.ig_mbs_user_requested_checkin_eligible(q)))
               OR (v_surface='instagram' AND (q.action_type IN ('discovery_follow','feed_engagement','story_reply','reply_external_comment','welcome_follower','wait','no_action') OR public.ig_user_requested_checkin_eligible(q))))
          AND (q.action_type <> 'story_reply' OR NOT public.ig_story_receipt_attempted(q.receipt))
          AND (q.action_type <> 'story_reply' OR NOT EXISTS (
              SELECT 1 FROM public.ig_next_action_receipts h
              WHERE (public.ig_story_receipt_attempted(h.receipt) AND h.action_id=q.id AND h.action_version=q.action_version)
                OR (h.action_type='story_reply' AND h.ig_username=q.ig_username AND h.receipt->>'story_id'=q.reason->>'story_id')))
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
 AND (r.lane<>'follower_notifications' OR (a.owner='follower_operator' AND a.action_type='welcome_follower'))
 AND ((r.lane='personal_discovery_follows' AND a.owner='personal_operator' AND a.reason->>'scope'='personal' AND a.action_type IN ('discovery_follow','welcome_follower')) OR (r.lane<>'personal_discovery_follows' AND a.owner<>'personal_operator'))
 AND a.id=p_action_id AND a.action_version=p_action_version AND a.claim_token=p_claim_token
 AND a.source_message_id IS NOT DISTINCT FROM p_source_message_id
 AND a.status='claimed' AND a.claim_expires_at>now()
 AND (a.reason->>'policy' IS DISTINCT FROM 'meal_plan_call_followup_v1' OR public.ig_meal_plan_action_eligible(a.id))
 AND ((p_surface='meta_business_suite' AND (a.action_type IN ('reply_inbound','close_sale') OR public.ig_mbs_free_zoom_invite_eligible(a) OR public.ig_mbs_review_followup_eligible(a) OR public.ig_mbs_user_requested_checkin_eligible(a)))
 OR (p_surface='instagram' AND (a.action_type IN ('discovery_follow','feed_engagement','story_reply','reply_external_comment','welcome_follower') OR public.ig_user_requested_checkin_eligible(a)))));
$function$;

CREATE OR REPLACE FUNCTION public.start_ig_browser_shift(p_run_id text, p_lane text, p_slot integer, p_cursor_start jsonb DEFAULT '{}'::jsonb, p_lease_seconds integer DEFAULT 300)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    v_surface text := p_cursor_start->'browser_surface'->>'kind';
    v_binding jsonb := p_cursor_start->'browser_surface';
    v_run public.ig_browser_shift_runs%ROWTYPE;
    v_active public.ig_browser_shift_runs%ROWTYPE;
    v_handoff public.ig_browser_shift_runs%ROWTYPE;
    v_handoff_found BOOLEAN := FALSE;
    v_base_run_id TEXT := regexp_replace(trim(coalesce(p_run_id, '')), '([:-])seg[0-9]+$', '');
    v_verified_native_actions INTEGER := 0;
    v_canonical_ids JSONB := '[]'::JSONB;
    v_lane_cursor JSONB := '{}'::JSONB;
    v_lease_seconds INTEGER := LEAST(GREATEST(COALESCE(p_lease_seconds, 300), 300), 300);
BEGIN
    IF NULLIF(trim(coalesce(p_run_id, '')), '') IS NULL THEN
        RAISE EXCEPTION 'run id is required';
    END IF;
    IF p_lane NOT IN (
        'story_nurture',
        'relationship_story_reactivation',
        'ranked_story_nurture',
        'story_viewer_nurture',
        'follower_notifications',
        'hot_lead_feed_nurture',
        'external_comment_and_mention_replies',
        'story_tray_discovery',
        'plant_based_discovery_follows',
        'missed_dm_audit',
        'active_client_instagram_community','personal_discovery_follows'
    ) THEN
        RAISE EXCEPTION 'invalid Instagram browser lane';
    END IF;
    IF p_slot IS NULL OR p_slot < 0 OR p_slot > 7 THEN
        RAISE EXCEPTION 'invalid Instagram browser slot';
    END IF;
    IF jsonb_typeof(COALESCE(p_cursor_start, '{}'::JSONB)) <> 'object' THEN
        RAISE EXCEPTION 'cursor_start must be a JSON object';
    END IF;

    IF NOT public.valid_ig_browser_surface(v_binding, p_lane) THEN
        RETURN jsonb_build_object('acquired',false,'reason','verified_surface_required');
    END IF;

    PERFORM pg_advisory_xact_lock(hashtextextended('ig_browser_shift_dispatcher', 0));

    SELECT * INTO v_run
    FROM public.ig_browser_shift_runs
    WHERE run_id = trim(p_run_id)
    FOR UPDATE;

    IF FOUND THEN
        RETURN jsonb_build_object(
            'acquired', v_run.status = 'running' AND v_run.lease_expires_at > NOW()
                AND v_run.browser_surface=v_surface AND v_run.browser_binding=v_binding,
            'idempotent', TRUE,
            'run', to_jsonb(v_run),
            'shift_state', jsonb_build_object(
                'base_run_id', v_run.base_run_id,
                'verified_native_actions', COALESCE((v_run.counts ->> 'verified_native_actions')::INTEGER, 0),
                'canonical_ids', v_run.canonical_ids
            )
        );
    END IF;

    UPDATE public.ig_browser_shift_runs
    SET
        status = 'interrupted',
        ended_at = COALESCE(ended_at, NOW()),
        receipt = receipt || jsonb_build_object(
            'interrupted_reason', 'lease_expired_before_finalization',
            'interrupted_at', NOW()
        )
    WHERE status = 'running'
      AND lease_expires_at <= NOW();

    SELECT * INTO v_active
    FROM public.ig_browser_shift_runs
    WHERE status = 'running'
      AND lease_expires_at > NOW()
      AND (browser_surface='legacy' OR public.ig_browser_coordination_scope(browser_surface,lane)=public.ig_browser_coordination_scope(v_surface,p_lane)
           OR (browser_binding->>'browser_id'=v_binding->>'browser_id'
               AND browser_binding->>'tab_id'=v_binding->>'tab_id'))
    LIMIT 1;

    IF FOUND THEN
        RETURN jsonb_build_object(
            'acquired', FALSE,
            'reason', 'active_shift_lease',
            'active_run', to_jsonb(v_active)
        );
    END IF;

    SELECT * INTO v_handoff
    FROM public.ig_browser_shift_runs
    WHERE lane = p_lane AND browser_surface=v_surface
    ORDER BY started_at DESC
    LIMIT 1;
    v_handoff_found := FOUND;

    v_lane_cursor := CASE
        WHEN v_handoff_found
             AND v_handoff.status IN ('partial', 'blocked', 'interrupted')
             AND COALESCE(v_handoff.next_resume ->> 'lane', p_lane) = p_lane
             AND v_handoff.next_resume <> '{}'::JSONB
            THEN v_handoff.next_resume
        WHEN v_handoff_found
             AND v_handoff.cursor_end ->> 'lane' = p_lane
            THEN v_handoff.cursor_end
        WHEN v_handoff_found
             AND v_handoff.cursor_current ->> 'lane' = p_lane
            THEN v_handoff.cursor_current
        ELSE COALESCE(p_cursor_start, '{}'::JSONB)
    END;

    v_lane_cursor := (
        COALESCE(v_lane_cursor, '{}'::JSONB)
        - 'verified_native_actions'
        - 'interaction_budget_remaining'
        - 'canonical_ids'
    ) || jsonb_build_object('lane', p_lane, 'slot', p_slot);

    -- The live tab binding always comes from fresh operator verification.
    v_lane_cursor := v_lane_cursor || jsonb_build_object('browser_surface',v_binding);

    SELECT COALESCE(MAX(
        CASE
            WHEN (counts ->> 'verified_native_actions') ~ '^[0-9]+$'
                THEN (counts ->> 'verified_native_actions')::INTEGER
            ELSE 0
        END
    ), 0)
    INTO v_verified_native_actions
    FROM public.ig_browser_shift_runs
    WHERE base_run_id = v_base_run_id;

    SELECT COALESCE(jsonb_agg(DISTINCT action_item), '[]'::JSONB)
    INTO v_canonical_ids
    FROM public.ig_browser_shift_runs r
    CROSS JOIN LATERAL jsonb_array_elements(r.canonical_ids) AS action_items(action_item)
    WHERE r.base_run_id = v_base_run_id;

    v_verified_native_actions := GREATEST(
        v_verified_native_actions,
        jsonb_array_length(v_canonical_ids)
    );

    INSERT INTO public.ig_browser_shift_runs (
        run_id,
        browser_surface,
        browser_binding,
        lane,
        slot,
        lease_expires_at,
        cursor_start,
        cursor_current,
        counts,
        canonical_ids,
        next_resume,
        receipt
    ) VALUES (
        trim(p_run_id),
        v_surface,
        v_binding,
        p_lane,
        p_slot,
        NOW() + make_interval(secs => v_lease_seconds),
        COALESCE(p_cursor_start, '{}'::JSONB),
        v_lane_cursor,
        jsonb_build_object('verified_native_actions', v_verified_native_actions),
        v_canonical_ids,
        '{}'::JSONB,
        jsonb_build_object(
            'handoff_from_run_id', CASE WHEN v_handoff_found THEN v_handoff.run_id ELSE NULL END,
            'handoff_from_status', CASE WHEN v_handoff_found THEN v_handoff.status ELSE NULL END,
            'handoff_is_same_base_shift', CASE WHEN v_handoff_found THEN v_handoff.base_run_id = v_base_run_id ELSE FALSE END,
            'lane_cursor_source', CASE
                WHEN v_handoff_found
                     AND v_handoff.status IN ('partial', 'blocked', 'interrupted')
                     AND COALESCE(v_handoff.next_resume ->> 'lane', p_lane) = p_lane
                     AND v_handoff.next_resume <> '{}'::JSONB THEN 'same_lane_partial_next_resume'
                WHEN v_handoff_found AND v_handoff.cursor_end ->> 'lane' = p_lane THEN 'same_lane_cursor_end'
                WHEN v_handoff_found AND v_handoff.cursor_current ->> 'lane' = p_lane THEN 'same_lane_cursor_current'
                ELSE 'provided_cursor_start'
            END
        )
    )
    RETURNING * INTO v_run;

    RETURN jsonb_build_object(
        'acquired', TRUE,
        'idempotent', FALSE,
        'run', to_jsonb(v_run),
        'handoff', CASE WHEN v_handoff.id IS NULL THEN NULL ELSE to_jsonb(v_handoff) END,
        'shift_state', jsonb_build_object(
            'base_run_id', v_base_run_id,
            'verified_native_actions', v_verified_native_actions,
            'canonical_ids', v_canonical_ids
        )
    );
END;
$function$;

CREATE OR REPLACE FUNCTION public.valid_ig_browser_surface(b jsonb, lane text)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
 IF b IS NULL OR jsonb_typeof(b)<>'object' OR nullif(b->>'browser_id','') IS NULL
 OR nullif(b->>'tab_id','') IS NULL OR b->>'account' IS DISTINCT FROM 'shan_n_sunny'
 OR coalesce(b->>'verified_at','')='' THEN RETURN false; END IF;
 IF (b->>'verified_at')::timestamptz < now()-interval '5 minutes'
 OR (b->>'verified_at')::timestamptz > now()+interval '30 seconds' THEN RETURN false; END IF;
 RETURN coalesce((b->>'kind'='meta_business_suite' AND lane='missed_dm_audit'
 AND b->>'page_id'='561122130919678' AND b->>'url' ~ '^https://business[.]facebook[.]com(/|$)')
 OR (b->>'kind'='instagram' AND lane IN ('plant_based_discovery_follows','active_client_instagram_community','personal_discovery_follows','follower_notifications')
 AND b->>'url' ~ '^https://(www[.])?instagram[.]com(/|$)'),false);
EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN RETURN false;
END $function$;


