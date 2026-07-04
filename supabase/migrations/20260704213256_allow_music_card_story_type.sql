ALTER TABLE public.stories
  DROP CONSTRAINT IF EXISTS stories_media_type_check;

ALTER TABLE public.stories
  ADD CONSTRAINT stories_media_type_check
  CHECK (media_type = ANY (ARRAY[
    'image'::text,
    'video'::text,
    'text'::text,
    'workout_card'::text,
    'nutrition_card'::text,
    'meal_card'::text,
    'level_up_card'::text,
    'checkin_card'::text,
    'progress_photo'::text,
    'music_card'::text
  ]));
