-- Custom Cards Migration
-- Stores user-created cards (quizzes, trackers, challenges, checklists) built via AI Card Builder

CREATE TABLE IF NOT EXISTS custom_cards (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    card_type TEXT NOT NULL CHECK (card_type IN ('quiz', 'tracker', 'challenge', 'checklist')),
    title TEXT NOT NULL,
    description TEXT,
    card_data JSONB NOT NULL DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast user lookups
CREATE INDEX IF NOT EXISTS idx_custom_cards_user_id ON custom_cards(user_id);
CREATE INDEX IF NOT EXISTS idx_custom_cards_active ON custom_cards(user_id, is_active) WHERE is_active = true;

-- RLS
ALTER TABLE custom_cards ENABLE ROW LEVEL SECURITY;

-- Users can read their own cards
CREATE POLICY "Users can read own cards" ON custom_cards
    FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own cards
CREATE POLICY "Users can insert own cards" ON custom_cards
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own cards
CREATE POLICY "Users can update own cards" ON custom_cards
    FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own cards
CREATE POLICY "Users can delete own cards" ON custom_cards
    FOR DELETE USING (auth.uid() = user_id);

-- Tracker daily logs (for tracker-type cards)
CREATE TABLE IF NOT EXISTS custom_card_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    card_id UUID NOT NULL REFERENCES custom_cards(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    log_date DATE NOT NULL DEFAULT CURRENT_DATE,
    log_data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(card_id, log_date)
);

CREATE INDEX IF NOT EXISTS idx_custom_card_logs_card ON custom_card_logs(card_id, log_date DESC);

ALTER TABLE custom_card_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own logs" ON custom_card_logs
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own logs" ON custom_card_logs
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own logs" ON custom_card_logs
    FOR UPDATE USING (auth.uid() = user_id);
