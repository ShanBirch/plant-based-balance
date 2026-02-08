-- Challenge Buy-In Migration
-- Adds paid entry support and single-challenge double XP enforcement

-- Add payment tracking columns to challenge_participants
ALTER TABLE public.challenge_participants
ADD COLUMN IF NOT EXISTS has_paid BOOLEAN DEFAULT FALSE;

ALTER TABLE public.challenge_participants
ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

ALTER TABLE public.challenge_participants
ADD COLUMN IF NOT EXISTS stripe_payment_id TEXT;

-- Add entry fee columns to challenges table
ALTER TABLE public.challenges
ADD COLUMN IF NOT EXISTS entry_fee INTEGER DEFAULT 999;  -- $9.99 in cents

-- Cosmetics / Inventory system
CREATE TABLE IF NOT EXISTS public.cosmetic_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    item_type TEXT NOT NULL CHECK (item_type IN ('avatar_border', 'profile_badge', 'profile_background', 'name_color', 'reaction_emoji', 'post_frame', 'victory_animation', 'trophy', '3d_prop')),
    rarity TEXT NOT NULL CHECK (rarity IN ('common', 'uncommon', 'rare', 'legendary', 'mythic')),
    asset_url TEXT,           -- URL to the 3D model / image / animation
    thumbnail_url TEXT,       -- Preview image
    season TEXT,              -- e.g., 'summer_2026', 'launch'
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.user_inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES public.cosmetic_items(id) ON DELETE CASCADE,
    source TEXT NOT NULL CHECK (source IN ('challenge_win', 'challenge_participation', 'purchase', 'reward')),
    challenge_id UUID REFERENCES public.challenges(id),
    is_equipped BOOLEAN DEFAULT FALSE,
    acquired_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, item_id)  -- Can only own each item once
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_user_inventory_user ON public.user_inventory(user_id);
CREATE INDEX IF NOT EXISTS idx_user_inventory_equipped ON public.user_inventory(user_id, is_equipped) WHERE is_equipped = TRUE;
CREATE INDEX IF NOT EXISTS idx_cosmetic_items_rarity ON public.cosmetic_items(rarity);
CREATE INDEX IF NOT EXISTS idx_cosmetic_items_season ON public.cosmetic_items(season);
CREATE INDEX IF NOT EXISTS idx_challenge_participants_paid ON public.challenge_participants(has_paid);

-- Seed some initial cosmetic items (launch collection)
INSERT INTO public.cosmetic_items (name, description, item_type, rarity, season) VALUES
    -- Common (participation rewards)
    ('Green Sprout Badge', 'A fresh start badge for challenge participants', 'profile_badge', 'common', 'launch'),
    ('Earth Tone Border', 'A warm earthy avatar border', 'avatar_border', 'common', 'launch'),
    ('Leaf Frame', 'Simple leaf-themed post frame', 'post_frame', 'common', 'launch'),
    -- Uncommon (2nd/3rd place)
    ('Golden Leaf Badge', 'Earned by top challengers', 'profile_badge', 'uncommon', 'launch'),
    ('Vine Border', 'An animated vine avatar border', 'avatar_border', 'uncommon', 'launch'),
    ('Forest Background', 'A lush forest profile background', 'profile_background', 'uncommon', 'launch'),
    -- Rare (winner rewards)
    ('Champion Crown', 'Only for challenge winners', 'profile_badge', 'rare', 'launch'),
    ('Flame Border', 'An animated flame avatar border', 'avatar_border', 'rare', 'launch'),
    ('Victory Dance', 'A celebration animation for winners', 'victory_animation', 'rare', 'launch'),
    ('Golden Trophy', 'A shining 3D trophy for your profile', '3d_prop', 'rare', 'launch'),
    -- Legendary
    ('Diamond Crown', 'The ultimate champion badge', 'profile_badge', 'legendary', 'launch'),
    ('Aurora Border', 'A shimmering northern lights border', 'avatar_border', 'legendary', 'launch'),
    ('Crystal Trophy', 'A rare crystal 3D trophy', '3d_prop', 'legendary', 'launch')
ON CONFLICT DO NOTHING;

-- Update accept_challenge_invitation to enforce single-challenge double XP
-- Double XP (xp_multiplier = 2) only applies to ONE challenge at a time
-- Drop first because return type may have changed
DROP FUNCTION IF EXISTS accept_challenge_invitation(UUID, UUID);
CREATE OR REPLACE FUNCTION accept_challenge_invitation(
    challenge_uuid UUID,
    user_uuid UUID
)
RETURNS VOID AS $$
DECLARE
    user_current_points INTEGER;
    has_active_2x BOOLEAN;
    multiplier INTEGER;
BEGIN
    -- Get user's current points
    SELECT COALESCE(current_points, 0) INTO user_current_points
    FROM public.user_points
    WHERE user_id = user_uuid;

    -- Check if user already has double XP active in another challenge
    SELECT EXISTS (
        SELECT 1 FROM public.challenge_participants cp
        JOIN public.challenges c ON c.id = cp.challenge_id
        WHERE cp.user_id = user_uuid
        AND cp.status = 'accepted'
        AND cp.xp_multiplier = 2
        AND c.status IN ('pending', 'active')
        AND c.id != challenge_uuid
    ) INTO has_active_2x;

    -- Only get 2x if no other challenge has it active
    multiplier := CASE WHEN has_active_2x THEN 1 ELSE 2 END;

    -- Update participant status to accepted
    UPDATE public.challenge_participants
    SET
        status = 'accepted',
        accepted_at = NOW(),
        starting_points = user_current_points,
        current_points = user_current_points,
        challenge_points = 0,
        xp_multiplier = multiplier
    WHERE challenge_id = challenge_uuid
    AND user_id = user_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant access
GRANT EXECUTE ON FUNCTION accept_challenge_invitation(UUID, UUID) TO authenticated;

-- Update complete_challenge to award cosmetic prizes
-- Drop first because return type may have changed
DROP FUNCTION IF EXISTS complete_challenge(UUID);
CREATE OR REPLACE FUNCTION complete_challenge(challenge_uuid UUID)
RETURNS JSONB AS $$
DECLARE
    winner_user_id UUID;
    winner_pts INT;
    winner_user_name TEXT;
    already_rewarded BOOLEAN;
    participant_record RECORD;
    random_item_id UUID;
BEGIN
    -- Check if winner was already rewarded
    SELECT winner_rewarded INTO already_rewarded
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

    -- Update challenge with winner
    UPDATE public.challenges
    SET
        status = 'completed',
        winner_id = winner_user_id,
        winner_points = winner_pts,
        completed_at = NOW(),
        updated_at = NOW()
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

    -- Award RARE cosmetic to winner (random rare+ item they don't own yet)
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

    -- Award COMMON cosmetic to all other participants
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

    -- Mark as rewarded
    UPDATE public.challenges
    SET winner_rewarded = TRUE
    WHERE id = challenge_uuid;

    RETURN jsonb_build_object(
        'winner_id', winner_user_id,
        'winner_name', winner_user_name,
        'winner_points', winner_pts,
        'reward_points', 200,
        'prizes_awarded', TRUE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant access
GRANT EXECUTE ON FUNCTION complete_challenge(UUID) TO authenticated;

-- RLS policies for cosmetic tables
ALTER TABLE public.cosmetic_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_inventory ENABLE ROW LEVEL SECURITY;

-- Anyone can view cosmetic items
CREATE POLICY "Anyone can view cosmetic items" ON public.cosmetic_items
    FOR SELECT USING (true);

-- Users can view their own inventory
CREATE POLICY "Users can view own inventory" ON public.user_inventory
    FOR SELECT USING (auth.uid() = user_id);

-- Users can update their own inventory (equip/unequip)
CREATE POLICY "Users can update own inventory" ON public.user_inventory
    FOR UPDATE USING (auth.uid() = user_id);

-- Service role can insert (for prize distribution)
CREATE POLICY "Service can insert inventory" ON public.user_inventory
    FOR INSERT WITH CHECK (true);

-- Function to get user's inventory
DROP FUNCTION IF EXISTS get_user_inventory(UUID);
CREATE OR REPLACE FUNCTION get_user_inventory(user_uuid UUID)
RETURNS TABLE (
    inventory_id UUID,
    item_id UUID,
    item_name TEXT,
    item_description TEXT,
    item_type TEXT,
    rarity TEXT,
    asset_url TEXT,
    thumbnail_url TEXT,
    season TEXT,
    source TEXT,
    is_equipped BOOLEAN,
    acquired_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        ui.id as inventory_id,
        ci.id as item_id,
        ci.name as item_name,
        ci.description as item_description,
        ci.item_type,
        ci.rarity,
        ci.asset_url,
        ci.thumbnail_url,
        ci.season,
        ui.source,
        ui.is_equipped,
        ui.acquired_at
    FROM public.user_inventory ui
    JOIN public.cosmetic_items ci ON ci.id = ui.item_id
    WHERE ui.user_id = user_uuid
    ORDER BY ui.acquired_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_user_inventory(UUID) TO authenticated;

-- Function to equip/unequip an item
DROP FUNCTION IF EXISTS toggle_equip_item(UUID, UUID);
CREATE OR REPLACE FUNCTION toggle_equip_item(user_uuid UUID, inventory_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
    current_equipped BOOLEAN;
    item_type_val TEXT;
BEGIN
    -- Get current state and item type
    SELECT ui.is_equipped, ci.item_type INTO current_equipped, item_type_val
    FROM public.user_inventory ui
    JOIN public.cosmetic_items ci ON ci.id = ui.item_id
    WHERE ui.id = inventory_uuid AND ui.user_id = user_uuid;

    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    -- Unequip any other item of same type first
    IF NOT current_equipped THEN
        UPDATE public.user_inventory ui
        SET is_equipped = FALSE
        FROM public.cosmetic_items ci
        WHERE ui.item_id = ci.id
        AND ui.user_id = user_uuid
        AND ci.item_type = item_type_val
        AND ui.is_equipped = TRUE;
    END IF;

    -- Toggle the target item
    UPDATE public.user_inventory
    SET is_equipped = NOT current_equipped
    WHERE id = inventory_uuid AND user_id = user_uuid;

    RETURN NOT current_equipped;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION toggle_equip_item(UUID, UUID) TO authenticated;
