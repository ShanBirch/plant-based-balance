-- Quiz Battle Migration
-- Head-to-head knowledge quiz battles with coin wagering

-- Quiz battles table
CREATE TABLE IF NOT EXISTS public.quiz_battles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    challenger_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    opponent_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    coin_bet INTEGER DEFAULT 0,
    question_seed TEXT NOT NULL,             -- JSON array of game references [{unitId, lessonIdx, gameIdx}, ...]
    challenger_score INTEGER DEFAULT 0,
    opponent_score INTEGER DEFAULT 0,
    challenger_time_ms INTEGER DEFAULT 0,    -- total time in ms
    opponent_time_ms INTEGER DEFAULT 0,
    challenger_finished BOOLEAN DEFAULT FALSE,
    opponent_finished BOOLEAN DEFAULT FALSE,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed', 'expired', 'declined')),
    winner_id UUID REFERENCES public.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '5 minutes'
);

CREATE INDEX IF NOT EXISTS idx_quiz_battles_challenger ON public.quiz_battles(challenger_id);
CREATE INDEX IF NOT EXISTS idx_quiz_battles_opponent ON public.quiz_battles(opponent_id);
CREATE INDEX IF NOT EXISTS idx_quiz_battles_status ON public.quiz_battles(status);

-- RLS
ALTER TABLE public.quiz_battles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own quiz battles" ON public.quiz_battles
    FOR SELECT USING (auth.uid() = challenger_id OR auth.uid() = opponent_id);

CREATE POLICY "Authenticated users can insert quiz battles" ON public.quiz_battles
    FOR INSERT WITH CHECK (auth.uid() = challenger_id);

CREATE POLICY "Participants can update quiz battles" ON public.quiz_battles
    FOR UPDATE USING (auth.uid() = challenger_id OR auth.uid() = opponent_id);

-- Create a quiz battle (challenger creates it)
DROP FUNCTION IF EXISTS create_quiz_battle(UUID, UUID, INTEGER, TEXT);
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

-- Join a quiz battle (opponent accepts)
DROP FUNCTION IF EXISTS join_quiz_battle(UUID, UUID);
CREATE OR REPLACE FUNCTION join_quiz_battle(
    p_battle_id UUID,
    p_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
    battle RECORD;
BEGIN
    SELECT * INTO battle FROM public.quiz_battles WHERE id = p_battle_id;

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

-- Submit quiz battle result (each player submits their score)
DROP FUNCTION IF EXISTS submit_quiz_battle_result(UUID, UUID, INTEGER, INTEGER);
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
    w_score INTEGER;
    l_score INTEGER;
    w_time INTEGER;
    l_time INTEGER;
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

    IF p_user_id = battle.challenger_id THEN
        -- Update with submitted values
        battle.challenger_score := p_score;
        battle.challenger_time_ms := p_time_ms;
        battle.challenger_finished := TRUE;
    ELSE
        battle.opponent_score := p_score;
        battle.opponent_time_ms := p_time_ms;
        battle.opponent_finished := TRUE;
    END IF;

    both_done := battle.challenger_finished AND battle.opponent_finished;

    IF both_done THEN
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
