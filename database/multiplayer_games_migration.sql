-- ============================================================
-- MULTIPLAYER GAMES MIGRATION
-- Adds board/card games that friends can challenge each other to
-- with coin betting using the existing coin system
-- ============================================================

-- Game matches table (tracks all multiplayer game sessions)
CREATE TABLE IF NOT EXISTS public.game_matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_type TEXT NOT NULL CHECK (game_type IN (
        'chess', 'checkers', 'connect4', 'tic_tac_toe', 'reversi', 'battleships'
    )),
    challenger_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    opponent_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    coin_bet INTEGER DEFAULT 0,
    -- Game state stored as JSON (board state, whose turn, etc.)
    game_state JSONB NOT NULL DEFAULT '{}',
    current_turn UUID,  -- which player's turn it is
    status TEXT DEFAULT 'pending' CHECK (status IN (
        'pending',     -- waiting for opponent to accept
        'active',      -- game in progress
        'completed',   -- game finished with a winner
        'draw',        -- game ended in a draw
        'declined',    -- opponent declined the challenge
        'expired',     -- challenge expired (not accepted in time)
        'forfeit'      -- a player forfeited
    )),
    winner_id UUID REFERENCES public.users(id),
    move_count INTEGER DEFAULT 0,
    last_move_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '24 hours',
    completed_at TIMESTAMPTZ,

    CHECK (challenger_id != opponent_id)
);

ALTER TABLE IF EXISTS public.game_matches ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '24 hours';

CREATE INDEX IF NOT EXISTS idx_game_matches_challenger ON public.game_matches(challenger_id, status);
CREATE INDEX IF NOT EXISTS idx_game_matches_opponent ON public.game_matches(opponent_id, status);
CREATE INDEX IF NOT EXISTS idx_game_matches_status ON public.game_matches(status);
CREATE INDEX IF NOT EXISTS idx_game_matches_current_turn ON public.game_matches(current_turn);

-- Game moves table (full move history for replay/validation)
CREATE TABLE IF NOT EXISTS public.game_moves (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id UUID NOT NULL REFERENCES public.game_matches(id) ON DELETE CASCADE,
    player_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    move_number INTEGER NOT NULL,
    move_data JSONB NOT NULL,  -- game-specific move info (e.g., {from: "e2", to: "e4"})
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_game_moves_match ON public.game_moves(match_id, move_number);

-- RLS for game_matches
ALTER TABLE public.game_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own games" ON public.game_matches
    FOR SELECT USING (auth.uid() = challenger_id OR auth.uid() = opponent_id);

CREATE POLICY "Authenticated users can create games" ON public.game_matches
    FOR INSERT WITH CHECK (auth.uid() = challenger_id);

CREATE POLICY "Participants can update games" ON public.game_matches
    FOR UPDATE USING (auth.uid() = challenger_id OR auth.uid() = opponent_id);

-- RLS for game_moves
ALTER TABLE public.game_moves ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Game participants can view moves" ON public.game_moves
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.game_matches
            WHERE id = game_moves.match_id
            AND (challenger_id = auth.uid() OR opponent_id = auth.uid())
        )
    );

CREATE POLICY "Game participants can insert moves" ON public.game_moves
    FOR INSERT WITH CHECK (auth.uid() = player_id);

-- Update coin_transactions check to include game types
ALTER TABLE public.coin_transactions DROP CONSTRAINT IF EXISTS coin_transactions_transaction_type_check;
ALTER TABLE public.coin_transactions ADD CONSTRAINT coin_transactions_transaction_type_check
    CHECK (transaction_type IN (
        'pack_purchase', 'challenge_entry', 'challenge_win',
        'battle_bet', 'battle_win', 'character_purchase',
        'cosmetic_purchase', 'refund', 'admin_grant',
        'game_bet', 'game_win'
    ));

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- Create a new game challenge
DROP FUNCTION IF EXISTS create_game_challenge(UUID, UUID, TEXT, INTEGER);
CREATE OR REPLACE FUNCTION create_game_challenge(
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
    -- Debit coins from challenger if there's a bet
    IF p_coin_bet > 0 THEN
        new_bal := debit_coins(
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

    RETURN jsonb_build_object(
        'success', true,
        'match_id', match_id,
        'game_type', p_game_type,
        'coin_bet', p_coin_bet
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION create_game_challenge(UUID, UUID, TEXT, INTEGER) TO authenticated;

-- Accept a game challenge
DROP FUNCTION IF EXISTS accept_game_challenge(UUID, UUID);
CREATE OR REPLACE FUNCTION accept_game_challenge(
    p_match_id UUID,
    p_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
    match RECORD;
    new_bal INTEGER;
BEGIN
    SELECT * INTO match FROM public.game_matches WHERE id = p_match_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('error', 'not_found');
    END IF;

    IF match.status != 'pending' THEN
        RETURN jsonb_build_object('error', 'not_pending', 'status', match.status);
    END IF;

    IF match.opponent_id != p_user_id THEN
        RETURN jsonb_build_object('error', 'not_opponent');
    END IF;

    IF match.expires_at < NOW() THEN
        UPDATE public.game_matches SET status = 'expired' WHERE id = p_match_id;
        -- Refund challenger's bet
        IF match.coin_bet > 0 THEN
            PERFORM credit_coins(match.challenger_id, match.coin_bet, 'refund', 'Game challenge expired - bet refunded', p_match_id::TEXT);
        END IF;
        RETURN jsonb_build_object('error', 'expired');
    END IF;

    -- Debit coins from opponent if there's a bet
    IF match.coin_bet > 0 THEN
        new_bal := debit_coins(
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

    RETURN jsonb_build_object(
        'success', true,
        'match_id', p_match_id,
        'game_type', match.game_type,
        'coin_bet', match.coin_bet,
        'challenger_id', match.challenger_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION accept_game_challenge(UUID, UUID) TO authenticated;

-- Decline a game challenge
DROP FUNCTION IF EXISTS decline_game_challenge(UUID, UUID);
CREATE OR REPLACE FUNCTION decline_game_challenge(
    p_match_id UUID,
    p_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
    match RECORD;
BEGIN
    SELECT * INTO match FROM public.game_matches WHERE id = p_match_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('error', 'not_found');
    END IF;

    IF match.opponent_id != p_user_id THEN
        RETURN jsonb_build_object('error', 'not_opponent');
    END IF;

    IF match.status != 'pending' THEN
        RETURN jsonb_build_object('error', 'not_pending');
    END IF;

    UPDATE public.game_matches SET status = 'declined' WHERE id = p_match_id;

    -- Refund challenger's bet
    IF match.coin_bet > 0 THEN
        PERFORM credit_coins(match.challenger_id, match.coin_bet, 'refund', 'Game challenge declined - bet refunded', p_match_id::TEXT);
    END IF;

    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION decline_game_challenge(UUID, UUID) TO authenticated;

-- Complete a game (declare winner or draw)
DROP FUNCTION IF EXISTS complete_game(UUID, UUID, BOOLEAN);
CREATE OR REPLACE FUNCTION complete_game(
    p_match_id UUID,
    p_winner_id UUID,  -- NULL for a draw
    p_is_draw BOOLEAN DEFAULT FALSE
)
RETURNS JSONB AS $$
DECLARE
    match RECORD;
    total_pot INTEGER;
BEGIN
    SELECT * INTO match FROM public.game_matches WHERE id = p_match_id FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('error', 'not_found');
    END IF;

    IF match.status != 'active' THEN
        RETURN jsonb_build_object('error', 'not_active');
    END IF;

    total_pot := match.coin_bet * 2;

    IF p_is_draw THEN
        UPDATE public.game_matches
        SET status = 'draw', completed_at = NOW()
        WHERE id = p_match_id;

        -- Refund both players
        IF match.coin_bet > 0 THEN
            PERFORM credit_coins(match.challenger_id, match.coin_bet, 'refund', 'Game ended in draw - bet refunded', p_match_id::TEXT);
            PERFORM credit_coins(match.opponent_id, match.coin_bet, 'refund', 'Game ended in draw - bet refunded', p_match_id::TEXT);
        END IF;

        RETURN jsonb_build_object('success', true, 'result', 'draw');
    ELSE
        UPDATE public.game_matches
        SET status = 'completed', winner_id = p_winner_id, completed_at = NOW()
        WHERE id = p_match_id;

        -- Award winnings to winner
        IF match.coin_bet > 0 THEN
            PERFORM credit_coins(p_winner_id, total_pot, 'game_win', 'Won ' || match.game_type || ' (' || total_pot || ' coins)', p_match_id::TEXT);
        END IF;

        RETURN jsonb_build_object('success', true, 'result', 'win', 'winner_id', p_winner_id, 'winnings', total_pot);
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION complete_game(UUID, UUID, BOOLEAN) TO authenticated;

-- Forfeit a game
DROP FUNCTION IF EXISTS forfeit_game(UUID, UUID);
CREATE OR REPLACE FUNCTION forfeit_game(
    p_match_id UUID,
    p_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
    match RECORD;
    other_player UUID;
    total_pot INTEGER;
BEGIN
    SELECT * INTO match FROM public.game_matches WHERE id = p_match_id FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('error', 'not_found');
    END IF;

    IF match.status != 'active' THEN
        RETURN jsonb_build_object('error', 'not_active');
    END IF;

    IF p_user_id != match.challenger_id AND p_user_id != match.opponent_id THEN
        RETURN jsonb_build_object('error', 'not_participant');
    END IF;

    -- Determine the other player (winner)
    other_player := CASE WHEN p_user_id = match.challenger_id THEN match.opponent_id ELSE match.challenger_id END;
    total_pot := match.coin_bet * 2;

    UPDATE public.game_matches
    SET status = 'forfeit', winner_id = other_player, completed_at = NOW()
    WHERE id = p_match_id;

    -- Award winnings to the other player
    IF match.coin_bet > 0 THEN
        PERFORM credit_coins(other_player, total_pot, 'game_win', 'Opponent forfeited ' || match.game_type || ' (' || total_pot || ' coins)', p_match_id::TEXT);
    END IF;

    RETURN jsonb_build_object('success', true, 'winner_id', other_player, 'winnings', total_pot);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION forfeit_game(UUID, UUID) TO authenticated;

-- Get user's active and pending games
DROP FUNCTION IF EXISTS get_user_games(UUID);
CREATE OR REPLACE FUNCTION get_user_games(user_uuid UUID)
RETURNS TABLE(
    match_id UUID,
    game_type TEXT,
    challenger_id UUID,
    challenger_name TEXT,
    challenger_photo TEXT,
    opponent_id UUID,
    opponent_name TEXT,
    opponent_photo TEXT,
    coin_bet INTEGER,
    status TEXT,
    current_turn UUID,
    move_count INTEGER,
    created_at TIMESTAMPTZ,
    last_move_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        gm.id as match_id,
        gm.game_type,
        gm.challenger_id,
        c.name as challenger_name,
        c.profile_photo as challenger_photo,
        gm.opponent_id,
        o.name as opponent_name,
        o.profile_photo as opponent_photo,
        gm.coin_bet,
        gm.status,
        gm.current_turn,
        gm.move_count,
        gm.created_at,
        gm.last_move_at
    FROM public.game_matches gm
    JOIN public.users c ON c.id = gm.challenger_id
    JOIN public.users o ON o.id = gm.opponent_id
    WHERE (gm.challenger_id = user_uuid OR gm.opponent_id = user_uuid)
    AND gm.status IN ('pending', 'active')
    ORDER BY
        CASE WHEN gm.current_turn = user_uuid THEN 0 ELSE 1 END,
        gm.last_move_at DESC NULLS LAST,
        gm.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_user_games(UUID) TO authenticated;

-- ============================================================
-- COMMENTS
-- ============================================================

COMMENT ON TABLE public.game_matches IS 'Tracks multiplayer game sessions between friends with optional coin betting';
COMMENT ON TABLE public.game_moves IS 'Full move history for game replays and validation';
