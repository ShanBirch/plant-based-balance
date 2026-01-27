-- Plant Based Balance - Meal Plans System Migration
-- This migration adds support for:
-- 1. Multiple meal plan types (Summer Shred, Clean Bulk, Hormone Reset, etc.)
-- 2. Dietary variants (vegan, vegetarian, dairy-free, gluten-free, omnivore)
-- 3. Individual meal plan purchases ($9.99)
-- 4. User food preferences (from preference wizard)
-- 5. Meal progress tracking

-- ============================================================
-- MEAL PLANS TABLE (catalog of available plans)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.meal_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Plan identification
  slug TEXT UNIQUE NOT NULL,           -- "summer-shred", "clean-bulk", "hormone-reset"
  name TEXT NOT NULL,                   -- "Summer Shred 28-Day Plan"
  short_name TEXT,                      -- "Summer Shred" (for UI)
  description TEXT,
  tagline TEXT,                         -- "Lean out for summer with high-protein meals"

  -- Categorization
  plan_type TEXT NOT NULL,             -- "goal-based", "hormone", "seasonal", "lifestyle"
  goal_tags TEXT[] DEFAULT '{}',       -- ["weight-loss", "muscle-gain", "energy", "hormone-balance"]

  -- Duration and structure
  duration_weeks INTEGER DEFAULT 4,
  meals_per_day INTEGER DEFAULT 5,     -- breakfast, am_snack, lunch, pm_snack, dinner

  -- Targeting
  target_sex TEXT,                     -- "female", "male", null for both
  difficulty TEXT DEFAULT 'beginner', -- "beginner", "intermediate", "advanced"
  avg_prep_time_mins INTEGER,          -- Average meal prep time

  -- Nutrition ranges (for filtering)
  min_daily_calories INTEGER,
  max_daily_calories INTEGER,
  avg_daily_protein_g INTEGER,

  -- Pricing
  price_cents INTEGER DEFAULT 999,     -- $9.99
  stripe_price_id TEXT,                -- Stripe price ID for one-time purchase
  is_free BOOLEAN DEFAULT false,       -- Free plans (e.g., sample plans)
  is_included_in_subscription BOOLEAN DEFAULT true, -- Subscribers get access

  -- Display
  icon TEXT DEFAULT '🍽️',
  thumbnail_url TEXT,
  preview_description TEXT,            -- What shows before purchase
  featured BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,

  -- Metadata
  created_by TEXT DEFAULT 'system',    -- 'system', 'ai', 'user:{id}'
  version INTEGER DEFAULT 1,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  active BOOLEAN DEFAULT true
);

-- ============================================================
-- MEAL PLAN VARIANTS TABLE (dietary versions of each plan)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.meal_plan_variants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  meal_plan_id UUID NOT NULL REFERENCES public.meal_plans(id) ON DELETE CASCADE,

  -- Variant identification
  diet_type TEXT NOT NULL,             -- "vegan", "vegetarian", "pescatarian", "omnivore"
  variant_slug TEXT NOT NULL,          -- "summer-shred-vegan"

  -- Dietary flags (for filtering)
  is_vegan BOOLEAN DEFAULT false,
  is_vegetarian BOOLEAN DEFAULT false,
  is_dairy_free BOOLEAN DEFAULT false,
  is_gluten_free BOOLEAN DEFAULT false,
  is_nut_free BOOLEAN DEFAULT false,
  is_soy_free BOOLEAN DEFAULT false,
  is_low_fodmap BOOLEAN DEFAULT false,

  -- Variant-specific info
  description TEXT,                    -- "Plant-powered version with complete proteins"
  notes TEXT,                          -- Chef notes, substitution tips

  -- Status
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(meal_plan_id, diet_type)
);

-- Index for quick variant lookup
CREATE INDEX idx_meal_plan_variants_plan ON public.meal_plan_variants(meal_plan_id);
CREATE INDEX idx_meal_plan_variants_diet ON public.meal_plan_variants(diet_type);

-- ============================================================
-- MEALS TABLE (individual meals within plan variants)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.meals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  meal_plan_variant_id UUID NOT NULL REFERENCES public.meal_plan_variants(id) ON DELETE CASCADE,

  -- Position in plan
  week_number INTEGER NOT NULL CHECK (week_number >= 1 AND week_number <= 12),
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0=Monday, 6=Sunday
  meal_slot TEXT NOT NULL,             -- "breakfast", "am_snack", "lunch", "pm_snack", "dinner"

  -- Meal details
  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT,                      -- Path to meal photo
  image_placeholder TEXT,              -- Category placeholder if no specific photo

  -- Timing
  suggested_time TEXT,                 -- "7:30 AM", "12:00 PM"
  prep_time_mins INTEGER,
  cook_time_mins INTEGER,
  total_time_mins INTEGER,

  -- Nutrition (per serving)
  calories INTEGER,
  protein_g NUMERIC(6,2),
  carbs_g NUMERIC(6,2),
  fat_g NUMERIC(6,2),
  fiber_g NUMERIC(6,2),
  sugar_g NUMERIC(6,2),
  sodium_mg INTEGER,

  -- Recipe
  servings INTEGER DEFAULT 1,
  ingredients JSONB NOT NULL,          -- [{name: "Tofu", amount: "200g", notes: "firm, pressed"}]
  preparation TEXT,                    -- Full preparation instructions
  preparation_steps JSONB,             -- [{step: 1, instruction: "...", time_mins: 5}]
  tips TEXT,                           -- Chef tips

  -- Categorization for swapping/filtering
  tags TEXT[] DEFAULT '{}',            -- ["high-protein", "quick", "no-cook", "meal-prep-friendly"]
  cuisine TEXT,                        -- "asian", "mediterranean", "mexican", etc.
  meal_type TEXT,                      -- "smoothie", "bowl", "salad", "wrap", "soup", etc.

  -- Allergen info
  allergens TEXT[] DEFAULT '{}',       -- ["soy", "nuts", "gluten", "dairy"]

  -- For meal swapping
  swap_group TEXT,                     -- Meals in same group can be swapped
  difficulty TEXT DEFAULT 'easy',     -- "easy", "medium", "hard"

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for meal lookup
CREATE INDEX idx_meals_variant_position ON public.meals(meal_plan_variant_id, week_number, day_of_week, meal_slot);
CREATE INDEX idx_meals_tags ON public.meals USING GIN(tags);
CREATE INDEX idx_meals_swap_group ON public.meals(swap_group);

-- ============================================================
-- MEAL PLAN PURCHASES TABLE (one-time $9.99 purchases)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.meal_plan_purchases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  meal_plan_id UUID NOT NULL REFERENCES public.meal_plans(id),
  meal_plan_variant_id UUID REFERENCES public.meal_plan_variants(id),

  -- Purchase details
  stripe_payment_intent_id TEXT,
  stripe_checkout_session_id TEXT,
  amount_cents INTEGER,
  currency TEXT DEFAULT 'AUD',

  -- Purchase status
  status TEXT DEFAULT 'completed',     -- "pending", "completed", "refunded", "failed"
  purchase_date TIMESTAMPTZ DEFAULT NOW(),

  -- Access control
  access_starts TIMESTAMPTZ DEFAULT NOW(),
  access_expires TIMESTAMPTZ,          -- null = lifetime access

  -- User's selected variant
  selected_diet_type TEXT,             -- The dietary variant they chose

  -- Progress tracking
  started_at TIMESTAMPTZ,              -- When they started the plan
  completed_at TIMESTAMPTZ,            -- When they finished
  current_week INTEGER DEFAULT 1,
  current_day INTEGER DEFAULT 0,       -- 0 = hasn't started

  -- Source tracking
  source TEXT,                         -- "store", "upsell", "gift", "promo"
  promo_code TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, meal_plan_id, meal_plan_variant_id)
);

-- Index for quick purchase lookup
CREATE INDEX idx_meal_plan_purchases_user ON public.meal_plan_purchases(user_id);
CREATE INDEX idx_meal_plan_purchases_status ON public.meal_plan_purchases(status);

-- ============================================================
-- USER ASSIGNED MEAL PLANS TABLE (for quiz onboarders)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.user_assigned_meal_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  meal_plan_id UUID NOT NULL REFERENCES public.meal_plans(id),
  meal_plan_variant_id UUID REFERENCES public.meal_plan_variants(id),

  -- Assignment source
  assignment_source TEXT NOT NULL,     -- "quiz", "subscription", "admin", "gift"

  -- For quiz assignments
  quiz_result_id UUID REFERENCES public.quiz_results(id),
  hormone_profile TEXT,                -- "CORTISOL", "ESTROGEN" (from quiz)

  -- Progress tracking
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  current_week INTEGER DEFAULT 1,
  current_day INTEGER DEFAULT 1,

  -- Settings
  is_active BOOLEAN DEFAULT true,      -- Current active plan

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, meal_plan_id)
);

-- Index for quick lookup
CREATE INDEX idx_user_assigned_plans_user ON public.user_assigned_meal_plans(user_id);
CREATE INDEX idx_user_assigned_plans_active ON public.user_assigned_meal_plans(user_id, is_active);

-- ============================================================
-- USER FOOD PREFERENCES TABLE (from preference wizard)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.user_food_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- Diet type selection
  diet_type TEXT,                      -- "vegan", "vegetarian", "pescatarian", "omnivore"

  -- Allergies & restrictions (arrays for multiple selections)
  allergies TEXT[] DEFAULT '{}',       -- ["nuts", "soy", "gluten", "dairy", "shellfish", "eggs"]
  intolerances TEXT[] DEFAULT '{}',    -- ["lactose", "fructose", "fodmap"]

  -- Food preferences
  dislikes TEXT[] DEFAULT '{}',        -- ["tofu", "mushrooms", "eggplant"]
  favorites TEXT[] DEFAULT '{}',       -- ["avocado", "quinoa", "berries"]

  -- Cuisine preferences
  cuisine_preferences TEXT[] DEFAULT '{}', -- ["asian", "mediterranean", "mexican", "indian"]
  cuisine_dislikes TEXT[] DEFAULT '{}',

  -- Meal preferences
  prep_time_preference TEXT,           -- "quick" (<15min), "moderate" (15-30min), "any"
  cooking_skill TEXT,                  -- "beginner", "intermediate", "advanced"
  batch_cooking_ok BOOLEAN DEFAULT true,

  -- Flavor preferences
  spice_tolerance TEXT,                -- "mild", "medium", "spicy", "extra-spicy"
  sweetness_preference TEXT,           -- "low", "moderate", "sweet"

  -- Lifestyle
  meals_per_day INTEGER DEFAULT 5,
  snacking_preference TEXT,            -- "no-snacks", "light-snacks", "regular-snacks"

  -- Goals (can override quiz results)
  calorie_target INTEGER,
  protein_target_g INTEGER,
  carb_preference TEXT,                -- "low-carb", "moderate", "high-carb"

  -- Equipment
  has_blender BOOLEAN DEFAULT true,
  has_air_fryer BOOLEAN DEFAULT false,
  has_instant_pot BOOLEAN DEFAULT false,
  has_food_processor BOOLEAN DEFAULT false,

  -- Wizard completion
  wizard_completed BOOLEAN DEFAULT false,
  wizard_completed_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id)
);

-- ============================================================
-- USER MEAL PROGRESS TABLE (track meal completion/swaps)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.user_meal_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  meal_id UUID NOT NULL REFERENCES public.meals(id),

  -- Which plan instance this is for
  meal_plan_purchase_id UUID REFERENCES public.meal_plan_purchases(id),
  user_assigned_plan_id UUID REFERENCES public.user_assigned_meal_plans(id),

  -- Date for this instance
  meal_date DATE NOT NULL,

  -- Status
  status TEXT DEFAULT 'planned',       -- "planned", "completed", "skipped", "swapped"

  -- If swapped
  swapped_with_meal_id UUID REFERENCES public.meals(id),
  swap_reason TEXT,

  -- User feedback
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  notes TEXT,
  would_make_again BOOLEAN,

  -- Photo proof
  photo_url TEXT,

  -- Nutrition adjustments
  actual_servings NUMERIC(4,2),        -- If they ate more/less

  -- Timestamps
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, meal_id, meal_date)
);

-- Index for progress tracking
CREATE INDEX idx_user_meal_progress_user_date ON public.user_meal_progress(user_id, meal_date);

-- ============================================================
-- SHOPPING LIST ITEMS TABLE (generated from meal plans)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.shopping_list_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- What week this is for
  week_start_date DATE NOT NULL,
  meal_plan_variant_id UUID REFERENCES public.meal_plan_variants(id),

  -- Item details
  ingredient_name TEXT NOT NULL,
  amount TEXT,                         -- "200g", "2 cups", "1 bunch"
  category TEXT,                       -- "produce", "protein", "dairy", "pantry", "frozen"

  -- Status
  is_checked BOOLEAN DEFAULT false,

  -- Source meals (for reference)
  source_meal_ids UUID[] DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, week_start_date, ingredient_name)
);

-- Index for shopping list
CREATE INDEX idx_shopping_list_user_week ON public.shopping_list_items(user_id, week_start_date);

-- ============================================================
-- TRIGGERS
-- ============================================================

-- Update updated_at timestamps
CREATE TRIGGER update_meal_plans_updated_at BEFORE UPDATE ON public.meal_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_meal_plan_purchases_updated_at BEFORE UPDATE ON public.meal_plan_purchases
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_assigned_meal_plans_updated_at BEFORE UPDATE ON public.user_assigned_meal_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_food_preferences_updated_at BEFORE UPDATE ON public.user_food_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================

-- Enable RLS
ALTER TABLE public.meal_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_plan_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_plan_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_assigned_meal_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_food_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_meal_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shopping_list_items ENABLE ROW LEVEL SECURITY;

-- Meal plans are publicly viewable (for the store)
CREATE POLICY "Anyone can view active meal plans" ON public.meal_plans
  FOR SELECT USING (active = true);

-- Meal plan variants are publicly viewable
CREATE POLICY "Anyone can view meal plan variants" ON public.meal_plan_variants
  FOR SELECT USING (active = true);

-- Meals are viewable if user has access to the plan
CREATE POLICY "Users can view meals for purchased/assigned plans" ON public.meals
  FOR SELECT USING (
    -- User has purchased this plan variant
    EXISTS (
      SELECT 1 FROM public.meal_plan_purchases mpp
      JOIN public.meal_plan_variants mpv ON mpv.id = mpp.meal_plan_variant_id
      WHERE mpv.id = meals.meal_plan_variant_id
      AND mpp.user_id = auth.uid()
      AND mpp.status = 'completed'
    )
    OR
    -- User has this plan assigned (quiz onboarding)
    EXISTS (
      SELECT 1 FROM public.user_assigned_meal_plans uamp
      WHERE uamp.meal_plan_variant_id = meals.meal_plan_variant_id
      AND uamp.user_id = auth.uid()
      AND uamp.is_active = true
    )
    OR
    -- User has active subscription
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
      AND u.subscription_status = 'active'
    )
  );

-- Users can only access their own purchases
CREATE POLICY "Users can view own purchases" ON public.meal_plan_purchases
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own purchases" ON public.meal_plan_purchases
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can only access their own assigned plans
CREATE POLICY "Users can view own assigned plans" ON public.user_assigned_meal_plans
  FOR ALL USING (auth.uid() = user_id);

-- Users can only access their own food preferences
CREATE POLICY "Users can manage own food preferences" ON public.user_food_preferences
  FOR ALL USING (auth.uid() = user_id);

-- Users can only access their own meal progress
CREATE POLICY "Users can manage own meal progress" ON public.user_meal_progress
  FOR ALL USING (auth.uid() = user_id);

-- Users can only access their own shopping lists
CREATE POLICY "Users can manage own shopping lists" ON public.shopping_list_items
  FOR ALL USING (auth.uid() = user_id);

-- Admin policies
CREATE POLICY "Admins can manage all meal plans" ON public.meal_plans
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE admin_users.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage all meal plan variants" ON public.meal_plan_variants
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE admin_users.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage all meals" ON public.meals
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE admin_users.user_id = auth.uid()
    )
  );

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

-- Function to check if user has access to a meal plan
CREATE OR REPLACE FUNCTION public.user_has_meal_plan_access(plan_id UUID, user_id_param UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- Check subscription
  IF EXISTS (
    SELECT 1 FROM public.users
    WHERE id = user_id_param
    AND subscription_status = 'active'
  ) THEN
    RETURN true;
  END IF;

  -- Check purchase
  IF EXISTS (
    SELECT 1 FROM public.meal_plan_purchases
    WHERE user_id = user_id_param
    AND meal_plan_id = plan_id
    AND status = 'completed'
  ) THEN
    RETURN true;
  END IF;

  -- Check assignment (quiz onboarding)
  IF EXISTS (
    SELECT 1 FROM public.user_assigned_meal_plans
    WHERE user_id = user_id_param
    AND meal_plan_id = plan_id
    AND is_active = true
  ) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's active meal plan with variant
CREATE OR REPLACE FUNCTION public.get_user_active_meal_plan(user_id_param UUID)
RETURNS TABLE (
  meal_plan_id UUID,
  meal_plan_variant_id UUID,
  plan_slug TEXT,
  plan_name TEXT,
  diet_type TEXT,
  source TEXT,
  current_week INTEGER,
  current_day INTEGER,
  started_at TIMESTAMPTZ
) AS $$
BEGIN
  -- First check for assigned plans (quiz onboarding)
  RETURN QUERY
  SELECT
    uamp.meal_plan_id,
    uamp.meal_plan_variant_id,
    mp.slug,
    mp.name,
    mpv.diet_type,
    'assigned'::TEXT as source,
    uamp.current_week,
    uamp.current_day,
    uamp.started_at
  FROM public.user_assigned_meal_plans uamp
  JOIN public.meal_plans mp ON mp.id = uamp.meal_plan_id
  LEFT JOIN public.meal_plan_variants mpv ON mpv.id = uamp.meal_plan_variant_id
  WHERE uamp.user_id = user_id_param
  AND uamp.is_active = true
  LIMIT 1;

  -- If no assigned plan, check purchases
  IF NOT FOUND THEN
    RETURN QUERY
    SELECT
      mpp.meal_plan_id,
      mpp.meal_plan_variant_id,
      mp.slug,
      mp.name,
      mpv.diet_type,
      'purchased'::TEXT as source,
      mpp.current_week,
      mpp.current_day,
      mpp.started_at
    FROM public.meal_plan_purchases mpp
    JOIN public.meal_plans mp ON mp.id = mpp.meal_plan_id
    LEFT JOIN public.meal_plan_variants mpv ON mpv.id = mpp.meal_plan_variant_id
    WHERE mpp.user_id = user_id_param
    AND mpp.status = 'completed'
    ORDER BY mpp.started_at DESC NULLS LAST
    LIMIT 1;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- SEED DATA: Initial Meal Plan Catalog (empty plans to be filled)
-- ============================================================

-- Hormone Reset Plan (for quiz onboarders)
INSERT INTO public.meal_plans (slug, name, short_name, description, tagline, plan_type, goal_tags, target_sex, icon, sort_order, is_included_in_subscription)
VALUES
  ('hormone-reset', 'Hormone Reset Protocol', 'Hormone Reset',
   'A comprehensive 4-week meal plan designed to balance hormones through anti-inflammatory foods, liver support, blood sugar balancing, and adrenal nourishment.',
   'Balance your hormones with nourishing, healing meals',
   'hormone', ARRAY['hormone-balance', 'stress-reduction', 'energy', 'liver-health'], 'female', '🌿', 1, true)
ON CONFLICT (slug) DO NOTHING;

-- Goal-Based Plans (for purchase)
INSERT INTO public.meal_plans (slug, name, short_name, description, tagline, plan_type, goal_tags, icon, price_cents, sort_order, featured)
VALUES
  ('summer-shred', 'Summer Shred 28-Day', 'Summer Shred',
   'High-protein, calorie-conscious meal plan designed for fat loss while maintaining muscle. Features satisfying, filling meals that keep you energized.',
   'Lean out with delicious, high-protein meals',
   'goal-based', ARRAY['weight-loss', 'muscle-retention', 'energy'], '☀️', 999, 10, true),

  ('clean-bulk', 'Clean Bulk Protocol', 'Clean Bulk',
   'A muscle-building meal plan with quality calories from whole foods. High protein, strategic carbs, and nutrient-dense meals for lean mass gain.',
   'Build muscle with clean, whole-food nutrition',
   'goal-based', ARRAY['muscle-gain', 'strength', 'performance'], '💪', 999, 11, true),

  ('energy-boost', 'Energy Boost 28-Day', 'Energy Boost',
   'Combat fatigue with meals designed to stabilize blood sugar, support mitochondrial health, and provide sustained energy throughout the day.',
   'All-day energy through balanced, energizing meals',
   'goal-based', ARRAY['energy', 'focus', 'vitality'], '⚡', 999, 12, false),

  ('gut-reset', 'Gut Reset Protocol', 'Gut Reset',
   'A healing meal plan focused on gut health, featuring prebiotic and probiotic-rich foods, easy-to-digest meals, and inflammation-reducing ingredients.',
   'Heal your gut with nourishing, easy-to-digest meals',
   'goal-based', ARRAY['gut-health', 'digestion', 'inflammation'], '🌱', 999, 13, false),

  ('quick-easy', 'Quick & Easy Meals', 'Quick & Easy',
   'Perfect for busy schedules. Every meal takes 20 minutes or less to prepare. No compromise on nutrition or taste.',
   'Healthy eating made simple for busy lives',
   'lifestyle', ARRAY['time-saving', 'beginner-friendly', 'practical'], '⏱️', 999, 20, true)
ON CONFLICT (slug) DO NOTHING;

-- Create variants for each plan (initial setup - vegan and vegetarian)
INSERT INTO public.meal_plan_variants (meal_plan_id, diet_type, variant_slug, is_vegan, is_vegetarian, is_dairy_free, description)
SELECT
  mp.id,
  'vegan',
  mp.slug || '-vegan',
  true,
  true,
  true,
  'Fully plant-based version with complete proteins from legumes, tofu, tempeh, and whole grains.'
FROM public.meal_plans mp
ON CONFLICT (meal_plan_id, diet_type) DO NOTHING;

INSERT INTO public.meal_plan_variants (meal_plan_id, diet_type, variant_slug, is_vegan, is_vegetarian, is_dairy_free, description)
SELECT
  mp.id,
  'vegetarian',
  mp.slug || '-vegetarian',
  false,
  true,
  false,
  'Lacto-ovo vegetarian version including eggs and dairy for additional protein options.'
FROM public.meal_plans mp
ON CONFLICT (meal_plan_id, diet_type) DO NOTHING;

INSERT INTO public.meal_plan_variants (meal_plan_id, diet_type, variant_slug, is_vegan, is_vegetarian, description)
SELECT
  mp.id,
  'pescatarian',
  mp.slug || '-pescatarian',
  false,
  false,
  'Includes fish and seafood for omega-3s and lean protein alongside plant-based meals.'
FROM public.meal_plans mp
WHERE mp.plan_type != 'hormone' -- Hormone plans stay plant-based
ON CONFLICT (meal_plan_id, diet_type) DO NOTHING;

INSERT INTO public.meal_plan_variants (meal_plan_id, diet_type, variant_slug, is_vegan, is_vegetarian, description)
SELECT
  mp.id,
  'omnivore',
  mp.slug || '-omnivore',
  false,
  false,
  'Full flexibility with chicken, fish, and lean meats alongside plant-based options.'
FROM public.meal_plans mp
WHERE mp.plan_type != 'hormone' -- Hormone plans stay plant-based
ON CONFLICT (meal_plan_id, diet_type) DO NOTHING;

-- Add gluten-free variants for gut-reset plan
INSERT INTO public.meal_plan_variants (meal_plan_id, diet_type, variant_slug, is_vegan, is_vegetarian, is_dairy_free, is_gluten_free, description)
SELECT
  mp.id,
  'gluten-free-vegan',
  mp.slug || '-gf-vegan',
  true,
  true,
  true,
  true,
  'Gluten-free and fully plant-based, perfect for those with celiac or gluten sensitivity.'
FROM public.meal_plans mp
WHERE mp.slug = 'gut-reset'
ON CONFLICT (meal_plan_id, diet_type) DO NOTHING;

COMMIT;
