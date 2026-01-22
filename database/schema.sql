-- Plant Based Balance - Supabase Database Schema
-- Run this in your Supabase SQL Editor to create all tables

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- USERS TABLE (extends Supabase auth.users)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  profile_photo TEXT, -- Base64 or URL to uploaded image
  program_start_date TIMESTAMPTZ DEFAULT NOW(),
  theme_preference TEXT DEFAULT 'light',

  -- Subscription info (from Stripe)
  stripe_customer_id TEXT,
  subscription_status TEXT, -- active, canceled, trialing, etc.
  subscription_plan TEXT, -- plan name

  -- User preferences
  location TEXT,
  rapid_api_key TEXT,
  sex TEXT, -- 'male' or 'female' (for BMR/TDEE calculations)

  -- Biometric login (stored in DB for persistence across sessions)
  biometric_credential_id TEXT, -- Base64-encoded WebAuthn credential ID

  -- Tracking
  last_login TIMESTAMPTZ,
  onboarding_complete BOOLEAN DEFAULT FALSE,
  pwa_banner_dismissed BOOLEAN DEFAULT FALSE,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- USER FACTS TABLE (learned information about users)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.user_facts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- Structured user information
  struggles JSONB DEFAULT '[]', -- array of strings
  preferences JSONB DEFAULT '[]', -- array of strings
  health_notes JSONB DEFAULT '[]', -- array of strings
  personal_details JSONB DEFAULT '[]', -- array of strings
  goals JSONB DEFAULT '[]', -- array of strings

  -- Current status
  sleep_quality TEXT,
  energy_level TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id)
);

-- ============================================================
-- QUIZ RESULTS TABLE (hormone quiz data)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.quiz_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- Quiz responses
  menopause_status TEXT,
  cycle_description TEXT,
  cycle_body_response TEXT,
  cycle_sync_preference TEXT,
  activity_level TEXT,
  weight_storage_location TEXT,
  goal_body_type TEXT,
  sleep_hours TEXT,
  sleep_quality TEXT,
  energy_level TEXT,
  energy_crashes TEXT,
  caffeine_relationship TEXT,

  -- Results
  hormone_profile TEXT, -- CORTISOL, ESTROGEN, etc.

  -- User info at time of quiz
  age INTEGER,
  height NUMERIC, -- in cm
  weight NUMERIC, -- in kg
  goal_weight NUMERIC, -- in kg
  sex TEXT, -- 'female' or 'male' (for BMR calculation)

  -- Calculated nutrition goals
  bmr NUMERIC, -- Basal Metabolic Rate
  tdee NUMERIC, -- Total Daily Energy Expenditure
  calorie_goal NUMERIC,
  protein_goal_g NUMERIC,
  carbs_goal_g NUMERIC,
  fat_goal_g NUMERIC,

  -- Timestamps
  taken_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- CONVERSATIONS TABLE (Shannon + Community chat)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- Message metadata
  chat_type TEXT NOT NULL, -- 'shannon' or 'community'
  role TEXT NOT NULL, -- 'user', 'bot', 'member', 'coach'

  -- Message content
  message_text TEXT NOT NULL,
  author_name TEXT, -- For community chat

  -- Timestamps
  timestamp BIGINT NOT NULL, -- Unix timestamp in milliseconds
  brisbane_time TEXT, -- Formatted time string
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Index for faster queries
  INDEX idx_conversations_user_chat (user_id, chat_type, timestamp)
);

-- ============================================================
-- WORKOUTS TABLE (workout history and custom workouts)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.workouts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- Workout type
  workout_type TEXT NOT NULL, -- 'history' or 'custom_template'

  -- For workout history
  workout_date DATE,
  exercise_name TEXT,
  set_number INTEGER,
  time_duration TEXT,
  reps TEXT,
  weight_kg TEXT,

  -- For custom workout templates
  template_name TEXT,
  template_data JSONB, -- Full workout template structure

  -- Current active workout
  is_current_workout BOOLEAN DEFAULT FALSE,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  INDEX idx_workouts_user_date (user_id, workout_date DESC)
);

-- ============================================================
-- WORKOUT CUSTOMIZATIONS TABLE (user-added/removed exercises per workout)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.workout_customizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- Workout identifier (format: "category/subcategory/workoutId" for library workouts)
  workout_key TEXT NOT NULL,

  -- Added exercises (JSONB array of exercise objects)
  -- Format: [{ name: string, sets: number, reps: string, desc: string }]
  added_exercises JSONB DEFAULT '[]',

  -- Removed exercises (JSONB array of exercise names to hide)
  removed_exercises JSONB DEFAULT '[]',

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Each user can only have one customization per workout
  UNIQUE(user_id, workout_key),
  INDEX idx_workout_customizations_user (user_id)
);

-- ============================================================
-- DAILY CHECK-INS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.daily_checkins (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- Check-in date
  checkin_date DATE NOT NULL,

  -- Check-in data
  energy TEXT,
  equipment TEXT,
  sleep TEXT,
  water_intake INTEGER,

  -- Additional fields (flexible JSONB for future additions)
  additional_data JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, checkin_date),
  INDEX idx_checkins_user_date (user_id, checkin_date DESC)
);

-- ============================================================
-- REFLECTIONS TABLE (journal entries)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.reflections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- Reflection type
  reflection_type TEXT DEFAULT 'standalone', -- 'standalone' or 'saturday_checkin'

  -- Content
  reflection_text TEXT NOT NULL,

  -- For Saturday check-ins
  story_key TEXT, -- Key for saturday_checkin_stories

  -- Timestamps
  timestamp BIGINT NOT NULL, -- Unix timestamp in milliseconds
  created_at TIMESTAMPTZ DEFAULT NOW(),

  INDEX idx_reflections_user_timestamp (user_id, timestamp DESC)
);

-- ============================================================
-- UPLOADS TABLE (images and files)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.uploads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- File info
  upload_type TEXT NOT NULL, -- 'profile_photo', 'reflection_image', etc.
  file_data TEXT, -- Base64 encoded data or URL to Supabase storage
  storage_path TEXT, -- Path in Supabase storage bucket
  mime_type TEXT,
  file_size INTEGER,

  -- Reference to related entities
  related_id UUID, -- ID of related reflection, etc.

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),

  INDEX idx_uploads_user (user_id, created_at DESC)
);

-- ============================================================
-- CHAT STATS TABLE (Shannon chat statistics)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.chat_stats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- Stats data
  stats_data JSONB NOT NULL,

  -- Timestamps
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- USER ACTIVITY LOG (for analytics)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.user_activity (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- Activity tracking
  activity_type TEXT NOT NULL, -- 'login', 'chat', 'workout', 'checkin', 'reflection', etc.
  activity_data JSONB, -- Additional context

  -- Timestamps
  occurred_at TIMESTAMPTZ DEFAULT NOW(),

  INDEX idx_activity_user_type_time (user_id, activity_type, occurred_at DESC)
);

-- ============================================================
-- ADMIN USERS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.admin_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- Admin permissions
  role TEXT NOT NULL DEFAULT 'admin', -- 'admin', 'super_admin'
  permissions JSONB DEFAULT '["view_users", "view_conversations", "view_analytics"]',

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id)
);

-- ============================================================
-- AUTOMATED TRIGGERS
-- ============================================================

-- Update updated_at timestamp automatically
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to tables with updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_facts_updated_at BEFORE UPDATE ON public.user_facts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workouts_updated_at BEFORE UPDATE ON public.workouts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_daily_checkins_updated_at BEFORE UPDATE ON public.daily_checkins
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reflections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- Users can only access their own data
CREATE POLICY "Users can view own profile" ON public.users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can view own facts" ON public.user_facts
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view own quiz results" ON public.quiz_results
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view own conversations" ON public.conversations
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own conversations" ON public.conversations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own conversations" ON public.conversations
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own conversations" ON public.conversations
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own workouts" ON public.workouts
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view own checkins" ON public.daily_checkins
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view own reflections" ON public.reflections
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view own uploads" ON public.uploads
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view own chat stats" ON public.chat_stats
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view own activity" ON public.user_activity
  FOR ALL USING (auth.uid() = user_id);

-- Admin policies (TODO: Update this to check admin_users table)
CREATE POLICY "Admins can view all users" ON public.users
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE admin_users.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all conversations" ON public.conversations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE admin_users.user_id = auth.uid()
    )
  );

-- Insert trigger to create user_facts entry when user is created
CREATE OR REPLACE FUNCTION create_user_facts_on_signup()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_facts (user_id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_user_created
  AFTER INSERT ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION create_user_facts_on_signup();
