-- Fresh perfect quizzes award 10 XP with no hidden daily completion cap.
-- Completed lesson replays remain non-repeatable for XP.

CREATE OR REPLACE FUNCTION public.complete_lesson(
  p_user_id UUID,
  p_lesson_id TEXT,
  p_unit_id TEXT,
  p_module_id TEXT,
  p_games_played INTEGER,
  p_games_correct INTEGER
)
RETURNS JSON AS $$
DECLARE
  xp_per_lesson INTEGER := 10;
  progress_record RECORD;
  score_pct INTEGER;
  xp_earned INTEGER := 0;
  is_new_lesson BOOLEAN;
BEGIN
  IF p_games_played > 0 THEN
    score_pct := ROUND((p_games_correct::NUMERIC / p_games_played) * 100);
  ELSE
    score_pct := 0;
  END IF;

  SELECT * INTO progress_record
  FROM public.user_learning_progress
  WHERE user_id = p_user_id;

  IF progress_record IS NULL THEN
    INSERT INTO public.user_learning_progress (user_id, lessons_today)
    VALUES (p_user_id, 0)
    RETURNING * INTO progress_record;
  END IF;

  IF progress_record.last_lesson_date IS NULL OR progress_record.last_lesson_date < CURRENT_DATE THEN
    UPDATE public.user_learning_progress
    SET lessons_today = 0,
        last_lesson_date = CURRENT_DATE,
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

  is_new_lesson := NOT (p_lesson_id = ANY(progress_record.lessons_completed));

  IF score_pct = 100 AND is_new_lesson THEN
    xp_earned := xp_per_lesson * public.get_active_challenge_xp_multiplier(p_user_id);
  END IF;

  INSERT INTO public.lesson_completions (
    user_id, lesson_id, unit_id, module_id,
    games_played, games_correct, score_percentage, xp_earned
  )
  VALUES (
    p_user_id, p_lesson_id, p_unit_id, p_module_id,
    p_games_played, p_games_correct, score_pct, xp_earned
  )
  ON CONFLICT (user_id, lesson_id, public.to_date_immutable(completed_at)) DO UPDATE
  SET games_played = EXCLUDED.games_played,
      games_correct = EXCLUDED.games_correct,
      score_percentage = EXCLUDED.score_percentage;

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

  IF xp_earned > 0 THEN
    UPDATE public.user_points
    SET lifetime_points = lifetime_points + xp_earned,
        updated_at = NOW()
    WHERE user_id = p_user_id;

    IF NOT FOUND THEN
      INSERT INTO public.user_points (user_id, lifetime_points)
      VALUES (p_user_id, xp_earned)
      ON CONFLICT (user_id) DO UPDATE
      SET lifetime_points = user_points.lifetime_points + xp_earned;
    END IF;

    INSERT INTO public.point_transactions (
      user_id,
      transaction_type,
      points_amount,
      reference_type,
      description
    ) VALUES (
      p_user_id,
      'earn_learning_quiz',
      xp_earned,
      'learning_quiz:' || p_lesson_id,
      'Perfect Health IQ quiz'
    );
  END IF;

  RETURN json_build_object(
    'success', TRUE,
    'xp_earned', xp_earned,
    'is_new_lesson', is_new_lesson,
    'score_percentage', score_pct,
    'needs_perfect_score', score_pct < 100 AND is_new_lesson,
    'lessons_remaining_today', NULL,
    'current_streak', progress_record.current_learning_streak
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.complete_lesson(UUID, TEXT, TEXT, TEXT, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_lesson(UUID, TEXT, TEXT, TEXT, INTEGER, INTEGER) TO service_role;
