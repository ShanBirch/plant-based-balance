-- Tamagotchi Battle PvP Migration
-- Real-time PvP battles with coin wagering

CREATE TABLE IF NOT EXISTS public.tamagotchi_battles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    challenger_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    opponent_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    coin_bet INTEGER DEFAULT 0,
    challenger_stats JSONB,          -- {str, hp, mana, movePower, level}
    opponent_stats JSONB,
    challenger_hp_remaining INTEGER,
    opponent_hp_remaining INTEGER,
    winner_id UUID REFERENCES public.users(id),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed', 'expired')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '5 minutes'
);

CREATE INDEX IF NOT EXISTS idx_tama_battles_challenger ON public.tamagotchi_battles(challenger_id);
CREATE INDEX IF NOT EXISTS idx_tama_battles_opponent ON public.tamagotchi_battles(opponent_id);
CREATE INDEX IF NOT EXISTS idx_tama_battles_status ON public.tamagotchi_battles(status);

-- RLS
ALTER TABLE public.tamagotchi_battles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tamagotchi battles" ON public.tamagotchi_battles
    FOR SELECT USING (auth.uid() = challenger_id OR auth.uid() = opponent_id);

CREATE POLICY "Authenticated users can insert tamagotchi battles" ON public.tamagotchi_battles
    FOR INSERT WITH CHECK (auth.uid() = challenger_id);

CREATE POLICY "Participants can update tamagotchi battles" ON public.tamagotchi_battles
    FOR UPDATE USING (auth.uid() = challenger_id OR auth.uid() = opponent_id);

-- Create a tamagotchi battle
DROP FUNCTION IF EXISTS create_tamagotchi_battle(UUID, UUID, INTEGER, JSONB);
CREATE OR REPLACE FUNCTION create_tamagotchi_battle(
    p_challenger_id UUID,
    p_opponent_id UUID,
    p_coin_bet INTEGER DEFAULT 0,
    p_challenger_stats JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
    battle_id UUID;
BEGIN
    INSERT INTO public.tamagotchi_battles (challenger_id, opponent_id, coin_bet, challenger_stats)
    VALUES (p_challenger_id, p_opponent_id, p_coin_bet, p_challenger_stats)
    RETURNING id INTO battle_id;

    RETURN battle_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION create_tamagotchi_battle(UUID, UUID, INTEGER, JSONB) TO authenticated;

-- Join a tamagotchi battle (opponent accepts)
DROP FUNCTION IF EXISTS join_tamagotchi_battle(UUID, UUID, JSONB);
CREATE OR REPLACE FUNCTION join_tamagotchi_battle(
    p_battle_id UUID,
    p_user_id UUID,
    p_opponent_stats JSONB DEFAULT '{}'
)
RETURNS JSONB AS $$
DECLARE
    battle RECORD;
BEGIN
    SELECT * INTO battle FROM public.tamagotchi_battles WHERE id = p_battle_id;

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
        UPDATE public.tamagotchi_battles SET status = 'expired' WHERE id = p_battle_id;
        RETURN jsonb_build_object('error', 'expired');
    END IF;

    UPDATE public.tamagotchi_battles
    SET status = 'active', opponent_stats = p_opponent_stats
    WHERE id = p_battle_id;

    RETURN jsonb_build_object(
        'success', true,
        'battle_id', p_battle_id,
        'coin_bet', battle.coin_bet,
        'challenger_id', battle.challenger_id,
        'challenger_stats', battle.challenger_stats
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION join_tamagotchi_battle(UUID, UUID, JSONB) TO authenticated;

-- Finish a tamagotchi battle (each player submits their result)
DROP FUNCTION IF EXISTS finish_tamagotchi_battle(UUID, UUID, INTEGER);
CREATE OR REPLACE FUNCTION finish_tamagotchi_battle(
    p_battle_id UUID,
    p_user_id UUID,
    p_hp_remaining INTEGER
)
RETURNS JSONB AS $$
DECLARE
    battle RECORD;
    both_done BOOLEAN;
    winner UUID;
BEGIN
    SELECT * INTO battle FROM public.tamagotchi_battles WHERE id = p_battle_id FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('error', 'not_found');
    END IF;

    IF battle.status = 'completed' THEN
        RETURN jsonb_build_object('error', 'already_completed');
    END IF;

    -- Update the player's HP remaining
    IF p_user_id = battle.challenger_id THEN
        UPDATE public.tamagotchi_battles
        SET challenger_hp_remaining = p_hp_remaining
        WHERE id = p_battle_id;
        battle.challenger_hp_remaining := p_hp_remaining;
    ELSIF p_user_id = battle.opponent_id THEN
        UPDATE public.tamagotchi_battles
        SET opponent_hp_remaining = p_hp_remaining
        WHERE id = p_battle_id;
        battle.opponent_hp_remaining := p_hp_remaining;
    ELSE
        RETURN jsonb_build_object('error', 'not_participant');
    END IF;

    -- Check if both submitted
    both_done := battle.challenger_hp_remaining IS NOT NULL AND battle.opponent_hp_remaining IS NOT NULL;

    IF both_done THEN
        -- Determine winner: whoever has more HP remaining
        -- If both dead (<=0), whoever died later has more HP (less negative)
        IF battle.challenger_hp_remaining > battle.opponent_hp_remaining THEN
            winner := battle.challenger_id;
        ELSIF battle.opponent_hp_remaining > battle.challenger_hp_remaining THEN
            winner := battle.opponent_id;
        ELSE
            -- Tie: challenger wins (first to challenge gets advantage)
            winner := battle.challenger_id;
        END IF;

        UPDATE public.tamagotchi_battles
        SET status = 'completed', winner_id = winner
        WHERE id = p_battle_id;

        -- Settle coins
        IF battle.coin_bet > 0 THEN
            PERFORM credit_coins(
                winner,
                battle.coin_bet * 2,
                'battle_win',
                'Won tamagotchi battle (' || (battle.coin_bet * 2) || ' coins)',
                p_battle_id::TEXT
            );
        END IF;

        RETURN jsonb_build_object(
            'finished', true,
            'winner_id', winner,
            'challenger_hp', battle.challenger_hp_remaining,
            'opponent_hp', battle.opponent_hp_remaining,
            'coin_bet', battle.coin_bet
        );
    END IF;

    RETURN jsonb_build_object(
        'finished', false,
        'waiting_for_opponent', true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION finish_tamagotchi_battle(UUID, UUID, INTEGER) TO authenticated;
