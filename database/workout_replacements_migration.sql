-- ============================================================
-- WORKOUT REPLACEMENTS TABLE
-- Allows users to temporarily replace workouts on specific days
-- ============================================================

CREATE TABLE IF NOT EXISTS public.workout_replacements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- Which day of the week (0 = Monday, 6 = Sunday)
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),

  -- Replacement workout details (JSONB)
  -- Format: { type: 'library'|'custom'|'rest'|'swap', name: string, category?: string, subcategory?: string }
  replacement_workout JSONB NOT NULL,

  -- Duration of replacement
  duration_weeks INTEGER NOT NULL DEFAULT 1 CHECK (duration_weeks >= 1 AND duration_weeks <= 12),

  -- When the replacement starts and ends
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_workout_replacements_user ON public.workout_replacements (user_id);
CREATE INDEX IF NOT EXISTS idx_workout_replacements_active ON public.workout_replacements (user_id, start_date, end_date);

-- Enable Row Level Security
ALTER TABLE public.workout_replacements ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can manage their own workout replacements
CREATE POLICY "Users can manage own workout replacements" ON public.workout_replacements
  FOR ALL USING (auth.uid() = user_id);
