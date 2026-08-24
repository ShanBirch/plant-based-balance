ALTER TABLE public.stories
  ADD COLUMN IF NOT EXISTS course_action_id text;

ALTER TABLE public.stories
  DROP CONSTRAINT IF EXISTS stories_course_action_id_check;

ALTER TABLE public.stories
  ADD CONSTRAINT stories_course_action_id_check
  CHECK (course_action_id IS NULL OR course_action_id IN (
    'w1_feed_intro',
    'w6_feed_reflection'
  ));

CREATE INDEX IF NOT EXISTS idx_stories_foundations_course_action
  ON public.stories (user_id, course_action_id, created_at DESC)
  WHERE course_action_id IS NOT NULL;

COMMENT ON COLUMN public.stories.course_action_id IS
  'Durable link to a Foundations text action. Typed introduction and reflection posts are linked only when started from that course action.';
