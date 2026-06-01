-- Progress Photo Feed Share Bonus
-- Ensures the extra feed-share XP can only be awarded once per weekly progress photo.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.stories'::regclass
      AND conname = 'stories_media_type_check'
  ) THEN
    ALTER TABLE public.stories DROP CONSTRAINT stories_media_type_check;
  END IF;

  ALTER TABLE public.stories
    ADD CONSTRAINT stories_media_type_check
    CHECK (media_type IN (
      'image',
      'video',
      'text',
      'workout_card',
      'nutrition_card',
      'meal_card',
      'level_up_card',
      'progress_photo'
    ));
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_point_transactions_progress_photo_share_unique
ON public.point_transactions(user_id, transaction_type, reference_id)
WHERE transaction_type = 'earn_progress_photo_share';

CREATE OR REPLACE FUNCTION public.share_progress_photo_to_feed(
  p_user_id UUID,
  p_photo_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_photo public.weekly_progress_photos%ROWTYPE;
  v_story public.stories%ROWTYPE;
  v_tx_id UUID;
  v_shot_count INTEGER := 1;
  v_caption TEXT;
  v_points INTEGER := 10;
BEGIN
  IF p_user_id IS NULL OR p_photo_id IS NULL THEN
    RAISE EXCEPTION 'Missing required fields';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_photo_id::TEXT));

  SELECT *
  INTO v_photo
  FROM public.weekly_progress_photos
  WHERE id = p_photo_id
    AND user_id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Progress photo not found';
  END IF;

  BEGIN
    v_shot_count := GREATEST(
      COALESCE(jsonb_array_length((v_photo.notes::JSONB)->'shots'), 1),
      1
    );
  EXCEPTION WHEN OTHERS THEN
    v_shot_count := 1;
  END;

  v_caption := CASE
    WHEN v_shot_count >= 3 THEN 'Weekly progress photos locked in.'
    ELSE 'Weekly progress photo locked in.'
  END;

  SELECT *
  INTO v_story
  FROM public.stories
  WHERE user_id = p_user_id
    AND media_type = 'progress_photo'
    AND media_url = v_photo.photo_url
  ORDER BY created_at ASC
  LIMIT 1;

  IF NOT FOUND THEN
    INSERT INTO public.stories (
      user_id,
      media_type,
      media_url,
      thumbnail_url,
      caption,
      duration,
      background_color,
      expires_at
    )
    VALUES (
      p_user_id,
      'progress_photo',
      v_photo.photo_url,
      v_photo.photo_url,
      v_caption,
      5,
      '#ec4899',
      NOW() + INTERVAL '365 days'
    )
    RETURNING * INTO v_story;
  END IF;

  INSERT INTO public.point_transactions (
    user_id,
    transaction_type,
    points_amount,
    reference_id,
    reference_type,
    photo_verified,
    verification_method,
    description
  )
  VALUES (
    p_user_id,
    'earn_progress_photo_share',
    v_points,
    p_photo_id,
    'weekly_progress_photo',
    FALSE,
    'feed_post',
    'Shared weekly progress photo to feed'
  )
  ON CONFLICT (user_id, transaction_type, reference_id)
    WHERE transaction_type = 'earn_progress_photo_share'
    DO NOTHING
  RETURNING id INTO v_tx_id;

  IF v_tx_id IS NOT NULL THEN
    PERFORM public.increment_user_points(p_user_id, v_points);
  END IF;

  RETURN jsonb_build_object(
    'success', TRUE,
    'alreadyShared', v_tx_id IS NULL,
    'pointsAwarded', CASE WHEN v_tx_id IS NULL THEN 0 ELSE v_points END,
    'story', jsonb_build_object(
      'id', v_story.id,
      'user_id', v_story.user_id,
      'media_type', v_story.media_type,
      'media_url', v_story.media_url,
      'thumbnail_url', v_story.thumbnail_url,
      'caption', v_story.caption,
      'created_at', v_story.created_at
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.share_progress_photo_to_feed(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.share_progress_photo_to_feed(UUID, UUID) TO service_role;

NOTIFY pgrst, 'reload schema';
