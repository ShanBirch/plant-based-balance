-- Add specific diary-to-Feed evidence for Foundations Week 4 and every
-- Balance Lead week. Existing story rows and journey snapshots stay intact.

ALTER TABLE public.stories
  DROP CONSTRAINT IF EXISTS stories_course_action_id_check;

ALTER TABLE public.stories
  ADD CONSTRAINT stories_course_action_id_check
  CHECK (course_action_id IS NULL OR course_action_id IN (
    'w1_feed_intro',
    'w4_diary_feed',
    'w6_feed_reflection',
    'w7_diary_feed',
    'w8_diary_feed',
    'w9_diary_feed',
    'w10_diary_feed',
    'w11_diary_feed',
    'w12_diary_feed'
  ));

COMMENT ON COLUMN public.stories.course_action_id IS
  'Durable link from a Feed story to the exact Foundations or Identity course action that initiated it. Diary actions are verified against the matching daily_checkins diary date.';

