-- ============================================================
-- FRIEND NUDGES (rewarded inactivity nudges)
-- Separate from the general `nudges` table so we can enforce a
-- 7-day-per-friend cadence without affecting AI coach / battle /
-- arena / chat nudges that use the existing `nudges` table.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.friend_nudges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  sender_id   UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- Monday of the ISO week the nudge was sent in. Combined with the
  -- unique constraint below this enforces "max 1 nudge per friend per week".
  week_start DATE NOT NULL DEFAULT DATE_TRUNC('week', CURRENT_DATE)::DATE,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  CHECK (sender_id != receiver_id),
  UNIQUE (sender_id, receiver_id, week_start)
);

CREATE INDEX IF NOT EXISTS idx_friend_nudges_sender_week
  ON public.friend_nudges(sender_id, week_start DESC);

ALTER TABLE public.friend_nudges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own friend_nudges"
  ON public.friend_nudges
  FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- Inserts happen via the send_inactivity_nudge RPC (SECURITY DEFINER),
-- but we still allow direct inserts by the sender as a fallback.
CREATE POLICY "Users can send their own friend_nudges"
  ON public.friend_nudges
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- ============================================================
-- RPC: get_inactive_friends_for_nudging(user_uuid)
-- Returns the user's friends whose last_login is >= 2 days ago
-- and whom the user hasn't already nudged this week.
-- ============================================================

CREATE OR REPLACE FUNCTION get_inactive_friends_for_nudging(user_uuid UUID)
RETURNS TABLE(
  friend_id      UUID,
  friend_name    TEXT,
  friend_photo   TEXT,
  last_login     TIMESTAMPTZ,
  days_inactive  INT
) AS $$
DECLARE
  week_start_date DATE := DATE_TRUNC('week', CURRENT_DATE)::DATE;
BEGIN
  RETURN QUERY
  SELECT * FROM (
    -- Friendships where the user is the sender side
    SELECT
      u.id                                          AS friend_id,
      u.name                                        AS friend_name,
      u.profile_photo                               AS friend_photo,
      u.last_login                                  AS last_login,
      GREATEST(0, EXTRACT(DAY FROM (NOW() - u.last_login))::INT) AS days_inactive
    FROM public.friendships f
    JOIN public.users u ON u.id = f.friend_id
    WHERE f.user_id = user_uuid
      AND f.status  = 'accepted'
      AND u.last_login IS NOT NULL
      AND u.last_login < NOW() - INTERVAL '2 days'
      AND NOT EXISTS (
        SELECT 1 FROM public.friend_nudges fn
        WHERE fn.sender_id   = user_uuid
          AND fn.receiver_id = u.id
          AND fn.week_start  = week_start_date
      )

    UNION

    -- Friendships where the user is the receiver side
    SELECT
      u.id                                          AS friend_id,
      u.name                                        AS friend_name,
      u.profile_photo                               AS friend_photo,
      u.last_login                                  AS last_login,
      GREATEST(0, EXTRACT(DAY FROM (NOW() - u.last_login))::INT) AS days_inactive
    FROM public.friendships f
    JOIN public.users u ON u.id = f.user_id
    WHERE f.friend_id = user_uuid
      AND f.status    = 'accepted'
      AND u.last_login IS NOT NULL
      AND u.last_login < NOW() - INTERVAL '2 days'
      AND NOT EXISTS (
        SELECT 1 FROM public.friend_nudges fn
        WHERE fn.sender_id   = user_uuid
          AND fn.receiver_id = u.id
          AND fn.week_start  = week_start_date
      )
  ) AS inactive_friends
  ORDER BY last_login ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- RPC: send_inactivity_nudge(friend_uuid)
-- Validates the nudge (must be a friend, must be inactive ≥2 days,
-- must not have been nudged this week), then atomically:
--   1. Inserts into friend_nudges (for the rate-limit record)
--   2. Inserts into nudges        (for the in-app notification)
--   3. Awards the sender +1 XP (lifetime_points)
-- Returns { success BOOLEAN, reason TEXT, new_lifetime_points INT }.
-- ============================================================

CREATE OR REPLACE FUNCTION send_inactivity_nudge(friend_uuid UUID)
RETURNS TABLE(success BOOLEAN, reason TEXT, new_lifetime_points INT) AS $$
DECLARE
  sender_uuid      UUID := auth.uid();
  week_start_date  DATE := DATE_TRUNC('week', CURRENT_DATE)::DATE;
  is_friend        BOOLEAN;
  friend_last_seen TIMESTAMPTZ;
  sender_name      TEXT;
  updated_points   INT;
BEGIN
  IF sender_uuid IS NULL THEN
    RETURN QUERY SELECT FALSE, 'not_authenticated', 0; RETURN;
  END IF;

  IF sender_uuid = friend_uuid THEN
    RETURN QUERY SELECT FALSE, 'cannot_nudge_self', 0; RETURN;
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
    RETURN QUERY SELECT FALSE, 'not_friends', 0; RETURN;
  END IF;

  -- 2. Inactivity check
  SELECT last_login INTO friend_last_seen
  FROM public.users WHERE id = friend_uuid;

  IF friend_last_seen IS NULL OR friend_last_seen >= NOW() - INTERVAL '2 days' THEN
    RETURN QUERY SELECT FALSE, 'friend_not_inactive', 0; RETURN;
  END IF;

  -- 3. Rate-limit check (unique constraint will catch races too)
  IF EXISTS (
    SELECT 1 FROM public.friend_nudges
    WHERE sender_id   = sender_uuid
      AND receiver_id = friend_uuid
      AND week_start  = week_start_date
  ) THEN
    RETURN QUERY SELECT FALSE, 'already_nudged_this_week', 0; RETURN;
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

  -- 6. Award +1 XP (lifetime_points). Create the row if it doesn't exist.
  INSERT INTO public.user_points (user_id, lifetime_points, current_points)
  VALUES (sender_uuid, 1, 0)
  ON CONFLICT (user_id) DO UPDATE
    SET lifetime_points = public.user_points.lifetime_points + 1
  RETURNING public.user_points.lifetime_points INTO updated_points;

  RETURN QUERY SELECT TRUE, 'ok', updated_points;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON TABLE public.friend_nudges IS
  'Rate-limit ledger for rewarded inactivity nudges (1 per friend per week). Separate from the general `nudges` table so AI coach / battle / chat flows are unaffected.';
