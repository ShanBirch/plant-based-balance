-- Fix stories media_type CHECK constraint
-- The original migration only allowed 'image' and 'video', but the app now
-- supports 'workout_card', 'nutrition_card', and 'level_up_card' types.
-- This caused "Failed to share workout card" errors.

-- Drop the existing check constraint and add the updated one
ALTER TABLE public.stories
  DROP CONSTRAINT IF EXISTS stories_media_type_check;

ALTER TABLE public.stories
  ADD CONSTRAINT stories_media_type_check
  CHECK (media_type IN ('image', 'video', 'workout_card', 'nutrition_card', 'level_up_card'));
