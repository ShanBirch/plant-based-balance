-- ============================================================
-- MULTIPLAYER GAMES MASTER FIX (COMPLETE BUNDLE)
-- This script repairs the table structure and installs all
-- necessary functions for chess and other multiplayer games.
-- ============================================================

-- 1. REPAIR TABLE SCHEMA
-- Ensure all required columns exist in the game_matches table
ALTER TABLE IF EXISTS public.game_matches 
    ADD COLUMN IF NOT EXISTS winner_id UUID REFERENCES public.users(id),
    ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '24 hours',
    ADD COLUMN IF NOT EXISTS last_move_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS move_count INTEGER DEFAULT 0;

-- Ensure status constraints allow all game states
ALTER TABLE IF EXISTS public.game_matches 
    DROP CONSTRAINT IF EXISTS game_matches_status_check;

ALTER TABLE IF EXISTS public.game_matches 
    ADD CONSTRAINT game_matches_status_check 
    CHECK (status IN ('pending', 'active', 'completed', 'draw', 'declined', 'expired', 'forfeit'));


-- 2. CREATE GAME CHALLENGE
CREATE OR REPLACE FUNCTION public.create_game_challenge(
    p_challenger_id UUID,
    p_opponent_id UUID,
    p_game_type TEXT,
    p_coin_bet INTEGER DEFAULT 0
)
RETURNS JSONB AS $$
DECLARE
    match_id UUID;
    new_bal INTEGER;
BEGIN
    IF p_coin_bet > 0 THEN
        new_bal := public.debit_coins(
            p_challenger_id, p_coin_bet,
            'game_bet',
            'Game challenge bet: ' || p_game_type || ' (' || p_coin_bet || ' coins)',
            NULL
        );
        IF new_bal = -1 THEN
            RETURN jsonb_build_object('error', 'insufficient_coins', 'message', 'Not enough coins for this bet');
        END IF;
    END IF;

    INSERT INTO public.game_matches (challenger_id, opponent_id, game_type, coin_bet, current_turn, game_state)
    VALUES (p_challenger_id, p_opponent_id, p_game_type, p_coin_bet, p_challenger_id, '{"board": null}')
    RETURNING id INTO match_id;

    RETURN jsonb_build_object('success', true, 'match_id', match_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. ACCEPT GAME CHALLENGE
CREATE OR REPLACE FUNCTION public.accept_game_challenge(
    p_match_id UUID,
    p_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
    match RECORD;
    new_bal INTEGER;
BEGIN
    SELECT * INTO match FROM public.game_matches WHERE id = p_match_id FOR UPDATE;

    IF NOT FOUND THEN RETURN jsonb_build_object('error', 'not_found'); END IF;
    IF match.status != 'pending' THEN RETURN jsonb_build_object('error', 'not_pending'); END IF;
    IF match.opponent_id != p_user_id THEN RETURN jsonb_build_object('error', 'not_opponent'); END IF;

    IF match.coin_bet > 0 THEN
        new_bal := public.debit_coins(
            p_user_id, match.coin_bet,
            'game_bet',
            'Accepted game challenge: ' || match.game_type || ' (' || match.coin_bet || ' coins)',
            p_match_id::TEXT
        );
        IF new_bal = -1 THEN
            RETURN jsonb_build_object('error', 'insufficient_coins', 'message', 'Not enough coins to accept this bet');
        END IF;
    END IF;

    UPDATE public.game_matches
    SET status = 'active', current_turn = match.challenger_id
    WHERE id = p_match_id;

    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 4. DECLINE GAME CHALLENGE
CREATE OR REPLACE FUNCTION public.decline_game_challenge(
    p_match_id UUID,
    p_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
    match RECORD;
BEGIN
    SELECT * INTO match FROM public.game_matches WHERE id = p_match_id FOR UPDATE;

    IF NOT FOUND THEN RETURN jsonb_build_object('error', 'not_found'); END IF;
    IF match.opponent_id != p_user_id AND match.challenger_id != p_user_id THEN 
        RETURN jsonb_build_object('error', 'not_participant'); 
    END IF;

    UPDATE public.game_matches SET status = 'declined', completed_at = NOW() WHERE id = p_match_id;

    -- Refund challenger's bet
    IF match.coin_bet > 0 THEN
        PERFORM public.credit_coins(match.challenger_id, match.coin_bet, 'refund', 'Game challenge declined - bet refunded', p_match_id::TEXT);
    END IF;

    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 5. FORFEIT / CANCEL CHALLENGE
CREATE OR REPLACE FUNCTION public.forfeit_game(
    p_match_id UUID,
    p_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_match RECORD;
    v_winner UUID;
    v_pot INTEGER;
BEGIN
    SELECT * INTO v_match FROM public.game_matches WHERE id = p_match_id FOR UPDATE;

    IF NOT FOUND THEN RETURN jsonb_build_object('error', 'not_found'); END IF;
    IF p_user_id != v_match.challenger_id AND p_user_id != v_match.opponent_id THEN
        RETURN jsonb_build_object('error', 'not_participant');
    END IF;

    -- If in lobby, treated as cancel/decline
    IF v_match.status = 'pending' THEN
        UPDATE public.game_matches 
        SET status = CASE WHEN p_user_id = v_match.challenger_id THEN 'forfeit' ELSE 'declined' END, 
            completed_at = NOW()
        WHERE id = p_match_id;

        IF v_match.coin_bet > 0 THEN
            PERFORM public.credit_coins(v_match.challenger_id, v_match.coin_bet, 'refund', 'Game cancelled - bet refunded', p_match_id::TEXT);
        END IF;
        RETURN jsonb_build_object('success', true, 'action', 'canceled');
        
    ELSIF v_match.status = 'active' THEN
        v_winner := CASE WHEN p_user_id = v_match.challenger_id THEN v_match.opponent_id ELSE v_match.challenger_id END;
        v_pot := v_match.coin_bet * 2;

        UPDATE public.game_matches SET status = 'forfeit', winner_id = v_winner, completed_at = NOW() WHERE id = p_match_id;

        IF v_match.coin_bet > 0 THEN
            PERFORM public.credit_coins(v_winner, v_pot, 'game_win', 'Opponent forfeited ' || v_match.game_type, p_match_id::TEXT);
        END IF;
        RETURN jsonb_build_object('success', true, 'action', 'forfeit');
    ELSE
        RETURN jsonb_build_object('error', 'finished');
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 6. COMPLETE GAME
CREATE OR REPLACE FUNCTION public.complete_game(
    p_match_id UUID,
    p_winner_id UUID,
    p_is_draw BOOLEAN DEFAULT FALSE
)
RETURNS JSONB AS $$
DECLARE
    match RECORD;
    total_pot INTEGER;
BEGIN
    SELECT * INTO match FROM public.game_matches WHERE id = p_match_id FOR UPDATE;
    IF NOT FOUND THEN RETURN jsonb_build_object('error', 'not_found'); END IF;

    IF p_is_draw THEN
        UPDATE public.game_matches SET status = 'draw', completed_at = NOW() WHERE id = p_match_id;
        IF match.coin_bet > 0 THEN
            PERFORM public.credit_coins(match.challenger_id, match.coin_bet, 'refund', 'Draw - bet refunded', p_match_id::TEXT);
            PERFORM public.credit_coins(match.opponent_id, match.coin_bet, 'refund', 'Draw - bet refunded', p_match_id::TEXT);
        END IF;
        RETURN jsonb_build_object('success', true, 'result', 'draw');
    ELSE
        UPDATE public.game_matches SET status = 'completed', winner_id = p_winner_id, completed_at = NOW() WHERE id = p_match_id;
        IF match.coin_bet > 0 THEN
            PERFORM public.credit_coins(p_winner_id, match.coin_bet * 2, 'game_win', 'Won ' || match.game_type, p_match_id::TEXT);
        END IF;
        RETURN jsonb_build_object('success', true, 'result', 'win');
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 7. GET USER GAMES
CREATE OR REPLACE FUNCTION public.get_user_games(user_uuid UUID)
RETURNS TABLE(
    match_id UUID, game_type TEXT, challenger_id UUID, challenger_name TEXT, challenger_photo TEXT,
    opponent_id UUID, opponent_name TEXT, opponent_photo TEXT, coin_bet INTEGER,
    status TEXT, current_turn UUID, move_count INTEGER, created_at TIMESTAMPTZ, last_move_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT gm.id, gm.game_type, gm.challenger_id, c.name, c.profile_photo,
           gm.opponent_id, o.name, o.profile_photo, gm.coin_bet, gm.status,
           gm.current_turn, gm.move_count, gm.created_at, gm.last_move_at
    FROM public.game_matches gm
    JOIN public.users c ON c.id = gm.challenger_id
    JOIN public.users o ON o.id = gm.opponent_id
    WHERE (gm.challenger_id = user_uuid OR gm.opponent_id = user_uuid)
    AND gm.status IN ('pending', 'active')
    ORDER BY CASE WHEN gm.current_turn = user_uuid THEN 0 ELSE 1 END,
             gm.last_move_at DESC NULLS LAST, gm.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- GRANT PERMISSIONS
GRANT EXECUTE ON FUNCTION public.create_game_challenge TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_game_challenge TO authenticated;
GRANT EXECUTE ON FUNCTION public.decline_game_challenge TO authenticated;
GRANT EXECUTE ON FUNCTION public.forfeit_game TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_game TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_games TO authenticated;
