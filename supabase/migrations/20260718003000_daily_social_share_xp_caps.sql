-- Cap each social-share category to one 15 XP award per destination per
-- Brisbane day. Workout and PB cards both use the workout category.

CREATE UNIQUE INDEX IF NOT EXISTS idx_point_transactions_daily_social_share_unique
ON public.point_transactions (user_id, transaction_type, reference_type)
WHERE transaction_type IN (
  'earn_meal_feed_share',
  'earn_meal_instagram_share',
  'earn_activity_feed_share',
  'earn_activity_instagram_share',
  'earn_workout_feed_share',
  'earn_workout_instagram_share'
)
AND reference_type ~ '^(meal|activity|workout)_(feed|instagram)_share:[0-9]{4}-[0-9]{2}-[0-9]{2}$';

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
  v_reference_type := p_share_kind || CASE
    WHEN p_destination = 'balance_feed' THEN '_feed_share:'
    ELSE '_instagram_share:'
  END || v_award_date::TEXT;
  v_description := 'Shared ' || p_share_kind || CASE
    WHEN p_destination = 'balance_feed' THEN ' to Balance Feed'
    ELSE ' to Instagram Feed'
  END;

  INSERT INTO public.point_transactions (
    user_id, transaction_type, points_amount, reference_id, reference_type,
    photo_verified, verification_method, description
  ) VALUES (
    p_user_id, v_transaction_type, v_points, p_reference_id, v_reference_type,
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
      'dailyLimitReached', TRUE,
      'pointsAwarded', 0,
      'basePoints', v_points,
      'reason', 'That share bonus has already been claimed for this destination today.'
    );
  END IF;

  PERFORM public.increment_user_points(p_user_id, v_points);
  PERFORM public.update_challenge_participant_points(p_user_id);

  RETURN jsonb_build_object(
    'success', TRUE,
    'alreadyAwarded', FALSE,
    'dailyLimitReached', FALSE,
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
  'Awards one 15 XP social-share bonus per category, destination, and Brisbane day. Workout and PB cards share the workout category.';

NOTIFY pgrst, 'reload schema';
