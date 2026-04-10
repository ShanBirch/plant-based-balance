-- Adds a reactions column to nudges (DM/messages table) so users can
-- react to individual messages with emojis. Shape:
--   { "❤️": ["user_id_1","user_id_2"], "🔥": ["user_id_3"] }
ALTER TABLE public.nudges
  ADD COLUMN IF NOT EXISTS reactions JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Toggle a reaction atomically. If the user already reacted with that emoji
-- it is removed; otherwise it is added. Returns the new reactions object.
-- NOTE: p_message_id is a UUID because nudges.id is a UUID. An earlier
-- version of this file used BIGINT which caused every reaction to fail with
-- "Could not react" on the client.
CREATE OR REPLACE FUNCTION public.toggle_message_reaction(
  p_message_id UUID,
  p_emoji TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_current JSONB;
  v_list JSONB;
  v_new JSONB;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT COALESCE(reactions, '{}'::jsonb) INTO v_current
  FROM public.nudges WHERE id = p_message_id;

  v_list := COALESCE(v_current -> p_emoji, '[]'::jsonb);

  IF v_list @> to_jsonb(v_user::text) THEN
    -- remove
    SELECT COALESCE(jsonb_agg(x), '[]'::jsonb) INTO v_list
    FROM jsonb_array_elements_text(v_list) x
    WHERE x <> v_user::text;
  ELSE
    v_list := v_list || to_jsonb(v_user::text);
  END IF;

  IF jsonb_array_length(v_list) = 0 THEN
    v_new := v_current - p_emoji;
  ELSE
    v_new := jsonb_set(v_current, ARRAY[p_emoji], v_list, true);
  END IF;

  UPDATE public.nudges SET reactions = v_new WHERE id = p_message_id;
  RETURN v_new;
END;
$$;

GRANT EXECUTE ON FUNCTION public.toggle_message_reaction(UUID, TEXT) TO authenticated;
