-- ============================================================
-- REPAIR MULTIPLAYER GAMES SCHEMA & FUNCTIONS
-- This script fixes missing columns in game_matches and 
-- deploys the improved forfeit/cancel logic.
-- ============================================================

-- 1. Fix missing columns in game_matches table
-- (Sometimes CREATE TABLE IF NOT EXISTS skips columns if the table already existed)
ALTER TABLE IF EXISTS public.game_matches 
    ADD COLUMN IF NOT EXISTS winner_id UUID REFERENCES public.users(id),
    ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '24 hours',
    ADD COLUMN IF NOT EXISTS last_move_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS move_count INTEGER DEFAULT 0;

-- 2. Update status constraints if needed
-- This ensures 'forfeit' and 'declined' are valid statuses
ALTER TABLE IF EXISTS public.game_matches 
    DROP CONSTRAINT IF EXISTS game_matches_status_check;

ALTER TABLE IF EXISTS public.game_matches 
    ADD CONSTRAINT game_matches_status_check 
    CHECK (status IN ('pending', 'active', 'completed', 'draw', 'declined', 'expired', 'forfeit'));

-- 3. Deploy the Improved Forfeit/Cancel Function
DROP FUNCTION IF EXISTS public.forfeit_game(UUID, UUID);

CREATE OR REPLACE FUNCTION public.forfeit_game(
    p_match_id UUID,
    p_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_match RECORD;
    v_other_player UUID;
    v_total_pot INTEGER;
BEGIN
    -- Fetch the match with a lock
    SELECT * INTO v_match FROM public.game_matches WHERE id = p_match_id FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('error', 'not_found', 'message', 'Game match not found');
    END IF;

    -- Verify the user is a participant
    IF p_user_id != v_match.challenger_id AND p_user_id != v_match.opponent_id THEN
        RETURN jsonb_build_object('error', 'not_participant', 'message', 'You are not a participant in this game');
    END IF;

    -- 🔒 LOBBY / PENDING STATE
    IF v_match.status = 'pending' THEN
        UPDATE public.game_matches 
        SET status = CASE WHEN p_user_id = v_match.challenger_id THEN 'forfeit' ELSE 'declined' END, 
            completed_at = NOW()
        WHERE id = p_match_id;

        -- Refund challenger's bet
        IF v_match.coin_bet > 0 THEN
            PERFORM public.credit_coins(v_match.challenger_id, v_match.coin_bet, 'refund', 'Game challenge canceled/declined - bet refunded', p_match_id::TEXT);
        END IF;

        RETURN jsonb_build_object('success', true, 'action', 'canceled');
        
    -- ⚔️ ACTIVE GAME STATE
    ELSIF v_match.status = 'active' THEN
        v_other_player := CASE WHEN p_user_id = v_match.challenger_id THEN v_match.opponent_id ELSE v_match.challenger_id END;
        v_total_pot := v_match.coin_bet * 2;

        UPDATE public.game_matches
        SET status = 'forfeit', winner_id = v_other_player, completed_at = NOW()
        WHERE id = p_match_id;

        -- Award pot to the other player
        IF v_match.coin_bet > 0 THEN
            PERFORM public.credit_coins(v_other_player, v_total_pot, 'game_win', 'Opponent forfeited ' || v_match.game_type || ' (' || v_total_pot || ' coins)', p_match_id::TEXT);
        END IF;

        RETURN jsonb_build_object('success', true, 'action', 'forfeit', 'winner_id', v_other_player, 'winnings', v_total_pot);
    
    ELSE
        RETURN jsonb_build_object('error', 'invalid_status', 'status', v_match.status, 'message', 'Game is already finished');
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.forfeit_game(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.forfeit_game(UUID, UUID) TO service_role;
