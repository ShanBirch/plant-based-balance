-- Migration: Add personal bests table for tracking exercise PRs
-- Purpose: Track user's all-time best performance for each exercise

-- ============================================================
-- PERSONAL BESTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.personal_bests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- Exercise identification
  exercise_name TEXT NOT NULL,

  -- Best performance metrics
  best_weight_kg NUMERIC,           -- All-time heaviest weight
  best_weight_reps INTEGER,         -- Reps achieved at best weight
  best_weight_date DATE,            -- When best weight was achieved

  best_reps INTEGER,                -- All-time most reps (at any weight)
  best_reps_weight_kg NUMERIC,      -- Weight used for best reps
  best_reps_date DATE,              -- When best reps were achieved

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Each user can only have one PB record per exercise
  UNIQUE(user_id, exercise_name),
  INDEX idx_personal_bests_user (user_id, updated_at DESC)
);

-- Enable RLS
ALTER TABLE public.personal_bests ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own personal bests" ON public.personal_bests
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own personal bests" ON public.personal_bests
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own personal bests" ON public.personal_bests
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all personal bests" ON public.personal_bests
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE admin_users.user_id = auth.uid()
    )
  );

-- Update trigger for updated_at
CREATE TRIGGER update_personal_bests_updated_at BEFORE UPDATE ON public.personal_bests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- PB HISTORY TABLE (tracks when PBs were broken)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.pb_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- What PB was broken
  exercise_name TEXT NOT NULL,
  pb_type TEXT NOT NULL,            -- 'weight' or 'reps'

  -- New record
  new_value NUMERIC NOT NULL,       -- New weight or reps
  new_reps INTEGER,                 -- Reps (if weight PB)
  new_weight_kg NUMERIC,            -- Weight (if reps PB)

  -- Previous record (for comparison)
  previous_value NUMERIC,
  improvement NUMERIC,              -- How much better (new - previous)

  -- When it happened
  achieved_at TIMESTAMPTZ DEFAULT NOW(),
  workout_date DATE,

  INDEX idx_pb_history_user (user_id, achieved_at DESC)
);

-- Enable RLS
ALTER TABLE public.pb_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for pb_history
CREATE POLICY "Users can view own pb history" ON public.pb_history
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own pb history" ON public.pb_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all pb history" ON public.pb_history
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE admin_users.user_id = auth.uid()
    )
  );
