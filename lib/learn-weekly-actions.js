(function(root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./learn-curriculum') : root.BalanceLearnCurriculum, root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BalanceLearnWeeklyActions = api;
})(typeof window !== 'undefined' ? window : globalThis, function(curriculum, root) {
  'use strict';
  const experiments = [
    { title:'Notice a repeating pattern', lessonId:'mind-1-4',
      prompt:'Spend the week noticing a repeating pattern you would like to adjust. Observe when it happens and what you normally do immediately beforehand. No change is required this week.',
      reflection:'Which repeating pattern would you like to pay attention to this week? Notice its time or situation and what comes immediately before it.',
      fields:[['pattern','The repeating pattern I noticed'],['situation','When, where or in what situation it repeated'],['beforehand','What I normally did immediately beforehand']],
      criteria:'Observed and described a repeating pattern, its time/situation and the immediately preceding action. Observation only; no change required.' },
    { title:'Notice what affects a choice', lessonId:'mind-2-2',
      prompt:'Notice a time sleep, hunger or stress affected a choice. Describe what happened and propose one change that might make the choice easier next time. You do not need to try the change this week.',
      reflection:'Pay attention to a choice affected by sleep, hunger or stress. What situation might you notice, and what could make that choice easier next time?',
      fields:[['circumstances','The circumstances: sleep, hunger or stress'],['choice','The choice I made'],['proposal','One change that might make it easier next time']],
      criteria:'Reported circumstances and a choice affected by sleep, hunger or stress, and proposed one change. Trying the proposal is not required.' },
    { title:'Try a small change on an existing routine', lessonId:'mind-4-3',
      prompt:'Choose a pattern from week 1 or 2. Attach a small helpful change to something you already do, try it and report what happened. For poor sleep and hunger, you could attach a small wind-down or earlier-bedtime step to an existing routine. There is no required number of attempts or improved outcome.',
      reflection:'Choose a pattern from week 1 or 2. What small helpful change could you attach to an existing routine? Try it before reporting what happened in your weekly check-in.',
      fields:[['pattern','The pattern I chose from week 1 or 2'],['tried','The change I actually tried and the routine I attached it to'],['outcome','What happened when I tried it']],
      criteria:'Named a prior pattern, actually tried a small change attached to an existing routine, and reported the outcome. Improvement and three attempts are not required.' },
    { title:'Change one part of a craving routine', lessonId:'fuel-6-1',
      prompt:'Map the sequence around a recurring craving and change one part of the routine. For example: dinner → couch → TV → snacks could become dinner → a different room → a book. Report whether the craving was the same, different or absent. It does not have to disappear.',
      reflection:'What sequence usually surrounds a craving? Choose one part of that routine to change, then try it and report what happened in your weekly check-in.',
      fields:[['sequence','The normal sequence around my craving'],['tried','The one part of the routine I actually changed'],['outcome','Was the craving the same, different or absent? What happened?']],
      criteria:'Mapped the usual sequence, actually changed one part and reported whether the craving was the same, different or absent. No reduction is required.' },
    { title:'Talk to someone about your journey', lessonId:'mind-6-5',
      prompt:'Talk to one person who is not your coach about your fitness journey or the habits you are building. In your weekly check-in, describe what you discussed, how you felt afterwards and whether motivation or feeling supported changed. A neutral or difficult conversation still counts. No names or identifying details are needed.',
      reflection:'Who outside your coaching relationship could you talk to about your fitness journey or habits? No name is needed. Have the conversation, then report what you discussed and how it felt in your weekly check-in.',
      fields:[['discussion','What I discussed with someone who is not my coach (no names needed)'],['feelings','How I felt afterwards'],['support','Whether motivation or feeling supported changed']],
      criteria:'Reported a conversation with one person other than the coach, the discussion, feelings afterwards and any change or no change in motivation/support. A positive experience is not required.' },
    { title:'Build and save a meal for your targets', lessonId:'fuel-5-5',
      prompt:'Use the nutrition tracker to build and save one meal that fits your personal targets, including protein, carbohydrates and fats. Choose Save for later, not Log meal, unless you actually ate it. Link the saved meal in your weekly check-in and explain how its macros fit your day. There is no universal best macro ratio.',
      reflection:'What meal could you build to fit your own daily nutrition targets? Use the tracker and Save for later. Link that saved meal and explain its protein, carbohydrates and fats in your weekly check-in.',
      fields:[['fit','How this saved meal and its macros fit my personal targets for the day']],
      criteria:'Linked a saved tracker meal with actual protein/carbohydrate/fat quantities, and explained its fit with personal daily targets. Saving is not eating; no universal macro ratio is prescribed.' }
  ];
  experiments.push(
    {title:'Separate a signal from its interpretation',lessonId:'mind-3-5',prompt:'Notice one everyday situation. Record what you directly observed, what you initially thought it meant, and one other plausible interpretation. You do not need to force a positive interpretation.',reflection:'What situation could you observe without immediately treating your first interpretation as fact?',fields:[['observed','What I directly observed'],['interpretation','My first interpretation'],['alternative','Another plausible interpretation']],criteria:'Described an actual observation, distinguished an interpretation and considered a plausible alternative. Positive feelings are not required.'},
    {title:'Test one expectation in context',lessonId:'mind-7-5',prompt:'Write one expectation about a manageable everyday action, then try the action or seek information. Describe the actual outcome and how the context affected your interpretation. Include neutral or difficult outcomes.',reflection:'What do you expect will happen, and what small action could give you useful evidence?',fields:[['prediction','What I expected before acting'],['action','The action I actually took'],['outcome','What happened and what the context helped explain']],criteria:'Reported a prior expectation, an actual manageable action or information-seeking step, and the outcome in context. Success or reduced discomfort is not required.'},
    {title:'Record a model update',lessonId:'mind-8-5',prompt:'Test one manageable prediction. Record what you expected beforehand, what actually happened, how reliable or relevant the evidence was, and what you would predict or test next. The result does not have to be positive or surprising.',reflection:'What prediction can you test, and what evidence would make you reconsider it?',fields:[['prediction','My prediction before the attempt'],['outcome','What I tried and what actually happened'],['weight','How reliable or relevant this evidence was'],['update','What I now predict or will test next']],criteria:'Reported a prior prediction, actual attempt and outcome, weighed the evidence, and described a proportionate updated expectation or next test. No forced positive result or immediate emotional change is required.'}
  );
  function currentVersion() { return root.socialJourney?.getLearnCurriculum?.() || root.BalanceLearnActionReview?.state?.curriculum_version || 'legacy_six'; }
  const meals = [3, 5, 5, 7, 7, 7];
  const workouts = [1, 2, 2, 2, 3, 3];
  function experiment(week, version = currentVersion()) {
    const index=curriculum.actionIndex(week,version);
    const item = experiments[index - 1];
    return item ? Object.assign({ week: Number(week), key:'learn_w' + Number(week) + '_v3', version:4, curriculum_version:version, requiresMeal:index===6 },item) : null;
  }
  function effectiveWeek(row, now = new Date()) {
    if (!row || !row.week_started_at) return null;
    const start = new Date(row.week_started_at + 'T00:00:00+10:00');
    if (!Number.isFinite(start.getTime())) return null;
    const elapsed = Math.max(0, Math.floor((now - start) / 604800000));
    return Math.min(curriculum.total(curriculum.version(row))+6, Number(row.current_week || 1) + elapsed);
  }
  function reportsForWeek(rows, week, start, end) {
    return rows.flatMap(row => {
      const extra = row.additional_data || {};
      return (Array.isArray(extra.weekly_checkins) ? extra.weekly_checkins : [])
        .concat(extra.weekly_checkin ? [extra.weekly_checkin] : []);
    }).filter(item => {
      const time = Date.parse(item && item.submitted_at);
      return item && (item.occurrence || 'weekly') === 'weekly'
        && time >= Date.parse(start) && time < Date.parse(end)
        && (!item.course_week || Number(item.course_week) === Number(week));
    });
  }
  // Workout history has one row per exercise/set. Count a completed training day
  // once, including supported logged activity, without multiplying set/import rows.
  function movementDays(workouts, activities) {
    return new Set(workouts.filter(r => Number(r.reps) > 0 || Number(r.time_duration) > 0).map(r => r.workout_date)
      .concat(activities.filter(r => Number(r.duration_minutes) > 0).map(r => r.activity_date)).filter(Boolean)).size;
  }
  function reportComplete(week, answers, meal, version) {
    const action = experiment(week,version);
    return !!action && action.fields.every(([key]) => typeof answers?.[key] === 'string' && answers[key].trim().length >= 2)
      && (!action.requiresMeal || (!!meal?.id && ['protein_g','carbs_g','fat_g'].every(key => meal[key] !== null && meal[key] !== undefined && Number.isFinite(Number(meal[key])) && Number(meal[key]) >= 0)));
  }
  return { experiment, meals, workouts, effectiveWeek, reportsForWeek, movementDays, reportComplete, curriculum, version: 4 };
});
