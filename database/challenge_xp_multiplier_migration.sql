-- Challenge XP Multiplier Migration
-- Returns 2 if the user is in ANY active challenge (accepted status), 1 otherwise.
-- Non-additive: no matter how many challenges the user is in, the multiplier is always 2x.
CREATE OR REPLACE FUNCTION get_active_challenge_xp_multiplier(p_user_id UUID)
RETURNS INTEGER AS $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM public.challenge_participants cp
        JOIN public.challenges c ON c.id = cp.challenge_id
        WHERE cp.user_id = p_user_id
          AND cp.status = 'accepted'
          AND c.status = 'active'
    ) THEN
        RETURN 2;
    END IF;
    RETURN 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_active_challenge_xp_multiplier TO authenticated;
GRANT EXECUTE ON FUNCTION get_active_challenge_xp_multiplier TO service_role;

-- Update complete_lesson to apply the challenge XP multiplier
CREATE OR REPLACE FUNCTION complete_lesson(
  p_user_id UUID,
  p_lesson_id TEXT,
  p_unit_id TEXT,
  p_module_id TEXT,
  p_games_played INTEGER,
  p_games_correct INTEGER
)
RETURNS JSON AS $$
DECLARE
  daily_limit INTEGER := 3;
  xp_per_lesson INTEGER := 1;
  progress_record RECORD;
  score_pct INTEGER;
  xp_earned INTEGER := 0;
  already_completed BOOLEAN;
  is_new_lesson BOOLEAN;
  result JSON;
BEGIN
  -- Calculate score percentage
  IF p_games_played > 0 THEN
    score_pct := ROUND((p_games_correct::NUMERIC / p_games_played) * 100);
  ELSE
    score_pct := 0;
  END IF;

  -- Get current progress
  SELECT * INTO progress_record
  FROM public.user_learning_progress
  WHERE user_id = p_user_id;

  -- Create progress record if doesn't exist
  IF progress_record IS NULL THEN
    INSERT INTO public.user_learning_progress (user_id, lessons_today)
    VALUES (p_user_id, 0)
    RETURNING * INTO progress_record;
  END IF;

  -- Reset daily count if new day
  IF progress_record.last_lesson_date IS NULL OR progress_record.last_lesson_date < CURRENT_DATE THEN
    UPDATE public.user_learning_progress
    SET lessons_today = 0,
        last_lesson_date = CURRENT_DATE,
        -- Update streak
        current_learning_streak = CASE
          WHEN progress_record.last_lesson_date = CURRENT_DATE - 1 THEN progress_record.current_learning_streak + 1
          ELSE 1
        END,
        longest_learning_streak = GREATEST(
          progress_record.longest_learning_streak,
          CASE
            WHEN progress_record.last_lesson_date = CURRENT_DATE - 1 THEN progress_record.current_learning_streak + 1
            ELSE 1
          END
        ),
        updated_at = NOW()
    WHERE user_id = p_user_id
    RETURNING * INTO progress_record;
  END IF;

  -- Check daily limit
  IF progress_record.lessons_today >= daily_limit THEN
    RETURN json_build_object(
      'success', FALSE,
      'error', 'daily_limit_reached',
      'message', 'You have reached your daily learning limit. Come back tomorrow!'
    );
  END IF;

  -- Check if lesson already completed with 100% score
  is_new_lesson := NOT (p_lesson_id = ANY(progress_record.lessons_completed));

  -- Award XP only when user gets 100% AND hasn't already earned XP for this lesson.
  -- Apply 2x multiplier if user is in any active challenge (non-additive: always 2x max).
  IF score_pct = 100 AND is_new_lesson THEN
    xp_earned := xp_per_lesson * get_active_challenge_xp_multiplier(p_user_id);
  END IF;

  -- Record the completion
  INSERT INTO public.lesson_completions (
    user_id, lesson_id, unit_id, module_id,
    games_played, games_correct, score_percentage, xp_earned
  )
  VALUES (
    p_user_id, p_lesson_id, p_unit_id, p_module_id,
    p_games_played, p_games_correct, score_pct, xp_earned
  )
  ON CONFLICT (user_id, lesson_id, (completed_at::DATE)) DO UPDATE
  SET games_played = EXCLUDED.games_played,
      games_correct = EXCLUDED.games_correct,
      score_percentage = EXCLUDED.score_percentage;

  -- Update progress
  UPDATE public.user_learning_progress
  SET lessons_today = lessons_today + 1,
      total_lessons_completed = CASE WHEN is_new_lesson AND score_pct = 100 THEN total_lessons_completed + 1 ELSE total_lessons_completed END,
      total_xp_from_learning = total_xp_from_learning + xp_earned,
      lessons_completed = CASE
        WHEN is_new_lesson AND score_pct = 100 THEN array_append(lessons_completed, p_lesson_id)
        ELSE lessons_completed
      END,
      updated_at = NOW()
  WHERE user_id = p_user_id;

  -- Award XP to main points system if earned
  IF xp_earned > 0 THEN
    UPDATE public.user_points
    SET lifetime_points = lifetime_points + xp_earned,
        updated_at = NOW()
    WHERE user_id = p_user_id;

    -- Create if doesn't exist
    IF NOT FOUND THEN
      INSERT INTO public.user_points (user_id, lifetime_points)
      VALUES (p_user_id, xp_earned)
      ON CONFLICT (user_id) DO UPDATE
      SET lifetime_points = user_points.lifetime_points + xp_earned;
    END IF;
  END IF;

  RETURN json_build_object(
    'success', TRUE,
    'xp_earned', xp_earned,
    'is_new_lesson', is_new_lesson,
    'score_percentage', score_pct,
    'needs_perfect_score', score_pct < 100 AND is_new_lesson,
    'lessons_remaining_today', daily_limit - progress_record.lessons_today - 1,
    'current_streak', progress_record.current_learning_streak
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update complete_unit to apply the challenge XP multiplier
CREATE OR REPLACE FUNCTION complete_unit(
  p_user_id UUID,
  p_unit_id TEXT,
  p_module_id TEXT
)
RETURNS JSON AS $$
DECLARE
  xp_per_unit INTEGER := 2;
  already_completed BOOLEAN;
BEGIN
  -- Check if already completed
  SELECT p_unit_id = ANY(units_completed)
  INTO already_completed
  FROM public.user_learning_progress
  WHERE user_id = p_user_id;

  IF already_completed THEN
    RETURN json_build_object('success', TRUE, 'xp_earned', 0, 'already_completed', TRUE);
  END IF;

  -- Apply 2x multiplier if in any active challenge
  xp_per_unit := xp_per_unit * get_active_challenge_xp_multiplier(p_user_id);

  -- Mark unit complete
  UPDATE public.user_learning_progress
  SET units_completed = array_append(units_completed, p_unit_id),
      total_xp_from_learning = total_xp_from_learning + xp_per_unit,
      updated_at = NOW()
  WHERE user_id = p_user_id;

  -- Record milestone
  INSERT INTO public.learning_milestones (user_id, milestone_type, milestone_id, xp_awarded)
  VALUES (p_user_id, 'unit_complete', p_unit_id, xp_per_unit)
  ON CONFLICT DO NOTHING;

  -- Award XP
  UPDATE public.user_points
  SET lifetime_points = lifetime_points + xp_per_unit
  WHERE user_id = p_user_id;

  RETURN json_build_object('success', TRUE, 'xp_earned', xp_per_unit, 'already_completed', FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update complete_module to apply the challenge XP multiplier
CREATE OR REPLACE FUNCTION complete_module(
  p_user_id UUID,
  p_module_id TEXT
)
RETURNS JSON AS $$
DECLARE
  xp_per_module INTEGER := 5;
  already_completed BOOLEAN;
BEGIN
  -- Check if already completed
  SELECT p_module_id = ANY(modules_completed)
  INTO already_completed
  FROM public.user_learning_progress
  WHERE user_id = p_user_id;

  IF already_completed THEN
    RETURN json_build_object('success', TRUE, 'xp_earned', 0, 'already_completed', TRUE);
  END IF;

  -- Apply 2x multiplier if in any active challenge
  xp_per_module := xp_per_module * get_active_challenge_xp_multiplier(p_user_id);

  -- Mark module complete
  UPDATE public.user_learning_progress
  SET modules_completed = array_append(modules_completed, p_module_id),
      total_xp_from_learning = total_xp_from_learning + xp_per_module,
      updated_at = NOW()
  WHERE user_id = p_user_id;

  -- Record milestone
  INSERT INTO public.learning_milestones (user_id, milestone_type, milestone_id, xp_awarded)
  VALUES (p_user_id, 'module_complete', p_module_id, xp_per_module)
  ON CONFLICT DO NOTHING;

  -- Award XP
  UPDATE public.user_points
  SET lifetime_points = lifetime_points + xp_per_module
  WHERE user_id = p_user_id;

  RETURN json_build_object('success', TRUE, 'xp_earned', xp_per_module, 'already_completed', FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
