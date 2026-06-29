-- Meal Feed share daily XP
-- - +15 XP for one logged meal card shared to Feed per Brisbane day.

CREATE UNIQUE INDEX IF NOT EXISTS idx_point_transactions_meal_feed_share_daily_unique
ON public.point_transactions(user_id, transaction_type, reference_type)
WHERE transaction_type = 'earn_meal_feed_share'
  AND reference_type LIKE 'meal_feed_share:%';

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
  v_meal_reference_type TEXT;
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
    v_award_date := (NEW.created_at AT TIME ZONE 'Australia/Brisbane')::DATE;
    v_meal_reference_id := COALESCE(private.uuid_or_null(v_payload->>'meal_id'), NEW.id);
    v_meal_reference_type := 'meal_feed_share:' || v_award_date::TEXT;

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
      15,
      v_meal_reference_id,
      v_meal_reference_type,
      FALSE,
      'feed_meal_card',
      'Shared meal to Feed'
    )
    ON CONFLICT (user_id, transaction_type, reference_type)
      WHERE transaction_type = 'earn_meal_feed_share'
        AND reference_type LIKE 'meal_feed_share:%'
      DO NOTHING
    RETURNING id INTO v_tx_id;

    IF v_tx_id IS NOT NULL THEN
      PERFORM public.increment_user_points(NEW.user_id, 15);
      v_total_awarded := v_total_awarded + 15;
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

REVOKE ALL ON FUNCTION private.award_story_community_feed_xp() FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION private.award_story_community_feed_xp() IS
  'Awards transaction-backed XP for regular daily Feed check-ins and one logged meal Feed share per Brisbane day.';

NOTIFY pgrst, 'reload schema';
