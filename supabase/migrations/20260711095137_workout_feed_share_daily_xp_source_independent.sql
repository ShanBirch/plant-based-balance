-- Award the daily Share a Set bonus from the archived media source.
-- This keeps Feed and workout-page entry points on the same server-side path.

CREATE UNIQUE INDEX IF NOT EXISTS idx_point_transactions_workout_feed_share_daily_unique
ON public.point_transactions (user_id, transaction_type, reference_type)
WHERE transaction_type = 'earn_workout_feed_share'
  AND reference_type LIKE 'workout_feed_share:%';

CREATE OR REPLACE FUNCTION private.award_workout_feed_share_xp()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_award_date DATE;
  v_reference_id UUID;
  v_reference_type TEXT;
  v_tx_id UUID;
BEGIN
  IF NEW.user_id IS NULL OR COALESCE(NEW.source, '') <> 'feed_workout_share' THEN
    RETURN NEW;
  END IF;

  v_award_date := (COALESCE(NEW.created_at, NOW()) AT TIME ZONE 'Australia/Brisbane')::DATE;
  v_reference_id := ('00000000-0000-4000-8000-' || replace(v_award_date::TEXT, '-', '') || '0000')::UUID;
  v_reference_type := 'workout_feed_share:' || v_award_date::TEXT;

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
    'earn_workout_feed_share',
    15,
    v_reference_id,
    v_reference_type,
    TRUE,
    'feed_workout_share',
    'Shared a set to Feed'
  )
  ON CONFLICT (user_id, transaction_type, reference_type)
    WHERE transaction_type = 'earn_workout_feed_share'
      AND reference_type LIKE 'workout_feed_share:%'
    DO NOTHING
  RETURNING id INTO v_tx_id;

  IF v_tx_id IS NOT NULL THEN
    PERFORM public.increment_user_points(NEW.user_id, 15);
    PERFORM public.update_challenge_participant_points(NEW.user_id);

    UPDATE public.stories
    SET points_awarded = COALESCE(points_awarded, 0) + 15
    WHERE id = NEW.story_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS award_workout_feed_share_xp_on_insert ON public.feed_media_assets;
CREATE TRIGGER award_workout_feed_share_xp_on_insert
  AFTER INSERT ON public.feed_media_assets
  FOR EACH ROW
  EXECUTE FUNCTION private.award_workout_feed_share_xp();

REVOKE ALL ON FUNCTION private.award_workout_feed_share_xp() FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION private.award_workout_feed_share_xp() IS
  'Awards one transaction-backed 15 XP Share a Set bonus per Brisbane day for archived workout Feed shares.';

NOTIFY pgrst, 'reload schema';
