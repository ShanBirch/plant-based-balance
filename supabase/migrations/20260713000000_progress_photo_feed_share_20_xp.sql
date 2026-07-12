-- Raise the one-time weekly progress photo Feed share reward from 10 to 20 XP.

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
  v_payload JSONB;
  v_shot_count INTEGER := 1;
  v_primary_url TEXT;
  v_points INTEGER := 20;
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

  v_payload := public.build_progress_photo_feed_payload(
    v_photo.notes,
    v_photo.photo_url,
    v_photo.storage_path,
    v_photo.id,
    v_photo.photo_week
  );
  v_shot_count := GREATEST(COALESCE(jsonb_array_length(v_payload->'shots'), 0), 1);
  v_primary_url := COALESCE(NULLIF(v_payload->'shots'->0->>'photo_url', ''), v_photo.photo_url);

  SELECT *
  INTO v_story
  FROM public.stories
  WHERE user_id = p_user_id
    AND media_type = 'progress_photo'
    AND media_url IN (v_photo.photo_url, v_primary_url)
  ORDER BY created_at ASC
  LIMIT 1;

  IF FOUND THEN
    UPDATE public.stories
    SET
      media_url = v_primary_url,
      thumbnail_url = v_primary_url,
      caption = v_payload::TEXT,
      duration = 5,
      background_color = '#ec4899',
      expires_at = GREATEST(expires_at, NOW() + INTERVAL '365 days'),
      updated_at = NOW()
    WHERE id = v_story.id
    RETURNING * INTO v_story;
  ELSE
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
      v_primary_url,
      v_primary_url,
      v_payload::TEXT,
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
    CASE WHEN v_shot_count >= 3
      THEN 'Shared weekly progress photos to feed'
      ELSE 'Shared weekly progress photo to feed'
    END
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
