-- User Saved Meals Migration
-- Adds a table for user-composed "build a meal" recipes that can be
-- quickly re-logged from the Recent Meals → Saved tab.

-- ============================================================
-- USER SAVED MEALS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.user_saved_meals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- Meal identity
  name TEXT NOT NULL,
  emoji TEXT DEFAULT '🍽️',

  -- Composed contents (array of food items matching meal_logs.food_items shape)
  food_items JSONB NOT NULL DEFAULT '[]',

  -- Aggregated totals (denormalized for fast list rendering)
  calories NUMERIC(7,2) DEFAULT 0,
  protein_g NUMERIC(6,2) DEFAULT 0,
  carbs_g NUMERIC(6,2) DEFAULT 0,
  fat_g NUMERIC(6,2) DEFAULT 0,
  fiber_g NUMERIC(6,2) DEFAULT 0,

  -- Micronutrients (same shape as meal_logs.micronutrients)
  micronutrients JSONB DEFAULT '{}',

  -- Usage tracking for sorting "most used" first
  times_logged INTEGER DEFAULT 0,
  last_logged_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  INDEX idx_user_saved_meals_user (user_id, last_logged_at DESC NULLS LAST, created_at DESC)
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE public.user_saved_meals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own saved meals" ON public.user_saved_meals
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own saved meals" ON public.user_saved_meals
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own saved meals" ON public.user_saved_meals
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own saved meals" ON public.user_saved_meals
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================
CREATE TRIGGER update_user_saved_meals_updated_at BEFORE UPDATE ON public.user_saved_meals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
