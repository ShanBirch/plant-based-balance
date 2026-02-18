-- Coach Personality Migration
-- Allows coaches to customise their AI personality so it matches their voice

CREATE TABLE IF NOT EXISTS coach_personality (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    coach_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    traits TEXT[] DEFAULT '{}',
    example_messages TEXT DEFAULT '',
    phrases TEXT DEFAULT '',
    avoid TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE coach_personality ENABLE ROW LEVEL SECURITY;

-- Coaches can read/write their own personality
CREATE POLICY "Coaches can manage their own personality"
    ON coach_personality FOR ALL
    USING (auth.uid() = coach_id)
    WITH CHECK (auth.uid() = coach_id);

-- Edge functions need to read personality data for any coach (service role)
-- The anon key policy allows the coach to manage their data
-- Edge functions use the service role key which bypasses RLS

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_coach_personality_coach_id ON coach_personality(coach_id);
