-- ============================================================
-- RARE REWARDS MIGRATION
-- Adds rare_reward_id column to challenges table and updates
-- complete_challenge to return the rare reward for frontend use
-- Run this in Supabase SQL Editor
-- ============================================================

-- Add rare_reward_id column to challenges table
-- Stores the rare skin ID (e.g., 'arny', 'goku', 'vegeta') that the winner receives
ALTER TABLE public.challenges
ADD COLUMN IF NOT EXISTS rare_reward_id TEXT;

-- Update complete_challenge to also return rare_reward_id
DROP FUNCTION IF EXISTS complete_challenge(UUID);
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
BEGIN
    -- Check if winner was already rewarded
    SELECT winner_rewarded, rare_reward_id
    INTO already_rewarded, challenge_rare_reward
    FROM public.challenges
    WHERE id = challenge_uuid;

    IF already_rewarded = TRUE THEN
        RETURN jsonb_build_object(
            'error', 'already_completed',
            'message', 'Challenge winner was already rewarded'
        );
    END IF;

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
        'winner_id', winner_user_id,
        'winner_name', winner_user_name,
        'winner_points', winner_pts,
        'reward_points', 200,
        'rare_reward_id', challenge_rare_reward,
        'prizes_awarded', TRUE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION complete_challenge(UUID) TO authenticated;
