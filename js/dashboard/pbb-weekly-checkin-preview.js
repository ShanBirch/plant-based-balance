(function(){
  'use strict';

  var PREVIEW_KEY = 'pbb_weekly_checkin_preview';

  var DEFAULT_DATA = {
    profile: {
      name: 'Shane',
      accountLabel: ''
    },
    weekLabel: 'Weekly Review',
    dateRange: 'Mon 25 May to Sun 31 May',
    objective: {
      label: 'Bulk up',
      detail: 'Build muscle with a small calorie surplus.',
      source: 'From onboarding'
    },
    calories: {
      target: '2,700',
      average: '2,419',
      verdict: 'Average calories landed a bit under target, so next week we will add a little more food to keep the bulk moving.'
    },
    training: {
      sessions: 3,
      highlight: 'Monday was legs, Wednesday kept shoulders and arms moving, and Friday finished with a strong bench session.'
    },
    goals: {
      completed: 3,
      total: 3,
      rows: [
        { label: 'Calories in range', value: '5/5 days', current: 5, target: 5, tone: 'green' },
        { label: 'Protein days', value: '4/5 days', current: 4, target: 4, tone: 'green' },
        { label: 'Gym sessions', value: '3/3', current: 3, target: 3, tone: 'green' }
      ]
    },
    wins: [
      'You got 3 gym sessions done and the week still had a good rhythm.',
      'Protein landed on target on 4 of 5 tracked days, which gives us a solid base.',
      'Weekly goals were all hit, so the overall plan is moving the right way.'
    ],
    adjustments: [
      'Bring average calories a little closer to target.',
      'Keep protein high and keep the current split where it is.',
      'Keep the calorie tracker widget handy if logging becomes the bottleneck.'
    ],
    tip: 'If calorie tracking is the bit that slips, add the calorie tracker widget to the home screen. One button, tap it, speak what you ate, and it logs it automatically.',
    note: 'Good week. The gym was consistent, protein was strong, and calories were close enough to give us a clean read. We will nudge food up next week and keep the same training rhythm.',
    gym: [
      { label: 'Sessions', value: '3', meta: 'clean week' },
      { label: 'Best lift', value: 'Leg press 120kg x 12', meta: 'Monday' },
      { label: 'Top press', value: 'Bench 100kg x 4', meta: 'Friday' }
    ],
    recoveryRows: [
      { label: 'Water', value: '1,898 ml', meta: '5 days logged' },
      { label: 'Sleep', value: 'Not connected', meta: 'yet' },
      { label: 'Steps', value: 'Not connected', meta: 'yet' }
    ],
    checkinMood: {
      rows: [],
      note: '',
      feedback: []
    }
  };

  var state = {
    data: null,
    loading: false,
    submitting: false,
    overlayOpen: false,
    source: 'default',
    hasLiveData: false,
    reviewRewardClaimed: false
  };

  function readPreviewFlagFromQuery(){
    try {
      var params = new URLSearchParams(window.location.search || '');
      if (params.get('weeklyCheckinPreview') === '1') {
        localStorage.setItem(PREVIEW_KEY, '1');
      } else if (params.get('weeklyCheckinPreview') === '0') {
        localStorage.removeItem(PREVIEW_KEY);
      }
    } catch (_) {}
  }

  function isExplicitPreviewEnabled(){
    try {
      return window.PBB_WEEKLY_CHECKIN_PREVIEW === true || localStorage.getItem(PREVIEW_KEY) === '1';
    } catch (_) {
      return window.PBB_WEEKLY_CHECKIN_PREVIEW === true;
    }
  }

  function isReviewWindow(){
    var day = new Date().getDay();
    return day === 5 || day === 6 || day === 0;
  }

  function getReviewUserId(){
    return window.currentUser && (window.currentUser.id || window.currentUser.user_id) || window.PBB_WEEKLY_CHECKIN_USER_ID || null;
  }

  function getReviewSeenKey(){
    var userId = getReviewUserId();
    if (!userId) return null;
    var week = getWeekWindow();
    return 'pbb_weekly_checkin_seen_' + userId + '_' + week.startKey;
  }

  function getReviewCompletedKey(){
    var userId = getReviewUserId();
    if (!userId) return null;
    var week = getWeekWindow();
    return 'pbb_weekly_checkin_completed_' + userId + '_' + week.startKey;
  }

  function hasViewedReview(){
    if (isExplicitPreviewEnabled()) return false;
    try {
      var key = getReviewSeenKey();
      return !!(key && localStorage.getItem(key) === '1');
    } catch (_) {
      return false;
    }
  }

  function markReviewViewed(){
    if (isExplicitPreviewEnabled()) return;
    try {
      var key = getReviewSeenKey();
      if (key) localStorage.setItem(key, '1');
    } catch (_) {}
  }

  function hasCompletedReviewAction(){
    if (isExplicitPreviewEnabled()) return false;
    try {
      var key = getReviewCompletedKey();
      return !!(key && localStorage.getItem(key) === '1');
    } catch (_) {
      return false;
    }
  }

  function markReviewCompleted(){
    if (isExplicitPreviewEnabled()) return;
    try {
      var key = getReviewCompletedKey();
      if (key) localStorage.setItem(key, '1');
    } catch (_) {}
  }

  function isReviewEnabled(){
    return isExplicitPreviewEnabled() || (isReviewWindow() && !!getReviewUserId() && !hasCompletedReviewAction());
  }

  function cardPillLabel(){
    return isExplicitPreviewEnabled() ? 'Preview' : 'Ready';
  }

  function escapeHtml(value){
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function cloneObject(value){
    return JSON.parse(JSON.stringify(value || {}));
  }

  function average(values){
    var filtered = (values || []).map(function(value){ return Number(value); }).filter(function(value){ return Number.isFinite(value) && value > 0; });
    if (!filtered.length) return 0;
    return filtered.reduce(function(sum, value){ return sum + value; }, 0) / filtered.length;
  }

  function sum(values){
    return (values || []).map(function(value){ return Number(value); }).filter(function(value){ return Number.isFinite(value); }).reduce(function(total, value){ return total + value; }, 0);
  }

  function countDistinct(items, keyFn){
    var seen = new Set();
    (items || []).forEach(function(item){
      var key = keyFn(item);
      if (key != null && key !== '') seen.add(key);
    });
    return seen.size;
  }

  function formatNumber(value, decimals){
    var num = Number(value);
    if (!Number.isFinite(num)) return String(value == null ? '' : value);
    if (decimals == null) decimals = 0;
    if (decimals === 0) return Math.round(num).toLocaleString();
    return num.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  }

  function formatMl(value){
    return formatNumber(value, 0) + ' ml';
  }

  function formatDuration(minutes){
    var mins = Math.max(0, Math.round(Number(minutes) || 0));
    var hours = Math.floor(mins / 60);
    var remainder = mins % 60;
    return hours + 'h ' + remainder + 'm';
  }

  function dayLabel(dateString){
    if (!dateString) return '';
    var date = new Date(String(dateString) + 'T00:00:00');
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString('en-AU', { weekday: 'short' });
  }

  function localDateKey(date){
    if (typeof window.getLocalDateString === 'function') {
      try { return window.getLocalDateString(date || new Date()); } catch (_) {}
    }
    var d = date instanceof Date ? new Date(date) : new Date(date || Date.now());
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 10);
  }

  function getWeekWindow(){
    var now = new Date();
    var dayOfWeek = now.getDay();
    // The Friday-to-Sunday check-in always belongs to the current Monday-to-Sunday week.
    var mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    var start = new Date(now);
    start.setDate(now.getDate() + mondayOffset);
    start.setHours(0, 0, 0, 0);
    var end = new Date(start);
    end.setDate(start.getDate() + 7);
    end.setHours(0, 0, 0, 0);
    return {
      start: start,
      end: end,
      startKey: localDateKey(start),
      endKey: localDateKey(end),
      label: start.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' }) + ' to ' + new Date(end.getTime() - 24 * 60 * 60 * 1000).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })
    };
  }

  function readWeeklyGoalsSnapshot(userId, weekStartKey){
    if (!userId || !weekStartKey) return null;
    try {
      var raw = localStorage.getItem('pbb_weekly_goals_' + userId + '_' + weekStartKey);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  function formatGoalAmount(value){
    var num = Number(value);
    if (!Number.isFinite(num)) return '0';
    return num % 1 === 0 ? String(num) : num.toFixed(1);
  }

  function clampGoalCount(value){
    var number = Math.floor(Number(value) || 0);
    return Math.max(0, Math.min(3, number));
  }

  function calculateReviewGoalReward(completed, total){
    var completedCount = clampGoalCount(completed);
    var totalCount = clampGoalCount(total);
    var maxPoints = Math.min(50, (totalCount * 10) + (totalCount >= 3 ? 20 : 0));
    var earnedPoints = Math.min(50, (completedCount * 10) + (completedCount >= 3 && totalCount >= 3 ? 20 : 0));
    return {
      earned: Math.min(earnedPoints, maxPoints),
      max: maxPoints
    };
  }

  function reviewActionLabel(data){
    return 'Set next week goals';
  }

  function buildWeeklyGoalsSummary(row, userId, weekStartKey){
    var liveState = window.weeklyGoals && typeof window.weeklyGoals.getState === 'function'
      ? window.weeklyGoals.getState()
      : null;
    var liveWeekStart = liveState && liveState.week && liveState.week.start ? liveState.week.start : null;
    var liveMatchesWeek = !!(weekStartKey && liveWeekStart && liveWeekStart === weekStartKey);
    var localRow = readWeeklyGoalsSnapshot(userId, weekStartKey);
    var liveRow = liveMatchesWeek && liveState && liveState.row && typeof liveState.row === 'object'
      ? liveState.row
      : null;
    // A local snapshot can predate a late wearable sync. Prefer the refreshed
    // server row so a completed Sunday is not held back by stale device data.
    var sourceRow = liveRow || row || localRow || null;
    var selected = liveMatchesWeek && Array.isArray(liveState.selected) && liveState.selected.length
      ? liveState.selected
      : (sourceRow && Array.isArray(sourceRow.selected_goals) ? sourceRow.selected_goals : []);
    var snapshot = liveMatchesWeek && liveState && liveState.progress && Array.isArray(liveState.progress.goals)
      ? liveState.progress
      : (sourceRow && sourceRow.progress_snapshot && typeof sourceRow.progress_snapshot === 'object' ? sourceRow.progress_snapshot : {});
    var progressItems = Array.isArray(snapshot.goals) ? snapshot.goals : [];
    var rows = selected.map(function(goal){
      var progress = progressItems.find(function(item){ return item && item.id === goal.id; }) || {};
      var current = progress.current != null ? Number(progress.current) : 0;
      var target = progress.target != null ? Number(progress.target) : Number(goal.target || 0);
      var unit = progress.unit || goal.unit || '';
      return {
        id: goal.id,
        label: goal.label || progress.label || 'Goal',
        category: goal.category || progress.category || '',
        value: formatGoalAmount(current) + ' / ' + formatGoalAmount(target) + (unit ? ' ' + unit : ''),
        current: Number.isFinite(current) ? current : 0,
        target: Number.isFinite(target) && target > 0 ? target : 1,
        tone: progress.complete ? 'green' : 'amber',
        complete: !!progress.complete
      };
    });
    var sourceCompleted = sourceRow && Number.isFinite(Number(sourceRow.completed_count)) ? Number(sourceRow.completed_count || 0) : 0;
    var sourceTotal = sourceRow && Number.isFinite(Number(sourceRow.total_count)) ? Number(sourceRow.total_count || 0) : 0;
    var total = rows.length || sourceTotal;
    var completed = rows.length
      ? rows.filter(function(item){ return item.complete; }).length
      : Math.min(total, sourceCompleted);
    return {
      completed: Math.max(0, completed),
      total: Math.max(0, total),
      rows: rows
    };
  }

  function buildBestLift(workouts){
    var rows = (workouts || []).map(function(row){
      return {
        exercise: row.exercise_name || '',
        reps: String(row.reps == null ? '' : row.reps).trim(),
        weight: Number(String(row.weight_kg == null ? '' : row.weight_kg).replace(/[^0-9.]/g, ''))
      };
    }).filter(function(row){ return row.exercise && Number.isFinite(row.weight) && row.weight > 0; });

    if (!rows.length) {
      return { label: 'Best lift', value: 'No lift data', meta: 'yet' };
    }

    rows.sort(function(a, b){
      if (b.weight !== a.weight) return b.weight - a.weight;
      var aReps = Number(a.reps) || 0;
      var bReps = Number(b.reps) || 0;
      return bReps - aReps;
    });

    var best = rows[0];
    return {
      label: 'Best lift',
      value: best.exercise + ' ' + formatNumber(best.weight, 0) + 'kg x ' + (best.reps || '?'),
      meta: 'top set'
    };
  }

  function buildBestPress(workouts){
    var bench = (workouts || []).filter(function(row){
      return /bench/i.test(String(row.exercise_name || ''));
    }).map(function(row){
      return {
        exercise: row.exercise_name || '',
        reps: String(row.reps == null ? '' : row.reps).trim(),
        weight: Number(String(row.weight_kg == null ? '' : row.weight_kg).replace(/[^0-9.]/g, ''))
      };
    }).filter(function(row){ return Number.isFinite(row.weight) && row.weight > 0; });

    if (!bench.length) {
      return { label: 'Top press', value: 'No bench data', meta: 'yet' };
    }

    bench.sort(function(a, b){
      if (b.weight !== a.weight) return b.weight - a.weight;
      return (Number(b.reps) || 0) - (Number(a.reps) || 0);
    });

    var best = bench[0];
    return {
      label: 'Top press',
      value: best.exercise + ' ' + formatNumber(best.weight, 0) + 'kg x ' + (best.reps || '?'),
      meta: 'Friday'
    };
  }

  function buildWorkoutHighlight(workouts){
    var dates = {};
    (workouts || []).forEach(function(row){
      if (!row.workout_date) return;
      dates[row.workout_date] = dates[row.workout_date] || [];
      dates[row.workout_date].push(row.exercise_name || '');
    });

    var orderedDates = Object.keys(dates).sort();
    if (!orderedDates.length) return 'No workouts logged yet.';

    if (orderedDates.length === 1) {
      return dayLabel(orderedDates[0]) + ' was the only session, but it still landed some real work.';
    }
    if (orderedDates.length === 2) {
      return dayLabel(orderedDates[0]) + ' and ' + dayLabel(orderedDates[1]) + ' kept the week moving.';
    }

    function dayTone(exercises, fallback){
      var joined = (exercises || []).join(' ').toLowerCase();
      if (/bench/.test(joined)) return 'finished with a strong bench session';
      if (/leg/.test(joined)) return 'was legs';
      if (/shoulder|lateral|overhead|press/.test(joined)) return 'kept shoulders and arms moving';
      if (/back|row|pull/.test(joined)) return 'kept back work moving';
      return fallback;
    }

    return dayLabel(orderedDates[0]) + ' ' + dayTone(dates[orderedDates[0]], 'was a solid session') + ', ' +
      dayLabel(orderedDates[1]) + ' ' + dayTone(dates[orderedDates[1]], 'kept the week moving') + ', and ' +
      dayLabel(orderedDates[2]) + ' ' + dayTone(dates[orderedDates[2]], 'finished strong');
  }

  function buildRecoveryRows(checkins, stepsRows, sleepRows){
    var rows = [];
    var stepDays = countDistinct(stepsRows, function(row){ return row.date; });
    var stepAverage = average((stepsRows || []).map(function(row){ return row.steps; }));
    var sleepAverage = average((sleepRows || []).map(function(row){
      return row.duration_minutes != null ? row.duration_minutes : row.total_sleep_minutes;
    }));

    if (sleepRows && sleepRows.length) {
      rows.push({
        label: 'Sleep',
        value: formatDuration(sleepAverage),
        meta: 'avg/night'
      });
    }

    if (stepsRows && stepsRows.length) {
      rows.push({
        label: 'Steps',
        value: formatNumber(stepAverage, 0),
        meta: 'avg/day'
      });
    }

    var waterAverage = average((checkins || []).map(function(row){ return row.water_intake; }));
    if (checkins && checkins.length) {
      rows.push({
        label: 'Water',
        value: formatMl(waterAverage),
        meta: checkins.length + ' days logged'
      });
    }

    while (rows.length < 3) {
      if (!rows.some(function(row){ return row.label === 'Sleep'; })) {
        rows.push({ label: 'Sleep', value: 'Not connected', meta: 'yet' });
        continue;
      }
      if (!rows.some(function(row){ return row.label === 'Steps'; })) {
        rows.push({ label: 'Steps', value: 'Not connected', meta: 'yet' });
        continue;
      }
      rows.push({ label: 'Water', value: 'No logs', meta: 'yet' });
    }

    return rows.slice(0, 3);
  }

  function cleanLabel(value){
    var text = String(value == null ? '' : value).trim();
    if (!text) return '';
    return text.replace(/[_-]+/g, ' ').replace(/\b\w/g, function(char){ return char.toUpperCase(); });
  }

  function readCheckinExtra(row){
    var extra = row && row.additional_data;
    if (!extra) return {};
    if (typeof extra === 'string') {
      try { return JSON.parse(extra) || {}; } catch (_) { return {}; }
    }
    return typeof extra === 'object' ? extra : {};
  }

  function hasSubmittedWeeklyResponse(checkins, weekStartKey){
    return (checkins || []).some(function(row){
      var weekly = readCheckinExtra(row).weekly_checkin;
      return weekly && weekly.week_start === weekStartKey && !!weekly.submitted_at;
    });
  }

  function cleanFeedbackText(value){
    return String(value == null ? '' : value).trim().replace(/\s+/g, ' ').replace(/[.!?]+$/g, '');
  }

  function buildDailyFeedback(checkins){
    return (checkins || []).slice().sort(function(a, b){
      return String(a.checkin_date || '').localeCompare(String(b.checkin_date || ''));
    }).map(function(row, index){
      var extra = readCheckinExtra(row);
      var parts = [];
      var highlight = cleanFeedbackText(extra.highlight);
      var struggle = cleanFeedbackText(extra.struggle);
      var note = cleanFeedbackText(extra.note);

      if (highlight) parts.push(highlight);
      if (struggle) parts.push('Hard bit: ' + struggle);
      if (note) parts.push('Note: ' + note);

      var text = parts.join('. ');
      if (!text) return null;
      return {
        label: 'Day ' + (index + 1),
        meta: dayLabel(row.checkin_date),
        text: text + '.'
      };
    }).filter(Boolean);
  }

  function buildCheckinMood(checkins, moodRows){
    var rows = [];
    var notes = [];
    var feedback = buildDailyFeedback(checkins);
    var checkinCount = Array.isArray(checkins) ? checkins.length : 0;
    var moodCount = Array.isArray(moodRows) ? moodRows.length : 0;
    var avgMood = average((moodRows || []).map(function(row){ return row.mood_score; }));
    var avgEnergy = average((moodRows || []).map(function(row){ return row.energy_score; }));
    var avgStress = average((moodRows || []).map(function(row){ return row.stress_score; }));
    var latestCheckin = (checkins || []).slice().sort(function(a, b){
      return String(b.checkin_date || '').localeCompare(String(a.checkin_date || ''));
    })[0];

    if (checkinCount) {
      rows.push({
        label: 'Daily check-ins',
        value: String(checkinCount),
        meta: checkinCount === 1 ? 'day logged' : 'days logged'
      });
    }

    if (moodCount) {
      rows.push({
        label: 'Mood',
        value: formatNumber(avgMood, 1) + '/10',
        meta: moodCount + ' logs'
      });
      rows.push({
        label: 'Energy',
        value: formatNumber(avgEnergy, 1) + '/10',
        meta: 'stress ' + formatNumber(avgStress, 1) + '/10'
      });
    } else if (latestCheckin && latestCheckin.energy) {
      rows.push({
        label: 'Energy',
        value: cleanLabel(latestCheckin.energy),
        meta: 'latest check-in'
      });
    }

    if (!feedback.length && !notes.length && moodCount) {
      notes.push('Mood checks averaged ' + formatNumber(avgMood, 1) + '/10, energy ' + formatNumber(avgEnergy, 1) + '/10, and stress ' + formatNumber(avgStress, 1) + '/10.');
    }

    return {
      rows: rows.slice(0, 3),
      note: notes.join(' '),
      feedback: feedback
    };
  }

  function normalizeGoalItems(value){
    if (!value) return [];
    if (Array.isArray(value)) {
      return value.map(function(item){
        if (item && typeof item === 'object') return item.label || item.name || item.title || item.value || '';
        return item;
      }).filter(Boolean);
    }
    if (typeof value === 'object') {
      return Object.keys(value).map(function(key){ return value[key]; }).filter(Boolean);
    }
    return [value];
  }

  function goalLabelFromBodyType(bodyType){
    var raw = String(bodyType || '').trim();
    var key = raw.toLowerCase();
    if (key === 'body builder' || key === 'bodybuilder' || key === 'muscle_gain' || key === 'gain_muscle') {
      return {
        label: 'Bulk up',
        detail: 'Build muscle with a small calorie surplus.',
        source: 'From onboarding'
      };
    }
    if (key === 'flat' || key === 'fat_loss' || key === 'lose_weight' || key === 'weight_loss') {
      return {
        label: 'Lose weight / get lean',
        detail: 'Keep the deficit small, protein high, and training consistent.',
        source: 'From onboarding'
      };
    }
    if (key === 'athletic' || key === 'maintain' || key === 'tone') {
      return {
        label: 'Get toned / maintain fitness',
        detail: 'Hold calories steady while keeping training and recovery consistent.',
        source: 'From onboarding'
      };
    }
    return null;
  }

  function deriveGoalFromOnboarding(details){
    var explicitGoalText = normalizeGoalItems([
      details.goal,
      details.primary_goal_label,
      details.goal_label,
      details.fitness_goal
    ]).join(' ').toLowerCase();

    if (/fat|lose|lean|weight loss|shred/.test(explicitGoalText)) {
      return {
        label: 'Lose weight / get lean',
        detail: 'Keep the deficit controlled, protein high, and training consistent.',
        source: 'From onboarding'
      };
    }
    if (/muscle|bulk|strength|size|gain/.test(explicitGoalText)) {
      return {
        label: 'Bulk up',
        detail: 'Build muscle with a small calorie surplus.',
        source: 'From onboarding'
      };
    }
    if (/tone|maintain|fitness|athletic/.test(explicitGoalText)) {
      return {
        label: 'Get toned / maintain fitness',
        detail: 'Hold calories steady while keeping training and recovery consistent.',
        source: 'From onboarding'
      };
    }

    var bodyTypeGoal = goalLabelFromBodyType(
      details.goalBodyType ||
      details.goal_body_type ||
      details.goalType ||
      details.goal_type ||
      details.primary_goal
    );
    if (bodyTypeGoal) return bodyTypeGoal;

    var goalItems = []
      .concat(normalizeGoalItems(details.goal_intent_labels))
      .concat(normalizeGoalItems(details.goal_intents))
      .concat(normalizeGoalItems(details.onboarding_goal_intents))
      .concat(normalizeGoalItems(details.weekly_goal_focus_labels))
      .concat(normalizeGoalItems(details.long_term_goal))
      .concat(normalizeGoalItems(details.independence_goal));

    var combined = goalItems.join(' ').toLowerCase();
    if (!combined) return null;

    if (/muscle|bulk|strength|size|gain/.test(combined)) {
      return {
        label: 'Bulk up',
        detail: 'Build muscle with a small calorie surplus.',
        source: 'From onboarding'
      };
    }
    if (/lose|lean|fat|weight/.test(combined)) {
      return {
        label: 'Lose weight / get lean',
        detail: 'Keep the deficit small, protein high, and training consistent.',
        source: 'From onboarding'
      };
    }
    if (/tone|maintain|fitness|athletic/.test(combined)) {
      return {
        label: 'Get toned / maintain fitness',
        detail: 'Hold calories steady while keeping training and recovery consistent.',
        source: 'From onboarding'
      };
    }

    return {
      label: String(goalItems[0]).trim(),
      detail: 'This is the goal you set during onboarding.',
      source: 'From onboarding'
    };
  }

  function deriveObjective(details, dailyNutrition){
    var explicitGoal = deriveGoalFromOnboarding(details || {});
    if (explicitGoal) return explicitGoal;

    var tdee = Number(details.tdee || 0);
    var calorieGoal = average((dailyNutrition || []).map(function(row){ return row.calorie_goal; })) || Number(details.calorie_goal || 0);
    var bodyType = String(details.goalBodyType || '').toLowerCase();
    var detailGoal = String(details.goal || '').toLowerCase();
    var caloriesAboveTdee = calorieGoal > tdee + 75;
    var caloriesBelowTdee = calorieGoal < tdee - 75;

    if (bodyType.indexOf('builder') !== -1 || caloriesAboveTdee || detailGoal.indexOf('gain') !== -1 || detailGoal.indexOf('bulk') !== -1) {
      return {
        label: 'Bulk up',
        detail: 'Build muscle with a small calorie surplus.',
        source: 'From calorie target'
      };
    }
    if (caloriesBelowTdee || detailGoal.indexOf('lose') !== -1 || detailGoal.indexOf('fat') !== -1) {
      return {
        label: 'Lose weight / get lean',
        detail: 'Keep the deficit small and keep protein high.',
        source: 'From calorie target'
      };
    }
    return {
      label: 'Maintain',
      detail: 'Hold calories steady and keep the training rhythm clean.',
      source: 'From calorie target'
    };
  }

  function buildReviewDataFromPayload(payload){
    var profile = payload.profile || {};
    var facts = payload.facts || {};
    var details = facts.personal_details || {};
    var dailyNutrition = Array.isArray(payload.dailyNutrition) ? payload.dailyNutrition : [];
    var workouts = Array.isArray(payload.workouts) ? payload.workouts : [];
    var checkins = Array.isArray(payload.checkins) ? payload.checkins : [];
    var stepsRows = Array.isArray(payload.stepsRows) ? payload.stepsRows : [];
    var sleepRows = Array.isArray(payload.sleepRows) ? payload.sleepRows : [];
    var moodRows = Array.isArray(payload.moodRows) ? payload.moodRows : [];
    var weeklyGoalsRow = payload.weeklyGoalsRow || null;
    var weeklyGoals = payload.weeklyGoalsSummary || buildWeeklyGoalsSummary(weeklyGoalsRow, payload.userId, payload.weekStartKey);

    var trackedNutritionDays = countDistinct(dailyNutrition.filter(function(row){
      return Number(row.total_calories || 0) > 0;
    }), function(row){ return row.nutrition_date; });
    var nutritionCount = trackedNutritionDays || dailyNutrition.length || 0;
    var calorieGoal = average(dailyNutrition.map(function(row){ return row.calorie_goal; })) || Number(details.calorie_goal || 0);
    var averageCalories = average(dailyNutrition.map(function(row){ return row.total_calories; }));
    var averageProtein = average(dailyNutrition.map(function(row){ return row.total_protein_g; }));
    var proteinGoal = average(dailyNutrition.map(function(row){ return row.protein_goal_g; })) || Number(details.protein_goal_g || 0);
    var caloriesDelta = averageCalories - calorieGoal;
    var proteinDays = dailyNutrition.filter(function(row){
      var goal = Number(row.protein_goal_g || 0);
      var actual = Number(row.total_protein_g || 0);
      return goal > 0 && actual >= goal * 0.9;
    }).length;
    var trainingDays = countDistinct(workouts, function(row){ return row.workout_date; });
    var objective = deriveObjective(details, dailyNutrition);
    var waterAverage = average((checkins || []).map(function(row){ return row.water_intake; }));
    var waterDays = (checkins || []).length;
    var goalsCompleted = Number(weeklyGoals.completed || 0);
    var goalsTotal = Number(weeklyGoals.total || 0);
    var goalsHit = goalsTotal > 0 && goalsCompleted >= goalsTotal;
    var objectiveLabel = String(objective && objective.label || '').toLowerCase();
    var isWeightLossGoal = objectiveLabel.indexOf('lose') !== -1 || objectiveLabel.indexOf('lean') !== -1 || objectiveLabel.indexOf('fat') !== -1;
    var caloriesVerdict;
    var note;
    var averageLabel = nutritionCount > 0 ? 'Average logged (' + nutritionCount + '/7)' : 'Average logged';

    if (!Number.isFinite(calorieGoal) || !Number.isFinite(averageCalories) || calorieGoal <= 0 || averageCalories <= 0) {
      caloriesVerdict = 'We do not have enough calorie data to make an adjustment yet, so we will keep collecting the week.';
    } else if (caloriesDelta <= -100) {
      caloriesVerdict = 'Average logged intake landed about ' + formatNumber(Math.abs(caloriesDelta), 0) + ' calories under target on tracked days, so next week we will bring food closer to the plan instead of treating this as a full-week calorie read.';
    } else if (caloriesDelta >= 100) {
      caloriesVerdict = 'Average logged intake landed about ' + formatNumber(Math.abs(caloriesDelta), 0) + ' calories over target on tracked days, so we will trim a little back next week.';
    } else {
      caloriesVerdict = 'Average logged intake landed close to target on tracked days, so we can keep the food setup about the same next week.';
    }

    if (!Number.isFinite(averageCalories) || averageCalories <= 0) {
      note = 'Training and recovery give us some signal, but food logging is too thin for a clean calorie call. Next week we will keep the review anchored to the goals you picked.';
    } else if (caloriesDelta <= -100) {
      note = isWeightLossGoal
        ? 'Weight moved, but logged food was well under target. We will keep the deficit controlled, keep training consistent, and tighten the goals you actually selected.'
        : 'The gym was consistent, but logged food was well under target. We will bring food closer to target and keep the training rhythm steady.';
    } else if (caloriesDelta >= 100) {
      note = 'The gym was consistent, but logged food sat above target on tracked days. We will tighten food slightly and keep the review tied to the goals you selected.';
    } else {
      note = 'Good week. Training was consistent and logged food sat close to target on tracked days. We will keep the same rhythm and review the goals you selected.';
    }

    return {
      profile: {
        name: profile.name || profile.full_name || 'Shane',
        accountLabel: profile.accountLabel || profile.account_label || ''
      },
      weekLabel: 'Weekly Review',
      dateRange: getWeekWindow().label,
      objective: objective,
      calories: {
        target: formatNumber(calorieGoal, 0),
        average: formatNumber(averageCalories, 0),
        averageLabel: averageLabel,
        verdict: caloriesVerdict
      },
      training: {
        sessions: trainingDays,
        highlight: buildWorkoutHighlight(workouts)
      },
      goals: {
        completed: goalsCompleted,
        total: goalsTotal,
        rows: weeklyGoals.rows
      },
      wins: [
        trainingDays ? 'You got ' + trainingDays + ' gym sessions done and the week still had a good rhythm.' : 'No workouts logged yet, so the gym read is still blank.',
        proteinDays ? 'Protein landed on target on ' + proteinDays + ' of ' + nutritionCount + ' tracked days, which gives us a solid base.' : 'Protein logging is still thin, so that will be one of the first things we tighten up.',
        goalsTotal > 0
          ? (goalsHit ? 'Weekly goals were all hit, so the overall plan is moving the right way.' : 'Weekly goals landed at ' + goalsCompleted + ' of ' + goalsTotal + ', so we will tighten the plan next week and keep the focus simple.')
          : 'No weekly goals were saved for this week, so next week we will pick the three that matter.'
      ],
      adjustments: [
        caloriesDelta < -100 ? 'Bring average calories a little closer to target.' : 'Keep calories steady and only nudge them if the numbers ask for it.',
        'Keep protein high and keep the current split where it is.',
        goalsTotal > 0 ? 'Use the selected Weekly Goals as the scorecard.' : 'Set Weekly Goals first so next week has a clear scorecard.'
      ],
      tip: 'If calorie tracking is the bit that slips, add the calorie tracker widget to the home screen. One button, tap it, speak what you ate, and it logs it automatically.',
      note: note,
      gym: [
        { label: 'Sessions', value: String(trainingDays || 0), meta: 'clean week' },
        buildBestLift(workouts),
        buildBestPress(workouts)
      ],
      recoveryRows: buildRecoveryRows(checkins, stepsRows, sleepRows),
      checkinMood: buildCheckinMood(checkins, moodRows),
      summary: {
        waterAverage: waterAverage,
        waterDays: waterDays,
        averageProtein: averageProtein,
        proteinGoal: proteinGoal
      }
    };
  }

  function normalizePreviewData(data){
    var base = cloneObject(DEFAULT_DATA);
    if (!data || typeof data !== 'object') return base;
    var merged = cloneObject(base);
    Object.keys(data).forEach(function(key){
      merged[key] = data[key];
    });
    if (data.profile) merged.profile = Object.assign({}, base.profile, data.profile);
    if (data.objective) merged.objective = Object.assign({}, base.objective, data.objective);
    if (data.calories) merged.calories = Object.assign({}, base.calories, data.calories);
    if (data.training) merged.training = Object.assign({}, base.training, data.training);
    if (data.goals) {
      merged.goals = Object.assign({}, base.goals, data.goals);
      merged.goals.rows = Array.isArray(data.goals.rows) ? data.goals.rows.slice() : base.goals.rows.slice();
    }
    merged.wins = Array.isArray(data.wins) ? data.wins.slice() : base.wins.slice();
    merged.adjustments = Array.isArray(data.adjustments) ? data.adjustments.slice() : base.adjustments.slice();
    merged.gym = Array.isArray(data.gym) ? data.gym.slice() : base.gym.slice();
    merged.recoveryRows = Array.isArray(data.recoveryRows) ? data.recoveryRows.slice() : base.recoveryRows.slice();
    if (data.checkinMood) {
      merged.checkinMood = Object.assign({}, base.checkinMood, data.checkinMood);
      merged.checkinMood.rows = Array.isArray(data.checkinMood.rows) ? data.checkinMood.rows.slice() : base.checkinMood.rows.slice();
      merged.checkinMood.feedback = Array.isArray(data.checkinMood.feedback) ? data.checkinMood.feedback.slice() : base.checkinMood.feedback.slice();
    }
    return merged;
  }

  async function tryLoadLiveData(){
    var supabase = window.supabaseClient;
    if (!supabase || !supabase.from) return null;

    var userId = getReviewUserId();
    if (!userId) return null;

    var week = getWeekWindow();
    var safeQuery = async function(queryFn, fallback){
      try {
        var result = await queryFn();
        if (!result || result.error) return fallback;
        return result.data != null ? result.data : fallback;
      } catch (_) {
        return fallback;
      }
    };

    var payload = await Promise.all([
      safeQuery(function(){ return supabase.from('users').select('id,name,profile_photo,program_start_date').eq('id', userId).maybeSingle(); }, null),
      safeQuery(function(){ return supabase.from('user_facts').select('*').eq('user_id', userId).maybeSingle(); }, null),
      safeQuery(function(){ return supabase.from('daily_nutrition').select('nutrition_date,total_calories,total_protein_g,calorie_goal,protein_goal_g,meal_count').eq('user_id', userId).gte('nutrition_date', week.startKey).lt('nutrition_date', week.endKey).order('nutrition_date', { ascending: true }); }, []),
      safeQuery(function(){ return supabase.from('workouts').select('workout_date,exercise_name,set_number,reps,weight_kg,created_at').eq('user_id', userId).eq('workout_type', 'history').gte('workout_date', week.startKey).lt('workout_date', week.endKey).order('workout_date', { ascending: true }); }, []),
      safeQuery(function(){ return supabase.from('daily_checkins').select('checkin_date,water_intake,sleep,energy,additional_data').eq('user_id', userId).gte('checkin_date', week.startKey).lt('checkin_date', week.endKey).order('checkin_date', { ascending: true }); }, []),
      safeQuery(function(){ return supabase.from('fitbit_daily_activity').select('date,steps,calories_burned,active_minutes').eq('user_id', userId).gte('date', week.startKey).lt('date', week.endKey).order('date', { ascending: true }); }, []),
      safeQuery(function(){ return supabase.from('fitbit_sleep').select('date,duration_minutes').eq('user_id', userId).gte('date', week.startKey).lt('date', week.endKey).order('date', { ascending: true }); }, []),
      safeQuery(function(){ return supabase.from('oura_sleep').select('date,total_sleep_minutes').eq('user_id', userId).gte('date', week.startKey).lt('date', week.endKey).order('date', { ascending: true }); }, []),
      safeQuery(function(){ return supabase.from('whoop_sleep').select('date,duration_minutes').eq('user_id', userId).gte('date', week.startKey).lt('date', week.endKey).order('date', { ascending: true }); }, []),
      safeQuery(function(){ return supabase.from('weekly_goals').select('selected_goals,completed_count,total_count,completion_rate,progress_snapshot,arc_snapshot').eq('user_id', userId).eq('week_start', week.startKey).maybeSingle(); }, null),
      safeQuery(function(){ return supabase.from('mood_logs').select('mood_score,energy_score,stress_score,created_at').eq('user_id', userId).gte('created_at', week.startKey).lt('created_at', week.endKey).order('created_at', { ascending: true }); }, [])
    ]);

    var profile = payload[0];
    var facts = payload[1];
    var dailyNutrition = payload[2] || [];
    var workouts = payload[3] || [];
    var checkins = payload[4] || [];
    var stepsRows = payload[5] || [];
    var fitbitSleep = payload[6] || [];
    var ouraSleep = payload[7] || [];
    var whoopSleep = payload[8] || [];
    var weeklyGoalsRow = payload[9];
    var moodRows = payload[10] || [];

    if (!isExplicitPreviewEnabled() && hasSubmittedWeeklyResponse(checkins, week.startKey)) {
      markReviewCompleted();
    }

    if (window.weeklyGoals && typeof window.weeklyGoals.refreshCompletedWeek === 'function') {
      try {
        var refreshedWeeklyGoals = await window.weeklyGoals.refreshCompletedWeek(week.startKey);
        if (refreshedWeeklyGoals && refreshedWeeklyGoals.row) {
          weeklyGoalsRow = refreshedWeeklyGoals.row;
        }
      } catch (error) {
        console.warn('[weekly-checkin-preview] completed-week goals refresh failed', error);
      }
    }

    var weeklyGoalsSummary = buildWeeklyGoalsSummary(weeklyGoalsRow, userId, week.startKey);

    if (!profile && !facts && !dailyNutrition.length && !workouts.length && !checkins.length && !stepsRows.length && !fitbitSleep.length && !ouraSleep.length && !whoopSleep.length && !moodRows.length && !weeklyGoalsSummary.total) {
      return null;
    }

    var liveData = buildReviewDataFromPayload({
      profile: profile || {},
      facts: facts || {},
      dailyNutrition: dailyNutrition,
      workouts: workouts,
      checkins: checkins,
      stepsRows: stepsRows,
      sleepRows: fitbitSleep.concat(ouraSleep, whoopSleep),
      moodRows: moodRows,
      weeklyGoalsRow: weeklyGoalsRow,
      weeklyGoalsSummary: weeklyGoalsSummary,
      userId: userId,
      weekStartKey: week.startKey
    });

    return liveData;
  }

  function ensureStyles(){
    if (document.getElementById('pbb-weekly-checkin-preview-style')) return;
    var style = document.createElement('style');
    style.id = 'pbb-weekly-checkin-preview-style';
    style.textContent = [
      '.pbb-wci-card{display:none;width:calc(100% - 50px);margin:0 25px 14px;border:1px solid rgba(245,217,138,.42);border-radius:20px;background:radial-gradient(circle at 16% 18%,rgba(255,244,199,.26),transparent 28%),radial-gradient(circle at 88% 0,rgba(245,158,11,.38),transparent 34%),linear-gradient(135deg,#16120a 0%,#0b0b0b 48%,#3a2607 100%);box-shadow:0 0 0 1px rgba(255,255,255,.04) inset,0 16px 34px rgba(154,101,18,.28),0 0 30px rgba(245,197,90,.30);color:#fff;text-align:left;cursor:pointer;position:relative;overflow:hidden;font-family:inherit;padding:0;transition:transform .16s ease,box-shadow .16s ease;}',
      '.pbb-wci-card:active{transform:scale(.99);box-shadow:0 10px 24px rgba(154,101,18,.24),0 0 22px rgba(245,197,90,.24);}',
      '.pbb-wci-card:before{content:"";position:absolute;inset:-2px;background:linear-gradient(115deg,transparent 0%,rgba(255,255,255,.20) 44%,transparent 58%);transform:translateX(-82%);animation:pbbWciSweep 5.5s ease-in-out infinite;pointer-events:none;}',
      '.pbb-wci-card-shimmer{position:absolute;inset:-2px;background:linear-gradient(115deg,transparent 0%,rgba(255,255,255,.20) 42%,transparent 56%);transform:translateX(-84%);animation:pbbWciSweep 5.5s ease-in-out infinite;pointer-events:none;z-index:1;}',
      '.pbb-wci-card-inner{position:relative;z-index:1;padding:18px 19px 17px;}',
      '.pbb-wci-card-top{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px;}',
      '.pbb-wci-kicker{font-size:.66rem;font-weight:900;letter-spacing:.10em;text-transform:uppercase;color:#f8d98b;}',
      '.pbb-wci-preview-pill{font-size:.64rem;font-weight:900;color:#151008;background:linear-gradient(135deg,#fff4bf,#f5d98a);border-radius:999px;padding:5px 8px;white-space:nowrap;}',
      '.pbb-wci-card-title{font-size:1.2rem;line-height:1.14;font-weight:950;margin:0 0 7px;color:#fff !important;-webkit-text-fill-color:#fff !important;text-shadow:0 1px 10px rgba(0,0,0,.36);}',
      '.pbb-wci-card-sub{font-size:.82rem;line-height:1.35;font-weight:700;color:rgba(255,255,255,.78);margin:0;}',
      '.pbb-wci-card-goal{display:flex;align-items:center;gap:7px;margin-top:11px;border-radius:999px;background:rgba(245,217,138,.11);border:1px solid rgba(245,217,138,.22);padding:7px 10px;font-size:.74rem;line-height:1.2;font-weight:900;color:#f9e6a9;width:max-content;max-width:100%;box-sizing:border-box;}',
      '.pbb-wci-card-goal span{color:rgba(255,255,255,.62);text-transform:uppercase;font-size:.62rem;letter-spacing:.08em;flex:0 0 auto;}',
      '.pbb-wci-card-goal b{display:block;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#fff;}',
      '.pbb-wci-card-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:14px;}',
      '.pbb-wci-card-stat{min-height:54px;border-radius:14px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.10);padding:9px 8px;box-sizing:border-box;}',
      '.pbb-wci-card-stat b{display:block;font-size:1rem;line-height:1.05;color:#fff;}',
      '.pbb-wci-card-stat span{display:block;margin-top:4px;font-size:.64rem;font-weight:800;color:rgba(255,255,255,.62);}',
      '.pbb-wci-card-footer{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:15px;font-size:.76rem;font-weight:900;color:#f9e6a9;}',
      '.pbb-wci-card-arrow{width:26px;height:26px;border-radius:999px;background:rgba(255,255,255,.12);display:flex;align-items:center;justify-content:center;flex:0 0 auto;}',
      '.pbb-wci-overlay{position:fixed;inset:0;z-index:12120;display:flex;align-items:center;justify-content:center;background:rgba(3,7,18,.84);backdrop-filter:blur(9px);-webkit-backdrop-filter:blur(9px);padding:calc(14px + env(safe-area-inset-top,0px)) 12px calc(14px + env(safe-area-inset-bottom,0px));box-sizing:border-box;}',
      '.pbb-wci-sheet{width:100%;max-width:560px;max-height:calc(100vh - env(safe-area-inset-top,0px) - env(safe-area-inset-bottom,0px) - 28px);overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;border-radius:24px;background:radial-gradient(circle at 18% 0,rgba(245,217,138,.22),transparent 31%),linear-gradient(180deg,#111 0%,#060606 100%);color:#fff;border:1px solid rgba(245,217,138,.20);box-shadow:0 30px 80px rgba(0,0,0,.54);font-family:inherit;}',
      '.pbb-wci-head{position:sticky;top:0;z-index:4;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:calc(15px + env(safe-area-inset-top,0px)) 18px 14px;background:linear-gradient(180deg,rgba(9,9,9,.98),rgba(9,9,9,.90));border-bottom:1px solid rgba(245,217,138,.16);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);}',
      '.pbb-wci-head-title{font-size:.96rem;font-weight:950;color:#fff;}',
      '.pbb-wci-head-sub{font-size:.69rem;font-weight:850;color:#f5d98a;margin-top:2px;}',
      '.pbb-wci-close{width:38px;height:38px;border:none;border-radius:999px;background:rgba(255,255,255,.10);color:#fff;font-size:1.35rem;line-height:1;display:flex;align-items:center;justify-content:center;cursor:pointer;flex:0 0 auto;}',
      '.pbb-wci-body{padding:18px 18px calc(22px + env(safe-area-inset-bottom,0px));}',
      '.pbb-wci-hero{position:relative;overflow:hidden;border-radius:22px;padding:18px;background:linear-gradient(135deg,rgba(245,217,138,.18),rgba(255,255,255,.06));border:1px solid rgba(245,217,138,.22);box-shadow:0 12px 28px rgba(0,0,0,.24);}',
      '.pbb-wci-hero:before{content:"";position:absolute;inset:-2px;background:linear-gradient(115deg,transparent 0%,rgba(255,255,255,.18) 42%,transparent 56%);transform:translateX(-90%);animation:pbbWciSheetSweep 6s ease-in-out infinite;pointer-events:none;}',
      '.pbb-wci-hero>*{position:relative;z-index:1;}',
      '.pbb-wci-profile{font-size:.72rem;line-height:1.35;font-weight:900;color:#f5d98a;text-transform:uppercase;letter-spacing:.08em;}',
      '.pbb-wci-hero h2{margin:8px 0 9px;font-size:1.55rem;line-height:1.08;font-weight:950;color:#fff;}',
      '.pbb-wci-hero p{margin:0;font-size:.94rem;line-height:1.48;font-weight:700;color:rgba(255,255,255,.82);}',
      '.pbb-wci-metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;margin-top:14px;}',
      '.pbb-wci-metric{border-radius:16px;background:rgba(0,0,0,.28);border:1px solid rgba(255,255,255,.09);padding:11px 9px;min-height:76px;box-sizing:border-box;}',
      '.pbb-wci-metric span{display:block;font-size:.65rem;line-height:1.2;font-weight:900;color:rgba(255,255,255,.58);text-transform:uppercase;}',
      '.pbb-wci-metric b{display:block;margin-top:7px;font-size:1.05rem;line-height:1.08;font-weight:950;color:#fff;}',
      '.pbb-wci-goal-banner{position:relative;overflow:hidden;margin-top:12px;border-radius:16px;padding:12px 13px;background:linear-gradient(135deg,rgba(245,217,138,.15),rgba(255,255,255,.05));border:1px solid rgba(245,217,138,.20);box-shadow:0 8px 18px rgba(0,0,0,.16);}',
      '.pbb-wci-goal-banner:before{content:"";position:absolute;inset:-2px;background:linear-gradient(115deg,transparent 0%,rgba(255,244,191,.18) 42%,transparent 56%);transform:translateX(-92%);animation:pbbWciSheetSweep 6.8s ease-in-out infinite;pointer-events:none;}',
      '.pbb-wci-goal-banner>*{position:relative;z-index:1;}',
      '.pbb-wci-goal-banner span{display:block;font-size:.64rem;line-height:1.2;font-weight:900;color:#f5d98a;text-transform:uppercase;letter-spacing:.08em;}',
      '.pbb-wci-goal-banner b{display:block;margin-top:6px;font-size:1rem;line-height:1.1;font-weight:950;color:#fff;}',
      '.pbb-wci-goal-banner small{display:block;margin-top:4px;font-size:.76rem;line-height:1.35;font-weight:700;color:rgba(255,255,255,.72);}',
      '.pbb-wci-goal-source{display:block;margin-top:7px;font-size:.64rem;line-height:1.2;font-weight:900;font-style:normal;color:rgba(245,217,138,.8);text-transform:uppercase;letter-spacing:.08em;}',
      '.pbb-wci-section{margin-top:13px;border-radius:18px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.10);padding:15px;}',
      '.pbb-wci-section h3{margin:0 0 10px;font-size:.98rem;line-height:1.2;font-weight:950;color:#fff;}',
      '.pbb-wci-section p{margin:0;font-size:.88rem;line-height:1.48;font-weight:700;color:rgba(255,255,255,.78);}',
      '.pbb-wci-dot-list{list-style:none;margin:0;padding:0;display:grid;gap:9px;}',
      '.pbb-wci-dot-list li{position:relative;padding-left:17px;font-size:.86rem;line-height:1.42;font-weight:760;color:rgba(255,255,255,.82);}',
      '.pbb-wci-dot-list li:before{content:"";position:absolute;left:0;top:.55em;width:6px;height:6px;border-radius:999px;background:#f5d98a;box-shadow:0 0 10px rgba(245,217,138,.7);}',
      '.pbb-wci-goal-row{display:grid;gap:7px;margin-top:11px;}',
      '.pbb-wci-goal-top{display:flex;align-items:center;justify-content:space-between;gap:10px;font-size:.82rem;font-weight:900;color:#fff;}',
      '.pbb-wci-goal-top span:last-child{color:rgba(255,255,255,.62);white-space:nowrap;}',
      '.pbb-wci-bar{height:9px;border-radius:999px;background:rgba(255,255,255,.10);overflow:hidden;}',
      '.pbb-wci-bar-fill{height:100%;border-radius:999px;background:linear-gradient(90deg,#22c55e,#a3e635);}',
      '.pbb-wci-bar-fill.amber{background:linear-gradient(90deg,#f59e0b,#f5d98a);}',
      '.pbb-wci-grid-3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;}',
      '.pbb-wci-gym-item,.pbb-wci-recovery-item,.pbb-wci-checkin-item{border-radius:14px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.09);padding:11px 9px;min-height:82px;box-sizing:border-box;}',
      '.pbb-wci-gym-item span,.pbb-wci-recovery-item span,.pbb-wci-checkin-item span{display:block;font-size:.65rem;font-weight:900;color:rgba(255,255,255,.55);text-transform:uppercase;}',
      '.pbb-wci-gym-item b,.pbb-wci-recovery-item b,.pbb-wci-checkin-item b{display:block;margin-top:7px;font-size:.98rem;line-height:1.08;color:#fff;}',
      '.pbb-wci-gym-item small,.pbb-wci-recovery-item small,.pbb-wci-checkin-item small{display:block;margin-top:6px;font-size:.68rem;font-weight:800;line-height:1.25;color:#f5d98a;}',
      '.pbb-wci-checkin-note{margin-top:12px;}',
      '.pbb-wci-feedback{margin-top:12px;border-radius:14px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);padding:12px;display:grid;gap:9px;}',
      '.pbb-wci-feedback-title{font-size:.68rem;line-height:1.2;font-weight:950;letter-spacing:.08em;text-transform:uppercase;color:#f5d98a;}',
      '.pbb-wci-feedback-row{display:grid;grid-template-columns:58px minmax(0,1fr);gap:10px;align-items:start;}',
      '.pbb-wci-feedback-day{font-size:.76rem;line-height:1.25;font-weight:950;color:#fff;white-space:nowrap;}',
      '.pbb-wci-feedback-date{display:block;margin-top:2px;font-size:.6rem;line-height:1.2;font-weight:900;color:rgba(245,217,138,.78);text-transform:uppercase;}',
      '.pbb-wci-feedback-text{min-width:0;font-size:.84rem;line-height:1.42;font-weight:720;color:rgba(255,255,255,.80);word-break:break-word;}',
      '.pbb-wci-form{display:grid;gap:15px;}',
      '.pbb-wci-form-intro{font-size:.83rem!important;color:rgba(255,255,255,.72)!important;}',
      '.pbb-wci-field{display:grid;gap:7px;}',
      '.pbb-wci-field-label{font-size:.78rem;line-height:1.3;font-weight:950;color:#fff;}',
      '.pbb-wci-field-help{font-size:.68rem;line-height:1.35;font-weight:750;color:rgba(255,255,255,.56);}',
      '.pbb-wci-choice-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;}',
      '.pbb-wci-choice{position:relative;display:flex;align-items:center;justify-content:center;min-height:42px;border-radius:12px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.06);padding:8px;text-align:center;font-size:.74rem;line-height:1.25;font-weight:900;color:rgba(255,255,255,.78);cursor:pointer;}',
      '.pbb-wci-choice input{position:absolute;opacity:0;pointer-events:none;}',
      '.pbb-wci-choice:has(input:checked){border-color:rgba(245,217,138,.7);background:rgba(245,217,138,.18);color:#fff;box-shadow:0 0 0 1px rgba(245,217,138,.12) inset;}',
      '.pbb-wci-rating{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:7px;}',
      '.pbb-wci-rating .pbb-wci-choice{min-height:40px;font-size:.84rem;}',
      '.pbb-wci-input,.pbb-wci-select{width:100%;box-sizing:border-box;border-radius:13px;border:1px solid rgba(255,255,255,.13);background:rgba(0,0,0,.24);color:#fff;padding:11px 12px;font:750 .82rem/1.4 inherit;outline:none;}',
      '.pbb-wci-input{min-height:78px;resize:vertical;}',
      '.pbb-wci-input:focus,.pbb-wci-select:focus{border-color:rgba(245,217,138,.72);box-shadow:0 0 0 3px rgba(245,217,138,.12);}',
      '.pbb-wci-select option{color:#111;background:#fff;}',
      '.pbb-wci-form-error{display:none;border-radius:11px;background:rgba(239,68,68,.14);border:1px solid rgba(248,113,113,.32);padding:9px 10px;font-size:.73rem;line-height:1.35;font-weight:850;color:#fecaca;}',
      '.pbb-wci-form-error.is-visible{display:block;}',
      '.pbb-wci-actions{display:grid;grid-template-columns:1fr;gap:10px;margin-top:14px;}',
      '.pbb-wci-action{min-height:44px;border-radius:14px;border:1px solid rgba(245,217,138,.22);font-family:inherit;font-size:.82rem;font-weight:950;cursor:pointer;}',
      '.pbb-wci-action:disabled{opacity:.72;cursor:wait;}',
      '.pbb-wci-action.primary{background:linear-gradient(135deg,#f8d98b,#d8b25e);color:#100d07;border-color:rgba(255,255,255,.14);}',
      '.pbb-wci-action.secondary{background:rgba(255,255,255,.08);color:#fff;}',
      '.pbb-wci-xp-celebration{position:fixed;inset:0;z-index:12180;display:flex;align-items:center;justify-content:center;pointer-events:none;background:rgba(3,7,18,.18);animation:pbbWciXpFade 2.4s ease forwards;}',
      '.pbb-wci-xp-card{position:relative;min-width:min(82vw,310px);padding:23px 22px;border-radius:22px;background:radial-gradient(circle at 50% 0,rgba(255,255,255,.24),transparent 38%),linear-gradient(135deg,#fff4bf,#d8b25e 54%,#9f7628);box-shadow:0 22px 54px rgba(15,23,42,.34),0 0 48px rgba(245,217,138,.48);text-align:center;color:#120d05;overflow:hidden;animation:pbbWciXpPop .62s cubic-bezier(.17,.84,.44,1) both;}',
      '.pbb-wci-xp-card:before{content:"";position:absolute;inset:-40%;background:linear-gradient(115deg,transparent 34%,rgba(255,255,255,.45) 48%,transparent 62%);transform:translateX(-65%);animation:pbbWciXpSweep 1.15s ease .15s forwards;}',
      '.pbb-wci-xp-card>*{position:relative;z-index:1;}',
      '.pbb-wci-xp-kicker{font-size:.68rem;line-height:1.2;font-weight:950;letter-spacing:.1em;text-transform:uppercase;color:#5f3f05;}',
      '.pbb-wci-xp-amount{margin-top:7px;font-size:2.35rem;line-height:1;font-weight:950;color:#120d05;}',
      '.pbb-wci-xp-copy{margin-top:6px;font-size:.9rem;line-height:1.35;font-weight:900;color:#3a2607;}',
      '.pbb-wci-xp-spark{position:absolute;width:8px;height:8px;border-radius:999px;background:#fff;box-shadow:0 0 14px rgba(255,255,255,.9);animation:pbbWciXpSpark 1.35s ease-out forwards;}',
      'html[data-pbb-theme="light"] .pbb-wci-card,html.pbb-theme-light .pbb-wci-card,body[data-pbb-theme="light"] .pbb-wci-card,body.pbb-theme-light .pbb-wci-card{color:#fffaf2 !important;-webkit-text-fill-color:#fffaf2 !important;box-shadow:0 0 0 1px rgba(255,255,255,.10) inset,0 16px 34px rgba(154,101,18,.22),0 0 24px rgba(245,197,90,.24) !important;}',
      'html[data-pbb-theme="light"] .pbb-wci-card *,html.pbb-theme-light .pbb-wci-card *,body[data-pbb-theme="light"] .pbb-wci-card *,body.pbb-theme-light .pbb-wci-card *{color:inherit;-webkit-text-fill-color:currentColor;}',
      'html[data-pbb-theme="light"] .pbb-wci-card-sub,html.pbb-theme-light .pbb-wci-card-sub,body[data-pbb-theme="light"] .pbb-wci-card-sub,body.pbb-theme-light .pbb-wci-card-sub{color:rgba(255,250,242,.88) !important;-webkit-text-fill-color:rgba(255,250,242,.88) !important;}',
      'html[data-pbb-theme="light"] .pbb-wci-card-goal span,html[data-pbb-theme="light"] .pbb-wci-card-stat span,html.pbb-theme-light .pbb-wci-card-goal span,html.pbb-theme-light .pbb-wci-card-stat span,body[data-pbb-theme="light"] .pbb-wci-card-goal span,body[data-pbb-theme="light"] .pbb-wci-card-stat span,body.pbb-theme-light .pbb-wci-card-goal span,body.pbb-theme-light .pbb-wci-card-stat span{color:rgba(255,250,242,.76) !important;-webkit-text-fill-color:rgba(255,250,242,.76) !important;}',
      'html[data-pbb-theme="light"] .pbb-wci-kicker,html[data-pbb-theme="light"] .pbb-wci-card-footer,html.pbb-theme-light .pbb-wci-kicker,html.pbb-theme-light .pbb-wci-card-footer,body[data-pbb-theme="light"] .pbb-wci-kicker,body[data-pbb-theme="light"] .pbb-wci-card-footer,body.pbb-theme-light .pbb-wci-kicker,body.pbb-theme-light .pbb-wci-card-footer{color:#ffe7a3 !important;-webkit-text-fill-color:#ffe7a3 !important;}',
      'html[data-pbb-theme="light"] .pbb-wci-preview-pill,html.pbb-theme-light .pbb-wci-preview-pill,body[data-pbb-theme="light"] .pbb-wci-preview-pill,body.pbb-theme-light .pbb-wci-preview-pill{color:#151008 !important;-webkit-text-fill-color:#151008 !important;}',
      'html[data-pbb-theme="light"] .pbb-wci-overlay,html.pbb-theme-light .pbb-wci-overlay,body[data-pbb-theme="light"] .pbb-wci-overlay,body.pbb-theme-light .pbb-wci-overlay{background:rgba(248,250,252,.88);}',
      'html[data-pbb-theme="light"] .pbb-wci-sheet,html.pbb-theme-light .pbb-wci-sheet,body[data-pbb-theme="light"] .pbb-wci-sheet,body.pbb-theme-light .pbb-wci-sheet{background:radial-gradient(circle at 18% 0,rgba(245,217,138,.24),transparent 31%),linear-gradient(180deg,#fffdf7 0%,#ffffff 100%);color:#0f172a !important;-webkit-text-fill-color:#0f172a !important;border-color:rgba(216,178,94,.32);box-shadow:0 30px 80px rgba(15,23,42,.20);}',
      'html[data-pbb-theme="light"] .pbb-wci-sheet *,html.pbb-theme-light .pbb-wci-sheet *,body[data-pbb-theme="light"] .pbb-wci-sheet *,body.pbb-theme-light .pbb-wci-sheet *{color:inherit;-webkit-text-fill-color:currentColor;}',
      'html[data-pbb-theme="light"] .pbb-wci-head,html.pbb-theme-light .pbb-wci-head,body[data-pbb-theme="light"] .pbb-wci-head,body.pbb-theme-light .pbb-wci-head{background:linear-gradient(180deg,rgba(255,255,255,.98),rgba(255,255,255,.92));border-bottom-color:rgba(216,178,94,.22);}',
      'html[data-pbb-theme="light"] .pbb-wci-head-title,html[data-pbb-theme="light"] .pbb-wci-hero h2,html[data-pbb-theme="light"] .pbb-wci-section h3,html[data-pbb-theme="light"] .pbb-wci-goal-top,html[data-pbb-theme="light"] .pbb-wci-gym-item b,html[data-pbb-theme="light"] .pbb-wci-recovery-item b,html[data-pbb-theme="light"] .pbb-wci-checkin-item b,html.pbb-theme-light .pbb-wci-head-title,html.pbb-theme-light .pbb-wci-hero h2,html.pbb-theme-light .pbb-wci-section h3,html.pbb-theme-light .pbb-wci-goal-top,html.pbb-theme-light .pbb-wci-gym-item b,html.pbb-theme-light .pbb-wci-recovery-item b,html.pbb-theme-light .pbb-wci-checkin-item b,body[data-pbb-theme="light"] .pbb-wci-head-title,body[data-pbb-theme="light"] .pbb-wci-hero h2,body[data-pbb-theme="light"] .pbb-wci-section h3,body[data-pbb-theme="light"] .pbb-wci-goal-top,body[data-pbb-theme="light"] .pbb-wci-gym-item b,body[data-pbb-theme="light"] .pbb-wci-recovery-item b,body[data-pbb-theme="light"] .pbb-wci-checkin-item b,body.pbb-theme-light .pbb-wci-head-title,body.pbb-theme-light .pbb-wci-hero h2,body.pbb-theme-light .pbb-wci-section h3,body.pbb-theme-light .pbb-wci-goal-top,body.pbb-theme-light .pbb-wci-gym-item b,body.pbb-theme-light .pbb-wci-recovery-item b,body.pbb-theme-light .pbb-wci-checkin-item b{color:#0f172a !important;-webkit-text-fill-color:#0f172a !important;}',
      'html[data-pbb-theme="light"] .pbb-wci-head-sub,html[data-pbb-theme="light"] .pbb-wci-profile,html[data-pbb-theme="light"] .pbb-wci-sheet .pbb-wci-kicker,html[data-pbb-theme="light"] .pbb-wci-goal-banner span,html[data-pbb-theme="light"] .pbb-wci-goal-source,html.pbb-theme-light .pbb-wci-head-sub,html.pbb-theme-light .pbb-wci-profile,html.pbb-theme-light .pbb-wci-sheet .pbb-wci-kicker,html.pbb-theme-light .pbb-wci-goal-banner span,html.pbb-theme-light .pbb-wci-goal-source,body[data-pbb-theme="light"] .pbb-wci-head-sub,body[data-pbb-theme="light"] .pbb-wci-profile,body[data-pbb-theme="light"] .pbb-wci-sheet .pbb-wci-kicker,body[data-pbb-theme="light"] .pbb-wci-goal-banner span,body[data-pbb-theme="light"] .pbb-wci-goal-source,body.pbb-theme-light .pbb-wci-head-sub,body.pbb-theme-light .pbb-wci-profile,body.pbb-theme-light .pbb-wci-sheet .pbb-wci-kicker,body.pbb-theme-light .pbb-wci-goal-banner span,body.pbb-theme-light .pbb-wci-goal-source{color:#9f7628 !important;-webkit-text-fill-color:#9f7628 !important;}',
      'html[data-pbb-theme="light"] .pbb-wci-hero,html.pbb-theme-light .pbb-wci-hero,body[data-pbb-theme="light"] .pbb-wci-hero,body.pbb-theme-light .pbb-wci-hero{background:linear-gradient(135deg,rgba(245,217,138,.30),rgba(255,255,255,.76));border-color:rgba(216,178,94,.26);box-shadow:0 12px 28px rgba(15,23,42,.10);}',
      'html[data-pbb-theme="light"] .pbb-wci-hero p,html[data-pbb-theme="light"] .pbb-wci-section p,html[data-pbb-theme="light"] .pbb-wci-dot-list li,html[data-pbb-theme="light"] .pbb-wci-goal-banner small,html.pbb-theme-light .pbb-wci-hero p,html.pbb-theme-light .pbb-wci-section p,html.pbb-theme-light .pbb-wci-dot-list li,html.pbb-theme-light .pbb-wci-goal-banner small,body[data-pbb-theme="light"] .pbb-wci-hero p,body[data-pbb-theme="light"] .pbb-wci-section p,body[data-pbb-theme="light"] .pbb-wci-dot-list li,body[data-pbb-theme="light"] .pbb-wci-goal-banner small,body.pbb-theme-light .pbb-wci-hero p,body.pbb-theme-light .pbb-wci-section p,body.pbb-theme-light .pbb-wci-dot-list li,body.pbb-theme-light .pbb-wci-goal-banner small{color:#334155 !important;-webkit-text-fill-color:#334155 !important;}',
      'html[data-pbb-theme="light"] .pbb-wci-section,html.pbb-theme-light .pbb-wci-section,body[data-pbb-theme="light"] .pbb-wci-section,body.pbb-theme-light .pbb-wci-section{background:rgba(255,255,255,.84);border-color:rgba(15,23,42,.08);box-shadow:0 10px 24px rgba(15,23,42,.07);}',
      'html[data-pbb-theme="light"] .pbb-wci-metric,html[data-pbb-theme="light"] .pbb-wci-gym-item,html[data-pbb-theme="light"] .pbb-wci-recovery-item,html[data-pbb-theme="light"] .pbb-wci-checkin-item,html.pbb-theme-light .pbb-wci-metric,html.pbb-theme-light .pbb-wci-gym-item,html.pbb-theme-light .pbb-wci-recovery-item,html.pbb-theme-light .pbb-wci-checkin-item,body[data-pbb-theme="light"] .pbb-wci-metric,body[data-pbb-theme="light"] .pbb-wci-gym-item,body[data-pbb-theme="light"] .pbb-wci-recovery-item,body[data-pbb-theme="light"] .pbb-wci-checkin-item,body.pbb-theme-light .pbb-wci-metric,body.pbb-theme-light .pbb-wci-gym-item,body.pbb-theme-light .pbb-wci-recovery-item,body.pbb-theme-light .pbb-wci-checkin-item{background:rgba(15,23,42,.04);border-color:rgba(15,23,42,.08);}',
      'html[data-pbb-theme="light"] .pbb-wci-feedback,html.pbb-theme-light .pbb-wci-feedback,body[data-pbb-theme="light"] .pbb-wci-feedback,body.pbb-theme-light .pbb-wci-feedback{background:rgba(15,23,42,.035);border-color:rgba(15,23,42,.08);}',
      'html[data-pbb-theme="light"] .pbb-wci-feedback-day,html.pbb-theme-light .pbb-wci-feedback-day,body[data-pbb-theme="light"] .pbb-wci-feedback-day,body.pbb-theme-light .pbb-wci-feedback-day{color:#0f172a !important;-webkit-text-fill-color:#0f172a !important;}',
      'html[data-pbb-theme="light"] .pbb-wci-feedback-title,html[data-pbb-theme="light"] .pbb-wci-feedback-date,html.pbb-theme-light .pbb-wci-feedback-title,html.pbb-theme-light .pbb-wci-feedback-date,body[data-pbb-theme="light"] .pbb-wci-feedback-title,body[data-pbb-theme="light"] .pbb-wci-feedback-date,body.pbb-theme-light .pbb-wci-feedback-title,body.pbb-theme-light .pbb-wci-feedback-date{color:#9f7628 !important;-webkit-text-fill-color:#9f7628 !important;}',
      'html[data-pbb-theme="light"] .pbb-wci-feedback-text,html.pbb-theme-light .pbb-wci-feedback-text,body[data-pbb-theme="light"] .pbb-wci-feedback-text,body.pbb-theme-light .pbb-wci-feedback-text{color:#334155 !important;-webkit-text-fill-color:#334155 !important;}',
      'html[data-pbb-theme="light"] .pbb-wci-field-label,html.pbb-theme-light .pbb-wci-field-label,body[data-pbb-theme="light"] .pbb-wci-field-label,body.pbb-theme-light .pbb-wci-field-label{color:#0f172a!important;-webkit-text-fill-color:#0f172a!important;}',
      'html[data-pbb-theme="light"] .pbb-wci-form-intro,html[data-pbb-theme="light"] .pbb-wci-field-help,html.pbb-theme-light .pbb-wci-form-intro,html.pbb-theme-light .pbb-wci-field-help,body[data-pbb-theme="light"] .pbb-wci-form-intro,body[data-pbb-theme="light"] .pbb-wci-field-help,body.pbb-theme-light .pbb-wci-form-intro,body.pbb-theme-light .pbb-wci-field-help{color:#64748b!important;-webkit-text-fill-color:#64748b!important;}',
      'html[data-pbb-theme="light"] .pbb-wci-choice,html.pbb-theme-light .pbb-wci-choice,body[data-pbb-theme="light"] .pbb-wci-choice,body.pbb-theme-light .pbb-wci-choice{background:#fff;border-color:#dbe2ea;color:#475569!important;-webkit-text-fill-color:#475569!important;}',
      'html[data-pbb-theme="light"] .pbb-wci-choice:has(input:checked),html.pbb-theme-light .pbb-wci-choice:has(input:checked),body[data-pbb-theme="light"] .pbb-wci-choice:has(input:checked),body.pbb-theme-light .pbb-wci-choice:has(input:checked){background:#fff7df;border-color:#b78a2e;color:#7c580d!important;-webkit-text-fill-color:#7c580d!important;}',
      'html[data-pbb-theme="light"] .pbb-wci-input,html[data-pbb-theme="light"] .pbb-wci-select,html.pbb-theme-light .pbb-wci-input,html.pbb-theme-light .pbb-wci-select,body[data-pbb-theme="light"] .pbb-wci-input,body[data-pbb-theme="light"] .pbb-wci-select,body.pbb-theme-light .pbb-wci-input,body.pbb-theme-light .pbb-wci-select{background:#fff;border-color:#dbe2ea;color:#0f172a!important;-webkit-text-fill-color:#0f172a!important;}',
      'html[data-pbb-theme="light"] .pbb-wci-metric span,html[data-pbb-theme="light"] .pbb-wci-gym-item span,html[data-pbb-theme="light"] .pbb-wci-recovery-item span,html[data-pbb-theme="light"] .pbb-wci-checkin-item span,html[data-pbb-theme="light"] .pbb-wci-goal-top span:last-child,html.pbb-theme-light .pbb-wci-metric span,html.pbb-theme-light .pbb-wci-gym-item span,html.pbb-theme-light .pbb-wci-recovery-item span,html.pbb-theme-light .pbb-wci-checkin-item span,html.pbb-theme-light .pbb-wci-goal-top span:last-child,body[data-pbb-theme="light"] .pbb-wci-metric span,body[data-pbb-theme="light"] .pbb-wci-gym-item span,body[data-pbb-theme="light"] .pbb-wci-recovery-item span,body[data-pbb-theme="light"] .pbb-wci-checkin-item span,body[data-pbb-theme="light"] .pbb-wci-goal-top span:last-child,body.pbb-theme-light .pbb-wci-metric span,body.pbb-theme-light .pbb-wci-gym-item span,body.pbb-theme-light .pbb-wci-recovery-item span,body.pbb-theme-light .pbb-wci-checkin-item span,body.pbb-theme-light .pbb-wci-goal-top span:last-child{color:#64748b !important;-webkit-text-fill-color:#64748b !important;}',
      'html[data-pbb-theme="light"] .pbb-wci-metric b,html[data-pbb-theme="light"] .pbb-wci-goal-banner b,html.pbb-theme-light .pbb-wci-metric b,html.pbb-theme-light .pbb-wci-goal-banner b,body[data-pbb-theme="light"] .pbb-wci-metric b,body[data-pbb-theme="light"] .pbb-wci-goal-banner b,body.pbb-theme-light .pbb-wci-metric b,body.pbb-theme-light .pbb-wci-goal-banner b{color:#111827 !important;-webkit-text-fill-color:#111827 !important;}',
      'html[data-pbb-theme="light"] .pbb-wci-gym-item small,html[data-pbb-theme="light"] .pbb-wci-recovery-item small,html[data-pbb-theme="light"] .pbb-wci-checkin-item small,html.pbb-theme-light .pbb-wci-gym-item small,html.pbb-theme-light .pbb-wci-recovery-item small,html.pbb-theme-light .pbb-wci-checkin-item small,body[data-pbb-theme="light"] .pbb-wci-gym-item small,body[data-pbb-theme="light"] .pbb-wci-recovery-item small,body[data-pbb-theme="light"] .pbb-wci-checkin-item small,body.pbb-theme-light .pbb-wci-gym-item small,body.pbb-theme-light .pbb-wci-recovery-item small,body.pbb-theme-light .pbb-wci-checkin-item small{color:#9f7628 !important;-webkit-text-fill-color:#9f7628 !important;}',
      'html[data-pbb-theme="light"] .pbb-wci-goal-banner,html.pbb-theme-light .pbb-wci-goal-banner,body[data-pbb-theme="light"] .pbb-wci-goal-banner,body.pbb-theme-light .pbb-wci-goal-banner{background:linear-gradient(135deg,rgba(245,217,138,.24),rgba(255,255,255,.72));border-color:rgba(216,178,94,.28);}',
      'html[data-pbb-theme="light"] .pbb-wci-bar,html.pbb-theme-light .pbb-wci-bar,body[data-pbb-theme="light"] .pbb-wci-bar,body.pbb-theme-light .pbb-wci-bar{background:rgba(15,23,42,.08);}',
      'html[data-pbb-theme="light"] .pbb-wci-close,html.pbb-theme-light .pbb-wci-close,body[data-pbb-theme="light"] .pbb-wci-close,body.pbb-theme-light .pbb-wci-close{background:#0f172a;color:#fff !important;-webkit-text-fill-color:#fff !important;}',
      'html[data-pbb-theme="light"] .pbb-wci-action.primary,html.pbb-theme-light .pbb-wci-action.primary,body[data-pbb-theme="light"] .pbb-wci-action.primary,body.pbb-theme-light .pbb-wci-action.primary{color:#100d07 !important;-webkit-text-fill-color:#100d07 !important;}',
      'html[data-pbb-theme="light"] .pbb-wci-action.secondary,html.pbb-theme-light .pbb-wci-action.secondary,body[data-pbb-theme="light"] .pbb-wci-action.secondary,body.pbb-theme-light .pbb-wci-action.secondary{color:#0f172a !important;-webkit-text-fill-color:#0f172a !important;}',
      '@keyframes pbbWciSweep{0%,55%{transform:translateX(-82%)}78%,100%{transform:translateX(82%)}}',
      '@keyframes pbbWciSheetSweep{0%,50%{transform:translateX(-92%)}76%,100%{transform:translateX(92%)}}',
      '@keyframes pbbWciXpPop{0%{opacity:0;transform:translateY(18px) scale(.88)}58%{opacity:1;transform:translateY(-3px) scale(1.04)}100%{opacity:1;transform:translateY(0) scale(1)}}',
      '@keyframes pbbWciXpFade{0%,74%{opacity:1}100%{opacity:0}}',
      '@keyframes pbbWciXpSweep{100%{transform:translateX(65%)}}',
      '@keyframes pbbWciXpSpark{0%{opacity:0;transform:translate(0,0) scale(.7)}18%{opacity:1}100%{opacity:0;transform:translate(var(--spark-x),var(--spark-y)) scale(.2)}}',
      '@media (max-width:420px){.pbb-wci-metrics,.pbb-wci-grid-3{grid-template-columns:1fr}.pbb-wci-actions{grid-template-columns:1fr}.pbb-wci-card-title{font-size:1.08rem}.pbb-wci-hero h2{font-size:1.35rem}}',
      '@media (max-width:640px){.pbb-wci-overlay{padding:0}.pbb-wci-sheet{max-width:none;min-height:100%;max-height:100%;border-radius:0;border-left:0;border-right:0}.pbb-wci-body{padding-left:16px;padding-right:16px}}'
    ].join('');
    document.head.appendChild(style);
  }

  function renderList(items){
    return '<ul class="pbb-wci-dot-list">' + (items || []).map(function(item){
      return '<li>' + escapeHtml(item) + '</li>';
    }).join('') + '</ul>';
  }

  function renderGoals(data){
    var rows = data.goals && Array.isArray(data.goals.rows) ? data.goals.rows : [];
    if (!rows.length) {
      return '<p>No weekly goals were saved for this week yet.</p>';
    }
    return rows.map(function(goal){
      var current = Number(goal.current || 0);
      var target = Math.max(1, Number(goal.target || 1));
      var pct = Math.max(0, Math.min(100, Math.round((current / target) * 100)));
      var tone = goal.tone === 'amber' ? ' amber' : '';
      return [
        '<div class="pbb-wci-goal-row">',
        '  <div class="pbb-wci-goal-top"><span>' + escapeHtml(goal.label) + '</span><span>' + escapeHtml(goal.value) + '</span></div>',
        '  <div class="pbb-wci-bar"><div class="pbb-wci-bar-fill' + tone + '" style="width:' + pct + '%"></div></div>',
        '</div>'
      ].join('');
    }).join('');
  }

  function renderGym(data){
    return '<div class="pbb-wci-grid-3">' + (data.gym || []).map(function(item){
      return [
        '<div class="pbb-wci-gym-item">',
        '  <span>' + escapeHtml(item.label) + '</span>',
        '  <b>' + escapeHtml(item.value) + '</b>',
        '  <small>' + escapeHtml(item.meta) + '</small>',
        '</div>'
      ].join('');
    }).join('') + '</div>';
  }

  function renderRecovery(data){
    return '<div class="pbb-wci-grid-3">' + (data.recoveryRows || []).map(function(item){
      return [
        '<div class="pbb-wci-recovery-item">',
        '  <span>' + escapeHtml(item.label) + '</span>',
        '  <b>' + escapeHtml(item.value) + '</b>',
        '  <small>' + escapeHtml(item.meta) + '</small>',
        '</div>'
      ].join('');
    }).join('') + '</div>';
  }

  function renderCheckinMood(data){
    var info = data.checkinMood || {};
    var rows = Array.isArray(info.rows) ? info.rows : [];
    var feedback = Array.isArray(info.feedback) ? info.feedback : [];
    if (!rows.length && !info.note && !feedback.length) return '';
    var cards = rows.length ? '<div class="pbb-wci-grid-3">' + rows.map(function(item){
      return [
        '<div class="pbb-wci-checkin-item">',
        '  <span>' + escapeHtml(item.label) + '</span>',
        '  <b>' + escapeHtml(item.value) + '</b>',
        '  <small>' + escapeHtml(item.meta) + '</small>',
        '</div>'
      ].join('');
    }).join('') + '</div>' : '';
    var feedbackHtml = feedback.length ? [
      '<div class="pbb-wci-feedback">',
      '  <div class="pbb-wci-feedback-title">Your feedback:</div>',
      feedback.map(function(item){
        return [
          '<div class="pbb-wci-feedback-row">',
          '  <div class="pbb-wci-feedback-day">' + escapeHtml(item.label) + (item.meta ? '<span class="pbb-wci-feedback-date">' + escapeHtml(item.meta) + '</span>' : '') + '</div>',
          '  <div class="pbb-wci-feedback-text">' + escapeHtml(item.text) + '</div>',
          '</div>'
        ].join('');
      }).join(''),
      '</div>'
    ].join('') : '';
    var note = info.note ? '<p class="pbb-wci-checkin-note">' + escapeHtml(info.note) + '</p>' : '';
    return '<section class="pbb-wci-section"><h3>Check-ins and mood</h3>' + cards + feedbackHtml + note + '</section>';
  }

  function weeklyReflectionGoalContext(data){
    var rows = data && data.goals && Array.isArray(data.goals.rows) ? data.goals.rows : [];
    var labels = rows.map(function(goal){
      return String(goal && goal.label || '').trim();
    }).filter(Boolean).slice(0, 3);

    if (!labels.length && data && data.objective && data.objective.label) {
      labels.push(String(data.objective.label).trim());
    }

    var list = '';
    if (labels.length === 1) list = labels[0];
    if (labels.length === 2) list = labels[0] + ' and ' + labels[1];
    if (labels.length > 2) list = labels.slice(0, -1).join(', ') + ' and ' + labels[labels.length - 1];

    return {
      labels: labels,
      list: list,
      subject: labels.length === 1 ? labels[0] : 'your weekly goals',
      blockerSubject: labels.length === 1 ? labels[0] : 'those goals'
    };
  }

  function renderWeeklyReflectionForm(data){
    var goalContext = weeklyReflectionGoalContext(data);
    var goalPrompt = goalContext.labels.length
      ? 'This week you were working on ' + goalContext.list + '. Tell Shannon what went well, what got in the way, and what would help next week.'
      : 'Tell Shannon what went well, what got in the way, and what would help next week.';
    var winPrompt = goalContext.labels.length
      ? 'What was your biggest win with ' + goalContext.subject + '?'
      : 'What was your biggest win?';
    var blockerPrompt = goalContext.labels.length
      ? 'What got in the way of ' + goalContext.blockerSubject + '?'
      : 'What got in the way?';
    var supportPrompt = goalContext.labels.length
      ? 'What would help you most with ' + goalContext.blockerSubject + ' next week?'
      : 'What would you like help with next week?';
    return [
      '<section class="pbb-wci-section pbb-wci-reflection-section">',
      '  <h3>Share your week with Shannon</h3>',
      '  <form class="pbb-wci-form" id="weekly-checkin-response-form">',
      '    <p class="pbb-wci-form-intro">' + escapeHtml(goalPrompt) + '</p>',
      '    <div class="pbb-wci-field">',
      '      <div class="pbb-wci-field-label">How did this week feel overall?</div>',
      '      <div class="pbb-wci-choice-grid">',
      '        <label class="pbb-wci-choice"><input type="radio" name="overall" value="strong" required><span>Strong week</span></label>',
      '        <label class="pbb-wci-choice"><input type="radio" name="overall" value="mostly_on_track"><span>Mostly on track</span></label>',
      '        <label class="pbb-wci-choice"><input type="radio" name="overall" value="mixed"><span>Mixed week</span></label>',
      '        <label class="pbb-wci-choice"><input type="radio" name="overall" value="tough"><span>Tough week</span></label>',
      '      </div>',
      '    </div>',
      '    <label class="pbb-wci-field">',
      '      <span class="pbb-wci-field-label">' + escapeHtml(winPrompt) + '</span>',
      '      <span class="pbb-wci-field-help">It can be training, food, routine, confidence, or something life-related.</span>',
      '      <textarea class="pbb-wci-input" name="win" maxlength="600" required placeholder="The thing I am happiest with this week..."></textarea>',
      '    </label>',
      '    <label class="pbb-wci-field">',
      '      <span class="pbb-wci-field-label">' + escapeHtml(blockerPrompt) + '</span>',
      '      <textarea class="pbb-wci-input" name="blocker" maxlength="600" placeholder="The hardest part was..."></textarea>',
      '    </label>',
      '    <div class="pbb-wci-field">',
      '      <div class="pbb-wci-field-label">How confident do you feel about next week?</div>',
      '      <div class="pbb-wci-rating" aria-label="Confidence from 1 to 5">',
      '        <label class="pbb-wci-choice"><input type="radio" name="confidence" value="1" required><span>1</span></label>',
      '        <label class="pbb-wci-choice"><input type="radio" name="confidence" value="2"><span>2</span></label>',
      '        <label class="pbb-wci-choice"><input type="radio" name="confidence" value="3"><span>3</span></label>',
      '        <label class="pbb-wci-choice"><input type="radio" name="confidence" value="4"><span>4</span></label>',
      '        <label class="pbb-wci-choice"><input type="radio" name="confidence" value="5"><span>5</span></label>',
      '      </div>',
      '      <div class="pbb-wci-field-help">1 means you need a reset. 5 means the plan feels clear.</div>',
      '    </div>',
      '    <label class="pbb-wci-field">',
      '      <span class="pbb-wci-field-label">' + escapeHtml(supportPrompt) + '</span>',
      '      <select class="pbb-wci-select" name="support" required>',
      '        <option value="">Choose one</option>',
      '        <option value="accountability">Keep me accountable</option>',
      '        <option value="training">Adjust or explain my training</option>',
      '        <option value="nutrition">Help with food or meal planning</option>',
      '        <option value="routine">Help the plan fit my routine</option>',
      '        <option value="talk">Talk something through with me</option>',
      '        <option value="nothing_specific">Nothing specific right now</option>',
      '      </select>',
      '    </label>',
      '    <label class="pbb-wci-field">',
      '      <span class="pbb-wci-field-label">Anything else Shannon should know?</span>',
      '      <textarea class="pbb-wci-input" name="note" maxlength="900" placeholder="Optional"></textarea>',
      '    </label>',
      '    <div class="pbb-wci-form-error" data-wci-form-error role="alert"></div>',
      '    <button type="submit" class="pbb-wci-action primary" data-wci-action="submit">Send check-in to Shannon</button>',
      '  </form>',
      '</section>'
    ].join('');
  }

  function weeklyGoalSnapshot(data){
    var rows = data && data.goals && Array.isArray(data.goals.rows) ? data.goals.rows : [];
    return rows.slice(0, 3).map(function(goal){
      return {
        id: goal.id || '',
        label: String(goal.label || 'Goal').slice(0, 120),
        current: Number(goal.current || 0),
        target: Number(goal.target || 0),
        value: String(goal.value || '').slice(0, 120),
        complete: !!goal.complete
      };
    });
  }

  function setWeeklyReflectionError(form, message){
    var errorBox = form && form.querySelector ? form.querySelector('[data-wci-form-error]') : null;
    if (!errorBox) return;
    errorBox.textContent = message || '';
    errorBox.classList.toggle('is-visible', !!message);
  }

  async function weeklyCheckinAccessToken(){
    var supabase = window.supabaseClient;
    if (!supabase || !supabase.auth || typeof supabase.auth.getSession !== 'function') return '';
    var result = await supabase.auth.getSession();
    return result && result.data && result.data.session ? result.data.session.access_token || '' : '';
  }

  async function submitWeeklyReflection(event){
    event.preventDefault();
    var form = event.currentTarget;
    if (!form || state.submitting) return;
    setWeeklyReflectionError(form, '');

    var formData = new FormData(form);
    var payload = {
      overall: String(formData.get('overall') || ''),
      win: String(formData.get('win') || '').trim(),
      blocker: String(formData.get('blocker') || '').trim(),
      confidence: Number(formData.get('confidence') || 0),
      support: String(formData.get('support') || ''),
      note: String(formData.get('note') || '').trim(),
      week_start: getWeekWindow().startKey,
      week_end: localDateKey(new Date(getWeekWindow().end.getTime() - 24 * 60 * 60 * 1000)),
      goals: weeklyGoalSnapshot(currentData())
    };

    if (!payload.overall || !payload.win || !payload.confidence || !payload.support) {
      setWeeklyReflectionError(form, 'Please answer the overall, win, confidence, and support questions.');
      return;
    }

    var submitButton = form.querySelector('[data-wci-action="submit"]');
    state.submitting = true;
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = 'Sending check-in...';
    }

    try {
      if (!isExplicitPreviewEnabled()) {
        var accessToken = await weeklyCheckinAccessToken();
        if (!accessToken) throw new Error('Please log in again before sending your check-in.');
        var response = await fetch('/.netlify/functions/submit-weekly-checkin', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + accessToken
          },
          body: JSON.stringify(payload)
        });
        var result = await response.json().catch(function(){ return {}; });
        if (!response.ok || !result.ok) throw new Error(result.error || 'Your check-in could not be sent.');
      }

      try {
        if (typeof window.trackBalanceActivity === 'function') {
          window.trackBalanceActivity('weekly_checkin_submitted', {
            source: 'to_do_next',
            week_start: payload.week_start,
            overall: payload.overall,
            confidence: payload.confidence,
            support: payload.support,
            goal_count: payload.goals.length
          }, { immediate: true });
        }
      } catch (_) {}

      markReviewCompleted();
      closeWeeklyCheckinPreview();
      renderCard();
      if (window.pbbNextSteps && typeof window.pbbNextSteps.refresh === 'function') {
        window.pbbNextSteps.refresh();
      }
      showToast('Check-in sent to Shannon.', 'success');
    } catch (error) {
      setWeeklyReflectionError(form, error && error.message ? error.message : 'Your check-in could not be sent. Please try again.');
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = 'Send check-in to Shannon';
      }
    } finally {
      state.submitting = false;
    }
  }

  function currentData(){
    if (state.source === 'default' && !isExplicitPreviewEnabled()) {
      var week = getWeekWindow();
      var user = window.currentUser || {};
      return normalizePreviewData({
        profile: { name: user.name || user.display_name || 'Your week', accountLabel: '' },
        weekLabel: 'Weekly Check-In',
        dateRange: week.label,
        objective: {
          label: 'Your current goal',
          detail: 'Your saved goals and progress will appear here when they are available.',
          source: 'Balance'
        },
        calories: {
          target: '--',
          average: '--',
          averageLabel: 'avg logged',
          verdict: 'Keep logging what you can. Your answers below give Shannon the context the numbers cannot show.'
        },
        training: { sessions: 0, highlight: 'Training data will appear here when it is available.' },
        goals: { completed: 0, total: 0, rows: [] },
        wins: ['Use the check-in below to tell Shannon what felt like a win this week.'],
        adjustments: ['Shannon will use your answers to shape the next coaching follow-up.'],
        tip: 'A useful check-in does not need a perfect week. Honest context is what makes the next plan better.',
        note: 'Your numbers are still loading, but you can complete the check-in and share the real story of your week.',
        gym: [
          { label: 'Sessions', value: '0', meta: 'loading' },
          { label: 'Best lift', value: 'No lift data', meta: 'yet' },
          { label: 'Top press', value: 'No press data', meta: 'yet' }
        ],
        recoveryRows: [
          { label: 'Sleep', value: 'Not connected', meta: 'yet' },
          { label: 'Steps', value: 'Not connected', meta: 'yet' },
          { label: 'Water', value: 'No logs', meta: 'yet' }
        ],
        checkinMood: { rows: [], note: '', feedback: [] }
      });
    }
    return normalizePreviewData(state.data || DEFAULT_DATA);
  }

  function placeCard(card){
    var wrapped = document.getElementById('monthly-wrapped-card');
    var goals = document.getElementById('weekly-goals-card');
    var fitgotchi = document.getElementById('tamagotchi-widget-container');

    if (wrapped && wrapped.parentNode && wrapped !== card) {
      if (wrapped.previousSibling !== card) wrapped.parentNode.insertBefore(card, wrapped);
      return;
    }
    if (goals && goals.parentNode && goals !== card) {
      if (goals.previousSibling !== card) goals.parentNode.insertBefore(card, goals);
      return;
    }
    if (fitgotchi && fitgotchi.parentNode && fitgotchi !== card) {
      if (fitgotchi.nextSibling !== card) fitgotchi.parentNode.insertBefore(card, fitgotchi.nextSibling);
    }
  }

  function renderCard(){
    ensureStyles();
    var card = document.getElementById('weekly-checkin-card');
    if (!card) {
      card = document.createElement('button');
      card.id = 'weekly-checkin-card';
      card.type = 'button';
      card.className = 'pbb-wci-card';
      var anchor = document.getElementById('weekly-wrapped-card') ||
        document.getElementById('weekly-goals-card');
      if (anchor && anchor.parentNode) {
        anchor.parentNode.insertBefore(card, anchor.nextSibling);
      } else if (document.body) {
        document.body.appendChild(card);
      }
    }
    placeCard(card);

    var data = currentData();
    card.style.display = isReviewEnabled() ? 'block' : 'none';
    card.setAttribute('aria-label', 'Open weekly check-in');
    card.innerHTML = [
      '<div class="pbb-wci-card-inner">',
      '  <div class="pbb-wci-card-top">',
      '    <div class="pbb-wci-kicker">Friday to Sunday</div>',
      '    <div class="pbb-wci-preview-pill">' + escapeHtml(cardPillLabel()) + '</div>',
      '  </div>',
      '  <h3 class="pbb-wci-card-title">Your weekly check-in is ready</h3>',
      '  <p class="pbb-wci-card-sub">Review your goals, share the real story of your week, and tell Shannon what you need next.</p>',
      '  <div class="pbb-wci-card-goal"><span>Goal</span><b>' + escapeHtml(data.objective.label) + '</b></div>',
      '  <div class="pbb-wci-card-stats">',
      '    <div class="pbb-wci-card-stat"><b>' + escapeHtml(data.calories.target) + '</b><span>cal target</span></div>',
      '    <div class="pbb-wci-card-stat"><b>' + escapeHtml(data.calories.average) + '</b><span>' + escapeHtml(data.calories.averageLabel || 'avg logged') + '</span></div>',
      '    <div class="pbb-wci-card-stat"><b>' + escapeHtml(data.goals.completed) + '/' + escapeHtml(data.goals.total) + '</b><span>goals hit</span></div>',
      '  </div>',
      '  <div class="pbb-wci-card-footer"><span>Tap to complete your check-in</span><span class="pbb-wci-card-arrow" aria-hidden="true">&#8250;</span></div>',
      '</div>'
    ].join('');
    card.onclick = openWeeklyCheckinPreview;
  }

  function showToast(message, type){
    if (typeof window.showToast === 'function') {
      try { window.showToast(message, type || 'info'); return; } catch (_) {}
    }
    if (typeof window.showNotification === 'function') {
      try { window.showNotification(message, type || 'info'); return; } catch (_) {}
    }
    console.log('[weekly-checkin-preview]', message);
  }

  function showWeeklyReviewXpCelebration(pointsAwarded){
    var points = Number(pointsAwarded || 0);
    if (!points) return;
    ensureStyles();

    var existing = document.getElementById('weekly-review-xp-celebration');
    if (existing) existing.remove();

    var overlay = document.createElement('div');
    overlay.id = 'weekly-review-xp-celebration';
    overlay.className = 'pbb-wci-xp-celebration';
    overlay.setAttribute('aria-live', 'polite');
    overlay.innerHTML = [
      '<div class="pbb-wci-xp-card" role="status">',
      '  <span class="pbb-wci-xp-spark" style="--spark-x:-108px;--spark-y:-78px;left:50%;top:50%;"></span>',
      '  <span class="pbb-wci-xp-spark" style="--spark-x:-72px;--spark-y:-122px;left:50%;top:50%;animation-delay:.04s;"></span>',
      '  <span class="pbb-wci-xp-spark" style="--spark-x:78px;--spark-y:-116px;left:50%;top:50%;animation-delay:.08s;"></span>',
      '  <span class="pbb-wci-xp-spark" style="--spark-x:116px;--spark-y:-58px;left:50%;top:50%;animation-delay:.12s;"></span>',
      '  <span class="pbb-wci-xp-spark" style="--spark-x:102px;--spark-y:72px;left:50%;top:50%;animation-delay:.16s;"></span>',
      '  <span class="pbb-wci-xp-spark" style="--spark-x:-94px;--spark-y:82px;left:50%;top:50%;animation-delay:.2s;"></span>',
      '  <div class="pbb-wci-xp-kicker">Weekly Review</div>',
      '  <div class="pbb-wci-xp-amount">+' + escapeHtml(points) + ' XP</div>',
      '  <div class="pbb-wci-xp-copy">claimed</div>',
      '</div>'
    ].join('');
    document.body.appendChild(overlay);
    window.setTimeout(function(){
      var current = document.getElementById('weekly-review-xp-celebration');
      if (current) current.remove();
    }, 2600);
  }

  function normalizeRpcJson(value){
    if (!value) return {};
    if (typeof value === 'string') {
      try { return JSON.parse(value) || {}; } catch (_) { return {}; }
    }
    return typeof value === 'object' ? value : {};
  }

  async function claimWeeklyReviewReward(){
    var data = currentData();
    var goals = data && data.goals ? data.goals : {};
    var reward = calculateReviewGoalReward(goals.completed, goals.total);

    if (reward.earned <= 0) {
      state.reviewRewardClaimed = true;
      return { success: true, pointsAwarded: 0, expectedPoints: 0 };
    }

    var supabase = window.supabaseClient;
    if (!supabase || typeof supabase.rpc !== 'function') {
      state.reviewRewardClaimed = false;
      showToast('XP claim needs connection. This review will stay here.', 'info');
      return { success: false, pointsAwarded: 0, expectedPoints: reward.earned };
    }

    try {
      var week = getWeekWindow();
      var result = await supabase.rpc('award_weekly_goal_points', {
        p_week_start: week.startKey
      });
      if (!result || result.error) {
        state.reviewRewardClaimed = false;
        showToast('XP claim did not finish. This review will stay here.', 'info');
        return { success: false, pointsAwarded: 0, expectedPoints: reward.earned };
      }

      var payload = normalizeRpcJson(result.data);
      if (payload && payload.success === false) {
        state.reviewRewardClaimed = false;
        showToast('XP claim is not ready yet. This review will stay here.', 'info');
        return Object.assign({ pointsAwarded: 0, expectedPoints: reward.earned }, payload);
      }

      var pointsAwarded = Number(payload.pointsAwarded || payload.points_awarded || 0);
      state.reviewRewardClaimed = true;
      if (pointsAwarded > 0) {
        showWeeklyReviewXpCelebration(pointsAwarded);
        showToast('+' + pointsAwarded + ' XP claimed.', 'success');
        if (typeof window.loadUserPoints === 'function') {
          window.loadUserPoints();
        } else if (typeof window.refreshLevelDisplay === 'function') {
          window.refreshLevelDisplay();
        }
      }
      return Object.assign({ success: true, pointsAwarded: pointsAwarded, expectedPoints: reward.earned }, payload);
    } catch (error) {
      state.reviewRewardClaimed = false;
      console.warn('[weekly-checkin-preview] weekly goal reward failed', error);
      showToast('XP claim did not finish. This review will stay here.', 'info');
      return { success: false, pointsAwarded: 0, expectedPoints: reward.earned };
    }
  }

  async function openNextGoals(event){
    var button = event && event.currentTarget ? event.currentTarget : null;
    if (button) {
      button.disabled = true;
      button.textContent = 'Opening goals...';
    }
    closeWeeklyCheckinPreview();
    if (typeof window.openWeeklyGoalsModal === 'function') {
      window.openWeeklyGoalsModal({ week: 'next', source: 'weekly-checkin-review' });
      return;
    }
    showToast('Next week goals would open from here.', 'info');
  }

  function openWeeklyCheckinPreview(){
    ensureStyles();
    markReviewViewed();
    try {
      var trackedWeek = getWeekWindow();
      if (typeof window.trackBalanceActivity === 'function') {
        window.trackBalanceActivity('weekly_review_opened', {
          source: 'weekly_review_card',
          week_start: trackedWeek.startKey,
          week_end: trackedWeek.endKey
        }, { immediate: true });
      }
    } catch (_) {}
    renderCard();

    var existing = document.getElementById('weekly-checkin-preview-overlay');
    if (existing) existing.remove();

    var data = currentData();
    var overlay = document.createElement('div');
    overlay.id = 'weekly-checkin-preview-overlay';
    overlay.className = 'pbb-wci-overlay';
    overlay.setAttribute('role', 'presentation');
    overlay.innerHTML = [
      '<section class="pbb-wci-sheet" role="dialog" aria-modal="true" aria-label="Weekly check-in">',
      '  <header class="pbb-wci-head">',
      '    <div><div class="pbb-wci-head-title">Weekly Check-In</div><div class="pbb-wci-head-sub">' + escapeHtml(data.dateRange) + '</div></div>',
      '    <button type="button" class="pbb-wci-close" aria-label="Close weekly check-in">&times;</button>',
      '  </header>',
      '  <div class="pbb-wci-body">',
      renderWeeklyReflectionForm(data),
      '  </div>',
      '</section>'
    ].join('');

    document.body.appendChild(overlay);
    state.overlayOpen = true;

    var sheet = overlay.querySelector('.pbb-wci-sheet');
    var closeBtn = overlay.querySelector('.pbb-wci-close');
    var responseForm = overlay.querySelector('#weekly-checkin-response-form');

    overlay.addEventListener('click', function(){
      closeWeeklyCheckinPreview();
    });
    if (sheet) sheet.addEventListener('click', function(e){ e.stopPropagation(); });
    if (closeBtn) closeBtn.addEventListener('click', closeWeeklyCheckinPreview);
    if (responseForm) responseForm.addEventListener('submit', submitWeeklyReflection);

    if (typeof window.pushNavigationState === 'function') {
      try { window.pushNavigationState('weekly-checkin-preview-overlay', closeWeeklyCheckinPreview); } catch (_) {}
    }
  }

  function closeWeeklyCheckinPreview(){
    var overlay = document.getElementById('weekly-checkin-preview-overlay');
    if (overlay) overlay.remove();
    state.overlayOpen = false;
  }

  async function maybeLoadLiveData(){
    if (state.loading) return;
    if (window.PBB_WEEKLY_CHECKIN_PREVIEW_DATA) return;
    if (!isReviewWindow() && !isExplicitPreviewEnabled()) return;
    if (!window.supabaseClient || !window.supabaseClient.from) return;

    state.loading = true;
    try {
      var live = await tryLoadLiveData();
      if (live) {
        state.data = normalizePreviewData(live);
        state.source = 'live';
        state.hasLiveData = true;
        renderCard();
        if (state.overlayOpen) openWeeklyCheckinPreview();
      }
    } catch (err) {
      console.warn('[weekly-checkin-preview] live load failed', err);
    } finally {
      state.loading = false;
    }
  }

  function handleWeeklyGoalsSaved(event){
    var detail = event && event.detail ? event.detail : {};
    if (detail.source !== 'weekly-checkin-review') return;
    if (detail.localOnly) {
      renderCard();
      return;
    }
    renderCard();
  }

  function boot(){
    readPreviewFlagFromQuery();
    if (window.PBB_WEEKLY_CHECKIN_PREVIEW_DATA) {
      state.data = normalizePreviewData(window.PBB_WEEKLY_CHECKIN_PREVIEW_DATA);
      state.source = 'preview';
      state.hasLiveData = false;
    } else {
      state.data = normalizePreviewData(DEFAULT_DATA);
      state.source = 'default';
      state.hasLiveData = false;
    }
    renderCard();
    maybeLoadLiveData();
  }

  window.openWeeklyCheckinPreview = openWeeklyCheckinPreview;
  window.closeWeeklyCheckinPreview = closeWeeklyCheckinPreview;
  window.refreshWeeklyCheckinPreviewCard = renderCard;
  window.addEventListener('pbbWeeklyGoalsSaved', handleWeeklyGoalsSaved);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
  window.addEventListener('pbbInitComplete', function(){
    renderCard();
    maybeLoadLiveData();
  });
  window.addEventListener('pbbCurrentUserReady', function(){
    renderCard();
    maybeLoadLiveData();
  });
})();
