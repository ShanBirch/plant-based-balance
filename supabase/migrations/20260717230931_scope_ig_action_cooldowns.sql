-- Scope queue cooldowns to the surface that created them. ig_next_actions keeps
-- one current instruction per Instagram person, so an unrelated completed
-- feed cooldown must not prevent a Story, follower, or DM action from becoming
-- the current instruction. Active ownership and explicit global pauses still
-- win. The receipt archive trigger preserves the replaced instruction.
CREATE OR REPLACE FUNCTION public.upsert_ig_next_action(
    p_thread_id uuid,
    p_ig_username text,
    p_lead_state text,
    p_owner text,
    p_action_type text,
    p_priority integer DEFAULT 0,
    p_due_at timestamptz DEFAULT now(),
    p_safe_after timestamptz DEFAULT NULL,
    p_reason jsonb DEFAULT '{}'::jsonb,
    p_source_message_id uuid DEFAULT NULL,
    p_supersede boolean DEFAULT false
)
RETURNS public.ig_next_actions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    v_subject_key text := public.ig_next_action_subject_key(p_thread_id, p_ig_username);
    v_existing public.ig_next_actions%ROWTYPE;
    v_result public.ig_next_actions%ROWTYPE;
    v_new_scope text := coalesce(
        nullif(trim(coalesce(p_reason->>'cooldown_scope', '')), ''),
        CASE p_action_type
            WHEN 'story_reply' THEN 'story'
            WHEN 'feed_engagement' THEN 'feed'
            WHEN 'discovery_follow' THEN 'follow'
            WHEN 'welcome_follower' THEN 'welcome'
            WHEN 'reply_external_comment' THEN 'external_comment'
            WHEN 'reply_inbound' THEN 'dm'
            WHEN 'close_sale' THEN 'dm_sales'
            WHEN 'send_checkout' THEN 'dm_sales'
            WHEN 'book_call' THEN 'dm_sales'
            WHEN 'reactivation' THEN 'dm_sales'
            ELSE coalesce(nullif(trim(p_owner), ''), 'unknown') || ':' || p_action_type
        END
    );
    v_existing_scope text;
    v_reason jsonb;
BEGIN
    IF p_thread_id IS NULL AND NULLIF(trim(coalesce(p_ig_username, '')), '') IS NULL THEN
        RAISE EXCEPTION 'an Instagram thread or handle is required';
    END IF;

    v_reason := coalesce(p_reason, '{}'::jsonb)
        || jsonb_build_object('cooldown_scope', v_new_scope);

    SELECT * INTO v_existing
    FROM public.ig_next_actions
    WHERE subject_key = v_subject_key
       OR (p_thread_id IS NOT NULL AND thread_id = p_thread_id)
    ORDER BY CASE WHEN subject_key = v_subject_key THEN 0 ELSE 1 END
    LIMIT 1
    FOR UPDATE;

    IF FOUND THEN
        v_existing_scope := coalesce(
            nullif(trim(coalesce(v_existing.reason->>'cooldown_scope', '')), ''),
            CASE v_existing.action_type
                WHEN 'story_reply' THEN 'story'
                WHEN 'feed_engagement' THEN 'feed'
                WHEN 'discovery_follow' THEN 'follow'
                WHEN 'welcome_follower' THEN 'welcome'
                WHEN 'reply_external_comment' THEN 'external_comment'
                WHEN 'reply_inbound' THEN 'dm'
                WHEN 'close_sale' THEN 'dm_sales'
                WHEN 'send_checkout' THEN 'dm_sales'
                WHEN 'book_call' THEN 'dm_sales'
                WHEN 'reactivation' THEN 'dm_sales'
                ELSE coalesce(nullif(trim(v_existing.owner), ''), 'unknown')
                    || ':' || v_existing.action_type
            END
        );
    END IF;

    IF FOUND AND NOT p_supersede THEN
        IF (v_existing.status = 'claimed' AND v_existing.claim_expires_at > now())
            OR (
                v_existing.status = 'cooldown'
                AND v_existing.safe_after > now()
                AND (v_existing_scope = 'global_proactive' OR v_existing_scope = v_new_scope)
            )
            OR (
                v_existing.status IN ('ready', 'waiting', 'needs_you', 'blocked')
                AND v_existing.action_type <> p_action_type
            ) THEN
            RETURN v_existing;
        END IF;
    END IF;

    IF FOUND THEN
        UPDATE public.ig_next_actions
        SET
            thread_id = coalesce(p_thread_id, v_existing.thread_id),
            ig_username = coalesce(NULLIF(trim(p_ig_username), ''), v_existing.ig_username),
            lead_state = coalesce(NULLIF(trim(p_lead_state), ''), v_existing.lead_state),
            owner = p_owner,
            status = 'ready',
            action_type = p_action_type,
            priority = greatest(0, least(coalesce(p_priority, 0), 10000)),
            due_at = coalesce(p_due_at, now()),
            safe_after = p_safe_after,
            source_message_id = coalesce(p_source_message_id, v_existing.source_message_id),
            reason = v_reason,
            claim_owner = NULL,
            claim_token = NULL,
            claim_run_id = NULL,
            claim_expires_at = NULL,
            completed_at = NULL,
            receipt = '{}'::jsonb,
            action_version = v_existing.action_version + 1
        WHERE id = v_existing.id
        RETURNING * INTO v_result;
    ELSE
        INSERT INTO public.ig_next_actions (
            subject_key, thread_id, ig_username, lead_state, owner, status,
            action_type, priority, due_at, safe_after, source_message_id, reason
        ) VALUES (
            v_subject_key, p_thread_id, NULLIF(trim(p_ig_username), ''),
            coalesce(NULLIF(trim(p_lead_state), ''), 'new'), p_owner, 'ready',
            p_action_type, greatest(0, least(coalesce(p_priority, 0), 10000)),
            coalesce(p_due_at, now()), p_safe_after, p_source_message_id,
            v_reason
        )
        RETURNING * INTO v_result;
    END IF;

    RETURN v_result;
END;
$function$;

COMMENT ON FUNCTION public.upsert_ig_next_action(
    uuid,text,text,text,text,integer,timestamptz,timestamptz,jsonb,uuid,boolean
)
IS 'Upserts the single current Instagram instruction. Cooldowns block only their own surface scope or an explicit global_proactive scope; active ownership still blocks competing actions.';

-- Backfill explicit scope metadata so operators never infer global blocking from
-- safe_after alone. Terminal safe_after timestamps remain historical evidence
-- and do not block a different surface.
UPDATE public.ig_next_actions
SET reason = coalesce(reason, '{}'::jsonb) || jsonb_build_object(
    'cooldown_scope',
    CASE action_type
        WHEN 'story_reply' THEN 'story'
        WHEN 'feed_engagement' THEN 'feed'
        WHEN 'discovery_follow' THEN 'follow'
        WHEN 'welcome_follower' THEN 'welcome'
        WHEN 'reply_external_comment' THEN 'external_comment'
        WHEN 'reply_inbound' THEN 'dm'
        WHEN 'close_sale' THEN 'dm_sales'
        WHEN 'send_checkout' THEN 'dm_sales'
        WHEN 'book_call' THEN 'dm_sales'
        WHEN 'reactivation' THEN 'dm_sales'
        ELSE coalesce(nullif(trim(owner), ''), 'unknown') || ':' || action_type
    END
)
WHERE nullif(trim(coalesce(reason->>'cooldown_scope', '')), '') IS NULL;
