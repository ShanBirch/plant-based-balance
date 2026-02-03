-- Daily Weigh-ins Migration
-- Tracks daily weight check-ins with points reward (4 points, once per day)

-- Create daily_weigh_ins table
CREATE TABLE IF NOT EXISTS public.daily_weigh_ins (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  weigh_in_date DATE NOT NULL,
  weight_kg NUMERIC NOT NULL,
  notes TEXT,
  points_awarded INTEGER DEFAULT 4,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, weigh_in_date)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_weigh_ins_user_date ON public.daily_weigh_ins(user_id, weigh_in_date DESC);

-- Enable RLS
ALTER TABLE public.daily_weigh_ins ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only see and modify their own weigh-ins
CREATE POLICY "Users can view own weigh-ins" ON public.daily_weigh_ins
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own weigh-ins" ON public.daily_weigh_ins
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own weigh-ins" ON public.daily_weigh_ins
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own weigh-ins" ON public.daily_weigh_ins
  FOR DELETE USING (auth.uid() = user_id);

-- Grant permissions
GRANT ALL ON public.daily_weigh_ins TO authenticated;
GRANT ALL ON public.daily_weigh_ins TO service_role;
