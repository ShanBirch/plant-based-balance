-- Migration: User Avatar System (Tamagotchi-style)
-- Purpose: Track user avatar customization and fitness state that adapts to training activity
-- Created: January 2026

-- ============================================================
-- USER AVATARS TABLE
-- Stores avatar customization and current fitness state
-- ============================================================
CREATE TABLE IF NOT EXISTS public.user_avatars (
  user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,

  -- Avatar Customization (chosen by user)
  body_type TEXT DEFAULT 'neutral',         -- 'slim', 'neutral', 'curvy', 'muscular'
  skin_tone TEXT DEFAULT 'medium',          -- 'light', 'medium', 'tan', 'dark'
  hair_style TEXT DEFAULT 'short',          -- 'short', 'medium', 'long', 'bald', 'ponytail', 'bun'
  hair_color TEXT DEFAULT 'brown',          -- 'black', 'brown', 'blonde', 'red', 'gray', 'pink', 'blue'
  outfit_color TEXT DEFAULT 'green',        -- Primary color for workout clothes
  accessory TEXT DEFAULT 'none',            -- 'none', 'headband', 'glasses', 'cap', 'wristband'

  -- Fitness State (calculated from activity)
  fitness_level INTEGER DEFAULT 50,         -- 0-100: affects muscle definition and posture
  energy_level INTEGER DEFAULT 50,          -- 0-100: affects animation speed and expression
  mood TEXT DEFAULT 'neutral',              -- 'sad', 'tired', 'neutral', 'happy', 'energetic', 'champion'

  -- Activity tracking for state calculation
  last_workout_date DATE,
  days_since_workout INTEGER DEFAULT 0,
  weekly_workout_count INTEGER DEFAULT 0,

  -- Unlockables (earned through milestones)
  unlocked_accessories JSONB DEFAULT '[]'::jsonb,  -- Array of unlocked accessory IDs
  unlocked_outfits JSONB DEFAULT '[]'::jsonb,      -- Array of unlocked outfit IDs
  unlocked_backgrounds JSONB DEFAULT '[]'::jsonb,  -- Array of unlocked room backgrounds

  -- Current room/background
  room_background TEXT DEFAULT 'gym',       -- 'gym', 'park', 'home', 'beach', 'mountain'

  -- Customization complete flag
  is_customized BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_user_avatars_user ON public.user_avatars(user_id);

-- ============================================================
-- AVATAR STATE HISTORY TABLE
-- Track avatar state changes over time (for timeline/memories)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.avatar_state_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- Snapshot of state
  fitness_level INTEGER,
  energy_level INTEGER,
  mood TEXT,
  weekly_workout_count INTEGER,

  -- What triggered this snapshot
  trigger_type TEXT,   -- 'workout_logged', 'streak_achieved', 'milestone', 'daily_decay', 'manual'
  trigger_description TEXT,

  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_avatar_history_user ON public.avatar_state_history(user_id, recorded_at DESC);

-- ============================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================

-- Enable RLS
ALTER TABLE public.user_avatars ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.avatar_state_history ENABLE ROW LEVEL SECURITY;

-- USER_AVATARS policies
CREATE POLICY "Users can view own avatar" ON public.user_avatars
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own avatar" ON public.user_avatars
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own avatar" ON public.user_avatars
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- AVATAR_STATE_HISTORY policies
CREATE POLICY "Users can view own avatar history" ON public.avatar_state_history
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own avatar history" ON public.avatar_state_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

-- Initialize avatar for new users (trigger function)
CREATE OR REPLACE FUNCTION initialize_user_avatar()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_avatars (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to auto-initialize avatar for new users
DROP TRIGGER IF EXISTS auto_initialize_avatar ON public.users;
CREATE TRIGGER auto_initialize_avatar
  AFTER INSERT ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION initialize_user_avatar();

-- Update timestamp on avatar change
CREATE OR REPLACE FUNCTION update_avatar_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS avatar_updated_at ON public.user_avatars;
CREATE TRIGGER avatar_updated_at
  BEFORE UPDATE ON public.user_avatars
  FOR EACH ROW
  EXECUTE FUNCTION update_avatar_timestamp();

-- ============================================================
-- STORED PROCEDURE: Update avatar fitness state
-- Called when user logs a workout
-- ============================================================
CREATE OR REPLACE FUNCTION update_avatar_fitness(
  p_user_id UUID,
  p_workout_logged BOOLEAN DEFAULT TRUE
)
RETURNS JSON AS $$
DECLARE
  v_avatar RECORD;
  v_new_fitness INTEGER;
  v_new_energy INTEGER;
  v_new_mood TEXT;
  v_days_since INTEGER;
  v_weekly_count INTEGER;
BEGIN
  -- Get current avatar state
  SELECT * INTO v_avatar FROM public.user_avatars WHERE user_id = p_user_id;

  -- If no avatar exists, create one
  IF NOT FOUND THEN
    INSERT INTO public.user_avatars (user_id) VALUES (p_user_id);
    SELECT * INTO v_avatar FROM public.user_avatars WHERE user_id = p_user_id;
  END IF;

  -- Calculate days since last workout
  IF v_avatar.last_workout_date IS NOT NULL THEN
    v_days_since := CURRENT_DATE - v_avatar.last_workout_date;
  ELSE
    v_days_since := 7; -- Default to a week if never worked out
  END IF;

  -- If workout was logged today
  IF p_workout_logged THEN
    -- Boost fitness (cap at 100)
    v_new_fitness := LEAST(100, v_avatar.fitness_level + 5);
    -- Boost energy
    v_new_energy := LEAST(100, v_avatar.energy_level + 10);
    -- Update weekly count
    v_weekly_count := v_avatar.weekly_workout_count + 1;
    v_days_since := 0;
  ELSE
    -- Daily decay calculation
    -- Fitness decays slowly (1 point per 2 days of inactivity)
    v_new_fitness := GREATEST(10, v_avatar.fitness_level - (v_days_since / 2));
    -- Energy decays faster (2 points per day of inactivity)
    v_new_energy := GREATEST(10, v_avatar.energy_level - (v_days_since * 2));
    v_weekly_count := v_avatar.weekly_workout_count;
  END IF;

  -- Calculate mood based on fitness and energy
  IF v_new_fitness >= 80 AND v_new_energy >= 80 THEN
    v_new_mood := 'champion';
  ELSIF v_new_fitness >= 60 AND v_new_energy >= 60 THEN
    v_new_mood := 'energetic';
  ELSIF v_new_fitness >= 40 AND v_new_energy >= 40 THEN
    v_new_mood := 'happy';
  ELSIF v_new_fitness >= 30 OR v_new_energy >= 30 THEN
    v_new_mood := 'neutral';
  ELSIF v_new_energy < 20 THEN
    v_new_mood := 'tired';
  ELSE
    v_new_mood := 'sad';
  END IF;

  -- Update avatar
  UPDATE public.user_avatars
  SET
    fitness_level = v_new_fitness,
    energy_level = v_new_energy,
    mood = v_new_mood,
    days_since_workout = v_days_since,
    weekly_workout_count = CASE
      WHEN p_workout_logged THEN v_weekly_count
      ELSE v_weekly_count
    END,
    last_workout_date = CASE
      WHEN p_workout_logged THEN CURRENT_DATE
      ELSE last_workout_date
    END
  WHERE user_id = p_user_id;

  -- Record state change in history
  INSERT INTO public.avatar_state_history (
    user_id, fitness_level, energy_level, mood, weekly_workout_count,
    trigger_type, trigger_description
  ) VALUES (
    p_user_id, v_new_fitness, v_new_energy, v_new_mood, v_weekly_count,
    CASE WHEN p_workout_logged THEN 'workout_logged' ELSE 'daily_decay' END,
    CASE WHEN p_workout_logged THEN 'User completed a workout' ELSE 'Daily fitness check' END
  );

  RETURN json_build_object(
    'fitness_level', v_new_fitness,
    'energy_level', v_new_energy,
    'mood', v_new_mood,
    'days_since_workout', v_days_since,
    'weekly_workout_count', v_weekly_count
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- STORED PROCEDURE: Get avatar with calculated state
-- ============================================================
CREATE OR REPLACE FUNCTION get_user_avatar(p_user_id UUID)
RETURNS JSON AS $$
DECLARE
  v_avatar RECORD;
  v_days_since INTEGER;
BEGIN
  SELECT * INTO v_avatar FROM public.user_avatars WHERE user_id = p_user_id;

  -- If no avatar exists, create one and return defaults
  IF NOT FOUND THEN
    INSERT INTO public.user_avatars (user_id) VALUES (p_user_id)
    ON CONFLICT (user_id) DO NOTHING;
    SELECT * INTO v_avatar FROM public.user_avatars WHERE user_id = p_user_id;
  END IF;

  -- Calculate current days since workout
  IF v_avatar.last_workout_date IS NOT NULL THEN
    v_days_since := CURRENT_DATE - v_avatar.last_workout_date;
  ELSE
    v_days_since := v_avatar.days_since_workout;
  END IF;

  RETURN json_build_object(
    'body_type', v_avatar.body_type,
    'skin_tone', v_avatar.skin_tone,
    'hair_style', v_avatar.hair_style,
    'hair_color', v_avatar.hair_color,
    'outfit_color', v_avatar.outfit_color,
    'accessory', v_avatar.accessory,
    'fitness_level', v_avatar.fitness_level,
    'energy_level', v_avatar.energy_level,
    'mood', v_avatar.mood,
    'days_since_workout', v_days_since,
    'weekly_workout_count', v_avatar.weekly_workout_count,
    'room_background', v_avatar.room_background,
    'is_customized', v_avatar.is_customized,
    'unlocked_accessories', v_avatar.unlocked_accessories,
    'unlocked_outfits', v_avatar.unlocked_outfits,
    'unlocked_backgrounds', v_avatar.unlocked_backgrounds
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Initialize avatars for existing users
-- ============================================================
INSERT INTO public.user_avatars (user_id)
SELECT id FROM public.users
WHERE id NOT IN (SELECT user_id FROM public.user_avatars)
ON CONFLICT (user_id) DO NOTHING;

-- ============================================================
-- GRANT PERMISSIONS for service role
-- ============================================================
GRANT ALL ON public.user_avatars TO service_role;
GRANT ALL ON public.avatar_state_history TO service_role;
GRANT EXECUTE ON FUNCTION update_avatar_fitness TO service_role;
GRANT EXECUTE ON FUNCTION get_user_avatar TO service_role;
