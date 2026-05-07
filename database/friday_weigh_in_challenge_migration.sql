-- Friday weigh-ins for live 30 Day Challenge cohorts.
--
-- Adds:
--   - a challenge-owned group chat for active system cohorts
--   - idempotent daily weigh-in XP and Friday loss XP
--   - a server-side post action that awards share XP only after posting
--   - a limited shared trend RPC for clickable weigh-in cards

ALTER TABLE public.group_chats
  ADD COLUMN IF NOT EXISTS challenge_id UUID REFERENCES public.challenges(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS is_challenge_chat BOOLEAN DEFAULT FALSE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_group_chats_challenge_unique
  ON public.group_chats(challenge_id)
  WHERE challenge_id IS NOT NULL AND is_challenge_chat = TRUE;

CREATE INDEX IF NOT EXISTS idx_group_chat_messages_friday_weigh
  ON public.group_chat_messages(user_id, win_type, created_at DESC)
  WHERE win_type = 'friday_weigh_in';

CREATE UNIQUE INDEX IF NOT EXISTS idx_point_transactions_friday_weigh_unique
  ON public.point_transactions(user_id, transaction_type, reference_id)
  WHERE transaction_type IN ('earn_weigh_in', 'bonus_friday_weigh_loss', 'earn_friday_weigh_share')
    AND reference_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.get_active_challenge_xp_multiplier(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.challenge_participants cp
    JOIN public.challenges c ON c.id = cp.challenge_id
    WHERE cp.user_id = p_user_id
      AND cp.status = 'accepted'
      AND c.status = 'active'
      AND (c.end_date IS NULL OR c.end_date >= CURRENT_DATE)
  ) THEN
    RETURN 2;
  END IF;

  RETURN 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_challenge_group_chat(p_challenge_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_chat_id UUID;
  v_challenge RECORD;
  v_creator_id UUID;
BEGIN
  SELECT id, name, creator_id
    INTO v_challenge
  FROM public.challenges
  WHERE id = p_challenge_id
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'challenge_not_found';
  END IF;

  v_creator_id := v_challenge.creator_id;

  IF v_creator_id IS NULL THEN
    SELECT user_id INTO v_creator_id
    FROM public.admin_users
    LIMIT 1;
  END IF;

  IF v_creator_id IS NULL THEN
    SELECT user_id INTO v_creator_id
    FROM public.challenge_participants
    WHERE challenge_id = p_challenge_id
      AND status = 'accepted'
    ORDER BY accepted_at NULLS LAST
    LIMIT 1;
  END IF;

  SELECT id INTO v_chat_id
  FROM public.group_chats
  WHERE challenge_id = p_challenge_id
    AND is_challenge_chat = TRUE
  LIMIT 1;

  IF v_chat_id IS NULL THEN
    IF v_creator_id IS NULL THEN
      RETURN NULL;
    END IF;

    INSERT INTO public.group_chats (name, created_by, challenge_id, is_challenge_chat)
    VALUES (COALESCE(v_challenge.name, '30 Day Challenge') || ' Chat', v_creator_id, p_challenge_id, TRUE)
    RETURNING id INTO v_chat_id;
  ELSE
    UPDATE public.group_chats
    SET name = COALESCE(v_challenge.name, '30 Day Challenge') || ' Chat',
        updated_at = NOW()
    WHERE id = v_chat_id;
  END IF;

  INSERT INTO public.group_chat_members (group_chat_id, user_id)
  SELECT v_chat_id, cp.user_id
  FROM public.challenge_participants cp
  WHERE cp.challenge_id = p_challenge_id
    AND cp.status = 'accepted'
  ON CONFLICT (group_chat_id, user_id) DO NOTHING;

  IF v_creator_id IS NOT NULL THEN
    INSERT INTO public.group_chat_members (group_chat_id, user_id)
    VALUES (v_chat_id, v_creator_id)
    ON CONFLICT (group_chat_id, user_id) DO NOTHING;
  END IF;

  RETURN v_chat_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_active_challenge_chat(p_challenge_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_challenge RECORD;
  v_chat_id UUID;
  v_chat_name TEXT;
  v_member_count INTEGER := 0;
  v_member_names TEXT := '';
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'unauthenticated');
  END IF;

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
    AND (p_challenge_id IS NULL OR c.id = p_challenge_id)
  ORDER BY c.start_date DESC NULLS LAST, c.created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'no_active_30_day_challenge');
  END IF;

  v_chat_id := public.ensure_challenge_group_chat(v_challenge.id);

  IF v_chat_id IS NULL THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'challenge_chat_unavailable');
  END IF;

  SELECT name INTO v_chat_name
  FROM public.group_chats
  WHERE id = v_chat_id;

  SELECT
    COUNT(*)::INTEGER,
    COALESCE(string_agg(COALESCE(u.name, 'Member'), ', ' ORDER BY gcm.joined_at ASC), '')
  INTO v_member_count, v_member_names
  FROM public.group_chat_members gcm
  LEFT JOIN public.users u ON u.id = gcm.user_id
  WHERE gcm.group_chat_id = v_chat_id;

  RETURN jsonb_build_object(
    'ok', TRUE,
    'challenge_id', v_challenge.id,
    'challenge_name', v_challenge.name,
    'chat_id', v_chat_id,
    'chat_name', COALESCE(v_chat_name, '30 Day Challenge Chat'),
    'member_count', v_member_count,
    'member_names', v_member_names
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_challenge_group_chat_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_challenge_id UUID;
BEGIN
  IF TG_TABLE_NAME = 'challenges' THEN
    IF NEW.status = 'active'
       AND COALESCE(NEW.is_system_cohort, FALSE) = TRUE
       AND NEW.cohort_type IN ('plant_based_30', 'transform_30') THEN
      PERFORM public.ensure_challenge_group_chat(NEW.id);
    END IF;
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'challenge_participants' THEN
    IF NEW.status = 'accepted' THEN
      SELECT c.id INTO v_challenge_id
      FROM public.challenges c
      WHERE c.id = NEW.challenge_id
        AND c.status = 'active'
        AND COALESCE(c.is_system_cohort, FALSE) = TRUE
        AND c.cohort_type IN ('plant_based_30', 'transform_30')
      LIMIT 1;

      IF v_challenge_id IS NOT NULL THEN
        PERFORM public.ensure_challenge_group_chat(v_challenge_id);
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_challenge_group_chat_on_challenge ON public.challenges;
CREATE TRIGGER trg_sync_challenge_group_chat_on_challenge
AFTER INSERT OR UPDATE OF status, is_system_cohort, cohort_type
ON public.challenges
FOR EACH ROW
EXECUTE FUNCTION public.sync_challenge_group_chat_trigger();

DROP TRIGGER IF EXISTS trg_sync_challenge_group_chat_on_participant ON public.challenge_participants;
CREATE TRIGGER trg_sync_challenge_group_chat_on_participant
AFTER INSERT OR UPDATE OF status
ON public.challenge_participants
FOR EACH ROW
EXECUTE FUNCTION public.sync_challenge_group_chat_trigger();

CREATE OR REPLACE FUNCTION public.handle_friday_weigh_in_rewards(p_weigh_in_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_weigh RECORD;
  v_challenge RECORD;
  v_chat_id UUID;
  v_chat_name TEXT;
  v_previous_weight NUMERIC;
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

      SELECT weight_kg INTO v_previous_weight
      FROM public.daily_weigh_ins
      WHERE user_id = v_user_id
        AND weigh_in_date < v_weigh.weigh_in_date
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
          'Friday weigh-in moved down'
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
    'change_kg', v_change_kg,
    'lost_weight', COALESCE(v_previous_weight IS NOT NULL AND v_weigh.weight_kg < v_previous_weight, FALSE),
    'daily_points_awarded', v_daily_points,
    'loss_points_awarded', v_loss_points,
    'total_points_awarded', v_total_awarded,
    'share_points_available', CASE WHEN v_has_challenge AND v_is_friday THEN 2 ELSE 0 END,
    'share_already_posted', v_share_already_posted
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.post_friday_weigh_in_to_challenge_chat(p_weigh_in_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_weigh RECORD;
  v_challenge RECORD;
  v_chat_id UUID;
  v_chat_name TEXT;
  v_message_id UUID;
  v_previous_weight NUMERIC;
  v_change_kg NUMERIC;
  v_abs_change_kg NUMERIC;
  v_message TEXT;
  v_share_points INTEGER := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'unauthenticated');
  END IF;

  PERFORM public.handle_friday_weigh_in_rewards(p_weigh_in_id);

  SELECT *
    INTO v_weigh
  FROM public.daily_weigh_ins
  WHERE id = p_weigh_in_id
    AND user_id = v_user_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'weigh_in_not_found');
  END IF;

  IF EXTRACT(ISODOW FROM v_weigh.weigh_in_date::TIMESTAMP) <> 5 THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'not_friday');
  END IF;

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

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'no_active_30_day_challenge');
  END IF;

  v_chat_id := public.ensure_challenge_group_chat(v_challenge.id);

  SELECT name INTO v_chat_name
  FROM public.group_chats
  WHERE id = v_chat_id;

  SELECT weight_kg INTO v_previous_weight
  FROM public.daily_weigh_ins
  WHERE user_id = v_user_id
    AND weigh_in_date < v_weigh.weigh_in_date
  ORDER BY weigh_in_date DESC
  LIMIT 1;

  IF v_previous_weight IS NOT NULL THEN
    v_change_kg := ROUND((v_weigh.weight_kg - v_previous_weight)::NUMERIC, 1);
    v_abs_change_kg := ABS(v_change_kg);
  END IF;

  IF v_previous_weight IS NULL THEN
    v_message := 'Friday weigh-in is in: ' || ROUND(v_weigh.weight_kg::NUMERIC, 1) || 'kg.';
  ELSIF v_change_kg < 0 THEN
    v_message := 'Friday weigh-in is in: ' || ROUND(v_weigh.weight_kg::NUMERIC, 1) || 'kg, down ' || v_abs_change_kg || 'kg from last check.';
  ELSIF v_change_kg > 0 THEN
    v_message := 'Friday weigh-in is in: ' || ROUND(v_weigh.weight_kg::NUMERIC, 1) || 'kg, up ' || v_abs_change_kg || 'kg from last check.';
  ELSE
    v_message := 'Friday weigh-in is in: ' || ROUND(v_weigh.weight_kg::NUMERIC, 1) || 'kg, steady from last check.';
  END IF;

  SELECT id INTO v_message_id
  FROM public.group_chat_messages
  WHERE user_id = v_user_id
    AND win_type = 'friday_weigh_in'
    AND win_details->>'weighInId' = p_weigh_in_id::TEXT
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_message_id IS NULL THEN
    INSERT INTO public.group_chat_messages (
      group_chat_id, user_id, message, is_win_share, win_type, win_details
    ) VALUES (
      v_chat_id,
      v_user_id,
      v_message,
      TRUE,
      'friday_weigh_in',
      jsonb_build_object(
        'weighInId', p_weigh_in_id,
        'weighInDate', v_weigh.weigh_in_date,
        'weightKg', ROUND(v_weigh.weight_kg::NUMERIC, 1),
        'previousWeightKg', CASE WHEN v_previous_weight IS NULL THEN NULL ELSE ROUND(v_previous_weight::NUMERIC, 1) END,
        'changeKg', v_change_kg,
        'challengeId', v_challenge.id,
        'challengeName', v_challenge.name,
        'trendRanges', jsonb_build_array(30, 90, 180)
      )
    )
    RETURNING id INTO v_message_id;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.point_transactions
    WHERE user_id = v_user_id
      AND transaction_type = 'earn_friday_weigh_share'
      AND reference_id = p_weigh_in_id
  ) THEN
    v_share_points := 2;
    PERFORM public.increment_user_points(v_user_id, v_share_points);

    INSERT INTO public.point_transactions (
      user_id, transaction_type, points_amount, reference_id, reference_type,
      photo_verified, verification_method, description
    ) VALUES (
      v_user_id,
      'earn_friday_weigh_share',
      v_share_points,
      p_weigh_in_id,
      'daily_weigh_in',
      FALSE,
      'challenge_chat_post',
      'Posted Friday weigh-in to challenge chat'
    );

    PERFORM public.update_challenge_participant_points(v_user_id);
  END IF;

  RETURN jsonb_build_object(
    'ok', TRUE,
    'message_id', v_message_id,
    'chat_id', v_chat_id,
    'chat_name', v_chat_name,
    'challenge_id', v_challenge.id,
    'share_points_awarded', v_share_points,
    'already_posted', v_share_points = 0
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_shared_weigh_in_trend(
  p_message_id UUID,
  p_range_days INTEGER DEFAULT 30
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_viewer_id UUID := auth.uid();
  v_message RECORD;
  v_anchor_date DATE;
  v_range_days INTEGER;
  v_points JSONB := '[]'::JSONB;
  v_count INTEGER := 0;
  v_start_weight NUMERIC;
  v_end_weight NUMERIC;
BEGIN
  IF v_viewer_id IS NULL THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'unauthenticated');
  END IF;

  SELECT gcm.*, u.name AS sender_name, u.profile_photo AS sender_photo
    INTO v_message
  FROM public.group_chat_messages gcm
  JOIN public.users u ON u.id = gcm.user_id
  WHERE gcm.id = p_message_id
    AND gcm.is_win_share = TRUE
    AND gcm.win_type = 'friday_weigh_in'
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'shared_weigh_in_not_found');
  END IF;

  IF NOT public.is_group_chat_member(v_message.group_chat_id, v_viewer_id) THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'forbidden');
  END IF;

  v_anchor_date := COALESCE((v_message.win_details->>'weighInDate')::DATE, CURRENT_DATE);
  v_range_days := LEAST(180, GREATEST(30, COALESCE(p_range_days, 30)));

  WITH scoped AS (
    SELECT weigh_in_date, ROUND(weight_kg::NUMERIC, 1) AS weight_kg
    FROM public.daily_weigh_ins
    WHERE user_id = v_message.user_id
      AND weigh_in_date >= (v_anchor_date - (v_range_days - 1))
      AND weigh_in_date <= v_anchor_date
    ORDER BY weigh_in_date ASC
  )
  SELECT
    COALESCE(jsonb_agg(
      jsonb_build_object(
        'date', weigh_in_date,
        'weightKg', weight_kg
      )
      ORDER BY weigh_in_date ASC
    ), '[]'::JSONB),
    COUNT(*)::INTEGER
  INTO v_points, v_count
  FROM scoped;

  SELECT weight_kg INTO v_start_weight
  FROM public.daily_weigh_ins
  WHERE user_id = v_message.user_id
    AND weigh_in_date >= (v_anchor_date - (v_range_days - 1))
    AND weigh_in_date <= v_anchor_date
  ORDER BY weigh_in_date ASC
  LIMIT 1;

  SELECT weight_kg INTO v_end_weight
  FROM public.daily_weigh_ins
  WHERE user_id = v_message.user_id
    AND weigh_in_date >= (v_anchor_date - (v_range_days - 1))
    AND weigh_in_date <= v_anchor_date
  ORDER BY weigh_in_date DESC
  LIMIT 1;

  RETURN jsonb_build_object(
    'ok', TRUE,
    'message_id', p_message_id,
    'sender_id', v_message.user_id,
    'sender_name', v_message.sender_name,
    'sender_photo', v_message.sender_photo,
    'anchor_date', v_anchor_date,
    'range_days', v_range_days,
    'count', v_count,
    'change_kg', CASE WHEN v_start_weight IS NULL OR v_end_weight IS NULL THEN NULL ELSE ROUND((v_end_weight - v_start_weight)::NUMERIC, 1) END,
    'points', v_points
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_active_challenge_xp_multiplier(UUID) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.ensure_challenge_group_chat(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.ensure_challenge_group_chat(UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_challenge_group_chat(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_my_active_challenge_chat(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.handle_friday_weigh_in_rewards(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.post_friday_weigh_in_to_challenge_chat(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_shared_weigh_in_trend(UUID, INTEGER) TO authenticated, service_role;

COMMENT ON FUNCTION public.handle_friday_weigh_in_rewards(UUID) IS
  'Idempotently awards daily weigh-in XP and Friday loss XP, and prepares the active 30 Day Challenge chat.';

COMMENT ON FUNCTION public.post_friday_weigh_in_to_challenge_chat(UUID) IS
  'Posts a Friday weigh-in card to the active 30 Day Challenge chat and awards share XP once.';

COMMENT ON FUNCTION public.get_shared_weigh_in_trend(UUID, INTEGER) IS
  'Returns a limited weight trend only for members who can view the clicked Friday weigh-in group chat message.';

COMMENT ON FUNCTION public.get_my_active_challenge_chat(UUID) IS
  'Ensures and returns the active 30 Day Challenge group chat for the signed-in participant.';

SELECT public.ensure_challenge_group_chat(id)
FROM public.challenges
WHERE status = 'active'
  AND is_system_cohort = TRUE
  AND cohort_type IN ('plant_based_30', 'transform_30');

NOTIFY pgrst, 'reload schema';
