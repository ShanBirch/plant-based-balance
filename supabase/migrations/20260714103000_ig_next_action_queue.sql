-- The traffic controller for Instagram relationships.
--
-- `ig_messages` is the factual conversation record and `ig_threads` is the
-- relationship record.  This table deliberately holds only the one current,
-- operational instruction for a person.  Server-side operators claim a short
-- lease before acting, then attach a receipt or a cooldown when they finish.

CREATE TABLE IF NOT EXISTS public.ig_next_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- `ig:<handle>` when we know the Instagram handle, otherwise
    -- `thread:<uuid>`.  A story lead can therefore be protected before an IG
    -- DM thread exists, and an inbound DM later supersedes that same action.
    subject_key TEXT NOT NULL UNIQUE,
    thread_id UUID UNIQUE REFERENCES public.ig_threads(id) ON DELETE CASCADE,
    ig_username TEXT,
    lead_state TEXT NOT NULL DEFAULT 'new',
    owner TEXT NOT NULL DEFAULT 'none',
    status TEXT NOT NULL DEFAULT 'ready',
    action_type TEXT NOT NULL DEFAULT 'wait',
    priority INTEGER NOT NULL DEFAULT 0,
    due_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    safe_after TIMESTAMPTZ,
    source_message_id UUID REFERENCES public.ig_messages(id) ON DELETE SET NULL,
    reason JSONB NOT NULL DEFAULT '{}'::JSONB,
    claim_owner TEXT,
    claim_token UUID,
    claim_run_id TEXT,
    claim_expires_at TIMESTAMPTZ,
    action_version INTEGER NOT NULL DEFAULT 1,
    receipt JSONB NOT NULL DEFAULT '{}'::JSONB,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ig_next_actions_subject_key_not_blank CHECK (length(trim(subject_key)) > 0),
    CONSTRAINT ig_next_actions_owner_check CHECK (owner IN (
        'none', 'dm_manager', 'story_operator', 'external_comment_operator',
        'follower_operator', 'feed_operator', 'discovery_operator',
        'onboarding', 'manual'
    )),
    CONSTRAINT ig_next_actions_status_check CHECK (status IN (
        'ready', 'claimed', 'waiting', 'cooldown', 'needs_you',
        'completed', 'cancelled', 'blocked'
    )),
    CONSTRAINT ig_next_actions_type_check CHECK (action_type IN (
        'reply_inbound', 'close_sale', 'book_call', 'send_checkout',
        'onboard_paid_member', 'story_reply', 'reply_external_comment',
        'welcome_follower', 'feed_engagement', 'discovery_follow',
        'reactivation', 'wait', 'no_action'
    )),
    CONSTRAINT ig_next_actions_claim_check CHECK (
        status <> 'claimed' OR (claim_owner IS NOT NULL AND claim_token IS NOT NULL AND claim_expires_at IS NOT NULL)
    ),
    CONSTRAINT ig_next_actions_priority_check CHECK (priority BETWEEN 0 AND 10000)
);

CREATE INDEX IF NOT EXISTS idx_ig_next_actions_claimable
    ON public.ig_next_actions (owner, priority DESC, due_at ASC, safe_after ASC)
    WHERE status IN ('ready', 'claimed', 'cooldown');

CREATE INDEX IF NOT EXISTS idx_ig_next_actions_thread
    ON public.ig_next_actions (thread_id)
    WHERE thread_id IS NOT NULL;

DROP TRIGGER IF EXISTS trg_ig_next_actions_updated_at ON public.ig_next_actions;
CREATE TRIGGER trg_ig_next_actions_updated_at
    BEFORE UPDATE ON public.ig_next_actions
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.ig_next_actions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.ig_next_actions FROM PUBLIC, anon, authenticated;

-- Normalise the identity in one place. Handles are case-insensitive on IG.
CREATE OR REPLACE FUNCTION public.ig_next_action_subject_key(
    p_thread_id UUID,
    p_ig_username TEXT
)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
    SELECT CASE
        WHEN NULLIF(regexp_replace(lower(trim(coalesce(p_ig_username, ''))), '^@+', ''), '') IS NOT NULL
            THEN 'ig:' || regexp_replace(lower(trim(p_ig_username)), '^@+', '')
        ELSE 'thread:' || coalesce(p_thread_id::TEXT, '')
    END;
$$;

-- Upsert an operational instruction. Non-forced calls respect a currently
-- claimed action and an active cooldown. Inbound replies pass `true` for
-- p_supersede: a live inbound always wins over an old outreach task.
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

-- Atomically claim only safe, due work. SKIP LOCKED means two scheduled
-- operators can run at the same time without receiving the same person.
CREATE OR REPLACE FUNCTION public.claim_ig_next_actions(
    p_owner TEXT,
    p_limit INTEGER DEFAULT 20,
    p_lease_seconds INTEGER DEFAULT 900,
    p_run_id TEXT DEFAULT NULL,
    p_thread_ids UUID[] DEFAULT NULL
)
RETURNS SETOF public.ig_next_actions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF p_owner NOT IN (
        'dm_manager', 'story_operator', 'external_comment_operator',
        'follower_operator', 'feed_operator', 'discovery_operator',
        'onboarding', 'manual'
    ) THEN
        RAISE EXCEPTION 'invalid queue owner';
    END IF;

    RETURN QUERY
    WITH candidates AS (
        SELECT q.id
        FROM public.ig_next_actions q
        WHERE q.owner = p_owner
          AND (p_thread_ids IS NULL OR q.thread_id = ANY(p_thread_ids))
          AND q.due_at <= NOW()
          AND COALESCE(q.safe_after, '-infinity'::TIMESTAMPTZ) <= NOW()
          AND (
              q.status = 'ready'
              OR (q.status = 'claimed' AND q.claim_expires_at <= NOW())
              OR (q.status = 'cooldown' AND q.safe_after <= NOW())
          )
        ORDER BY q.priority DESC, q.due_at ASC, q.created_at ASC
        LIMIT LEAST(GREATEST(COALESCE(p_limit, 20), 1), 100)
        FOR UPDATE SKIP LOCKED
    )
    UPDATE public.ig_next_actions q
    SET
        status = 'claimed',
        claim_owner = p_owner,
        claim_token = gen_random_uuid(),
        claim_run_id = NULLIF(trim(p_run_id), ''),
        claim_expires_at = NOW() + make_interval(secs => LEAST(GREATEST(COALESCE(p_lease_seconds, 900), 60), 7200))
    FROM candidates c
    WHERE q.id = c.id
    RETURNING q.*;
END;
$$;

-- An operator can only complete the precise lease it claimed. Completing a
-- Story reply or feed engagement applies the business cooldown even if a
-- caller accidentally sends a shorter one.
CREATE OR REPLACE FUNCTION public.complete_ig_next_action(
    p_action_id UUID,
    p_claim_token UUID,
    p_status TEXT DEFAULT 'waiting',
    p_safe_after TIMESTAMPTZ DEFAULT NULL,
    p_receipt JSONB DEFAULT '{}'::JSONB
)
RETURNS public.ig_next_actions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_existing public.ig_next_actions%ROWTYPE;
    v_status TEXT := lower(trim(coalesce(p_status, 'waiting')));
    v_safe_after TIMESTAMPTZ := p_safe_after;
    v_result public.ig_next_actions%ROWTYPE;
BEGIN
    SELECT * INTO v_existing
    FROM public.ig_next_actions
    WHERE id = p_action_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'queue action not found';
    END IF;
    IF v_existing.status <> 'claimed'
       OR v_existing.claim_token IS DISTINCT FROM p_claim_token
       OR v_existing.claim_expires_at <= NOW() THEN
        RAISE EXCEPTION 'queue action is not claimed by this lease';
    END IF;
    IF v_status NOT IN ('waiting', 'cooldown', 'completed', 'cancelled', 'blocked', 'needs_you') THEN
        RAISE EXCEPTION 'invalid completion status';
    END IF;

    IF v_existing.action_type = 'story_reply' THEN
        v_status := 'cooldown';
        v_safe_after := GREATEST(COALESCE(v_safe_after, NOW()), NOW() + INTERVAL '24 hours');
    ELSIF v_existing.action_type = 'feed_engagement' THEN
        v_status := 'cooldown';
        v_safe_after := GREATEST(COALESCE(v_safe_after, NOW()), NOW() + INTERVAL '7 days');
    END IF;

    UPDATE public.ig_next_actions
    SET
        status = v_status,
        safe_after = v_safe_after,
        receipt = COALESCE(v_existing.receipt, '{}'::JSONB)
            || COALESCE(p_receipt, '{}'::JSONB)
            || jsonb_build_object('completed_at', NOW(), 'claim_run_id', v_existing.claim_run_id),
        claim_owner = NULL,
        claim_token = NULL,
        claim_run_id = NULL,
        claim_expires_at = NULL,
        completed_at = NOW()
    WHERE id = v_existing.id
    RETURNING * INTO v_result;

    RETURN v_result;
END;
$$;

-- Every inbound IG DM supersedes outreach immediately. Sales/call language is
-- made urgent for the DM manager; it is never held in Needs You waiting for
-- Shannon to notice it.
CREATE OR REPLACE FUNCTION public.route_ig_inbound_to_next_action()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_thread public.ig_threads%ROWTYPE;
    v_text TEXT := lower(trim(coalesce(NEW.text, '')));
    v_action_type TEXT := 'reply_inbound';
    v_priority INTEGER := 800;
    v_lead_state TEXT;
BEGIN
    IF lower(coalesce(NEW.direction, '')) <> 'in' THEN
        RETURN NEW;
    END IF;

    SELECT * INTO v_thread FROM public.ig_threads WHERE id = NEW.thread_id;
    IF NOT FOUND OR lower(coalesce(v_thread.channel, '')) <> 'instagram' THEN
        RETURN NEW;
    END IF;

    v_lead_state := CASE
        WHEN v_thread.linked_user_id IS NOT NULL OR v_thread.lead_stage IN ('in_app', 'paying') THEN 'client'
        ELSE COALESCE(NULLIF(v_thread.lead_stage, ''), 'new')
    END;

    IF v_text ~ '\m(book|booking|call|chat)\M' THEN
        v_action_type := 'book_call';
        v_priority := 1000;
    ELSIF v_text ~ '\m(price|cost|how much|sign up|signup|join|start|link|ready|coaching)\M' THEN
        v_action_type := 'close_sale';
        v_priority := 950;
    END IF;

    PERFORM public.upsert_ig_next_action(
        NEW.thread_id,
        v_thread.ig_username,
        v_lead_state,
        'dm_manager',
        v_action_type,
        v_priority,
        NOW(),
        NOW(),
        jsonb_build_object(
            'source', 'ig_messages_inbound',
            'why', CASE
                WHEN v_action_type = 'book_call' THEN 'Inbound call-booking intent'
                WHEN v_action_type = 'close_sale' THEN 'Inbound buying intent'
                ELSE 'Inbound Instagram DM needs a reply'
            END,
            'message_preview', left(coalesce(NEW.text, ''), 300)
        ),
        NEW.id,
        TRUE
    );
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ig_inbound_next_action ON public.ig_messages;
CREATE TRIGGER trg_ig_inbound_next_action
    AFTER INSERT ON public.ig_messages
    FOR EACH ROW EXECUTE FUNCTION public.route_ig_inbound_to_next_action();

-- Seed currently unanswered Instagram conversations from the existing
-- snapshot. This is deliberately limited to the seven-day DM audit window;
-- it creates work but never sends anything during the migration.
INSERT INTO public.ig_next_actions (
    subject_key, thread_id, ig_username, lead_state, owner, status,
    action_type, priority, due_at, safe_after, reason
)
SELECT
    public.ig_next_action_subject_key(s.thread_id, s.ig_username),
    s.thread_id,
    s.ig_username,
    CASE WHEN s.relationship_kind = 'client' THEN 'client' ELSE coalesce(nullif(s.lead_stage, ''), 'new') END,
    'dm_manager',
    'ready',
    'reply_inbound',
    CASE WHEN s.engagement_temperature = 'hot' THEN 850 ELSE 800 END,
    NOW(),
    NOW(),
    jsonb_build_object('source', 'seven_day_backfill', 'why', 'Recent inbound IG DM has no later outbound reply')
FROM public.ig_thread_engagement_snapshot s
WHERE s.channel = 'instagram'
  AND s.open_dm_needs_reply = TRUE
  AND s.last_inbound_at >= NOW() - INTERVAL '7 days'
ON CONFLICT (subject_key) DO NOTHING;

REVOKE ALL ON FUNCTION public.upsert_ig_next_action(UUID, TEXT, TEXT, TEXT, TEXT, INTEGER, TIMESTAMPTZ, TIMESTAMPTZ, JSONB, UUID, BOOLEAN) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_ig_next_actions(TEXT, INTEGER, INTEGER, TEXT, UUID[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_ig_next_action(UUID, UUID, TEXT, TIMESTAMPTZ, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_ig_next_action(UUID, TEXT, TEXT, TEXT, TEXT, INTEGER, TIMESTAMPTZ, TIMESTAMPTZ, JSONB, UUID, BOOLEAN) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_ig_next_actions(TEXT, INTEGER, INTEGER, TEXT, UUID[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_ig_next_action(UUID, UUID, TEXT, TIMESTAMPTZ, JSONB) TO service_role;

COMMENT ON TABLE public.ig_next_actions IS
    'One current, claimable next action per Instagram person. Server operators use the RPC functions; no browser role has direct access.';
