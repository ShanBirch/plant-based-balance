-- Feed Reactions Migration
-- Allows users to react to feed posts (stories) with emoji reactions

-- Create feed_reactions table
CREATE TABLE IF NOT EXISTS feed_reactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    story_id UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    reaction VARCHAR(20) NOT NULL, -- emoji reaction type: 'love', 'muscle', 'fire', 'clap', 'wow'
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Each user can only have one reaction per story (they can change it)
    UNIQUE(story_id, user_id)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_feed_reactions_story_id ON feed_reactions(story_id);
CREATE INDEX IF NOT EXISTS idx_feed_reactions_user_id ON feed_reactions(user_id);

-- Enable RLS
ALTER TABLE feed_reactions ENABLE ROW LEVEL SECURITY;

-- Users can see all reactions on stories they can see
CREATE POLICY "Users can view feed reactions" ON feed_reactions
    FOR SELECT USING (true);

-- Users can insert their own reactions
CREATE POLICY "Users can create their own reactions" ON feed_reactions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own reactions
CREATE POLICY "Users can update their own reactions" ON feed_reactions
    FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own reactions
CREATE POLICY "Users can delete their own reactions" ON feed_reactions
    FOR DELETE USING (auth.uid() = user_id);

-- Function to get reaction counts for a story
CREATE OR REPLACE FUNCTION get_story_reactions(story_uuid UUID)
RETURNS TABLE(reaction VARCHAR, count BIGINT, reacted_by_me BOOLEAN) AS $$
BEGIN
    RETURN QUERY
    SELECT
        fr.reaction,
        COUNT(*)::BIGINT as count,
        BOOL_OR(fr.user_id = auth.uid()) as reacted_by_me
    FROM feed_reactions fr
    WHERE fr.story_id = story_uuid
    GROUP BY fr.reaction
    ORDER BY count DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to toggle a reaction (add or remove)
CREATE OR REPLACE FUNCTION toggle_feed_reaction(p_story_id UUID, p_user_id UUID, p_reaction VARCHAR)
RETURNS JSON AS $$
DECLARE
    existing_reaction VARCHAR;
    result JSON;
BEGIN
    -- Check if user already has a reaction on this story
    SELECT reaction INTO existing_reaction
    FROM feed_reactions
    WHERE story_id = p_story_id AND user_id = p_user_id;

    IF existing_reaction IS NOT NULL THEN
        IF existing_reaction = p_reaction THEN
            -- Same reaction: remove it (toggle off)
            DELETE FROM feed_reactions
            WHERE story_id = p_story_id AND user_id = p_user_id;
            result := json_build_object('action', 'removed', 'reaction', p_reaction);
        ELSE
            -- Different reaction: update to new one
            UPDATE feed_reactions
            SET reaction = p_reaction, created_at = NOW()
            WHERE story_id = p_story_id AND user_id = p_user_id;
            result := json_build_object('action', 'updated', 'reaction', p_reaction);
        END IF;
    ELSE
        -- No existing reaction: add new one
        INSERT INTO feed_reactions (story_id, user_id, reaction)
        VALUES (p_story_id, p_user_id, p_reaction);
        result := json_build_object('action', 'added', 'reaction', p_reaction);
    END IF;

    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
