-- Weekly Progress Photos Migration
-- Allows users to upload a weekly progress photo (every Monday) and earn 15 XP

-- Create the weekly_progress_photos table
CREATE TABLE IF NOT EXISTS public.weekly_progress_photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    photo_url TEXT NOT NULL,
    storage_path TEXT,
    photo_week DATE NOT NULL, -- The Monday of the week this photo belongs to
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- One photo per user per week
    UNIQUE(user_id, photo_week)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_weekly_progress_photos_user_id ON public.weekly_progress_photos(user_id);
CREATE INDEX IF NOT EXISTS idx_weekly_progress_photos_user_week ON public.weekly_progress_photos(user_id, photo_week DESC);

-- Enable RLS
ALTER TABLE public.weekly_progress_photos ENABLE ROW LEVEL SECURITY;

-- RLS policies - users can only access their own photos
CREATE POLICY "Users can view own progress photos"
    ON public.weekly_progress_photos FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own progress photos"
    ON public.weekly_progress_photos FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own progress photos"
    ON public.weekly_progress_photos FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own progress photos"
    ON public.weekly_progress_photos FOR DELETE
    USING (auth.uid() = user_id);
