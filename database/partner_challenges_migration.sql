-- ============================================================
-- PARTNER CHALLENGES MIGRATION
-- 1v1 accountability challenges between friends
-- Types: meal streak, calorie target, workout streak, workout program
-- Modes: competitive (vs) or cooperative (together)
-- Run this in Supabase SQL Editor
-- ============================================================

-- ============================================================
-- PARTNER CHALLENGES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.partner_challenges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Participants
    challenger_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    opponent_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

    -- Challenge type
    challenge_type TEXT NOT NULL CHECK (challenge_type IN (
        'meal_streak',       -- Log at least N meals every day
        'calorie_target',    -- Hit calorie goal within tolerance each day
        'workout_streak',    -- Complete at least 1 workout every day
        'workout_program'    -- Both follow the same weekly program
    )),

    -- Mode: competitive = most days wins, cooperative = both must hit threshold
    mode TEXT NOT NULL DEFAULT 'competitive' CHECK (mode IN ('competitive', 'cooperative')),

    -- Timing
    duration_days INT NOT NULL DEFAULT 28 CHECK (duration_days >= 7),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,

    -- Coin wager (each player puts in this amount; winner takes all)
    coin_bet INT DEFAULT 0,

    -- Flexible target config per type
    -- meal_streak:    { "min_meals_per_day": 1 }
    -- calorie_target: { "tolerance_pct": 20 }
    -- workout_streak: { "min_workouts_per_day": 1 }
    -- workout_program: { "program_name": "Push Pull Legs", "days_per_week": 4 }
    target_config JSONB DEFAULT '{}',

    -- Status
    status TEXT DEFAULT 'pending' CHECK (status IN (
        'pending',     -- Waiting for opponent to accept
        'active',      -- In progress
        'completed',   -- Finished
        'declined',    -- Opponent declined
        'cancelled'    -- Creator cancelled
    )),

    -- Progress counters
    challenger_days_completed INT DEFAULT 0,
    opponent_days_completed INT DEFAULT 0,

    -- Winner (set on completion)
    winner_id UUID REFERENCES public.users(id),

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Constraints
    CONSTRAINT pc_valid_dates CHECK (end_date > start_date),
    CONSTRAINT pc_different_players CHECK (challenger_id != opponent_id)
);

-- ============================================================
-- PARTNER CHALLENGE DAILY PROGRESS
-- One row per user per day per challenge
-- ============================================================
CREATE TABLE IF NOT EXISTS public.partner_challenge_days (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    challenge_id UUID NOT NULL REFERENCES public.partner_challenges(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

    day_date DATE NOT NULL,
    completed BOOLEAN DEFAULT FALSE,

    -- Flexible details per type
    -- meal_streak:    { "meals_logged": 3 }
    -- calorie_target: { "calories": 1950, "goal": 2000, "within_target": true }
    -- workout_streak: { "workouts_completed": 1, "workout_names": ["Push Day"] }
    -- workout_program: { "scheduled": "Push Day", "completed": true }
    details JSONB DEFAULT '{}',

    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- One entry per user per day per challenge
    UNIQUE(challenge_id, user_id, day_date)
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_pc_challenger ON public.partner_challenges(challenger_id);
CREATE INDEX IF NOT EXISTS idx_pc_opponent ON public.partner_challenges(opponent_id);
CREATE INDEX IF NOT EXISTS idx_pc_status ON public.partner_challenges(status);
CREATE INDEX IF NOT EXISTS idx_pc_dates ON public.partner_challenges(start_date, end_date);

CREATE INDEX IF NOT EXISTS idx_pcd_challenge ON public.partner_challenge_days(challenge_id);
CREATE INDEX IF NOT EXISTS idx_pcd_user ON public.partner_challenge_days(user_id);
CREATE INDEX IF NOT EXISTS idx_pcd_date ON public.partner_challenge_days(day_date);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE public.partner_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_challenge_days ENABLE ROW LEVEL SECURITY;

-- Partner challenges: participants can view their own challenges
CREATE POLICY "Users can view own partner challenges" ON public.partner_challenges
    FOR SELECT USING (challenger_id = auth.uid() OR opponent_id = auth.uid());

-- Partner challenges: users can create
CREATE POLICY "Users can create partner challenges" ON public.partner_challenges
    FOR INSERT WITH CHECK (challenger_id = auth.uid());

-- Partner challenges: participants can update
CREATE POLICY "Participants can update partner challenges" ON public.partner_challenges
    FOR UPDATE USING (challenger_id = auth.uid() OR opponent_id = auth.uid());

-- Daily progress: participants can view
CREATE POLICY "Users can view challenge day progress" ON public.partner_challenge_days
    FOR SELECT USING (
        challenge_id IN (
            SELECT id FROM public.partner_challenges
            WHERE challenger_id = auth.uid() OR opponent_id = auth.uid()
        )
    );

-- Daily progress: users can insert/update their own
CREATE POLICY "Users can insert own day progress" ON public.partner_challenge_days
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own day progress" ON public.partner_challenge_days
    FOR UPDATE USING (user_id = auth.uid());

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- Create a partner challenge (debits coins from challenger)
CREATE OR REPLACE FUNCTION create_partner_challenge(
    p_challenger_id UUID,
    p_opponent_id UUID,
    p_challenge_type TEXT,
    p_mode TEXT,
    p_duration_days INT,
    p_start_date DATE,
    p_coin_bet INT,
    p_target_config JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
    challenge_id UUID;
    end_dt DATE;
BEGIN
    -- Calculate end date
    end_dt := p_start_date + p_duration_days;

    -- Debit coins from challenger if betting
    IF p_coin_bet > 0 THEN
        PERFORM debit_coins(
            p_challenger_id, p_coin_bet,
            'challenge_entry',
            'Partner challenge bet: ' || p_challenge_type,
            NULL
        );
    END IF;

    -- Insert challenge
    INSERT INTO public.partner_challenges (
        challenger_id, opponent_id, challenge_type, mode,
        duration_days, start_date, end_date,
        coin_bet, target_config, status
    ) VALUES (
        p_challenger_id, p_opponent_id, p_challenge_type, p_mode,
        p_duration_days, p_start_date, end_dt,
        p_coin_bet, p_target_config, 'pending'
    ) RETURNING id INTO challenge_id;

    RETURN challenge_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION create_partner_challenge(UUID, UUID, TEXT, TEXT, INT, DATE, INT, JSONB) TO authenticated;

-- Accept a partner challenge (debits coins from opponent, sets status to active)
CREATE OR REPLACE FUNCTION accept_partner_challenge(
    p_challenge_id UUID,
    p_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
    ch RECORD;
BEGIN
    -- Get challenge
    SELECT * INTO ch FROM public.partner_challenges
    WHERE id = p_challenge_id AND opponent_id = p_user_id AND status = 'pending';

    IF NOT FOUND THEN
        RETURN jsonb_build_object('error', 'not_found', 'message', 'Challenge not found or already responded');
    END IF;

    -- Debit coins from opponent if betting
    IF ch.coin_bet > 0 THEN
        DECLARE
            new_bal INT;
        BEGIN
            new_bal := debit_coins(
                p_user_id, ch.coin_bet,
                'challenge_entry',
                'Accepted partner challenge bet: ' || ch.challenge_type,
                p_challenge_id::TEXT
            );
            IF new_bal = -1 THEN
                RETURN jsonb_build_object('error', 'insufficient_coins', 'message', 'Not enough coins');
            END IF;
        END;
    END IF;

    -- Activate challenge
    UPDATE public.partner_challenges
    SET status = 'active', updated_at = NOW()
    WHERE id = p_challenge_id;

    RETURN jsonb_build_object(
        'success', TRUE,
        'challenge_type', ch.challenge_type,
        'duration_days', ch.duration_days,
        'coin_bet', ch.coin_bet
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION accept_partner_challenge(UUID, UUID) TO authenticated;

-- Decline a partner challenge (refunds challenger's coins)
CREATE OR REPLACE FUNCTION decline_partner_challenge(
    p_challenge_id UUID,
    p_user_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    ch RECORD;
BEGIN
    SELECT * INTO ch FROM public.partner_challenges
    WHERE id = p_challenge_id AND opponent_id = p_user_id AND status = 'pending';

    IF NOT FOUND THEN RETURN FALSE; END IF;

    -- Refund challenger's coins
    IF ch.coin_bet > 0 THEN
        PERFORM credit_coins(
            ch.challenger_id, ch.coin_bet,
            'refund',
            'Partner challenge declined - refund',
            p_challenge_id::TEXT
        );
    END IF;

    UPDATE public.partner_challenges
    SET status = 'declined', updated_at = NOW()
    WHERE id = p_challenge_id;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION decline_partner_challenge(UUID, UUID) TO authenticated;

-- Record daily progress for a partner challenge
CREATE OR REPLACE FUNCTION record_partner_challenge_day(
    p_challenge_id UUID,
    p_user_id UUID,
    p_day_date DATE,
    p_completed BOOLEAN,
    p_details JSONB DEFAULT '{}'
)
RETURNS JSONB AS $$
DECLARE
    ch RECORD;
    is_challenger BOOLEAN;
    days_count INT;
BEGIN
    -- Validate challenge is active and user is a participant
    SELECT * INTO ch FROM public.partner_challenges
    WHERE id = p_challenge_id AND status = 'active'
    AND (challenger_id = p_user_id OR opponent_id = p_user_id);

    IF NOT FOUND THEN
        RETURN jsonb_build_object('error', 'invalid', 'message', 'Challenge not active or user not participant');
    END IF;

    -- Check date is within challenge range
    IF p_day_date < ch.start_date OR p_day_date > ch.end_date THEN
        RETURN jsonb_build_object('error', 'out_of_range', 'message', 'Date is outside challenge period');
    END IF;

    is_challenger := (ch.challenger_id = p_user_id);

    -- Upsert the day record
    INSERT INTO public.partner_challenge_days (challenge_id, user_id, day_date, completed, details)
    VALUES (p_challenge_id, p_user_id, p_day_date, p_completed, p_details)
    ON CONFLICT (challenge_id, user_id, day_date)
    DO UPDATE SET completed = p_completed, details = p_details;

    -- Recalculate total days completed
    SELECT COUNT(*) INTO days_count
    FROM public.partner_challenge_days
    WHERE challenge_id = p_challenge_id AND user_id = p_user_id AND completed = TRUE;

    -- Update the counter
    IF is_challenger THEN
        UPDATE public.partner_challenges
        SET challenger_days_completed = days_count, updated_at = NOW()
        WHERE id = p_challenge_id;
    ELSE
        UPDATE public.partner_challenges
        SET opponent_days_completed = days_count, updated_at = NOW()
        WHERE id = p_challenge_id;
    END IF;

    RETURN jsonb_build_object('success', TRUE, 'days_completed', days_count);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION record_partner_challenge_day(UUID, UUID, DATE, BOOLEAN, JSONB) TO authenticated;

-- Complete a partner challenge and settle coins
CREATE OR REPLACE FUNCTION complete_partner_challenge(p_challenge_id UUID)
RETURNS JSONB AS $$
DECLARE
    ch RECORD;
    winner UUID;
    result_text TEXT;
BEGIN
    SELECT * INTO ch FROM public.partner_challenges
    WHERE id = p_challenge_id AND status = 'active';

    IF NOT FOUND THEN
        RETURN jsonb_build_object('error', 'not_found');
    END IF;

    -- Determine winner
    IF ch.mode = 'competitive' THEN
        -- Most days completed wins
        IF ch.challenger_days_completed > ch.opponent_days_completed THEN
            winner := ch.challenger_id;
            result_text := 'challenger_wins';
        ELSIF ch.opponent_days_completed > ch.challenger_days_completed THEN
            winner := ch.opponent_id;
            result_text := 'opponent_wins';
        ELSE
            winner := NULL;
            result_text := 'draw';
        END IF;
    ELSE
        -- Cooperative: both need 80%+ to share, otherwise highest wins
        DECLARE
            threshold INT := CEIL(ch.duration_days * 0.8);
            challenger_passed BOOLEAN := ch.challenger_days_completed >= threshold;
            opponent_passed BOOLEAN := ch.opponent_days_completed >= threshold;
        BEGIN
            IF challenger_passed AND opponent_passed THEN
                winner := NULL;
                result_text := 'both_win';
            ELSIF challenger_passed THEN
                winner := ch.challenger_id;
                result_text := 'challenger_wins';
            ELSIF opponent_passed THEN
                winner := ch.opponent_id;
                result_text := 'opponent_wins';
            ELSE
                winner := NULL;
                result_text := 'both_lose';
            END IF;
        END;
    END IF;

    -- Settle coins
    IF ch.coin_bet > 0 THEN
        IF result_text = 'both_win' THEN
            -- Cooperative success: both get their coins back
            PERFORM credit_coins(ch.challenger_id, ch.coin_bet, 'challenge_win', 'Partner challenge completed together!', p_challenge_id::TEXT);
            PERFORM credit_coins(ch.opponent_id, ch.coin_bet, 'challenge_win', 'Partner challenge completed together!', p_challenge_id::TEXT);
        ELSIF result_text = 'draw' THEN
            -- Draw: both get refunded
            PERFORM credit_coins(ch.challenger_id, ch.coin_bet, 'refund', 'Partner challenge draw - refund', p_challenge_id::TEXT);
            PERFORM credit_coins(ch.opponent_id, ch.coin_bet, 'refund', 'Partner challenge draw - refund', p_challenge_id::TEXT);
        ELSIF result_text = 'both_lose' THEN
            -- Both failed cooperative: coins go to the house (no refund)
            NULL;
        ELSIF winner IS NOT NULL THEN
            -- Winner takes all
            PERFORM credit_coins(winner, ch.coin_bet * 2, 'challenge_win', 'Won partner challenge!', p_challenge_id::TEXT);
        END IF;
    END IF;

    -- Update challenge
    UPDATE public.partner_challenges
    SET status = 'completed', winner_id = winner, updated_at = NOW()
    WHERE id = p_challenge_id;

    RETURN jsonb_build_object(
        'result', result_text,
        'winner_id', winner,
        'challenger_days', ch.challenger_days_completed,
        'opponent_days', ch.opponent_days_completed,
        'coin_bet', ch.coin_bet
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION complete_partner_challenge(UUID) TO authenticated;

-- Get user's partner challenges (active + pending)
CREATE OR REPLACE FUNCTION get_user_partner_challenges(p_user_id UUID)
RETURNS TABLE(
    challenge_id UUID,
    challenge_type TEXT,
    mode TEXT,
    duration_days INT,
    start_date DATE,
    end_date DATE,
    days_remaining INT,
    coin_bet INT,
    target_config JSONB,
    status TEXT,
    is_challenger BOOLEAN,
    partner_id UUID,
    partner_name TEXT,
    partner_photo TEXT,
    my_days_completed INT,
    partner_days_completed INT,
    winner_id UUID,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        pc.id as challenge_id,
        pc.challenge_type,
        pc.mode,
        pc.duration_days,
        pc.start_date,
        pc.end_date,
        GREATEST(0, pc.end_date - CURRENT_DATE)::INT as days_remaining,
        pc.coin_bet,
        pc.target_config,
        pc.status,
        (pc.challenger_id = p_user_id) as is_challenger,
        CASE WHEN pc.challenger_id = p_user_id THEN pc.opponent_id ELSE pc.challenger_id END as partner_id,
        u.name as partner_name,
        u.profile_photo as partner_photo,
        CASE WHEN pc.challenger_id = p_user_id THEN pc.challenger_days_completed ELSE pc.opponent_days_completed END as my_days_completed,
        CASE WHEN pc.challenger_id = p_user_id THEN pc.opponent_days_completed ELSE pc.challenger_days_completed END as partner_days_completed,
        pc.winner_id,
        pc.created_at
    FROM public.partner_challenges pc
    JOIN public.users u ON u.id = CASE WHEN pc.challenger_id = p_user_id THEN pc.opponent_id ELSE pc.challenger_id END
    WHERE (pc.challenger_id = p_user_id OR pc.opponent_id = p_user_id)
    AND pc.status IN ('pending', 'active', 'completed')
    ORDER BY
        CASE pc.status
            WHEN 'pending' THEN 0
            WHEN 'active' THEN 1
            WHEN 'completed' THEN 2
        END,
        pc.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_user_partner_challenges(UUID) TO authenticated;

-- Get daily progress for a partner challenge
CREATE OR REPLACE FUNCTION get_partner_challenge_progress(p_challenge_id UUID)
RETURNS TABLE(
    user_id UUID,
    user_name TEXT,
    day_date DATE,
    completed BOOLEAN,
    details JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        pcd.user_id,
        u.name as user_name,
        pcd.day_date,
        pcd.completed,
        pcd.details
    FROM public.partner_challenge_days pcd
    JOIN public.users u ON u.id = pcd.user_id
    WHERE pcd.challenge_id = p_challenge_id
    ORDER BY pcd.day_date ASC, pcd.user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_partner_challenge_progress(UUID) TO authenticated;

-- ============================================================
-- COMMENTS
-- ============================================================
COMMENT ON TABLE public.partner_challenges IS '1v1 accountability challenges between friends';
COMMENT ON TABLE public.partner_challenge_days IS 'Daily progress tracking for partner challenges';
COMMENT ON FUNCTION create_partner_challenge IS 'Creates a new partner challenge and debits challenger coins';
COMMENT ON FUNCTION accept_partner_challenge IS 'Accepts a partner challenge and debits opponent coins';
COMMENT ON FUNCTION decline_partner_challenge IS 'Declines a partner challenge and refunds challenger';
COMMENT ON FUNCTION record_partner_challenge_day IS 'Records daily progress for a partner challenge';
COMMENT ON FUNCTION complete_partner_challenge IS 'Completes a partner challenge and settles coins';
COMMENT ON FUNCTION get_user_partner_challenges IS 'Gets all partner challenges for a user';
COMMENT ON FUNCTION get_partner_challenge_progress IS 'Gets daily progress grid for a partner challenge';
