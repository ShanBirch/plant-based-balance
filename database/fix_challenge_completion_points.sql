-- ============================================================
-- FIX: Challenge completion points
-- ============================================================
-- Problem: When a challenge ends, complete_challenge picks the
--   winner based on challenge_points stored in challenge_participants.
--   But these points are only updated when a user views the leaderboard
--   (via get_challenge_leaderboard_v2). If points haven't been refreshed
--   recently for all participants, the winner determination uses stale
--   data and participants may show 0 progress.
--
-- Fix: Before picking the winner, refresh every participant's points
--   by calling update_challenge_participant_points for each one.
-- ============================================================

CREATE OR REPLACE FUNCTION complete_challenge(challenge_uuid UUID)
RETURNS JSONB AS $$
DECLARE
    winner_user_id UUID;
    winner_pts INT;
    winner_user_name TEXT;
    already_rewarded BOOLEAN;
    challenge_rare_reward TEXT;
    participant_record RECORD;
    random_item_id UUID;
    v_challenge_status TEXT;
BEGIN
    -- Check if winner was already rewarded
    SELECT winner_rewarded, rare_reward_id, status
    INTO already_rewarded, challenge_rare_reward, v_challenge_status
    FROM public.challenges
    WHERE id = challenge_uuid;

    IF already_rewarded = TRUE THEN
        RETURN jsonb_build_object(
            'error', 'already_completed',
            'message', 'Challenge winner was already rewarded'
        );
    END IF;

    -- Refresh all participants' points before determining the winner.
    -- update_challenge_participant_points only processes active challenges,
    -- so we must call it BEFORE changing the status to completed.
    FOR participant_record IN
        SELECT cp.user_id
        FROM public.challenge_participants cp
        WHERE cp.challenge_id = challenge_uuid
        AND cp.status = 'accepted'
    LOOP
        PERFORM public.update_challenge_participant_points(participant_record.user_id);
    END LOOP;

    -- Find the winner (highest challenge_points)
    SELECT cp.user_id, cp.challenge_points, u.name
    INTO winner_user_id, winner_pts, winner_user_name
    FROM public.challenge_participants cp
    JOIN public.users u ON u.id = cp.user_id
    WHERE cp.challenge_id = challenge_uuid AND cp.status = 'accepted'
    ORDER BY cp.challenge_points DESC
    LIMIT 1;

    IF winner_user_id IS NULL THEN
        RETURN jsonb_build_object(
            'error', 'no_participants',
            'message', 'No accepted participants in this challenge'
        );
    END IF;

    -- Update challenge with winner
    UPDATE public.challenges
    SET
        status = 'completed',
        winner_id = winner_user_id,
        winner_points = winner_pts,
        completed_at = NOW(),
        updated_at = NOW(),
        winner_rewarded = TRUE
    WHERE id = challenge_uuid;

    -- Award 200 points to winner
    UPDATE public.user_points
    SET
        current_points = current_points + 200,
        lifetime_points = lifetime_points + 200
    WHERE user_id = winner_user_id;

    -- Record the point transaction
    INSERT INTO public.point_transactions (user_id, transaction_type, points, description)
    VALUES (winner_user_id, 'challenge_win', 200, 'Won challenge: ' || (SELECT name FROM public.challenges WHERE id = challenge_uuid));

    -- Award cosmetic to winner (from cosmetic_items table if available)
    SELECT ci.id INTO random_item_id
    FROM public.cosmetic_items ci
    WHERE ci.rarity IN ('rare', 'legendary')
    AND ci.is_active = TRUE
    AND ci.id NOT IN (SELECT item_id FROM public.user_inventory WHERE user_id = winner_user_id)
    ORDER BY random()
    LIMIT 1;

    IF random_item_id IS NOT NULL THEN
        INSERT INTO public.user_inventory (user_id, item_id, source, challenge_id)
        VALUES (winner_user_id, random_item_id, 'challenge_win', challenge_uuid)
        ON CONFLICT (user_id, item_id) DO NOTHING;
    END IF;

    -- Award common cosmetic to other participants
    FOR participant_record IN
        SELECT cp.user_id
        FROM public.challenge_participants cp
        WHERE cp.challenge_id = challenge_uuid
        AND cp.status = 'accepted'
        AND cp.user_id != winner_user_id
    LOOP
        SELECT ci.id INTO random_item_id
        FROM public.cosmetic_items ci
        WHERE ci.rarity IN ('common', 'uncommon')
        AND ci.is_active = TRUE
        AND ci.id NOT IN (SELECT item_id FROM public.user_inventory WHERE user_id = participant_record.user_id)
        ORDER BY random()
        LIMIT 1;

        IF random_item_id IS NOT NULL THEN
            INSERT INTO public.user_inventory (user_id, item_id, source, challenge_id)
            VALUES (participant_record.user_id, random_item_id, 'challenge_participation', challenge_uuid)
            ON CONFLICT (user_id, item_id) DO NOTHING;
        END IF;
    END LOOP;

    RETURN jsonb_build_object(
        'success', TRUE,
        'winner_id', winner_user_id,
        'winner_name', winner_user_name,
        'winner_points', winner_pts,
        'rare_reward_id', challenge_rare_reward
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION complete_challenge(UUID) TO authenticated;
