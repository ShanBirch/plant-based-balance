-- ============================================================
-- IMPROVED FORFEIT/CANCEL FUNCTION
-- This correctly handles both active games (forfeit) and 
-- pending challenges (cancel) with proper coin refunds.
-- ============================================================

DROP FUNCTION IF EXISTS forfeit_game(UUID, UUID);

CREATE OR REPLACE FUNCTION forfeit_game(
    p_match_id UUID,
    p_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_match RECORD;
    v_other_player UUID;
    v_total_pot INTEGER;
BEGIN
    -- Fetch the match with a lock to prevent race conditions
    SELECT * INTO v_match FROM public.game_matches WHERE id = p_match_id FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('error', 'not_found', 'message', 'Game not found');
    END IF;

    -- Verify the user is a participant
    IF p_user_id != v_match.challenger_id AND p_user_id != v_match.opponent_id THEN
        RETURN jsonb_build_object('error', 'not_participant', 'message', 'You are not a participant in this game');
    END IF;

    -- Handle case based on current status
    IF v_match.status = 'pending' THEN
        -- CHALLENGE CANCELLATION
        -- If the challenger cancels or the opponent declines before it starts
        UPDATE public.game_matches 
        SET status = CASE WHEN p_user_id = v_match.challenger_id THEN 'forfeit' ELSE 'declined' END, 
            completed_at = NOW()
        WHERE id = p_match_id;

        -- Refund challenger's bet if they are the one canceling OR if it's being declined
        IF v_match.coin_bet > 0 THEN
            PERFORM credit_coins(v_match.challenger_id, v_match.coin_bet, 'refund', 'Game challenge canceled/declined - bet refunded', p_match_id::TEXT);
        END IF;

        RETURN jsonb_build_object('success', true, 'action', 'canceled');
        
    ELSIF v_match.status = 'active' THEN
        -- ACTIVE GAME FORFEIT
        -- Determine the other player (winner)
        v_other_player := CASE WHEN p_user_id = v_match.challenger_id THEN v_match.opponent_id ELSE v_match.challenger_id END;
        v_total_pot := v_match.coin_bet * 2;

        UPDATE public.game_matches
        SET status = 'forfeit', winner_id = v_other_player, completed_at = NOW()
        WHERE id = p_match_id;

        -- Award winnings to the other player
        IF v_match.coin_bet > 0 THEN
            PERFORM credit_coins(v_other_player, v_total_pot, 'game_win', 'Opponent forfeited ' || v_match.game_type || ' (' || v_total_pot || ' coins)', p_match_id::TEXT);
        END IF;

        RETURN jsonb_build_object('success', true, 'action', 'forfeit', 'winner_id', v_other_player, 'winnings', v_total_pot);
    
    ELSE
        -- Match is already finished or in another state
        RETURN jsonb_build_object('error', 'invalid_status', 'status', v_match.status, 'message', 'This game cannot be forfeited in its current state');
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure the authenticated role has access
GRANT EXECUTE ON FUNCTION forfeit_game(UUID, UUID) TO authenticated;
