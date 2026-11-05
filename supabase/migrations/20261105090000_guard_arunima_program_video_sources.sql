-- Protect Arunima across app, coach, script and direct SQL program writes.
-- Invoker-only trigger: no network calls, security-definer privileges or public RPC.
CREATE OR REPLACE FUNCTION public.guard_arunima_program_video_sources()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog AS $guard$
DECLARE
  verified constant jsonb := '{"Dumbbell Goblet Squat":{"primary":"https://plantbased-balance.org/assets/exercise-videos/compat/goblet-squat.mp4","preferred":"https://plantbased-balance.org/assets/exercise-videos/compat/goblet-squat.mp4"},"Dumbbell Bench Press":{"primary":"https://f005.backblazeb2.com/file/plantbasedbalancestories/balance-social/app-exercise-videos/phone-v1/b43812635823cb88b97346e5.mp4","preferred":"https://plantbased-balance.org/assets/exercise-videos/backup/7d5d09d043d9888f7ad62019.mp4"},"Dumbbell Single Arm Row":{"primary":"https://plantbased-balance.org/assets/exercise-videos/compat/dumbbell-single-arm-row.mp4","preferred":"https://plantbased-balance.org/assets/exercise-videos/compat/dumbbell-single-arm-row.mp4"},"Hollow Body Hold":{"primary":"https://f005.backblazeb2.com/file/plantbasedbalancestories/balance-social/app-exercise-videos/phone-v1/acea1803f9eb80ee594aec44.mp4","preferred":"https://plantbased-balance.org/assets/exercise-videos/backup/6334bd0f83c3bea9a8fc7d5f.mp4"},"Dumbbell Romanian Deadlift":{"primary":"https://f005.backblazeb2.com/file/plantbasedbalancestories/balance-social/app-exercise-videos/phone-v1/8caf3c7873a3dcc4386fb8b4.mp4","preferred":"https://plantbased-balance.org/assets/exercise-videos/backup/bd380a4902e7c11a7327816c.mp4"},"Kneeling Push Up":{"primary":"https://f005.backblazeb2.com/file/plantbasedbalancestories/balance-social/app-exercise-videos/phone-v1/2d2a10f666178ff02067830d.mp4","preferred":"https://plantbased-balance.org/assets/exercise-videos/backup/06661f03ba77338c2b0bab26.mp4"},"Standing Dumbbell Bicep Curls":{"primary":"https://f005.backblazeb2.com/file/plantbasedbalancestories/balance-social/app-exercise-videos/phone-v1/28b713946443b8d05c9abc23.mp4","preferred":"https://plantbased-balance.org/assets/exercise-videos/backup/3482f8491bc58f0cee0b74bd.mp4"},"Plank":{"primary":"https://f005.backblazeb2.com/file/plantbasedbalancestories/balance-social/app-exercise-videos/phone-v1/5d89bdb72cbf41264de67eba.mp4","preferred":"https://plantbased-balance.org/assets/exercise-videos/backup/a417b1dca95f7c101862c942.mp4"},"Dumbbell Skull Crusher":{"primary":"https://f005.backblazeb2.com/file/plantbasedbalancestories/balance-social/app-exercise-videos/phone-v1/1b120133b95f99d089dff702.mp4","preferred":"https://plantbased-balance.org/assets/exercise-videos/backup/095b616261991bc4fa066ed9.mp4"},"Ab Crunch":{"primary":"https://f005.backblazeb2.com/file/plantbasedbalancestories/balance-social/app-exercise-videos/phone-v1/87429d2a4602b601301c53e7.mp4","preferred":"https://plantbased-balance.org/assets/exercise-videos/backup/d0fccabeb2cd95707d4f0586.mp4"},"Bench Single Leg Hip Thrust":{"primary":"https://f005.backblazeb2.com/file/plantbasedbalancestories/balance-social/app-exercise-videos/phone-v1/086f0bae9d1b94f5938618a7.mp4","preferred":"https://plantbased-balance.org/assets/exercise-videos/backup/aaa0e04c0db5874e1d43e26e.mp4"},"High Plank Shoulder Taps":{"primary":"https://f005.backblazeb2.com/file/plantbasedbalancestories/balance-social/app-exercise-videos/phone-v1/d405852b53c360ca99485fe7.mp4","preferred":"https://plantbased-balance.org/assets/exercise-videos/backup/c99a030273bbc8d79b074ec2.mp4"},"Cat Cow":{"primary":"https://plantbased-balance.org/assets/exercise-videos/compat/cat-cow.mp4","preferred":"https://plantbased-balance.org/assets/exercise-videos/compat/cat-cow.mp4"},"Child''s Pose":{"primary":"https://plantbased-balance.org/assets/exercise-videos/compat/childs-pose.mp4","preferred":"https://plantbased-balance.org/assets/exercise-videos/compat/childs-pose.mp4"},"Yoga - Seated Side Stretch":{"primary":"https://plantbased-balance.org/assets/exercise-videos/compat/yoga-seated-side-stretch.mp4","preferred":"https://plantbased-balance.org/assets/exercise-videos/compat/yoga-seated-side-stretch.mp4"}}'::jsonb;
  day_entry jsonb; exercise jsonb; days jsonb := '[]'::jsonb;
  exercises jsonb; source text; preferred text; known jsonb;
BEGIN
  IF NEW.user_id IS DISTINCT FROM '2f67ca67-7566-48d6-b29f-b2d73caa24d4'::uuid THEN RETURN NEW; END IF;
  IF jsonb_typeof(NEW.weekly_schedule) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Workout schedule must be an array';
  END IF;
  FOR day_entry IN SELECT value FROM jsonb_array_elements(NEW.weekly_schedule) LOOP
    IF day_entry #> '{workout,exercises}' IS NOT NULL AND day_entry #> '{workout,exercises}' <> 'null'::jsonb THEN
      exercises := '[]'::jsonb;
      FOR exercise IN SELECT value FROM jsonb_array_elements(day_entry #> '{workout,exercises}') LOOP
        known := verified -> (exercise ->> 'name');
        source := coalesce(nullif(btrim(exercise->>'video_url'), ''), nullif(btrim(exercise->>'videoUrl'), ''));
        source := split_part(split_part(source, '#', 1), '?', 1);
        preferred := NULL;
        IF known IS NOT NULL AND (source IS NULL OR source = known->>'primary' OR source = known->>'preferred' OR 'https://plantbased-balance.org' || source = known->>'preferred') THEN
          preferred := known->>'preferred';
        ELSIF source ~ '^(/assets/exercise-videos/|https://plantbased-balance[.]org/assets/exercise-videos/)(compat|backup)/[a-zA-Z0-9_-]+[.]mp4$' THEN
          preferred := CASE WHEN left(source, 1) = '/' THEN 'https://plantbased-balance.org' || source ELSE source END;
        END IF;
        IF preferred IS NULL THEN
          RAISE EXCEPTION 'Video for "%" needs a verified Balance-hosted phone-compatible copy before assigning this program to Arunima', exercise->>'name' USING ERRCODE = '23514';
        END IF;
        exercises := exercises || jsonb_build_array(exercise || jsonb_build_object('video_url', preferred, 'videoUrl', preferred));
      END LOOP;
      day_entry := jsonb_set(day_entry, '{workout,exercises}', exercises);
    END IF;
    days := days || jsonb_build_array(day_entry);
  END LOOP;
  NEW.weekly_schedule := days;
  RETURN NEW;
END;
$guard$;
REVOKE ALL ON FUNCTION public.guard_arunima_program_video_sources() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS guard_arunima_program_video_sources ON public.custom_workout_programs;
CREATE TRIGGER guard_arunima_program_video_sources BEFORE INSERT OR UPDATE OF weekly_schedule, user_id ON public.custom_workout_programs FOR EACH ROW EXECUTE FUNCTION public.guard_arunima_program_video_sources();
