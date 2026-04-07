-- Feed Comments Migration
-- Allows users to comment on feed posts (stories)

-- Create feed_comments table
CREATE TABLE IF NOT EXISTS feed_comments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    story_id UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    comment_text TEXT NOT NULL CHECK (char_length(comment_text) > 0 AND char_length(comment_text) <= 500),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_feed_comments_story_id ON feed_comments(story_id);
CREATE INDEX IF NOT EXISTS idx_feed_comments_created_at ON feed_comments(story_id, created_at DESC);

-- Enable RLS
ALTER TABLE feed_comments ENABLE ROW LEVEL SECURITY;

-- Users can see all comments on stories they can see
CREATE POLICY "Users can view feed comments" ON feed_comments
    FOR SELECT USING (true);

-- Users can insert their own comments
CREATE POLICY "Users can create their own comments" ON feed_comments
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can delete their own comments
CREATE POLICY "Users can delete their own comments" ON feed_comments
    FOR DELETE USING (auth.uid() = user_id);

-- Function to get comments for a story (most recent first, limited)
CREATE OR REPLACE FUNCTION get_story_comments(p_story_id UUID, p_limit INT DEFAULT 20)
RETURNS TABLE(
    comment_id UUID,
    user_id UUID,
    user_name TEXT,
    profile_photo TEXT,
    comment_text TEXT,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        fc.id AS comment_id,
        fc.user_id,
        COALESCE(p.display_name, p.full_name, 'Unknown') AS user_name,
        p.profile_photo,
        fc.comment_text,
        fc.created_at
    FROM feed_comments fc
    LEFT JOIN profiles p ON p.id = fc.user_id
    WHERE fc.story_id = p_story_id
    ORDER BY fc.created_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get comment counts for multiple stories at once
CREATE OR REPLACE FUNCTION get_bulk_comment_counts(p_story_ids UUID[])
RETURNS TABLE(story_id UUID, comment_count BIGINT) AS $$
BEGIN
    RETURN QUERY
    SELECT fc.story_id, COUNT(*)::BIGINT AS comment_count
    FROM feed_comments fc
    WHERE fc.story_id = ANY(p_story_ids)
    GROUP BY fc.story_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
