-- Progress photo feed shares should render the full saved photo set.
-- Weekly uploads store the individual shots in weekly_progress_photos.notes.

CREATE OR REPLACE FUNCTION public.build_progress_photo_feed_payload(
  p_notes TEXT,
  p_photo_url TEXT,
  p_storage_path TEXT,
  p_photo_id UUID,
  p_photo_week DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_notes JSONB := '{}'::jsonb;
  v_shots JSONB := '[]'::jsonb;
  v_shot JSONB;
  v_url TEXT;
  v_angle TEXT;
  v_title TEXT;
  v_storage_path TEXT;
  v_caption TEXT;
BEGIN
  BEGIN
    v_notes := COALESCE(NULLIF(btrim(p_notes), '')::jsonb, '{}'::jsonb);
  EXCEPTION WHEN OTHERS THEN
    v_notes := '{}'::jsonb;
  END;

  IF jsonb_typeof(v_notes->'shots') = 'array' THEN
    FOR v_shot IN
      SELECT value
      FROM jsonb_array_elements(v_notes->'shots')
    LOOP
      v_url := NULLIF(btrim(COALESCE(v_shot->>'photo_url', v_shot->>'media_url', v_shot->>'url', '')), '');

      IF v_url IS NOT NULL AND v_url ~* '^https?://' THEN
        v_angle := NULLIF(btrim(COALESCE(v_shot->>'angle', v_shot->>'key', v_shot->>'position', '')), '');
        v_title := NULLIF(btrim(COALESCE(v_shot->>'title', v_shot->>'label', '')), '');
        v_storage_path := NULLIF(btrim(COALESCE(v_shot->>'storage_path', v_shot->>'fileName', v_shot->>'file_name', '')), '');

        v_shots := v_shots || jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
          'angle', v_angle,
          'title', v_title,
          'photo_url', v_url,
          'storage_path', v_storage_path
        )));
      END IF;
    END LOOP;
  END IF;

  IF jsonb_array_length(v_shots) = 0 AND NULLIF(btrim(COALESCE(p_photo_url, '')), '') IS NOT NULL THEN
    v_shots := jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
      'angle', 'progress',
      'title', 'Progress photo',
      'photo_url', p_photo_url,
      'storage_path', NULLIF(btrim(COALESCE(p_storage_path, '')), '')
    )));
  END IF;

  v_caption := CASE
    WHEN jsonb_array_length(v_shots) >= 3 THEN 'Weekly progress photos locked in.'
    ELSE 'Weekly progress photo locked in.'
  END;

  RETURN jsonb_build_object(
    'card_type', 'progress_photo_set',
    'share_caption', v_caption,
    'photo_id', p_photo_id,
    'photo_week', p_photo_week,
    'shot_count', jsonb_array_length(v_shots),
    'shots', v_shots
  );
END;
$$;

REVOKE ALL ON FUNCTION public.build_progress_photo_feed_payload(TEXT, TEXT, TEXT, UUID, DATE) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.build_progress_photo_feed_payload(TEXT, TEXT, TEXT, UUID, DATE) TO service_role;

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

WITH progress_payloads AS (
  SELECT
    s.id AS story_id,
    public.build_progress_photo_feed_payload(wp.notes, wp.photo_url, wp.storage_path, wp.id, wp.photo_week) AS payload
  FROM public.stories s
  JOIN public.weekly_progress_photos wp
    ON wp.user_id = s.user_id
   AND s.media_type = 'progress_photo'
   AND s.media_url = wp.photo_url
)
UPDATE public.stories s
SET
  media_url = COALESCE(NULLIF(progress_payloads.payload->'shots'->0->>'photo_url', ''), s.media_url),
  thumbnail_url = COALESCE(NULLIF(progress_payloads.payload->'shots'->0->>'photo_url', ''), s.thumbnail_url),
  caption = progress_payloads.payload::TEXT,
  updated_at = NOW()
FROM progress_payloads
WHERE s.id = progress_payloads.story_id
  AND jsonb_array_length(progress_payloads.payload->'shots') > 1;

NOTIFY pgrst, 'reload schema';
