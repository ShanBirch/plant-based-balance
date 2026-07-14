-- A newer inbound interaction supersedes any earlier completed action for the
-- same person.  Keeping the old receipt here makes a fresh, ready action look
-- completed to the operator and can strand a reply indefinitely.
CREATE OR REPLACE FUNCTION public.upsert_ig_next_action(
    p_thread_id UUID,
    p_ig_username TEXT,
    p_lead_state TEXT,
    p_owner TEXT,
    p_action_type TEXT,
    p_priority INTEGER DEFAULT 0,
    p_due_at TIMESTAMPTZ DEFAULT NOW(),
    p_safe_after TIMESTAMPTZ DEFAULT NULL,
    p_reason JSONB DEFAULT '{}'::JSONB,
    p_source_message_id UUID DEFAULT NULL,
    p_supersede BOOLEAN DEFAULT FALSE
)
RETURNS public.ig_next_actions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_subject_key TEXT := public.ig_next_action_subject_key(p_thread_id, p_ig_username);
    v_existing public.ig_next_actions%ROWTYPE;
    v_result public.ig_next_actions%ROWTYPE;
BEGIN
    IF p_thread_id IS NULL AND NULLIF(trim(coalesce(p_ig_username, '')), '') IS NULL THEN
        RAISE EXCEPTION 'an Instagram thread or handle is required';
    END IF;

    SELECT * INTO v_existing
    FROM public.ig_next_actions
    WHERE subject_key = v_subject_key
       OR (p_thread_id IS NOT NULL AND thread_id = p_thread_id)
    ORDER BY CASE WHEN subject_key = v_subject_key THEN 0 ELSE 1 END
    LIMIT 1
    FOR UPDATE;

    IF FOUND AND NOT p_supersede THEN
        IF (v_existing.status = 'claimed' AND v_existing.claim_expires_at > NOW())
            OR (v_existing.status = 'cooldown' AND v_existing.safe_after > NOW())
            OR (v_existing.status IN ('ready', 'waiting', 'needs_you', 'blocked')
                AND v_existing.action_type <> p_action_type) THEN
            RETURN v_existing;
        END IF;
    END IF;

    IF FOUND THEN
        UPDATE public.ig_next_actions
        SET
            thread_id = COALESCE(p_thread_id, v_existing.thread_id),
            ig_username = COALESCE(NULLIF(trim(p_ig_username), ''), v_existing.ig_username),
            lead_state = COALESCE(NULLIF(trim(p_lead_state), ''), v_existing.lead_state),
            owner = p_owner,
            status = 'ready',
            action_type = p_action_type,
            priority = GREATEST(0, LEAST(COALESCE(p_priority, 0), 10000)),
            due_at = COALESCE(p_due_at, NOW()),
            safe_after = p_safe_after,
            source_message_id = COALESCE(p_source_message_id, v_existing.source_message_id),
            reason = COALESCE(p_reason, '{}'::JSONB),
            claim_owner = NULL,
            claim_token = NULL,
            claim_run_id = NULL,
            claim_expires_at = NULL,
            completed_at = NULL,
            receipt = CASE WHEN p_supersede THEN '{}'::JSONB ELSE v_existing.receipt END,
            action_version = v_existing.action_version + 1
        WHERE id = v_existing.id
        RETURNING * INTO v_result;
    ELSE
        INSERT INTO public.ig_next_actions (
            subject_key, thread_id, ig_username, lead_state, owner, status,
            action_type, priority, due_at, safe_after, source_message_id, reason
        ) VALUES (
            v_subject_key, p_thread_id, NULLIF(trim(p_ig_username), ''),
            COALESCE(NULLIF(trim(p_lead_state), ''), 'new'), p_owner, 'ready',
            p_action_type, GREATEST(0, LEAST(COALESCE(p_priority, 0), 10000)),
            COALESCE(p_due_at, NOW()), p_safe_after, p_source_message_id,
            COALESCE(p_reason, '{}'::JSONB)
        )
        RETURNING * INTO v_result;
    END IF;

    RETURN v_result;
END;
$$;
