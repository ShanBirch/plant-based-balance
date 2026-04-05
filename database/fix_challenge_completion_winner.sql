-- ============================================================
-- FIX: CHALLENGE COMPLETION WINNER DETERMINATION
--
-- Problem: complete_challenge() picks the winner based on
-- challenge_points without first refreshing them. For weight_loss
-- challenges especially, points may be stale (NULL/0) if
-- update_challenge_participant_points hasn't run for all
-- participants recently.
--
-- Fix: Update ALL participants' points before selecting winner.
--
-- Run this in Supabase SQL Editor.
-- ============================================================

CREATE OR REPLACE FUNCTION complete_challenge(challenge_uuid UUID)
RETURNS JSONB AS $$
DECLARE
  winner_user_id UUID;
  winner_pts INT;
  winner_user_name TEXT;
  already_rewarded BOOLEAN;
  participant_uid UUID;
BEGIN
  -- Check if winner was already rewarded (prevents race condition/double reward)
  SELECT winner_rewarded INTO already_rewarded
  FROM public.challenges
  WHERE id = challenge_uuid;

  IF already_rewarded = TRUE THEN
    RETURN jsonb_build_object(
      'error', 'already_completed',
      'message', 'Challenge winner was already rewarded'
    );
  END IF;

  -- Refresh ALL participants' points before determining the winner.
  -- This is critical for weight_loss challenges where points depend on
  -- weigh-in data that may not have been synced to challenge_points yet.
  FOR participant_uid IN
    SELECT cp.user_id
    FROM public.challenge_participants cp
    WHERE cp.challenge_id = challenge_uuid
    AND cp.status = 'accepted'
  LOOP
    PERFORM public.update_challenge_participant_points(participant_uid);
  END LOOP;

  -- Find the winner (highest challenge_points)
  SELECT cp.user_id, cp.challenge_points, u.name
  INTO winner_user_id, winner_pts, winner_user_name
  FROM public.challenge_participants cp
  JOIN public.users u ON u.id = cp.user_id
  WHERE cp.challenge_id = challenge_uuid AND cp.status = 'accepted'
  ORDER BY cp.challenge_points DESC
  LIMIT 1;

  -- Update challenge with winner
  UPDATE public.challenges
  SET
    status = 'completed',
    winner_id = winner_user_id,
    winner_points = winner_pts,
    completed_at = NOW(),
    updated_at = NOW()
  WHERE id = challenge_uuid;

  -- Award 200 points to winner
  UPDATE public.user_points
  SET
    current_points = current_points + 200,
    lifetime_points = lifetime_points + 200
  WHERE user_id = winner_user_id;

  -- Record the transaction
  INSERT INTO public.point_transactions (user_id, transaction_type, points, description)
  VALUES (winner_user_id, 'challenge_win', 200, 'Won challenge: ' || (SELECT name FROM public.challenges WHERE id = challenge_uuid));

  -- Mark as rewarded
  UPDATE public.challenges
  SET winner_rewarded = TRUE
  WHERE id = challenge_uuid;

  RETURN jsonb_build_object(
    'winner_id', winner_user_id,
    'winner_name', winner_user_name,
    'winner_points', winner_pts,
    'reward_points', 200
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.complete_challenge(UUID) TO authenticated;
