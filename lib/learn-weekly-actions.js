(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BalanceLearnWeeklyActions = api;
})(typeof window !== 'undefined' ? window : globalThis, function() {
  'use strict';
  const experiments = [
    ['Notice a repeating pattern', 'Notice one repeating pattern and what happens immediately before it. What did you notice?'],
    ['Work with your energy', 'Notice how sleep, hunger or stress affects a choice. Try one small adjustment to make that choice easier. What happened?'],
    ['Attach an action to a routine', 'Attach a small action to an existing routine, such as logging lunch after eating. Try it three times. What helped you remember?'],
    ['Change one part of a craving routine', 'Notice the circumstances around a craving. Change one part of the routine. What did you try and what happened?'],
    ['Make a workout or meal easier', 'Set up one thing that makes a workout or meal easier. What did you set up and what helped?'],
    ['Choose the routine you will keep', 'Review what helped. Choose a realistic food and movement routine to continue. What will you keep doing?']
  ];
  const meals = [3, 5, 5, 7, 7, 7];
  const workouts = [1, 2, 2, 2, 3, 3];
  function experiment(week) {
    const item = experiments[Number(week) - 1];
    return item ? { week: Number(week), title: item[0], prompt: item[1] } : null;
  }
  function effectiveWeek(row, now = new Date()) {
    if (!row || !row.week_started_at) return null;
    const start = new Date(row.week_started_at + 'T00:00:00+10:00');
    if (!Number.isFinite(start.getTime())) return null;
    const elapsed = Math.max(0, Math.floor((now - start) / 604800000));
    return Math.min(12, Number(row.current_week || 1) + elapsed);
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
  return { experiment, meals, workouts, effectiveWeek, reportsForWeek, movementDays, version: 2 };
});
