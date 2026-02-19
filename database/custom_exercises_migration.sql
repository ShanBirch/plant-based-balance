-- Custom Exercises Migration
-- Allows users to create their own exercises with recorded videos

CREATE TABLE IF NOT EXISTS public.custom_exercises (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- Exercise details
  exercise_name TEXT NOT NULL,
  description TEXT,
  muscle_group TEXT, -- e.g. 'chest', 'back', 'legs', 'shoulders', 'arms', 'core', 'full_body', 'other'
  equipment TEXT, -- e.g. 'barbell', 'dumbbell', 'cable', 'bodyweight', 'band', 'machine', 'other'

  -- Video
  video_url TEXT, -- Public URL to the uploaded video
  storage_path TEXT, -- Path in Supabase storage bucket
  thumbnail_url TEXT, -- Optional thumbnail

  -- Defaults for when adding to workouts
  default_sets INTEGER DEFAULT 3,
  default_reps TEXT DEFAULT '8-12',

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_custom_exercises_user ON public.custom_exercises(user_id);
CREATE INDEX IF NOT EXISTS idx_custom_exercises_name ON public.custom_exercises(user_id, exercise_name);

-- Enable RLS
ALTER TABLE public.custom_exercises ENABLE ROW LEVEL SECURITY;

-- Users can only access their own custom exercises
CREATE POLICY "Users can manage own custom exercises" ON public.custom_exercises
  FOR ALL USING (auth.uid() = user_id);

-- Admins can view all custom exercises
CREATE POLICY "Admins can view all custom exercises" ON public.custom_exercises
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.admin_users WHERE admin_users.user_id = auth.uid())
  );

-- Auto-update updated_at
CREATE TRIGGER update_custom_exercises_updated_at BEFORE UPDATE ON public.custom_exercises
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
