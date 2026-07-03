-- Keep Weekly Goals workout progress anchored to the source workout dates.
-- Older cached clients can write a progress_snapshot that only saw the first
-- REST page of set rows. Normalize complete_workouts before the row is saved.

CREATE OR REPLACE FUNCTION public.normalize_weekly_goals_workout_progress()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_goal jsonb;
  v_goals jsonb := '[]'::jsonb;
  v_current numeric;
  v_target numeric;
  v_completed integer := 0;
  v_total integer := 0;
  v_workout_days integer := 0;
  v_arc_start date;
  v_week_end_exclusive date;
BEGIN
  IF NEW.user_id IS NULL OR NEW.week_start IS NULL OR NEW.week_end IS NULL THEN
    RETURN NEW;
  END IF;

  v_week_end_exclusive := NEW.week_end + 1;
  v_arc_start := NEW.week_start - 21;

  IF jsonb_typeof(NEW.progress_snapshot->'goals') = 'array' THEN
    FOR v_goal IN
      SELECT value
      FROM jsonb_array_elements(NEW.progress_snapshot->'goals')
    LOOP
      IF v_goal->>'id' = 'complete_workouts' THEN
        SELECT count(DISTINCT workout_date)::numeric
        INTO v_current
        FROM public.workouts
        WHERE user_id = NEW.user_id
          AND workout_type = 'history'
          AND workout_date >= NEW.week_start
          AND workout_date < v_week_end_exclusive;

        v_target := CASE
          WHEN coalesce(v_goal->>'target', '') ~ '^[0-9]+(\.[0-9]+)?$'
            THEN (v_goal->>'target')::numeric
          ELSE 1
        END;

        v_goal := v_goal || jsonb_build_object(
          'current', floor(coalesce(v_current, 0))::integer,
          'target', v_target,
          'percent', greatest(
            0,
            least(
              100,
              CASE
                WHEN v_target > 0 THEN (coalesce(v_current, 0) / v_target) * 100
                ELSE 0
              END
            )
          ),
          'complete', coalesce(v_current, 0) >= v_target
        );
      END IF;

      v_total := v_total + 1;
      IF coalesce((v_goal->>'complete')::boolean, false) THEN
        v_completed := v_completed + 1;
      END IF;
      v_goals := v_goals || jsonb_build_array(v_goal);
    END LOOP;

    NEW.progress_snapshot := coalesce(NEW.progress_snapshot, '{}'::jsonb)
      || jsonb_build_object(
        'goals', v_goals,
        'completed_count', v_completed,
        'total_count', v_total,
        'completion_rate', CASE
          WHEN v_total > 0 THEN round((v_completed::numeric / v_total::numeric) * 100)
          ELSE 0
        END
      );

    NEW.completed_count := v_completed;
    NEW.total_count := v_total;
    NEW.completion_rate := CASE
      WHEN v_total > 0 THEN round((v_completed::numeric / v_total::numeric) * 100)
      ELSE 0
    END;
  END IF;

  IF jsonb_typeof(NEW.arc_snapshot) = 'object' THEN
    SELECT count(DISTINCT workout_date)::integer
    INTO v_workout_days
    FROM public.workouts
    WHERE user_id = NEW.user_id
      AND workout_type = 'history'
      AND workout_date >= v_arc_start
      AND workout_date < v_week_end_exclusive;

    NEW.arc_snapshot := coalesce(NEW.arc_snapshot, '{}'::jsonb)
      || jsonb_build_object('workout_days', coalesce(v_workout_days, 0));
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS normalize_weekly_goals_workout_progress ON public.weekly_goals;
CREATE TRIGGER normalize_weekly_goals_workout_progress
  BEFORE INSERT OR UPDATE OF progress_snapshot, selected_goals, week_start, week_end
  ON public.weekly_goals
  FOR EACH ROW
  EXECUTE FUNCTION public.normalize_weekly_goals_workout_progress();
