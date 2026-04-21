-- ============================================================
-- REMOVE XP REWARD FROM INACTIVITY NUDGES
-- Previously `send_inactivity_nudge` awarded the sender +1 XP
-- (lifetime_points). XP rewards have been removed; the RPC now
-- only records the nudge and inserts the notification.
-- Return shape changes from (success, reason, new_lifetime_points)
-- to (success, reason).
-- ============================================================

-- The return signature is changing, so we have to drop first.
DROP FUNCTION IF EXISTS send_inactivity_nudge(UUID);

CREATE OR REPLACE FUNCTION send_inactivity_nudge(friend_uuid UUID)
RETURNS TABLE(success BOOLEAN, reason TEXT) AS $$
DECLARE
  sender_uuid      UUID := auth.uid();
  week_start_date  DATE := DATE_TRUNC('week', CURRENT_DATE)::DATE;
  is_friend        BOOLEAN;
  friend_last_seen TIMESTAMPTZ;
  sender_name      TEXT;
BEGIN
  IF sender_uuid IS NULL THEN
    RETURN QUERY SELECT FALSE, 'not_authenticated'; RETURN;
  END IF;

  IF sender_uuid = friend_uuid THEN
    RETURN QUERY SELECT FALSE, 'cannot_nudge_self'; RETURN;
  END IF;

  -- 1. Friendship check (either direction, must be accepted)
  SELECT EXISTS (
    SELECT 1 FROM public.friendships
    WHERE status = 'accepted'
      AND (
        (user_id = sender_uuid AND friend_id = friend_uuid) OR
        (user_id = friend_uuid AND friend_id = sender_uuid)
      )
  ) INTO is_friend;

  IF NOT is_friend THEN
    RETURN QUERY SELECT FALSE, 'not_friends'; RETURN;
  END IF;

  -- 2. Inactivity check
  SELECT last_login INTO friend_last_seen
  FROM public.users WHERE id = friend_uuid;

  IF friend_last_seen IS NULL OR friend_last_seen >= NOW() - INTERVAL '2 days' THEN
    RETURN QUERY SELECT FALSE, 'friend_not_inactive'; RETURN;
  END IF;

  -- 3. Rate-limit check (unique constraint will catch races too)
  IF EXISTS (
    SELECT 1 FROM public.friend_nudges
    WHERE sender_id   = sender_uuid
      AND receiver_id = friend_uuid
      AND week_start  = week_start_date
  ) THEN
    RETURN QUERY SELECT FALSE, 'already_nudged_this_week'; RETURN;
  END IF;

  -- 4. Record the nudge for rate limiting
  INSERT INTO public.friend_nudges (sender_id, receiver_id, week_start)
  VALUES (sender_uuid, friend_uuid, week_start_date)
  ON CONFLICT (sender_id, receiver_id, week_start) DO NOTHING;

  -- 5. Also insert into the general nudges table so the receiver
  -- gets the in-app notification through existing delivery.
  SELECT name INTO sender_name FROM public.users WHERE id = sender_uuid;
  INSERT INTO public.nudges (sender_id, receiver_id, message)
  VALUES (
    sender_uuid,
    friend_uuid,
    COALESCE(sender_name, 'A friend') || ' is thinking of you — time to log in! 👋'
  );

  RETURN QUERY SELECT TRUE, 'ok';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
