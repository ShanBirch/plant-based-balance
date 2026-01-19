-- Calorie Tracker Migration
-- Add meal logging and nutrition tracking tables

-- ============================================================
-- MEAL LOGS TABLE (individual meal photos and AI analysis)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.meal_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- Meal metadata
  meal_date DATE NOT NULL,
  meal_time TIME NOT NULL,
  meal_type TEXT, -- 'breakfast', 'lunch', 'dinner', 'snack'

  -- Photo storage
  photo_url TEXT, -- Supabase Storage URL
  storage_path TEXT, -- Path in meal-photos bucket

  -- AI Analysis results
  food_items JSONB DEFAULT '[]', -- Array of detected food items
  calories NUMERIC(7,2),
  protein_g NUMERIC(6,2),
  carbs_g NUMERIC(6,2),
  fat_g NUMERIC(6,2),
  fiber_g NUMERIC(6,2),

  -- Micronutrients (optional)
  micronutrients JSONB DEFAULT '{}', -- {vitamin_c: 20, iron: 5, etc.}

  -- User notes
  notes TEXT,

  -- AI metadata
  ai_confidence TEXT, -- 'high', 'medium', 'low'
  ai_model TEXT DEFAULT 'gemini-flash-latest',
  analysis_timestamp TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for meal_logs
CREATE INDEX IF NOT EXISTS idx_meal_logs_user_date ON public.meal_logs (user_id, meal_date DESC);

-- ============================================================
-- DAILY NUTRITION TABLE (aggregated daily totals)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.daily_nutrition (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- Date
  nutrition_date DATE NOT NULL,

  -- Daily totals
  total_calories NUMERIC(7,2) DEFAULT 0,
  total_protein_g NUMERIC(7,2) DEFAULT 0,
  total_carbs_g NUMERIC(7,2) DEFAULT 0,
  total_fat_g NUMERIC(7,2) DEFAULT 0,
  total_fiber_g NUMERIC(7,2) DEFAULT 0,

  -- Meal counts
  meal_count INTEGER DEFAULT 0,

  -- User goals (can be updated)
  calorie_goal NUMERIC(7,2) DEFAULT 2000,
  protein_goal_g NUMERIC(6,2) DEFAULT 50,
  carbs_goal_g NUMERIC(6,2) DEFAULT 250,
  fat_goal_g NUMERIC(6,2) DEFAULT 70,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, nutrition_date)
);

-- Create index for daily_nutrition
CREATE INDEX IF NOT EXISTS idx_daily_nutrition_user_date ON public.daily_nutrition (user_id, nutrition_date DESC);

-- ============================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================

-- Enable RLS on new tables
ALTER TABLE public.meal_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_nutrition ENABLE ROW LEVEL SECURITY;

-- Users can only access their own meal logs
CREATE POLICY "Users can view own meal logs" ON public.meal_logs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own meal logs" ON public.meal_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own meal logs" ON public.meal_logs
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own meal logs" ON public.meal_logs
  FOR DELETE USING (auth.uid() = user_id);

-- Users can only access their own daily nutrition
CREATE POLICY "Users can view own daily nutrition" ON public.daily_nutrition
  FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- AUTOMATED TRIGGERS
-- ============================================================

-- Update updated_at timestamp automatically
CREATE TRIGGER update_meal_logs_updated_at BEFORE UPDATE ON public.meal_logs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_daily_nutrition_updated_at BEFORE UPDATE ON public.daily_nutrition
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- FUNCTION: Update daily nutrition totals when meal is added/updated/deleted
-- ============================================================
CREATE OR REPLACE FUNCTION update_daily_nutrition_totals()
RETURNS TRIGGER AS $$
DECLARE
  target_date DATE;
  target_user UUID;
BEGIN
  -- Determine which date and user to update
  IF (TG_OP = 'DELETE') THEN
    target_date := OLD.meal_date;
    target_user := OLD.user_id;
  ELSE
    target_date := NEW.meal_date;
    target_user := NEW.user_id;
  END IF;

  -- Recalculate daily totals
  INSERT INTO public.daily_nutrition (
    user_id,
    nutrition_date,
    total_calories,
    total_protein_g,
    total_carbs_g,
    total_fat_g,
    total_fiber_g,
    meal_count
  )
  SELECT
    target_user,
    target_date,
    COALESCE(SUM(calories), 0),
    COALESCE(SUM(protein_g), 0),
    COALESCE(SUM(carbs_g), 0),
    COALESCE(SUM(fat_g), 0),
    COALESCE(SUM(fiber_g), 0),
    COUNT(*)
  FROM public.meal_logs
  WHERE user_id = target_user
    AND meal_date = target_date
  ON CONFLICT (user_id, nutrition_date)
  DO UPDATE SET
    total_calories = EXCLUDED.total_calories,
    total_protein_g = EXCLUDED.total_protein_g,
    total_carbs_g = EXCLUDED.total_carbs_g,
    total_fat_g = EXCLUDED.total_fat_g,
    total_fiber_g = EXCLUDED.total_fiber_g,
    meal_count = EXCLUDED.meal_count,
    updated_at = NOW();

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to meal_logs table
CREATE TRIGGER update_daily_nutrition_on_meal_change
  AFTER INSERT OR UPDATE OR DELETE ON public.meal_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_daily_nutrition_totals();

-- ============================================================
-- STORAGE BUCKET SETUP (run in Supabase Storage dashboard)
-- ============================================================
-- CREATE BUCKET meal-photos WITH PUBLIC = false;
--
-- Storage Policy: Users can upload their own meal photos
-- CREATE POLICY "Users can upload own meal photos"
-- ON storage.objects FOR INSERT
-- WITH CHECK (bucket_id = 'meal-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
--
-- CREATE POLICY "Users can view own meal photos"
-- ON storage.objects FOR SELECT
-- USING (bucket_id = 'meal-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
--
-- CREATE POLICY "Users can delete own meal photos"
-- ON storage.objects FOR DELETE
-- USING (bucket_id = 'meal-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
