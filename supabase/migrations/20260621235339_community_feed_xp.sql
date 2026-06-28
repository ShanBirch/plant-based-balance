-- Community Feed XP
-- - +2 XP for one regular Feed check-in post per Brisbane day.
-- - +2 XP for commenting on someone else's Feed post.
-- - +1 XP for sharing a logged meal card to Feed.

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
REVOKE ALL ON SCHEMA private FROM anon, authenticated;

CREATE UNIQUE INDEX IF NOT EXISTS idx_point_transactions_feed_checkin_daily_unique
ON public.point_transactions(user_id, transaction_type, reference_type)
WHERE transaction_type = 'earn_feed_check_in';

CREATE UNIQUE INDEX IF NOT EXISTS idx_point_transactions_feed_comment_unique
ON public.point_transactions(user_id, transaction_type, reference_id)
WHERE transaction_type = 'earn_feed_comment';

CREATE UNIQUE INDEX IF NOT EXISTS idx_point_transactions_meal_feed_share_unique
ON public.point_transactions(user_id, transaction_type, reference_id)
WHERE transaction_type = 'earn_meal_feed_share';

CREATE OR REPLACE FUNCTION private.uuid_or_null(p_value TEXT)
RETURNS UUID
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO ''
AS $$
DECLARE
  v_value TEXT := btrim(COALESCE(p_value, ''));
BEGIN
  IF v_value = '' THEN
    RETURN NULL;
  END IF;

  IF v_value ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
    RETURN v_value::UUID;
  END IF;

  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION private.award_story_community_feed_xp()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_payload JSONB;
  v_award_date DATE;
  v_checkin_reference_type TEXT;
  v_meal_reference_id UUID;
  v_tx_id UUID;
  v_total_awarded INTEGER := 0;
BEGIN
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.created_at IS NULL THEN
    NEW.created_at := NOW();
  END IF;

  BEGIN
    v_payload := NEW.caption::JSONB;
  EXCEPTION WHEN OTHERS THEN
    v_payload := NULL;
  END;

  IF NEW.media_type IN ('meal_card', 'nutrition_card')
     AND COALESCE(v_payload->>'card_type', '') = 'meal' THEN
    v_meal_reference_id := COALESCE(private.uuid_or_null(v_payload->>'meal_id'), NEW.id);

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
      NEW.user_id,
      'earn_meal_feed_share',
      1,
      v_meal_reference_id,
      CASE WHEN v_meal_reference_id = NEW.id THEN 'story' ELSE 'meal_log' END,
      FALSE,
      'feed_meal_card',
      'Shared meal to Feed'
    )
    ON CONFLICT (user_id, transaction_type, reference_id)
      WHERE transaction_type = 'earn_meal_feed_share'
      DO NOTHING
    RETURNING id INTO v_tx_id;

    IF v_tx_id IS NOT NULL THEN
      PERFORM public.increment_user_points(NEW.user_id, 1);
      v_total_awarded := v_total_awarded + 1;
    END IF;
  END IF;

  IF NEW.media_type IN ('image', 'video', 'text') THEN
    v_award_date := (NEW.created_at AT TIME ZONE 'Australia/Brisbane')::DATE;
    v_checkin_reference_type := 'feed_check_in:' || v_award_date::TEXT;
    v_tx_id := NULL;

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
      NEW.user_id,
      'earn_feed_check_in',
      2,
      NEW.id,
      v_checkin_reference_type,
      FALSE,
      'feed_post',
      'Daily Feed check-in post'
    )
    ON CONFLICT (user_id, transaction_type, reference_type)
      WHERE transaction_type = 'earn_feed_check_in'
      DO NOTHING
    RETURNING id INTO v_tx_id;

    IF v_tx_id IS NOT NULL THEN
      PERFORM public.increment_user_points(NEW.user_id, 2);
      v_total_awarded := v_total_awarded + 2;
    END IF;
  END IF;

  IF v_total_awarded > 0 THEN
    NEW.points_awarded := COALESCE(NEW.points_awarded, 0) + v_total_awarded;
    PERFORM public.update_challenge_participant_points(NEW.user_id);
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION private.award_feed_comment_xp()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_story_owner_id UUID;
  v_tx_id UUID;
BEGIN
  IF NEW.user_id IS NULL OR NEW.story_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT s.user_id
  INTO v_story_owner_id
  FROM public.stories s
  WHERE s.id = NEW.story_id;

  IF v_story_owner_id IS NULL OR v_story_owner_id = NEW.user_id THEN
    RETURN NEW;
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
    NEW.user_id,
    'earn_feed_comment',
    2,
    NEW.id,
    'feed_comment',
    FALSE,
    'feed_comment',
    'Commented on a Feed post'
  )
  ON CONFLICT (user_id, transaction_type, reference_id)
    WHERE transaction_type = 'earn_feed_comment'
    DO NOTHING
  RETURNING id INTO v_tx_id;

  IF v_tx_id IS NOT NULL THEN
    PERFORM public.increment_user_points(NEW.user_id, 2);
    PERFORM public.update_challenge_participant_points(NEW.user_id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS award_story_community_feed_xp_on_insert ON public.stories;
CREATE TRIGGER award_story_community_feed_xp_on_insert
  BEFORE INSERT ON public.stories
  FOR EACH ROW
  EXECUTE FUNCTION private.award_story_community_feed_xp();

DROP TRIGGER IF EXISTS award_feed_comment_xp_on_insert ON public.feed_comments;
CREATE TRIGGER award_feed_comment_xp_on_insert
  AFTER INSERT ON public.feed_comments
  FOR EACH ROW
  EXECUTE FUNCTION private.award_feed_comment_xp();

REVOKE ALL ON FUNCTION private.uuid_or_null(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.award_story_community_feed_xp() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.award_feed_comment_xp() FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION private.award_story_community_feed_xp() IS
  'Awards transaction-backed XP for regular daily Feed check-ins and logged meal Feed shares.';

COMMENT ON FUNCTION private.award_feed_comment_xp() IS
  'Awards transaction-backed XP when a user comments on another user''s Feed post.';

NOTIFY pgrst, 'reload schema';
