-- Independent 15 XP rewards for sharing eligible Balance content to the
-- Balance Feed and Instagram Feed.
--
-- Meals and workouts retain one reward per Brisbane day per destination.
-- Tracked activities retain one reward per activity per destination.

CREATE UNIQUE INDEX IF NOT EXISTS idx_point_transactions_activity_social_share_unique
ON public.point_transactions (user_id, transaction_type, reference_id)
WHERE transaction_type IN ('earn_activity_feed_share', 'earn_activity_instagram_share')
  AND reference_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_point_transactions_instagram_daily_share_unique
ON public.point_transactions (user_id, transaction_type, reference_type)
WHERE transaction_type IN ('earn_meal_instagram_share', 'earn_workout_instagram_share')
  AND reference_type LIKE '%_instagram_share:%';

CREATE OR REPLACE FUNCTION public.award_social_share_xp(
  p_user_id UUID,
  p_share_kind TEXT,
  p_destination TEXT,
  p_reference_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_award_date DATE := (NOW() AT TIME ZONE 'Australia/Brisbane')::DATE;
  v_transaction_type TEXT;
  v_reference_type TEXT;
  v_description TEXT;
  v_tx_id UUID;
  v_points CONSTANT INTEGER := 15;
BEGIN
  IF p_user_id IS NULL OR p_reference_id IS NULL THEN
    RAISE EXCEPTION 'user and reference are required';
  END IF;

  IF p_share_kind NOT IN ('meal', 'activity', 'workout') THEN
    RAISE EXCEPTION 'invalid share kind';
  END IF;

  IF p_destination NOT IN ('balance_feed', 'instagram_feed') THEN
    RAISE EXCEPTION 'invalid share destination';
  END IF;

  v_transaction_type := 'earn_' || p_share_kind || CASE
    WHEN p_destination = 'balance_feed' THEN '_feed_share'
    ELSE '_instagram_share'
  END;

  IF p_share_kind IN ('meal', 'workout') THEN
    v_reference_type := p_share_kind || CASE
      WHEN p_destination = 'balance_feed' THEN '_feed_share:'
      ELSE '_instagram_share:'
    END || v_award_date::TEXT;
  ELSE
    v_reference_type := 'activity_' || CASE
      WHEN p_destination = 'balance_feed' THEN 'feed_share:'
      ELSE 'instagram_share:'
    END || p_reference_id::TEXT;
  END IF;

  v_description := 'Shared ' || p_share_kind || CASE
    WHEN p_destination = 'balance_feed' THEN ' to Balance Feed'
    ELSE ' to Instagram Feed'
  END;

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
    v_transaction_type,
    v_points,
    p_reference_id,
    v_reference_type,
    FALSE,
    CASE WHEN p_destination = 'balance_feed' THEN 'balance_feed_share' ELSE 'instagram_share_opened' END,
    v_description
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_tx_id;

  IF v_tx_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'alreadyAwarded', TRUE,
      'pointsAwarded', 0,
      'basePoints', v_points,
      'reason', CASE
        WHEN p_share_kind IN ('meal', 'workout') THEN 'That share bonus has already been claimed for this destination today.'
        ELSE 'That activity share bonus has already been claimed for this destination.'
      END
    );
  END IF;

  PERFORM public.increment_user_points(p_user_id, v_points);
  PERFORM public.update_challenge_participant_points(p_user_id);

  RETURN jsonb_build_object(
    'success', TRUE,
    'alreadyAwarded', FALSE,
    'pointsAwarded', v_points,
    'basePoints', v_points,
    'shareKind', p_share_kind,
    'shareDestination', p_destination
  );
END;
$$;

REVOKE ALL ON FUNCTION public.award_social_share_xp(UUID, TEXT, TEXT, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.award_social_share_xp(UUID, TEXT, TEXT, UUID) TO service_role;

COMMENT ON FUNCTION public.award_social_share_xp(UUID, TEXT, TEXT, UUID) IS
  'Atomically awards independent 15 XP Balance Feed and Instagram Feed share bonuses.';

NOTIFY pgrst, 'reload schema';
