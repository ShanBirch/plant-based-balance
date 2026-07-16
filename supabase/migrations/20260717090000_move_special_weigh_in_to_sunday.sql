-- Move the challenge board-day weigh-in rewards from Friday to Sunday.
-- Legacy function, transaction, and card identifiers remain in place so existing
-- clients and historical reward records continue to work.

CREATE OR REPLACE FUNCTION public.handle_friday_weigh_in_rewards(p_weigh_in_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID := auth.uid();
  v_weigh RECORD;
  v_challenge RECORD;
  v_chat_id UUID;
  v_chat_name TEXT;
  v_previous_weight NUMERIC;
  v_previous_weight_date DATE;
  v_change_kg NUMERIC;
  v_is_sunday BOOLEAN := FALSE;
  v_has_challenge BOOLEAN := FALSE;
  v_daily_points INTEGER := 0;
  v_loss_points INTEGER := 0;
  v_total_awarded INTEGER := 0;
  v_share_already_posted BOOLEAN := FALSE;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'unauthenticated');
  END IF;

  SELECT *
    INTO v_weigh
  FROM public.daily_weigh_ins
  WHERE id = p_weigh_in_id
    AND user_id = v_user_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'weigh_in_not_found');
  END IF;

  v_is_sunday := EXTRACT(ISODOW FROM v_weigh.weigh_in_date::TIMESTAMP) = 7;

  IF NOT EXISTS (
    SELECT 1
    FROM public.point_transactions
    WHERE user_id = v_user_id
      AND transaction_type = 'earn_weigh_in'
      AND reference_id = p_weigh_in_id
  ) THEN
    v_daily_points := public.get_active_challenge_xp_multiplier(v_user_id);
    PERFORM public.increment_user_points(v_user_id, v_daily_points);

    INSERT INTO public.point_transactions (
      user_id, transaction_type, points_amount, reference_id, reference_type,
      photo_verified, verification_method, description
    ) VALUES (
      v_user_id,
      'earn_weigh_in',
      v_daily_points,
      p_weigh_in_id,
      'daily_weigh_in',
      FALSE,
      'scale_self_logged',
      'Daily weigh-in logged'
    );

    v_total_awarded := v_total_awarded + v_daily_points;
  END IF;

  IF v_is_sunday THEN
    SELECT c.*
      INTO v_challenge
    FROM public.challenge_participants cp
    JOIN public.challenges c ON c.id = cp.challenge_id
    WHERE cp.user_id = v_user_id
      AND cp.status = 'accepted'
      AND c.status = 'active'
      AND c.is_system_cohort = TRUE
      AND c.cohort_type IN ('plant_based_30', 'transform_30')
      AND (c.end_date IS NULL OR c.end_date >= CURRENT_DATE)
    ORDER BY c.start_date DESC NULLS LAST, c.created_at DESC
    LIMIT 1;

    IF FOUND THEN
      v_has_challenge := TRUE;
      v_chat_id := public.ensure_challenge_group_chat(v_challenge.id);

      SELECT name INTO v_chat_name
      FROM public.group_chats
      WHERE id = v_chat_id;

      SELECT weight_kg, weigh_in_date
        INTO v_previous_weight, v_previous_weight_date
      FROM public.daily_weigh_ins
      WHERE user_id = v_user_id
        AND weigh_in_date < v_weigh.weigh_in_date
        AND EXTRACT(ISODOW FROM weigh_in_date::TIMESTAMP) = 7
      ORDER BY weigh_in_date DESC
      LIMIT 1;

      IF v_previous_weight IS NOT NULL THEN
        v_change_kg := ROUND((v_weigh.weight_kg - v_previous_weight)::NUMERIC, 1);
      END IF;

      IF v_previous_weight IS NOT NULL
         AND v_weigh.weight_kg < v_previous_weight
         AND NOT EXISTS (
           SELECT 1
           FROM public.point_transactions
           WHERE user_id = v_user_id
             AND transaction_type = 'bonus_friday_weigh_loss'
             AND reference_id = p_weigh_in_id
         ) THEN
        v_loss_points := 5;
        PERFORM public.increment_user_points(v_user_id, v_loss_points);

        INSERT INTO public.point_transactions (
          user_id, transaction_type, points_amount, reference_id, reference_type,
          photo_verified, verification_method, description
        ) VALUES (
          v_user_id,
          'bonus_friday_weigh_loss',
          v_loss_points,
          p_weigh_in_id,
          'daily_weigh_in',
          FALSE,
          'trend_verified',
          'Sunday weigh-in moved down from last Sunday'
        );

        v_total_awarded := v_total_awarded + v_loss_points;
      END IF;

      SELECT EXISTS (
        SELECT 1
        FROM public.group_chat_messages gcm
        WHERE gcm.user_id = v_user_id
          AND gcm.win_type = 'friday_weigh_in'
          AND gcm.win_details->>'weighInId' = p_weigh_in_id::TEXT
      ) INTO v_share_already_posted;
    END IF;
  END IF;

  IF v_total_awarded > 0 THEN
    PERFORM public.update_challenge_participant_points(v_user_id);
  END IF;

  RETURN jsonb_build_object(
    'ok', TRUE,
    'weigh_in_id', p_weigh_in_id,
    'weigh_in_date', v_weigh.weigh_in_date,
    'weight_kg', v_weigh.weight_kg,
    -- Keep is_friday until all deployed clients have moved to a new payload contract.
    'is_friday', v_is_sunday,
    'is_sunday', v_is_sunday,
    'active_challenge', v_has_challenge,
    'challenge_id', CASE WHEN v_has_challenge THEN v_challenge.id ELSE NULL END,
    'challenge_name', CASE WHEN v_has_challenge THEN v_challenge.name ELSE NULL END,
    'chat_id', v_chat_id,
    'chat_name', v_chat_name,
    'previous_weight_kg', v_previous_weight,
    'previous_weight_date', v_previous_weight_date,
    'change_kg', v_change_kg,
    'comparison_label', CASE WHEN v_previous_weight_date IS NULL THEN 'first_sunday' ELSE 'last_sunday' END,
    'lost_weight', COALESCE(v_previous_weight IS NOT NULL AND v_weigh.weight_kg < v_previous_weight, FALSE),
    'daily_points_awarded', v_daily_points,
    'loss_points_awarded', v_loss_points,
    'total_points_awarded', v_total_awarded,
    'share_points_available', CASE WHEN v_has_challenge AND v_is_sunday THEN 5 ELSE 0 END,
    'share_already_posted', v_share_already_posted
  );
END;
$function$;

COMMENT ON FUNCTION public.handle_friday_weigh_in_rewards(UUID) IS
  'Awards daily weigh-in XP plus Sunday challenge board-day progress rewards. Legacy function name retained for client compatibility.';

NOTIFY pgrst, 'reload schema';
