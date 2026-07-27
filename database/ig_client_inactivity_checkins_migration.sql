-- Native Instagram inactivity check-ins for current Balance clients.
--
-- The browser dispatcher, not the app or Graph API, owns these proactive
-- check-ins. A series has at most three verified sends at 3, 7, and 14 days
-- without a login. First touches never start after day 7, so enabling this
-- migration cannot chase long-dormant historical clients.

ALTER TABLE public.ig_next_actions
    DROP CONSTRAINT IF EXISTS ig_next_actions_type_check;

ALTER TABLE public.ig_next_actions
    ADD CONSTRAINT ig_next_actions_type_check CHECK (action_type = ANY (ARRAY[
        'reply_inbound'::TEXT,
        'close_sale'::TEXT,
        'book_call'::TEXT,
        'send_checkout'::TEXT,
        'onboard_paid_member'::TEXT,
        'story_reply'::TEXT,
        'reply_external_comment'::TEXT,
        'welcome_follower'::TEXT,
        'feed_engagement'::TEXT,
        'discovery_follow'::TEXT,
        'reactivation'::TEXT,
        'client_inactivity_checkin'::TEXT,
        'wait'::TEXT,
        'no_action'::TEXT
    ]));

CREATE OR REPLACE FUNCTION public.ig_client_checkin_delivery_time(
    p_candidate TIMESTAMPTZ
)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
    v_local TIMESTAMP := p_candidate AT TIME ZONE 'Australia/Brisbane';
    v_date DATE := v_local::DATE;
    v_dow INTEGER := EXTRACT(DOW FROM v_local)::INTEGER;
    v_time TIME := v_local::TIME;
BEGIN
    -- Weekend-due check-ins wait until 9:00am Monday Brisbane time.
    IF v_dow = 6 THEN
        v_local := (v_date + 2) + TIME '09:00';
    ELSIF v_dow = 0 THEN
        v_local := (v_date + 1) + TIME '09:00';
    ELSIF v_time < TIME '08:30' THEN
        v_local := v_date + TIME '08:30';
    ELSIF v_time > TIME '18:30' THEN
        v_local := (v_date + 1) + TIME '08:30';
        v_dow := EXTRACT(DOW FROM v_local)::INTEGER;
        IF v_dow = 6 THEN
            v_local := (v_local::DATE + 2) + TIME '09:00';
        ELSIF v_dow = 0 THEN
            v_local := (v_local::DATE + 1) + TIME '09:00';
        END IF;
    END IF;

    RETURN v_local AT TIME ZONE 'Australia/Brisbane';
END;
$$;

REVOKE ALL ON FUNCTION public.ig_client_checkin_delivery_time(TIMESTAMPTZ)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ig_client_checkin_delivery_time(TIMESTAMPTZ)
    TO service_role;

CREATE OR REPLACE FUNCTION public.refresh_ig_client_inactivity_checkins(
    p_limit INTEGER DEFAULT 20,
    p_now TIMESTAMPTZ DEFAULT NOW()
)
RETURNS SETOF public.ig_next_actions
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_candidate RECORD;
    v_existing public.ig_next_actions%ROWTYPE;
    v_result public.ig_next_actions%ROWTYPE;
    v_message TEXT;
BEGIN
    FOR v_candidate IN
        WITH active_assignments AS (
            SELECT
                cc.client_id,
                MIN(cc.assigned_at) AS assigned_at
            FROM public.coach_clients cc
            WHERE cc.status = 'active'
            GROUP BY cc.client_id
        ),
        active_challenge_clients AS (
            SELECT DISTINCT cp.user_id AS client_id
            FROM public.challenge_participants cp
            JOIN public.challenges ch ON ch.id = cp.challenge_id
            WHERE cp.status IN ('active', 'accepted', 'joined')
              AND ch.status = 'active'
              AND (ch.end_date IS NULL OR ch.end_date >= (p_now AT TIME ZONE 'Australia/Brisbane')::DATE)
        ),
        latest_instagram_thread AS (
            SELECT DISTINCT ON (t.linked_user_id)
                t.id AS thread_id,
                t.linked_user_id AS client_id,
                t.coach_id,
                t.ig_username,
                t.profile_name,
                t.last_inbound_at,
                t.last_outbound_at,
                COALESCE(t.custom_data, '{}'::JSONB) AS custom_data,
                t.updated_at
            FROM public.ig_threads t
            WHERE t.channel = 'instagram'
              AND t.linked_user_id IS NOT NULL
              AND NULLIF(TRIM(COALESCE(t.ig_username, '')), '') IS NOT NULL
            ORDER BY t.linked_user_id, t.updated_at DESC NULLS LAST, t.created_at DESC NULLS LAST
        ),
        client_base AS (
            SELECT
                u.id AS client_id,
                COALESCE(NULLIF(TRIM(u.name), ''), NULLIF(TRIM(i.profile_name), ''), i.ig_username, 'there') AS client_name,
                LOWER(i.ig_username) AS normalized_username,
                u.last_login,
                GREATEST(
                    COALESCE(u.last_login, '-infinity'::TIMESTAMPTZ),
                    COALESCE(a.assigned_at, '-infinity'::TIMESTAMPTZ),
                    COALESCE(u.created_at, '-infinity'::TIMESTAMPTZ)
                ) AS inactivity_anchor_at,
                i.thread_id,
                i.coach_id,
                i.ig_username,
                i.profile_name,
                i.last_inbound_at,
                i.last_outbound_at,
                i.custom_data,
                i.updated_at
            FROM public.users u
            JOIN latest_instagram_thread i ON i.client_id = u.id
            LEFT JOIN active_assignments a ON a.client_id = u.id
            LEFT JOIN active_challenge_clients ac ON ac.client_id = u.id
            WHERE NOT u.is_test_account
              AND (
                  a.client_id IS NOT NULL
                  OR ac.client_id IS NOT NULL
                  OR COALESCE(u.subscription_status, '') IN ('active', 'trialing')
              )
              AND LOWER(i.ig_username) NOT IN ('cavazzanafrancesca', 'lara_lessmann')
              AND COALESCE((i.custom_data ->> 'client_inactivity_auto_checkin_enabled')::BOOLEAN, TRUE)
              AND NOT COALESCE((i.custom_data ->> 'do_not_follow_up')::BOOLEAN, FALSE)
              AND NOT COALESCE((i.custom_data ->> 'blocked_by_shannon')::BOOLEAN, FALSE)
              AND NOT COALESCE((i.custom_data ->> 'auto_send_stopped')::BOOLEAN, FALSE)
              AND NOT COALESCE((i.custom_data ->> 'manual_review_only')::BOOLEAN, FALSE)
              AND COALESCE(
                  NULLIF(i.custom_data ->> 'client_inactivity_pause_until', '')::TIMESTAMPTZ,
                  '-infinity'::TIMESTAMPTZ
              ) <= p_now
        ),
        with_touch_history AS (
            SELECT
                b.*,
                COALESCE(h.touch_count, 0) AS touch_count,
                h.last_touch_at
            FROM client_base b
            LEFT JOIN LATERAL (
                SELECT
                    MAX((e.metadata ->> 'touch_number')::INTEGER) AS touch_count,
                    MAX(e.created_at) AS last_touch_at
                FROM public.conversion_operator_events e
                WHERE e.entity_kind = 'client'
                  AND e.action = 'check_in_done'
                  AND e.client_id = b.client_id
                  AND e.thread_id = b.thread_id
                  AND e.metadata ->> 'checkin_kind' = 'ig_client_inactivity'
                  AND NULLIF(e.metadata ->> 'inactivity_anchor_at', '')::TIMESTAMPTZ = b.inactivity_anchor_at
            ) h ON TRUE
        ),
        scheduled AS (
            SELECT
                h.*,
                h.touch_count + 1 AS touch_number,
                CASE h.touch_count
                    WHEN 0 THEN h.inactivity_anchor_at + INTERVAL '3 days'
                    WHEN 1 THEN GREATEST(
                        h.inactivity_anchor_at + INTERVAL '7 days',
                        h.last_touch_at + INTERVAL '72 hours'
                    )
                    WHEN 2 THEN GREATEST(
                        h.inactivity_anchor_at + INTERVAL '14 days',
                        h.last_touch_at + INTERVAL '72 hours'
                    )
                    ELSE 'infinity'::TIMESTAMPTZ
                END AS base_due_at
            FROM with_touch_history h
        ),
        due AS (
            SELECT
                s.*,
                GREATEST(
                    public.ig_client_checkin_delivery_time(s.base_due_at),
                    public.ig_client_checkin_delivery_time(p_now)
                ) AS delivery_at
            FROM scheduled s
            WHERE s.inactivity_anchor_at <> '-infinity'::TIMESTAMPTZ
              AND s.touch_count < 3
              AND s.base_due_at <= p_now
              -- Never start a new series for an already long-dormant client.
              AND (s.touch_count > 0 OR p_now < s.inactivity_anchor_at + INTERVAL '7 days')
              -- A client reply after an inactivity touch ends that series.
              AND (
                  s.touch_count = 0
                  OR s.last_inbound_at IS NULL
                  OR s.last_inbound_at <= s.last_touch_at
              )
              -- Never compete with an unanswered client conversation.
              AND (s.last_inbound_at IS NULL OR s.last_outbound_at >= s.last_inbound_at)
              -- Do not crowd any recent Instagram conversation or proactive touch.
              AND GREATEST(
                  COALESCE(s.last_inbound_at, '-infinity'::TIMESTAMPTZ),
                  COALESCE(s.last_outbound_at, '-infinity'::TIMESTAMPTZ)
              ) <= p_now - INTERVAL '72 hours'
        )
        SELECT *
        FROM due
        WHERE delivery_at <= p_now
        ORDER BY base_due_at ASC, inactivity_anchor_at ASC
        LIMIT LEAST(GREATEST(COALESCE(p_limit, 20), 1), 100)
    LOOP
        SELECT * INTO v_existing
        FROM public.ig_next_actions q
        WHERE q.thread_id = v_candidate.thread_id
        LIMIT 1;

        IF FOUND
           AND v_existing.action_type = 'client_inactivity_checkin'
           AND v_existing.owner = 'browser_dispatcher'
           AND v_existing.status IN ('ready', 'waiting', 'claimed')
           AND v_existing.reason ->> 'inactivity_anchor_at' = v_candidate.inactivity_anchor_at::TEXT
           AND (v_existing.reason ->> 'touch_number')::INTEGER = v_candidate.touch_number THEN
            RETURN NEXT v_existing;
            CONTINUE;
        END IF;

        IF FOUND AND (
            (v_existing.status = 'claimed' AND v_existing.claim_expires_at > p_now)
            OR v_existing.status IN ('ready', 'waiting', 'needs_you', 'blocked')
        ) THEN
            CONTINUE;
        END IF;

        v_message := CASE v_candidate.touch_number
            WHEN 1 THEN FORMAT(
                'hey %s, havent seen you in Balance for a few days. everything alright on your end?',
                LOWER(SPLIT_PART(v_candidate.client_name, ' ', 1))
            )
            WHEN 2 THEN FORMAT(
                'hey %s, reckon we make the restart stupidly simple this week? one workout and one food goal, thats it',
                LOWER(SPLIT_PART(v_candidate.client_name, ' ', 1))
            )
            ELSE FORMAT(
                'no stress if nows not the right time %s. ill leave the ball with you, but message me whenever you want to reset and ill help you get moving again',
                LOWER(SPLIT_PART(v_candidate.client_name, ' ', 1))
            )
        END;

        SELECT * INTO v_result
        FROM public.upsert_ig_next_action(
            p_thread_id => v_candidate.thread_id,
            p_ig_username => v_candidate.ig_username,
            p_lead_state => 'client',
            p_owner => 'browser_dispatcher',
            p_action_type => 'client_inactivity_checkin',
            p_priority => 880,
            p_due_at => v_candidate.delivery_at,
            p_safe_after => v_candidate.delivery_at,
            p_reason => jsonb_build_object(
                'source', 'ig_client_inactivity_checkin',
                'cooldown_scope', 'client_inactivity',
                'client_id', v_candidate.client_id,
                'client_name', v_candidate.client_name,
                'touch_number', v_candidate.touch_number,
                'inactivity_anchor_at', v_candidate.inactivity_anchor_at::TEXT,
                'last_login', v_candidate.last_login,
                'days_inactive', FLOOR(EXTRACT(EPOCH FROM (p_now - v_candidate.inactivity_anchor_at)) / 86400)::INTEGER,
                'suggested_text', v_message,
                'delivery_channel', 'instagram_native',
                'approval_required', FALSE,
                'app_delivery_forbidden', TRUE,
                'weekend_policy', 'defer_to_monday_0900_australia_brisbane'
            ),
            p_source_message_id => NULL,
            p_supersede => FALSE
        );

        IF v_result.owner = 'browser_dispatcher'
           AND v_result.action_type = 'client_inactivity_checkin' THEN
            RETURN NEXT v_result;
        END IF;
    END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_ig_client_inactivity_checkins(INTEGER, TIMESTAMPTZ)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_ig_client_inactivity_checkins(INTEGER, TIMESTAMPTZ)
    TO service_role;

CREATE OR REPLACE FUNCTION public.complete_ig_client_inactivity_checkin(
    p_action_id UUID,
    p_claim_token UUID,
    p_canonical_message_id UUID,
    p_sent_text TEXT,
    p_native_message_id TEXT DEFAULT NULL,
    p_run_id TEXT DEFAULT NULL,
    p_readback_at TIMESTAMPTZ DEFAULT NOW()
)
RETURNS public.ig_next_actions
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_action public.ig_next_actions%ROWTYPE;
    v_message public.ig_messages%ROWTYPE;
    v_thread public.ig_threads%ROWTYPE;
    v_result public.ig_next_actions%ROWTYPE;
    v_client_id UUID;
    v_coach_id UUID;
    v_touch_number INTEGER;
    v_anchor TIMESTAMPTZ;
    v_receipt JSONB;
BEGIN
    SELECT * INTO v_action
    FROM public.ig_next_actions
    WHERE id = p_action_id
    FOR UPDATE;

    IF NOT FOUND
       OR v_action.owner <> 'browser_dispatcher'
       OR v_action.action_type <> 'client_inactivity_checkin'
       OR v_action.status <> 'claimed'
       OR v_action.claim_token IS DISTINCT FROM p_claim_token
       OR v_action.claim_expires_at <= NOW() THEN
        RAISE EXCEPTION 'client inactivity action is not held by this browser lease';
    END IF;

    SELECT * INTO v_message
    FROM public.ig_messages m
    WHERE m.id = p_canonical_message_id
      AND m.thread_id = v_action.thread_id
      AND m.direction = 'out'
      AND TRIM(m.text) = TRIM(p_sent_text)
      AND m.created_at >= NOW() - INTERVAL '30 minutes';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'canonical Instagram outbound readback does not match this check-in';
    END IF;

    SELECT * INTO v_thread
    FROM public.ig_threads
    WHERE id = v_action.thread_id
    FOR UPDATE;

    v_client_id := v_thread.linked_user_id;
    v_coach_id := v_thread.coach_id;
    IF v_coach_id IS NULL THEN
        SELECT cc.coach_id INTO v_coach_id
        FROM public.coach_clients cc
        WHERE cc.client_id = v_client_id AND cc.status = 'active'
        ORDER BY cc.assigned_at DESC NULLS LAST
        LIMIT 1;
    END IF;

    IF v_client_id IS NULL OR v_coach_id IS NULL THEN
        RAISE EXCEPTION 'linked client and coach are required for an inactivity check-in';
    END IF;

    v_touch_number := (v_action.reason ->> 'touch_number')::INTEGER;
    v_anchor := (v_action.reason ->> 'inactivity_anchor_at')::TIMESTAMPTZ;
    IF v_touch_number NOT BETWEEN 1 AND 3 OR v_anchor IS NULL THEN
        RAISE EXCEPTION 'invalid inactivity series metadata';
    END IF;

    v_receipt := jsonb_build_object(
        'decision', 'sent_verified',
        'outcome', 'client_inactivity_checkin_sent',
        'native_verified', TRUE,
        'readback_verified', TRUE,
        'verified_action_count', 1,
        'client_id', v_client_id,
        'touch_number', v_touch_number,
        'inactivity_anchor_at', v_anchor,
        'sent_text', p_sent_text,
        'native_message_id', p_native_message_id,
        'canonical_message_id', p_canonical_message_id,
        'readback_at', p_readback_at,
        'run_id', p_run_id,
        'delivery_channel', 'instagram_native',
        'approval_required', FALSE,
        'app_delivery_used', FALSE
    );

    SELECT * INTO v_result
    FROM public.complete_ig_next_action(
        p_action_id,
        p_claim_token,
        'completed',
        NULL,
        v_receipt
    );

    INSERT INTO public.conversion_operator_events (
        coach_id,
        actor_id,
        entity_kind,
        thread_id,
        client_id,
        action,
        previous_lane,
        note,
        metadata
    )
    SELECT
        v_coach_id,
        v_coach_id,
        'client',
        v_action.thread_id,
        v_client_id,
        'check_in_done',
        'ig_client_inactivity',
        FORMAT('Instagram inactivity check-in %s of 3 sent', v_touch_number),
        jsonb_build_object(
            'checkin_kind', 'ig_client_inactivity',
            'action_id', v_action.id,
            'action_version', v_action.action_version,
            'touch_number', v_touch_number,
            'inactivity_anchor_at', v_anchor,
            'canonical_message_id', p_canonical_message_id,
            'native_message_id', p_native_message_id,
            'delivery_channel', 'instagram_native',
            'approval_required', FALSE,
            'app_delivery_used', FALSE,
            'verified_at', p_readback_at,
            'run_id', p_run_id
        )
    WHERE NOT EXISTS (
        SELECT 1
        FROM public.conversion_operator_events e
        WHERE e.action = 'check_in_done'
          AND e.entity_kind = 'client'
          AND e.metadata ->> 'checkin_kind' = 'ig_client_inactivity'
          AND e.metadata ->> 'action_id' = v_action.id::TEXT
          AND (e.metadata ->> 'action_version')::INTEGER = v_action.action_version
    );

    RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_ig_client_inactivity_checkin(
    UUID, UUID, UUID, TEXT, TEXT, TEXT, TIMESTAMPTZ
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_ig_client_inactivity_checkin(
    UUID, UUID, UUID, TEXT, TEXT, TEXT, TIMESTAMPTZ
) TO service_role;
