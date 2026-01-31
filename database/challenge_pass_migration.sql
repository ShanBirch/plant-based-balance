-- Challenge Pass Migration
-- Adds support for paid challenge access with double XP

-- Add challenge_pass_purchased column to users table
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS has_challenge_pass BOOLEAN DEFAULT FALSE;

-- Add challenge_pass_purchased_at timestamp
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS challenge_pass_purchased_at TIMESTAMPTZ;

-- Add xp_multiplier column to challenge_participants
-- This stores the XP multiplier for each participant (1 for free, 2 for paid)
ALTER TABLE public.challenge_participants
ADD COLUMN IF NOT EXISTS xp_multiplier INTEGER DEFAULT 1;

-- Create index for quick lookups
CREATE INDEX IF NOT EXISTS idx_users_challenge_pass
ON public.users(has_challenge_pass)
WHERE has_challenge_pass = TRUE;

-- Function to check if user has challenge pass
CREATE OR REPLACE FUNCTION has_challenge_pass(user_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.users
        WHERE id = user_uuid AND has_challenge_pass = TRUE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant access to authenticated users
GRANT EXECUTE ON FUNCTION has_challenge_pass(UUID) TO authenticated;

-- Update accept_challenge_invitation to set xp_multiplier based on challenge pass
CREATE OR REPLACE FUNCTION accept_challenge_invitation(
    challenge_uuid UUID,
    user_uuid UUID
)
RETURNS VOID AS $$
DECLARE
    user_current_points INTEGER;
    user_has_pass BOOLEAN;
    multiplier INTEGER;
BEGIN
    -- Get user's current points
    SELECT COALESCE(current_points, 0) INTO user_current_points
    FROM public.user_points
    WHERE user_id = user_uuid;

    -- Check if user has challenge pass
    SELECT COALESCE(has_challenge_pass, FALSE) INTO user_has_pass
    FROM public.users
    WHERE id = user_uuid;

    -- Set multiplier (2x if has pass, 1x if not)
    multiplier := CASE WHEN user_has_pass THEN 2 ELSE 1 END;

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

-- Update the challenge points sync function to apply XP multiplier
-- This is called after points are awarded to sync with active challenges
CREATE OR REPLACE FUNCTION update_challenge_participant_points(user_uuid UUID)
RETURNS VOID AS $$
DECLARE
    user_current_points INTEGER;
    participant_record RECORD;
BEGIN
    -- Get user's current total points
    SELECT COALESCE(current_points, 0) INTO user_current_points
    FROM public.user_points
    WHERE user_id = user_uuid;

    -- Update all active challenge participations for this user
    -- Apply the xp_multiplier to challenge_points calculation
    FOR participant_record IN
        SELECT cp.challenge_id, cp.starting_points, cp.xp_multiplier
        FROM public.challenge_participants cp
        JOIN public.challenges c ON c.id = cp.challenge_id
        WHERE cp.user_id = user_uuid
        AND cp.status = 'accepted'
        AND c.status = 'active'
    LOOP
        UPDATE public.challenge_participants
        SET
            current_points = user_current_points,
            -- Apply multiplier to challenge points (2x for pass holders)
            challenge_points = (user_current_points - participant_record.starting_points) * COALESCE(participant_record.xp_multiplier, 1)
        WHERE challenge_id = participant_record.challenge_id
        AND user_id = user_uuid;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant access
GRANT EXECUTE ON FUNCTION update_challenge_participant_points(UUID) TO authenticated;

-- Also update the creator's participant record when creating a challenge
-- to respect their challenge pass status
CREATE OR REPLACE FUNCTION set_creator_xp_multiplier()
RETURNS TRIGGER AS $$
DECLARE
    creator_has_pass BOOLEAN;
    multiplier INTEGER;
BEGIN
    -- Check if creator has challenge pass
    SELECT COALESCE(has_challenge_pass, FALSE) INTO creator_has_pass
    FROM public.users
    WHERE id = NEW.user_id;

    -- Set multiplier
    multiplier := CASE WHEN creator_has_pass THEN 2 ELSE 1 END;

    -- Update the multiplier
    NEW.xp_multiplier := multiplier;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to set xp_multiplier on insert
DROP TRIGGER IF EXISTS set_challenge_creator_multiplier ON public.challenge_participants;
CREATE TRIGGER set_challenge_creator_multiplier
    BEFORE INSERT ON public.challenge_participants
    FOR EACH ROW
    WHEN (NEW.status = 'accepted')
    EXECUTE FUNCTION set_creator_xp_multiplier();
