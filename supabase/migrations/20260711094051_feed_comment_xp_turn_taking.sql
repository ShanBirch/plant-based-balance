-- Feed comment XP turn-taking guard
-- A member earns comment XP once per turn on a post. Consecutive comments
-- by the same member do not create additional XP until someone else replies.

CREATE OR REPLACE FUNCTION private.award_feed_comment_xp()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_story_owner_id UUID;
  v_previous_commenter_id UUID;
  v_tx_id UUID;
  v_description TEXT := 'Commented on a Feed post';
BEGIN
  IF NEW.user_id IS NULL OR NEW.story_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT s.user_id
  INTO v_story_owner_id
  FROM public.stories s
  WHERE s.id = NEW.story_id;

  IF v_story_owner_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- The trigger runs after the insert, so exclude the new row and inspect the
  -- latest visible comment on this post. A new turn starts only after another
  -- participant has commented.
  SELECT fc.user_id
  INTO v_previous_commenter_id
  FROM public.feed_comments fc
  WHERE fc.story_id = NEW.story_id
    AND fc.id <> NEW.id
  ORDER BY fc.created_at DESC, fc.id DESC
  LIMIT 1;

  IF v_story_owner_id = NEW.user_id THEN
    -- Owners earn for replying to the conversation, but not for starting or
    -- extending their own consecutive run of comments.
    IF v_previous_commenter_id IS NULL OR v_previous_commenter_id = NEW.user_id THEN
      RETURN NEW;
    END IF;
    v_description := 'Replied to a comment on own Feed post';
  ELSIF v_previous_commenter_id = NEW.user_id THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.point_transactions (
    user_id,
    transaction_type,
    points_amount,
    reference_id,
    reference_type,
    photo_verified,
    verification_method,
    description
  )
  VALUES (
    NEW.user_id,
    'earn_feed_comment',
    2,
    NEW.id,
    'feed_comment',
    FALSE,
    'feed_comment',
    v_description
  )
  ON CONFLICT (user_id, transaction_type, reference_id)
    WHERE transaction_type = 'earn_feed_comment'
    DO NOTHING
  RETURNING id INTO v_tx_id;

  IF v_tx_id IS NOT NULL THEN
    PERFORM public.increment_user_points(NEW.user_id, 2);
    PERFORM public.update_challenge_participant_points(NEW.user_id);
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.award_feed_comment_xp() FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION private.award_feed_comment_xp() IS
  'Awards transaction-backed XP for one Feed comment per turn, after another participant has commented.';

NOTIFY pgrst, 'reload schema';
