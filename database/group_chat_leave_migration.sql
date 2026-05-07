-- Group chat leave support.
-- Users can remove themselves from a chat, and challenge chat sync respects
-- that opt-out instead of silently adding them back to the inbox.

CREATE TABLE IF NOT EXISTS public.group_chat_member_leaves (
  group_chat_id UUID NOT NULL REFERENCES public.group_chats(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  left_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (group_chat_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_group_chat_member_leaves_user
  ON public.group_chat_member_leaves(user_id, left_at DESC);

ALTER TABLE public.group_chat_member_leaves ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'group_chat_member_leaves'
      AND policyname = 'Users can manage their own group chat leave records'
  ) THEN
    CREATE POLICY "Users can manage their own group chat leave records"
      ON public.group_chat_member_leaves
      FOR ALL
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END;
$$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_chat_member_leaves TO authenticated;

CREATE OR REPLACE FUNCTION public.leave_group_chat(chat_uuid UUID)
RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_chat RECORD;
  v_removed INTEGER := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'unauthenticated');
  END IF;

  SELECT id, name, is_challenge_chat
    INTO v_chat
  FROM public.group_chats
  WHERE id = chat_uuid
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'group_chat_not_found_or_not_member');
  END IF;

  DELETE FROM public.group_chat_members
  WHERE group_chat_id = chat_uuid
    AND user_id = v_user_id;

  GET DIAGNOSTICS v_removed = ROW_COUNT;

  IF v_removed < 1 THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'group_chat_not_found_or_not_member');
  END IF;

  INSERT INTO public.group_chat_member_leaves (group_chat_id, user_id, left_at)
  VALUES (chat_uuid, v_user_id, NOW())
  ON CONFLICT (group_chat_id, user_id)
  DO UPDATE SET left_at = EXCLUDED.left_at;

  RETURN jsonb_build_object(
    'ok', TRUE,
    'chat_id', chat_uuid,
    'chat_name', COALESCE(v_chat.name, 'Group chat'),
    'is_challenge_chat', COALESCE(v_chat.is_challenge_chat, FALSE),
    'removed', v_removed
  );
END;
$$;

REVOKE ALL ON FUNCTION public.leave_group_chat(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.leave_group_chat(UUID) TO authenticated;

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
    AND NOT EXISTS (
      SELECT 1
      FROM public.group_chat_member_leaves gcml
      WHERE gcml.group_chat_id = v_chat_id
        AND gcml.user_id = cp.user_id
    )
  ON CONFLICT (group_chat_id, user_id) DO NOTHING;

  IF v_creator_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM public.group_chat_member_leaves gcml
       WHERE gcml.group_chat_id = v_chat_id
         AND gcml.user_id = v_creator_id
     ) THEN
    INSERT INTO public.group_chat_members (group_chat_id, user_id)
    VALUES (v_chat_id, v_creator_id)
    ON CONFLICT (group_chat_id, user_id) DO NOTHING;
  END IF;

  RETURN v_chat_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.ensure_challenge_group_chat(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.ensure_challenge_group_chat(UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_challenge_group_chat(UUID) TO service_role;

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

  IF NOT EXISTS (
    SELECT 1
    FROM public.group_chat_members gcm
    WHERE gcm.group_chat_id = v_chat_id
      AND gcm.user_id = v_user_id
  ) THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'left_challenge_chat', 'chat_id', v_chat_id);
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

GRANT EXECUTE ON FUNCTION public.get_my_active_challenge_chat(UUID) TO authenticated, service_role;

COMMENT ON TABLE public.group_chat_member_leaves IS
  'Tracks users who intentionally left a group chat so automated syncs do not re-add them.';

COMMENT ON FUNCTION public.leave_group_chat(UUID) IS
  'Removes the signed-in user from a group chat and records the leave so challenge chats stay out of their inbox.';
