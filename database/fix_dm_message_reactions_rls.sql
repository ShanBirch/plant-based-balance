-- Fix: "Could not react" error when liking DM messages.
--
-- Root cause: the original message_reactions_migration.sql declared the
-- toggle_message_reaction RPC with p_message_id BIGINT, but public.nudges.id
-- is a UUID. The web client was also coercing the id with Number(), which
-- turns a UUID string into NaN. The RPC therefore either threw a type
-- mismatch (uuid = bigint) or never matched a row, and the client surfaced
-- the generic "Could not react" toast for every tap.
--
-- In addition, the existing UPDATE policy on public.nudges only allowed the
-- receiver to update rows (it was originally intended for marking messages
-- as read). This file also relaxes that so either participant can update
-- their own DM row — a defense-in-depth measure, since the RPC is
-- SECURITY DEFINER and enforces participation itself.
--
-- Run this in the Supabase SQL editor once.

-- Allow sender or receiver to update the nudge row (covers reactions and
-- read receipts). Drop any prior version first so this is idempotent.
DROP POLICY IF EXISTS "Users can mark nudges as read" ON public.nudges;
DROP POLICY IF EXISTS "Participants can update nudges" ON public.nudges;
CREATE POLICY "Participants can update nudges" ON public.nudges
  FOR UPDATE
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id)
  WITH CHECK (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- Drop the broken BIGINT-signature version of the RPC if it exists on prod.
-- Postgres treats the signature as part of the function identity, so the
-- UUID version below will not replace it without this step.
DROP FUNCTION IF EXISTS public.toggle_message_reaction(BIGINT, TEXT);

-- Recreate the RPC with the correct UUID parameter type and harden it: verify
-- the caller is a participant of the message before mutating the reactions
-- JSONB. Runs as SECURITY DEFINER so it can bypass RLS once the participant
-- check has passed.
CREATE OR REPLACE FUNCTION public.toggle_message_reaction(
  p_message_id UUID,
  p_emoji TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_sender UUID;
  v_receiver UUID;
  v_current JSONB;
  v_list JSONB;
  v_new JSONB;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT sender_id, receiver_id, COALESCE(reactions, '{}'::jsonb)
    INTO v_sender, v_receiver, v_current
  FROM public.nudges
  WHERE id = p_message_id;

  IF v_sender IS NULL THEN
    RAISE EXCEPTION 'Message not found';
  END IF;

  IF v_user <> v_sender AND v_user <> v_receiver THEN
    RAISE EXCEPTION 'Not a participant of this message';
  END IF;

  v_list := COALESCE(v_current -> p_emoji, '[]'::jsonb);

  IF v_list @> to_jsonb(v_user::text) THEN
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
