-- Preserve the existing sequence and action evidence for members already enrolled.
-- Members already in Become retain its original calendar. New journeys use eight_v1.
update public.social_journey_progress
set settings = jsonb_set(coalesce(settings,'{}'::jsonb),'{learn_curriculum}',
  to_jsonb(case when current_week + greatest(0, ((now() at time zone 'Australia/Brisbane')::date - week_started_at) / 7) > 6
    then 'legacy_six'::text else 'bridge_eight_v1'::text end))
where not (coalesce(settings,'{}'::jsonb) ? 'learn_curriculum');

alter table public.social_journey_progress drop constraint social_journey_progress_current_week_check;
alter table public.social_journey_progress add constraint social_journey_progress_current_week_check check(current_week between 1 and 14);
alter table public.learn_action_reviews drop constraint learn_action_reviews_week_check;
alter table public.learn_action_reviews add constraint learn_action_reviews_week_check check(week between 1 and 8);
alter table public.stories drop constraint stories_course_action_id_check;
alter table public.stories add constraint stories_course_action_id_check check(course_action_id is null or course_action_id in (
  'w1_feed_intro','w4_diary_feed','w6_feed_reflection','w7_feed_reflection','w8_feed_reflection',
  'w7_diary_feed','w8_diary_feed','w9_diary_feed','w10_diary_feed','w11_diary_feed','w12_diary_feed'
));

-- Change only the week bound, retaining the live function's ownership, revision,
-- completed-evidence protection, invoker rights and existing grants.
do $migration$
declare definition text;
begin
  select pg_get_functiondef('public.write_learn_action_review(uuid,integer,uuid,text,jsonb,integer)'::regprocedure) into definition;
  if position('p_week not between 1 and 6' in definition)=0 then
    raise exception 'Unexpected action writer definition; inspect before applying';
  end if;
  execute replace(definition,'p_week not between 1 and 6','p_week not between 1 and 8');
end $migration$;
