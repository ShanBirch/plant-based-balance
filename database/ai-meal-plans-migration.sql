-- =============================================
-- AI-Generated Meal Plans Migration
-- Stores personalized meal plans created by FITGotchi AI Coach
-- =============================================

-- Main table for AI-generated meal plans
CREATE TABLE IF NOT EXISTS public.ai_generated_meal_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    plan_name TEXT NOT NULL,
    plan_description TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('generating', 'active', 'archived')),
    generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Snapshot of user goals at generation time
    calorie_goal INTEGER,
    protein_goal_g INTEGER,
    carbs_goal_g INTEGER,
    fat_goal_g INTEGER,
    diet_type TEXT DEFAULT 'vegan',

    -- Metadata
    total_meals INTEGER DEFAULT 140,
    current_week INTEGER DEFAULT 1,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Individual meals within an AI-generated plan
CREATE TABLE IF NOT EXISTS public.ai_generated_meals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id UUID NOT NULL REFERENCES public.ai_generated_meal_plans(id) ON DELETE CASCADE,

    -- Position
    week_number INTEGER NOT NULL CHECK (week_number BETWEEN 1 AND 4),
    day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    day_name TEXT NOT NULL,
    meal_slot TEXT NOT NULL CHECK (meal_slot IN ('breakfast', 'am_snack', 'lunch', 'pm_snack', 'dinner')),
    meal_time TEXT, -- e.g., "7:30 AM"

    -- Meal details
    name TEXT NOT NULL,
    description TEXT,
    calories INTEGER,
    protein_g NUMERIC(6,1),
    carbs_g NUMERIC(6,1),
    fat_g NUMERIC(6,1),
    fiber_g NUMERIC(6,1),

    -- Recipe
    ingredients JSONB DEFAULT '[]'::jsonb, -- [{name, amount}]
    preparation TEXT,
    prep_time_mins INTEGER,
    cook_time_mins INTEGER,

    -- Metadata
    tags TEXT[] DEFAULT '{}',
    cuisine TEXT,
    image_url TEXT, -- AI-generated meal photo URL or base64 data URI

    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Week themes for AI plans
CREATE TABLE IF NOT EXISTS public.ai_meal_plan_weeks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id UUID NOT NULL REFERENCES public.ai_generated_meal_plans(id) ON DELETE CASCADE,
    week_number INTEGER NOT NULL CHECK (week_number BETWEEN 1 AND 4),
    theme TEXT NOT NULL,
    theme_description TEXT,

    UNIQUE(plan_id, week_number)
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_ai_meal_plans_user ON public.ai_generated_meal_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_meal_plans_status ON public.ai_generated_meal_plans(user_id, status);
CREATE INDEX IF NOT EXISTS idx_ai_meals_plan ON public.ai_generated_meals(plan_id);
CREATE INDEX IF NOT EXISTS idx_ai_meals_week ON public.ai_generated_meals(plan_id, week_number);
CREATE INDEX IF NOT EXISTS idx_ai_meals_day ON public.ai_generated_meals(plan_id, week_number, day_of_week);

-- RLS Policies
ALTER TABLE public.ai_generated_meal_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_generated_meals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_meal_plan_weeks ENABLE ROW LEVEL SECURITY;

-- Users can view/manage their own AI meal plans
CREATE POLICY "Users can view own AI meal plans"
    ON public.ai_generated_meal_plans FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own AI meal plans"
    ON public.ai_generated_meal_plans FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own AI meal plans"
    ON public.ai_generated_meal_plans FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own AI meal plans"
    ON public.ai_generated_meal_plans FOR DELETE
    USING (auth.uid() = user_id);

-- Users can view/manage meals in their plans
CREATE POLICY "Users can view own AI meals"
    ON public.ai_generated_meals FOR SELECT
    USING (plan_id IN (SELECT id FROM public.ai_generated_meal_plans WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert own AI meals"
    ON public.ai_generated_meals FOR INSERT
    WITH CHECK (plan_id IN (SELECT id FROM public.ai_generated_meal_plans WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete own AI meals"
    ON public.ai_generated_meals FOR DELETE
    USING (plan_id IN (SELECT id FROM public.ai_generated_meal_plans WHERE user_id = auth.uid()));

-- Week themes
CREATE POLICY "Users can view own AI week themes"
    ON public.ai_meal_plan_weeks FOR SELECT
    USING (plan_id IN (SELECT id FROM public.ai_generated_meal_plans WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert own AI week themes"
    ON public.ai_meal_plan_weeks FOR INSERT
    WITH CHECK (plan_id IN (SELECT id FROM public.ai_generated_meal_plans WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete own AI week themes"
    ON public.ai_meal_plan_weeks FOR DELETE
    USING (plan_id IN (SELECT id FROM public.ai_generated_meal_plans WHERE user_id = auth.uid()));

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_ai_meal_plan_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ai_meal_plan_updated_at
    BEFORE UPDATE ON public.ai_generated_meal_plans
    FOR EACH ROW EXECUTE FUNCTION update_ai_meal_plan_timestamp();
