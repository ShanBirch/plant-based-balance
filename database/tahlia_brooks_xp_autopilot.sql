-- Tahlia Brooks seeded XP autopilot
--
-- Creates a private daily XP plan for the seeded Tahlia Brooks account.
-- Supabase Cron checks the worker every minute. The worker only applies due
-- awards, so visible XP changes still happen 5-10 randomized times per
-- Brisbane day and only enough XP is applied to keep the day inside the
-- 30-75 XP target.

CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE TABLE IF NOT EXISTS private.seed_xp_automation_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_key TEXT NOT NULL UNIQUE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    timezone TEXT NOT NULL DEFAULT 'Australia/Brisbane',
    daily_min_xp INTEGER NOT NULL DEFAULT 30 CHECK (daily_min_xp >= 0),
    daily_max_xp INTEGER NOT NULL DEFAULT 75 CHECK (daily_max_xp >= daily_min_xp),
    min_awards_per_day INTEGER NOT NULL DEFAULT 5 CHECK (min_awards_per_day > 0),
    max_awards_per_day INTEGER NOT NULL DEFAULT 10 CHECK (max_awards_per_day >= min_awards_per_day),
    active_start TIME NOT NULL DEFAULT '06:10',
    active_end TIME NOT NULL DEFAULT '22:40',
    transaction_type TEXT NOT NULL DEFAULT 'seeded_challenge_bonus',
    reference_type TEXT NOT NULL DEFAULT 'tahlia_brooks_xp_autopilot',
    description TEXT NOT NULL DEFAULT '[Seeded challenge] Tahlia Brooks daily XP',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS private.seed_xp_daily_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_id UUID NOT NULL REFERENCES private.seed_xp_automation_rules(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    local_date DATE NOT NULL,
    target_xp INTEGER NOT NULL,
    award_count INTEGER NOT NULL,
    existing_xp_at_generation INTEGER NOT NULL DEFAULT 0,
    planned_award_xp INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (rule_id, local_date)
);

CREATE TABLE IF NOT EXISTS private.seed_xp_awards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id UUID NOT NULL REFERENCES private.seed_xp_daily_plans(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    award_index INTEGER NOT NULL,
    scheduled_for TIMESTAMPTZ NOT NULL,
    xp_amount INTEGER NOT NULL CHECK (xp_amount >= 0),
    applied_at TIMESTAMPTZ,
    point_transaction_id UUID REFERENCES public.point_transactions(id) ON DELETE SET NULL,
    skipped_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (plan_id, award_index)
);

CREATE INDEX IF NOT EXISTS idx_seed_xp_awards_due
    ON private.seed_xp_awards (scheduled_for)
    WHERE applied_at IS NULL AND skipped_reason IS NULL;

ALTER TABLE private.seed_xp_automation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.seed_xp_daily_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.seed_xp_awards ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE private.seed_xp_automation_rules FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE private.seed_xp_daily_plans FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE private.seed_xp_awards FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.seed_xp_for_local_date(
    p_user_id UUID,
    p_local_date DATE,
    p_timezone TEXT
)
RETURNS INTEGER
LANGUAGE sql
STABLE
SET search_path = public
AS $$
    SELECT COALESCE(SUM(pt.points_amount), 0)::INTEGER
    FROM public.point_transactions pt
    WHERE pt.user_id = p_user_id
      AND pt.points_amount > 0
      AND (pt.created_at AT TIME ZONE p_timezone)::DATE = p_local_date
$$;

CREATE OR REPLACE FUNCTION private.ensure_seed_xp_daily_plan(
    p_rule_key TEXT,
    p_now TIMESTAMPTZ DEFAULT NOW()
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = private, public, extensions
AS $$
DECLARE
    v_rule RECORD;
    v_plan_id UUID;
    v_local_date DATE;
    v_existing_xp INTEGER;
    v_target_xp INTEGER;
    v_award_count INTEGER;
    v_planned_xp INTEGER;
    v_amounts INTEGER[];
    v_remaining INTEGER;
    v_slot INTEGER;
    v_index INTEGER;
    v_start_ts TIMESTAMPTZ;
    v_end_ts TIMESTAMPTZ;
    v_span_minutes INTEGER;
    v_offset_minutes INTEGER;
    v_scheduled_for TIMESTAMPTZ;
BEGIN
    SELECT *
    INTO v_rule
    FROM private.seed_xp_automation_rules
    WHERE rule_key = p_rule_key
      AND enabled = TRUE;

    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    v_local_date := (p_now AT TIME ZONE v_rule.timezone)::DATE;

    SELECT id
    INTO v_plan_id
    FROM private.seed_xp_daily_plans
    WHERE rule_id = v_rule.id
      AND local_date = v_local_date;

    IF FOUND THEN
        RETURN v_plan_id;
    END IF;

    v_existing_xp := private.seed_xp_for_local_date(v_rule.user_id, v_local_date, v_rule.timezone);
    v_target_xp := FLOOR(v_rule.daily_min_xp + RANDOM() * (v_rule.daily_max_xp - v_rule.daily_min_xp + 1))::INTEGER;
    v_planned_xp := GREATEST(0, v_target_xp - v_existing_xp);
    v_award_count := FLOOR(v_rule.min_awards_per_day + RANDOM() * (v_rule.max_awards_per_day - v_rule.min_awards_per_day + 1))::INTEGER;

    IF v_planned_xp > 0 THEN
        v_award_count := LEAST(v_award_count, v_planned_xp);
    ELSE
        v_award_count := 0;
    END IF;

    INSERT INTO private.seed_xp_daily_plans (
        rule_id,
        user_id,
        local_date,
        target_xp,
        award_count,
        existing_xp_at_generation,
        planned_award_xp
    )
    VALUES (
        v_rule.id,
        v_rule.user_id,
        v_local_date,
        v_target_xp,
        v_award_count,
        v_existing_xp,
        v_planned_xp
    )
    RETURNING id INTO v_plan_id;

    IF v_award_count = 0 THEN
        RETURN v_plan_id;
    END IF;

    v_amounts := ARRAY_FILL(1, ARRAY[v_award_count]);
    v_remaining := v_planned_xp - v_award_count;

    WHILE v_remaining > 0 LOOP
        v_slot := FLOOR(1 + RANDOM() * v_award_count)::INTEGER;
        v_amounts[v_slot] := v_amounts[v_slot] + 1;
        v_remaining := v_remaining - 1;
    END LOOP;

    v_start_ts := (v_local_date::TIMESTAMP + v_rule.active_start) AT TIME ZONE v_rule.timezone;
    v_end_ts := (v_local_date::TIMESTAMP + v_rule.active_end) AT TIME ZONE v_rule.timezone;

    IF p_now > v_start_ts AND p_now < v_end_ts - INTERVAL '30 minutes' THEN
        v_start_ts := DATE_TRUNC('minute', p_now + INTERVAL '5 minutes');
    END IF;

    IF v_end_ts <= v_start_ts THEN
        v_end_ts := v_start_ts + INTERVAL '2 hours';
    END IF;

    v_span_minutes := GREATEST(1, FLOOR(EXTRACT(EPOCH FROM (v_end_ts - v_start_ts)) / 60)::INTEGER);

    FOR v_index IN 1..v_award_count LOOP
        v_offset_minutes := FLOOR(RANDOM() * v_span_minutes)::INTEGER;
        v_scheduled_for := v_start_ts + (v_offset_minutes || ' minutes')::INTERVAL;

        IF EXTRACT(MINUTE FROM (v_scheduled_for AT TIME ZONE v_rule.timezone))::INTEGER = 0 THEN
            v_scheduled_for := v_scheduled_for + ((1 + FLOOR(RANDOM() * 9))::INTEGER || ' minutes')::INTERVAL;
        END IF;

        IF v_scheduled_for > v_end_ts THEN
            v_scheduled_for := v_end_ts - INTERVAL '3 minutes';
        END IF;

        INSERT INTO private.seed_xp_awards (
            plan_id,
            user_id,
            award_index,
            scheduled_for,
            xp_amount
        )
        VALUES (
            v_plan_id,
            v_rule.user_id,
            v_index,
            v_scheduled_for,
            v_amounts[v_index]
        );
    END LOOP;

    RETURN v_plan_id;
END;
$$;

CREATE OR REPLACE FUNCTION private.run_seed_xp_worker(
    p_rule_key TEXT DEFAULT 'tahlia_brooks_xp_autopilot',
    p_now TIMESTAMPTZ DEFAULT NOW()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = private, public, extensions
AS $$
DECLARE
    v_rule RECORD;
    v_plan_id UUID;
    v_award RECORD;
    v_day_total INTEGER;
    v_award_xp INTEGER;
    v_tx_id UUID;
    v_awarded INTEGER := 0;
    v_awarded_xp INTEGER := 0;
    v_skipped INTEGER := 0;
    v_due INTEGER := 0;
BEGIN
    IF NOT pg_try_advisory_xact_lock(HASHTEXT('seed_xp_worker:' || p_rule_key)) THEN
        RETURN jsonb_build_object('ok', TRUE, 'locked', TRUE, 'rule_key', p_rule_key);
    END IF;

    SELECT *
    INTO v_rule
    FROM private.seed_xp_automation_rules
    WHERE rule_key = p_rule_key
      AND enabled = TRUE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', FALSE, 'error', 'rule_not_found_or_disabled', 'rule_key', p_rule_key);
    END IF;

    v_plan_id := private.ensure_seed_xp_daily_plan(p_rule_key, p_now);

    FOR v_award IN
        SELECT a.*, p.target_xp, p.local_date, r.transaction_type, r.reference_type, r.description, r.timezone
        FROM private.seed_xp_awards a
        JOIN private.seed_xp_daily_plans p ON p.id = a.plan_id
        JOIN private.seed_xp_automation_rules r ON r.id = p.rule_id
        WHERE r.rule_key = p_rule_key
          AND a.applied_at IS NULL
          AND a.skipped_reason IS NULL
          AND a.scheduled_for <= p_now
        ORDER BY a.scheduled_for ASC
        LIMIT 20
        FOR UPDATE OF a SKIP LOCKED
    LOOP
        v_due := v_due + 1;
        v_day_total := private.seed_xp_for_local_date(v_award.user_id, v_award.local_date, v_award.timezone);
        v_award_xp := LEAST(v_award.xp_amount, GREATEST(0, v_award.target_xp - v_day_total));

        IF v_award_xp <= 0 THEN
            UPDATE private.seed_xp_awards
            SET skipped_reason = 'daily_target_already_met',
                applied_at = p_now,
                xp_amount = 0
            WHERE id = v_award.id;
            v_skipped := v_skipped + 1;
            CONTINUE;
        END IF;

        INSERT INTO public.point_transactions (
            user_id,
            transaction_type,
            points_amount,
            reference_id,
            reference_type,
            photo_verified,
            description,
            created_at
        )
        VALUES (
            v_award.user_id,
            v_award.transaction_type,
            v_award_xp,
            v_award.id,
            v_award.reference_type,
            FALSE,
            v_award.description,
            LEAST(v_award.scheduled_for, p_now)
        )
        RETURNING id INTO v_tx_id;

        PERFORM public.increment_user_points(v_award.user_id, v_award_xp);
        PERFORM public.update_challenge_participant_points(v_award.user_id);

        UPDATE private.seed_xp_awards
        SET applied_at = p_now,
            point_transaction_id = v_tx_id,
            xp_amount = v_award_xp
        WHERE id = v_award.id;

        v_awarded := v_awarded + 1;
        v_awarded_xp := v_awarded_xp + v_award_xp;
    END LOOP;

    RETURN jsonb_build_object(
        'ok', TRUE,
        'rule_key', p_rule_key,
        'plan_id', v_plan_id,
        'checked_at', p_now,
        'due', v_due,
        'awarded', v_awarded,
        'awarded_xp', v_awarded_xp,
        'skipped', v_skipped
    );
END;
$$;

REVOKE ALL ON FUNCTION private.seed_xp_for_local_date(UUID, DATE, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.ensure_seed_xp_daily_plan(TEXT, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.run_seed_xp_worker(TEXT, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.run_seed_xp_worker(TEXT, TIMESTAMPTZ) TO service_role;

INSERT INTO private.seed_xp_automation_rules (
    rule_key,
    user_id,
    daily_min_xp,
    daily_max_xp,
    min_awards_per_day,
    max_awards_per_day,
    active_start,
    active_end
)
SELECT
    'tahlia_brooks_xp_autopilot',
    u.id,
    30,
    75,
    5,
    10,
    '06:10'::TIME,
    '22:40'::TIME
FROM public.users u
WHERE u.email = 'seed.tahlia.brooks+kayla30@plantbased-balance.org'
ON CONFLICT (rule_key) DO UPDATE SET
    user_id = EXCLUDED.user_id,
    enabled = TRUE,
    daily_min_xp = EXCLUDED.daily_min_xp,
    daily_max_xp = EXCLUDED.daily_max_xp,
    min_awards_per_day = EXCLUDED.min_awards_per_day,
    max_awards_per_day = EXCLUDED.max_awards_per_day,
    active_start = EXCLUDED.active_start,
    active_end = EXCLUDED.active_end,
    updated_at = NOW();

SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'tahlia-brooks-xp-autopilot';

SELECT cron.schedule(
    'tahlia-brooks-xp-autopilot',
    '* * * * *',
    $$SELECT private.run_seed_xp_worker('tahlia_brooks_xp_autopilot');$$
);
