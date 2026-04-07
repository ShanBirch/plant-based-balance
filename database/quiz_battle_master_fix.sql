-- Quiz Battle Master Fix
-- Ensuring all quiz battle functionality is correctly implemented in Supabase

-- 1. Ensure Table Structure
CREATE TABLE IF NOT EXISTS public.quiz_battles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    challenger_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    opponent_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    coin_bet INTEGER DEFAULT 0,
    question_seed TEXT NOT NULL,             -- JSON/String seed for deterministic questions
    challenger_score INTEGER DEFAULT 0,
    opponent_score INTEGER DEFAULT 0,
    challenger_time_ms INTEGER DEFAULT 0,    -- total time in ms
    opponent_time_ms INTEGER DEFAULT 0,
    challenger_finished BOOLEAN DEFAULT FALSE,
    opponent_finished BOOLEAN DEFAULT FALSE,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed', 'expired', 'declined')),
    winner_id UUID REFERENCES public.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '24 hours' -- Increased from 5 mins to 24 hours for better UX
);

-- Ensure nudges can store quiz battle references
ALTER TABLE public.nudges ADD COLUMN IF NOT EXISTS nudge_type TEXT DEFAULT 'personal';
ALTER TABLE public.nudges ADD COLUMN IF NOT EXISTS reference_id UUID;
ALTER TABLE public.nudges ADD COLUMN IF NOT EXISTS coin_bet INTEGER DEFAULT 0;

-- 2. Indexes
CREATE INDEX IF NOT EXISTS idx_quiz_battles_challenger ON public.quiz_battles(challenger_id);
CREATE INDEX IF NOT EXISTS idx_quiz_battles_opponent ON public.quiz_battles(opponent_id);
CREATE INDEX IF NOT EXISTS idx_quiz_battles_status ON public.quiz_battles(status);

-- 3. RLS
ALTER TABLE public.quiz_battles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own quiz battles" ON public.quiz_battles;
CREATE POLICY "Users can view own quiz battles" ON public.quiz_battles
    FOR SELECT USING (auth.uid() = challenger_id OR auth.uid() = opponent_id);

DROP POLICY IF EXISTS "Authenticated users can insert quiz battles" ON public.quiz_battles;
CREATE POLICY "Authenticated users can insert quiz battles" ON public.quiz_battles
    FOR INSERT WITH CHECK (auth.uid() = challenger_id);

DROP POLICY IF EXISTS "Participants can update quiz battles" ON public.quiz_battles;
CREATE POLICY "Participants can update quiz battles" ON public.quiz_battles
    FOR UPDATE USING (auth.uid() = challenger_id OR auth.uid() = opponent_id);

-- 4. RPC Functions

-- Create a quiz battle
CREATE OR REPLACE FUNCTION create_quiz_battle(
    p_challenger_id UUID,
    p_opponent_id UUID,
    p_coin_bet INTEGER DEFAULT 0,
    p_question_seed TEXT DEFAULT '[]'
)
RETURNS UUID AS $$
DECLARE
    battle_id UUID;
BEGIN
    INSERT INTO public.quiz_battles (challenger_id, opponent_id, coin_bet, question_seed)
    VALUES (p_challenger_id, p_opponent_id, p_coin_bet, p_question_seed)
    RETURNING id INTO battle_id;

    RETURN battle_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION create_quiz_battle(UUID, UUID, INTEGER, TEXT) TO authenticated;

-- Join/Accept a quiz battle
CREATE OR REPLACE FUNCTION join_quiz_battle(
    p_battle_id UUID,
    p_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
    battle RECORD;
BEGIN
    SELECT * INTO battle FROM public.quiz_battles WHERE id = p_battle_id FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('error', 'not_found');
    END IF;

    IF battle.status != 'pending' THEN
        RETURN jsonb_build_object('error', 'not_pending', 'status', battle.status);
    END IF;

    IF battle.opponent_id != p_user_id THEN
        RETURN jsonb_build_object('error', 'not_opponent');
    END IF;

    IF battle.expires_at < NOW() THEN
        UPDATE public.quiz_battles SET status = 'expired' WHERE id = p_battle_id;
        RETURN jsonb_build_object('error', 'expired');
    END IF;

    UPDATE public.quiz_battles
    SET status = 'active'
    WHERE id = p_battle_id;

    RETURN jsonb_build_object(
        'success', true,
        'battle_id', p_battle_id,
        'question_seed', battle.question_seed,
        'coin_bet', battle.coin_bet,
        'challenger_id', battle.challenger_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION join_quiz_battle(UUID, UUID) TO authenticated;

-- Decline a quiz battle (Refunds challenger)
CREATE OR REPLACE FUNCTION decline_quiz_battle(
    p_battle_id UUID,
    p_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
    battle RECORD;
BEGIN
    SELECT * INTO battle FROM public.quiz_battles WHERE id = p_battle_id FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('error', 'not_found');
    END IF;

    IF battle.status != 'pending' THEN
        RETURN jsonb_build_object('error', 'not_pending');
    END IF;

    IF battle.opponent_id != p_user_id AND battle.challenger_id != p_user_id THEN
        RETURN jsonb_build_object('error', 'not_participant');
    END IF;

    UPDATE public.quiz_battles
    SET status = 'declined'
    WHERE id = p_battle_id;

    -- Refund challenger if there was a bet
    IF battle.coin_bet > 0 THEN
        PERFORM credit_coins(
            battle.challenger_id,
            battle.coin_bet,
            'refund',
            'Quiz battle declined/cancelled',
            p_battle_id::TEXT
        );
    END IF;

    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION decline_quiz_battle(UUID, UUID) TO authenticated;

-- Submit result
CREATE OR REPLACE FUNCTION submit_quiz_battle_result(
    p_battle_id UUID,
    p_user_id UUID,
    p_score INTEGER,
    p_time_ms INTEGER
)
RETURNS JSONB AS $$
DECLARE
    battle RECORD;
    both_done BOOLEAN;
    winner UUID;
BEGIN
    SELECT * INTO battle FROM public.quiz_battles WHERE id = p_battle_id FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('error', 'not_found');
    END IF;

    IF battle.status = 'completed' THEN
        RETURN jsonb_build_object('error', 'already_completed');
    END IF;

    -- Update the player's score
    IF p_user_id = battle.challenger_id THEN
        UPDATE public.quiz_battles
        SET challenger_score = p_score, challenger_time_ms = p_time_ms, challenger_finished = TRUE
        WHERE id = p_battle_id;
    ELSIF p_user_id = battle.opponent_id THEN
        UPDATE public.quiz_battles
        SET opponent_score = p_score, opponent_time_ms = p_time_ms, opponent_finished = TRUE
        WHERE id = p_battle_id;
    ELSE
        RETURN jsonb_build_object('error', 'not_participant');
    END IF;

    -- Re-fetch to check if both are done
    SELECT * INTO battle FROM public.quiz_battles WHERE id = p_battle_id;

    -- If this was the last person to submit, finalize the battle
    IF battle.challenger_finished AND battle.opponent_finished THEN
        -- Determine winner: highest score wins, tiebreak by fastest time
        IF battle.challenger_score > battle.opponent_score THEN
            winner := battle.challenger_id;
        ELSIF battle.opponent_score > battle.challenger_score THEN
            winner := battle.opponent_id;
        ELSIF battle.challenger_time_ms <= battle.opponent_time_ms THEN
            winner := battle.challenger_id;
        ELSE
            winner := battle.opponent_id;
        END IF;

        UPDATE public.quiz_battles
        SET status = 'completed', winner_id = winner
        WHERE id = p_battle_id;

        -- Settle coins if there was a bet
        IF battle.coin_bet > 0 THEN
            PERFORM credit_coins(
                winner,
                battle.coin_bet * 2,
                'battle_win',
                'Won quiz battle (' || (battle.coin_bet * 2) || ' coins)',
                p_battle_id::TEXT
            );
        END IF;

        RETURN jsonb_build_object(
            'finished', true,
            'winner_id', winner,
            'challenger_score', battle.challenger_score,
            'opponent_score', battle.opponent_score,
            'challenger_time_ms', battle.challenger_time_ms,
            'opponent_time_ms', battle.opponent_time_ms,
            'coin_bet', battle.coin_bet
        );
    END IF;

    RETURN jsonb_build_object(
        'finished', false,
        'waiting_for_opponent', true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION submit_quiz_battle_result(UUID, UUID, INTEGER, INTEGER) TO authenticated;

-- Function to get active battles for a user
CREATE OR REPLACE FUNCTION get_user_quiz_battles(p_user_id UUID)
RETURNS TABLE (
    id UUID,
    challenger_id UUID,
    opponent_id UUID,
    challenger_name TEXT,
    opponent_name TEXT,
    coin_bet INTEGER,
    status TEXT,
    created_at TIMESTAMPTZ,
    challenger_finished BOOLEAN,
    opponent_finished BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        qb.id,
        qb.challenger_id,
        qb.opponent_id,
        COALESCE(u1.name, u1.email),
        COALESCE(u2.name, u2.email),
        qb.coin_bet,
        qb.status,
        qb.created_at,
        qb.challenger_finished,
        qb.opponent_finished
    FROM public.quiz_battles qb
    JOIN public.users u1 ON qb.challenger_id = u1.id
    JOIN public.users u2 ON qb.opponent_id = u2.id
    WHERE qb.challenger_id = p_user_id OR qb.opponent_id = p_user_id
    ORDER BY qb.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_user_quiz_battles(UUID) TO authenticated;
