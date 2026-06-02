-- Set Friday weigh-in Feed share rewards to 10 XP and top up any
-- existing shares that were previously awarded at 2 XP.

CREATE UNIQUE INDEX IF NOT EXISTS idx_point_transactions_friday_weigh_unique
ON public.point_transactions(user_id, transaction_type, reference_id)
WHERE transaction_type = ANY (ARRAY[
  'earn_weigh_in',
  'bonus_friday_weigh_loss',
  'earn_friday_weigh_share'
])
AND reference_id IS NOT NULL;

WITH friday_share_topups AS (
  SELECT
    id,
    user_id,
    10 - points_amount AS delta
  FROM public.point_transactions
  WHERE transaction_type = 'earn_friday_weigh_share'
    AND points_amount > 0
    AND points_amount < 10
),
updated_transactions AS (
  UPDATE public.point_transactions pt
  SET
    points_amount = 10,
    description = 'Posted Friday weigh-in to feed'
  FROM friday_share_topups topup
  WHERE pt.id = topup.id
  RETURNING topup.user_id, topup.delta
),
topup_totals AS (
  SELECT user_id, SUM(delta)::INTEGER AS delta
  FROM updated_transactions
  GROUP BY user_id
)
INSERT INTO public.user_points (
  user_id,
  current_points,
  lifetime_points,
  created_at,
  updated_at
)
SELECT
  user_id,
  delta,
  delta,
  NOW(),
  NOW()
FROM topup_totals
ON CONFLICT (user_id) DO UPDATE
SET
  current_points = COALESCE(public.user_points.current_points, 0) + EXCLUDED.current_points,
  lifetime_points = COALESCE(public.user_points.lifetime_points, 0) + EXCLUDED.lifetime_points,
  updated_at = NOW();

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
  v_is_friday BOOLEAN := FALSE;
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

  v_is_friday := EXTRACT(ISODOW FROM v_weigh.weigh_in_date::TIMESTAMP) = 5;

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

  IF v_is_friday THEN
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
        AND EXTRACT(ISODOW FROM weigh_in_date::TIMESTAMP) = 5
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
        v_loss_points := 10;
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
          'Friday weigh-in moved down from last Friday'
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
    'is_friday', v_is_friday,
    'active_challenge', v_has_challenge,
    'challenge_id', CASE WHEN v_has_challenge THEN v_challenge.id ELSE NULL END,
    'challenge_name', CASE WHEN v_has_challenge THEN v_challenge.name ELSE NULL END,
    'chat_id', v_chat_id,
    'chat_name', v_chat_name,
    'previous_weight_kg', v_previous_weight,
    'previous_weight_date', v_previous_weight_date,
    'change_kg', v_change_kg,
    'comparison_label', CASE WHEN v_previous_weight_date IS NULL THEN 'first_friday' ELSE 'last_friday' END,
    'lost_weight', COALESCE(v_previous_weight IS NOT NULL AND v_weigh.weight_kg < v_previous_weight, FALSE),
    'daily_points_awarded', v_daily_points,
    'loss_points_awarded', v_loss_points,
    'total_points_awarded', v_total_awarded,
    'share_points_available', CASE WHEN v_has_challenge AND v_is_friday THEN 10 ELSE 0 END,
    'share_already_posted', v_share_already_posted
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.handle_friday_weigh_in_rewards(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.handle_friday_weigh_in_rewards(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.handle_friday_weigh_in_rewards(UUID) TO service_role;

NOTIFY pgrst, 'reload schema';
