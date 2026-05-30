(function(){
  'use strict';

  var PREVIEW_KEY = 'pbb_weekly_checkin_preview';
  var DOGFOOD_UNTIL = '2026-06-16T00:00:00+10:00';
  var DOGFOOD_USER_IDS = {
    '00a6605e-8edb-4917-85ba-24a23f179059': true
  };
  var DOGFOOD_EMAILS = {
    'shannonbirch@cocospersonaltraining.com': true
  };

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
      'We will make a small calorie bump next week so the average sits closer to target.',
      'We will keep protein high and keep the current split exactly where it is.',
      'We will keep the calorie tracker widget handy if logging becomes the bottleneck.'
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
      note: ''
    }
  };

  var state = {
    data: null,
    loading: false,
    overlayOpen: false,
    source: 'default'
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

  function getCurrentUserField(field){
    try {
      var user = window.currentUser || window.user || {};
      return user[field] || user.user && user.user[field] || '';
    } catch (_) {
      return '';
    }
  }

  function isDogfoodAccount(){
    var id = String(getCurrentUserField('id') || getCurrentUserField('user_id') || '').trim();
    var email = String(getCurrentUserField('email') || '').trim().toLowerCase();
    return !!(DOGFOOD_USER_IDS[id] || DOGFOOD_EMAILS[email]);
  }

  function isSundayWindow(){
    return new Date().getDay() === 0;
  }

  function isDogfoodWindow(){
    var until = new Date(DOGFOOD_UNTIL).getTime();
    return Number.isFinite(until) && Date.now() < until;
  }

  function isDogfoodEnabled(){
    return isDogfoodAccount() && isDogfoodWindow() && isSundayWindow();
  }

  function isReviewEnabled(){
    return isExplicitPreviewEnabled() || isDogfoodEnabled();
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

  function getWeekWindow(){
    var now = new Date();
    var dayOfWeek = now.getDay();
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
      startKey: start.toISOString().slice(0, 10),
      endKey: end.toISOString().slice(0, 10),
      label: start.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' }) + ' to ' + new Date(end.getTime() - 24 * 60 * 60 * 1000).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })
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

  function buildCheckinMood(checkins, moodRows){
    var rows = [];
    var notes = [];
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

    if (latestCheckin && latestCheckin.additional_data) {
      var extra = latestCheckin.additional_data || {};
      if (extra.highlight) notes.push('Latest highlight: ' + extra.highlight + '.');
      if (extra.struggle) notes.push('Sticky bit: ' + extra.struggle + '.');
      if (extra.note) notes.push('Note: ' + extra.note + '.');
    }

    if (!notes.length && moodCount) {
      notes.push('Mood checks averaged ' + formatNumber(avgMood, 1) + '/10, energy ' + formatNumber(avgEnergy, 1) + '/10, and stress ' + formatNumber(avgStress, 1) + '/10.');
    }

    return {
      rows: rows.slice(0, 3),
      note: notes.join(' ')
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

    var nutritionCount = dailyNutrition.length || 1;
    var calorieGoal = average(dailyNutrition.map(function(row){ return row.calorie_goal; })) || Number(details.calorie_goal || 0);
    var averageCalories = average(dailyNutrition.map(function(row){ return row.total_calories; }));
    var averageProtein = average(dailyNutrition.map(function(row){ return row.total_protein_g; }));
    var proteinGoal = average(dailyNutrition.map(function(row){ return row.protein_goal_g; })) || Number(details.protein_goal_g || 0);
    var caloriesDelta = averageCalories - calorieGoal;
    var caloriesInRangeDays = dailyNutrition.filter(function(row){
      var goal = Number(row.calorie_goal || 0);
      var actual = Number(row.total_calories || 0);
      return goal > 0 && actual > 0 && Math.abs(actual - goal) <= goal * 0.2;
    }).length;
    var proteinDays = dailyNutrition.filter(function(row){
      var goal = Number(row.protein_goal_g || 0);
      var actual = Number(row.total_protein_g || 0);
      return goal > 0 && actual >= goal * 0.9;
    }).length;
    var trainingDays = countDistinct(workouts, function(row){ return row.workout_date; });
    var objective = deriveObjective(details, dailyNutrition);
    var waterAverage = average((checkins || []).map(function(row){ return row.water_intake; }));
    var waterDays = (checkins || []).length;
    var goalsCompleted = weeklyGoalsRow && Number.isFinite(Number(weeklyGoalsRow.completed_count)) ? Number(weeklyGoalsRow.completed_count || 0) : 3;
    var goalsTotal = weeklyGoalsRow && Number.isFinite(Number(weeklyGoalsRow.total_count)) ? Number(weeklyGoalsRow.total_count || 3) : 3;
    var goalsHit = goalsTotal > 0 && goalsCompleted >= goalsTotal;
    var caloriesVerdict;

    if (!Number.isFinite(calorieGoal) || !Number.isFinite(averageCalories) || calorieGoal <= 0 || averageCalories <= 0) {
      caloriesVerdict = 'We do not have enough calorie data to make an adjustment yet, so we will keep collecting the week.';
    } else if (caloriesDelta <= -100) {
      caloriesVerdict = 'Average intake landed about ' + formatNumber(Math.abs(caloriesDelta), 0) + ' calories under target, so we will add a little more food next week to keep the bulk moving.';
    } else if (caloriesDelta >= 100) {
      caloriesVerdict = 'Average intake landed about ' + formatNumber(Math.abs(caloriesDelta), 0) + ' calories over target, so we will trim a little back next week.';
    } else {
      caloriesVerdict = 'Average intake landed close to target, so we can keep the food setup about the same next week.';
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
        verdict: caloriesVerdict
      },
      training: {
        sessions: trainingDays,
        highlight: buildWorkoutHighlight(workouts)
      },
      goals: {
        completed: goalsCompleted,
        total: goalsTotal,
        rows: [
          {
            label: 'Calories in range',
            value: caloriesInRangeDays + '/' + nutritionCount + ' days',
            current: caloriesInRangeDays,
            target: nutritionCount,
            tone: caloriesInRangeDays >= nutritionCount ? 'green' : 'amber'
          },
          {
            label: 'Protein days',
            value: proteinDays + '/' + nutritionCount + ' days',
            current: proteinDays,
            target: Math.min(4, nutritionCount),
            tone: proteinDays >= Math.min(4, nutritionCount) ? 'green' : 'amber'
          },
          {
            label: 'Gym sessions',
            value: trainingDays + '/' + Math.max(3, trainingDays) + '',
            current: trainingDays,
            target: Math.max(3, trainingDays),
            tone: trainingDays >= 3 ? 'green' : 'amber'
          }
        ]
      },
      wins: [
        trainingDays ? 'You got ' + trainingDays + ' gym sessions done and the week still had a good rhythm.' : 'No workouts logged yet, so the gym read is still blank.',
        proteinDays ? 'Protein landed on target on ' + proteinDays + ' of ' + nutritionCount + ' tracked days, which gives us a solid base.' : 'Protein logging is still thin, so that will be one of the first things we tighten up.',
        goalsHit ? 'Weekly goals were all hit, so the overall plan is moving the right way.' : 'Weekly goals were not fully hit, so we will tighten the plan next week and keep the focus simple.'
      ],
      adjustments: [
        caloriesDelta < -100 ? 'We will make a small calorie bump next week so the average sits closer to target.' : 'We will keep calories steady next week and only nudge them if the numbers ask for it.',
        'We will keep protein high and keep the current split exactly where it is.',
        'We will keep the calorie tracker widget handy if logging becomes the bottleneck.'
      ],
      tip: 'If calorie tracking is the bit that slips, add the calorie tracker widget to the home screen. One button, tap it, speak what you ate, and it logs it automatically.',
      note: caloriesDelta < -100 ? 'Good week. The gym was consistent, protein was strong, and calories were close enough to give us a clean read. We will nudge food up next week and keep the same training rhythm.' : 'Good week. The gym was consistent and the recovery signals give us a clear read on what to do next.',
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
    }
    return merged;
  }

  async function tryLoadLiveData(){
    var supabase = window.supabaseClient;
    if (!supabase || !supabase.from) return null;

    var userId = window.currentUser && (window.currentUser.id || window.currentUser.user_id) || window.PBB_WEEKLY_CHECKIN_USER_ID || null;
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
      safeQuery(function(){ return supabase.from('weekly_goals').select('completed_count,total_count,completion_rate,progress_snapshot,arc_snapshot').eq('user_id', userId).eq('week_start', week.startKey).maybeSingle(); }, null),
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

    if ((!profile && !facts) || (!dailyNutrition.length && !workouts.length && !checkins.length && !stepsRows.length && !fitbitSleep.length && !ouraSleep.length && !whoopSleep.length && !moodRows.length)) {
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
      weeklyGoalsRow: weeklyGoalsRow
    });

    if (weeklyGoalsRow && Number.isFinite(Number(weeklyGoalsRow.completed_count))) {
      liveData.goals.completed = Number(weeklyGoalsRow.completed_count || 0);
      liveData.goals.total = Number(weeklyGoalsRow.total_count || liveData.goals.total || 3);
    }

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
      '.pbb-wci-card-title{font-size:1.2rem;line-height:1.14;font-weight:950;margin:0 0 7px;color:#fff;}',
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
      '.pbb-wci-actions{display:grid;grid-template-columns:1fr;gap:10px;margin-top:14px;}',
      '.pbb-wci-action{min-height:44px;border-radius:14px;border:1px solid rgba(245,217,138,.22);font-family:inherit;font-size:.82rem;font-weight:950;cursor:pointer;}',
      '.pbb-wci-action.primary{background:linear-gradient(135deg,#f8d98b,#d8b25e);color:#100d07;border-color:rgba(255,255,255,.14);}',
      '.pbb-wci-action.secondary{background:rgba(255,255,255,.08);color:#fff;}',
      'html.pbb-theme-light .pbb-wci-card,body.pbb-theme-light .pbb-wci-card{box-shadow:0 0 0 1px rgba(255,255,255,.4) inset,0 16px 34px rgba(154,101,18,.20),0 0 24px rgba(245,197,90,.22);}',
      'html.pbb-theme-light .pbb-wci-overlay,body.pbb-theme-light .pbb-wci-overlay{background:rgba(248,250,252,.88);}',
      'html.pbb-theme-light .pbb-wci-sheet,body.pbb-theme-light .pbb-wci-sheet{background:radial-gradient(circle at 18% 0,rgba(245,217,138,.24),transparent 31%),linear-gradient(180deg,#fffdf7 0%,#ffffff 100%);color:#0f172a;border-color:rgba(216,178,94,.32);box-shadow:0 30px 80px rgba(15,23,42,.20);}',
      'html.pbb-theme-light .pbb-wci-head,body.pbb-theme-light .pbb-wci-head{background:linear-gradient(180deg,rgba(255,255,255,.98),rgba(255,255,255,.92));border-bottom-color:rgba(216,178,94,.22);}',
      'html.pbb-theme-light .pbb-wci-head-title,html.pbb-theme-light .pbb-wci-hero h2,html.pbb-theme-light .pbb-wci-section h3,html.pbb-theme-light .pbb-wci-goal-top,html.pbb-theme-light .pbb-wci-gym-item b,html.pbb-theme-light .pbb-wci-recovery-item b,html.pbb-theme-light .pbb-wci-checkin-item b,body.pbb-theme-light .pbb-wci-head-title,body.pbb-theme-light .pbb-wci-hero h2,body.pbb-theme-light .pbb-wci-section h3,body.pbb-theme-light .pbb-wci-goal-top,body.pbb-theme-light .pbb-wci-gym-item b,body.pbb-theme-light .pbb-wci-recovery-item b,body.pbb-theme-light .pbb-wci-checkin-item b{color:#0f172a;}',
      'html.pbb-theme-light .pbb-wci-head-sub,html.pbb-theme-light .pbb-wci-profile,html.pbb-theme-light .pbb-wci-kicker,html.pbb-theme-light .pbb-wci-goal-banner span,html.pbb-theme-light .pbb-wci-goal-source,body.pbb-theme-light .pbb-wci-head-sub,body.pbb-theme-light .pbb-wci-profile,body.pbb-theme-light .pbb-wci-kicker,body.pbb-theme-light .pbb-wci-goal-banner span,body.pbb-theme-light .pbb-wci-goal-source{color:#9f7628;}',
      'html.pbb-theme-light .pbb-wci-hero,body.pbb-theme-light .pbb-wci-hero{background:linear-gradient(135deg,rgba(245,217,138,.30),rgba(255,255,255,.76));border-color:rgba(216,178,94,.26);box-shadow:0 12px 28px rgba(15,23,42,.10);}',
      'html.pbb-theme-light .pbb-wci-hero p,html.pbb-theme-light .pbb-wci-section p,html.pbb-theme-light .pbb-wci-dot-list li,html.pbb-theme-light .pbb-wci-goal-banner small,body.pbb-theme-light .pbb-wci-hero p,body.pbb-theme-light .pbb-wci-section p,body.pbb-theme-light .pbb-wci-dot-list li,body.pbb-theme-light .pbb-wci-goal-banner small{color:#334155;}',
      'html.pbb-theme-light .pbb-wci-section,body.pbb-theme-light .pbb-wci-section{background:rgba(255,255,255,.84);border-color:rgba(15,23,42,.08);box-shadow:0 10px 24px rgba(15,23,42,.07);}',
      'html.pbb-theme-light .pbb-wci-metric,html.pbb-theme-light .pbb-wci-gym-item,html.pbb-theme-light .pbb-wci-recovery-item,html.pbb-theme-light .pbb-wci-checkin-item,body.pbb-theme-light .pbb-wci-metric,body.pbb-theme-light .pbb-wci-gym-item,body.pbb-theme-light .pbb-wci-recovery-item,body.pbb-theme-light .pbb-wci-checkin-item{background:rgba(15,23,42,.04);border-color:rgba(15,23,42,.08);}',
      'html.pbb-theme-light .pbb-wci-metric span,html.pbb-theme-light .pbb-wci-gym-item span,html.pbb-theme-light .pbb-wci-recovery-item span,html.pbb-theme-light .pbb-wci-checkin-item span,html.pbb-theme-light .pbb-wci-goal-top span:last-child,body.pbb-theme-light .pbb-wci-metric span,body.pbb-theme-light .pbb-wci-gym-item span,body.pbb-theme-light .pbb-wci-recovery-item span,body.pbb-theme-light .pbb-wci-checkin-item span,body.pbb-theme-light .pbb-wci-goal-top span:last-child{color:#64748b;}',
      'html.pbb-theme-light .pbb-wci-metric b,html.pbb-theme-light .pbb-wci-goal-banner b,body.pbb-theme-light .pbb-wci-metric b,body.pbb-theme-light .pbb-wci-goal-banner b{color:#111827;}',
      'html.pbb-theme-light .pbb-wci-gym-item small,html.pbb-theme-light .pbb-wci-recovery-item small,html.pbb-theme-light .pbb-wci-checkin-item small,body.pbb-theme-light .pbb-wci-gym-item small,body.pbb-theme-light .pbb-wci-recovery-item small,body.pbb-theme-light .pbb-wci-checkin-item small{color:#9f7628;}',
      'html.pbb-theme-light .pbb-wci-goal-banner,body.pbb-theme-light .pbb-wci-goal-banner{background:linear-gradient(135deg,rgba(245,217,138,.24),rgba(255,255,255,.72));border-color:rgba(216,178,94,.28);}',
      'html.pbb-theme-light .pbb-wci-bar,body.pbb-theme-light .pbb-wci-bar{background:rgba(15,23,42,.08);}',
      'html.pbb-theme-light .pbb-wci-close,body.pbb-theme-light .pbb-wci-close{background:#0f172a;color:#fff;}',
      '@keyframes pbbWciSweep{0%,55%{transform:translateX(-82%)}78%,100%{transform:translateX(82%)}}',
      '@keyframes pbbWciSheetSweep{0%,50%{transform:translateX(-92%)}76%,100%{transform:translateX(92%)}}',
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
    return (data.goals && data.goals.rows ? data.goals.rows : []).map(function(goal){
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
    if (!rows.length && !info.note) return '';
    var cards = rows.length ? '<div class="pbb-wci-grid-3">' + rows.map(function(item){
      return [
        '<div class="pbb-wci-checkin-item">',
        '  <span>' + escapeHtml(item.label) + '</span>',
        '  <b>' + escapeHtml(item.value) + '</b>',
        '  <small>' + escapeHtml(item.meta) + '</small>',
        '</div>'
      ].join('');
    }).join('') + '</div>' : '';
    var note = info.note ? '<p class="pbb-wci-checkin-note">' + escapeHtml(info.note) + '</p>' : '';
    return '<section class="pbb-wci-section"><h3>Check-ins and mood</h3>' + cards + note + '</section>';
  }

  function currentData(){
    return normalizePreviewData(state.data || DEFAULT_DATA);
  }

  function placeCard(card){
    var friendPill = document.getElementById('home-friends-pill');
    var wrapped = document.getElementById('weekly-wrapped-card');
    var goals = document.getElementById('weekly-goals-card');
    var fitgotchi = document.getElementById('tamagotchi-widget-container');

    if (friendPill && friendPill.parentNode && friendPill !== card) {
      if (friendPill.previousSibling !== card) friendPill.parentNode.insertBefore(card, friendPill);
      return;
    }
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
        document.getElementById('weekly-goals-card') ||
        document.getElementById('home-friends-pill');
      if (anchor && anchor.parentNode) {
        anchor.parentNode.insertBefore(card, anchor.nextSibling);
      } else if (document.body) {
        document.body.appendChild(card);
      }
    }
    placeCard(card);

    var data = currentData();
    card.style.display = isReviewEnabled() ? 'block' : 'none';
    card.setAttribute('aria-label', 'Open weekly review');
    card.innerHTML = [
      '<div class="pbb-wci-card-inner">',
      '  <div class="pbb-wci-card-top">',
      '    <div class="pbb-wci-kicker">Your Weekly Review</div>',
      '    <div class="pbb-wci-preview-pill">' + escapeHtml(cardPillLabel()) + '</div>',
      '  </div>',
      '  <h3 class="pbb-wci-card-title">Your Weekly Review is ready</h3>',
      '  <p class="pbb-wci-card-sub">Calories, current goal, gym progress, check-ins, mood, and recovery signals where we have them.</p>',
      '  <div class="pbb-wci-card-goal"><span>Goal</span><b>' + escapeHtml(data.objective.label) + '</b></div>',
      '  <div class="pbb-wci-card-stats">',
      '    <div class="pbb-wci-card-stat"><b>' + escapeHtml(data.calories.target) + '</b><span>cal target</span></div>',
      '    <div class="pbb-wci-card-stat"><b>' + escapeHtml(data.calories.average) + '</b><span>avg logged</span></div>',
      '    <div class="pbb-wci-card-stat"><b>' + escapeHtml(data.goals.completed) + '/' + escapeHtml(data.goals.total) + '</b><span>goals hit</span></div>',
      '  </div>',
      '  <div class="pbb-wci-card-footer"><span>Tap to open the review</span><span class="pbb-wci-card-arrow" aria-hidden="true">&#8250;</span></div>',
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

  function openNextGoals(){
    closeWeeklyCheckinPreview();
    if (typeof window.openWeeklyGoalsModal === 'function') {
      window.openWeeklyGoalsModal({ week: 'next' });
      return;
    }
    showToast('Next week goals would open from here.', 'info');
  }

  function openWeeklyCheckinPreview(){
    ensureStyles();
    var existing = document.getElementById('weekly-checkin-preview-overlay');
    if (existing) existing.remove();

    var data = currentData();
    var overlay = document.createElement('div');
    overlay.id = 'weekly-checkin-preview-overlay';
    overlay.className = 'pbb-wci-overlay';
    overlay.setAttribute('role', 'presentation');
    overlay.innerHTML = [
      '<section class="pbb-wci-sheet" role="dialog" aria-modal="true" aria-label="Weekly review">',
      '  <header class="pbb-wci-head">',
      '    <div><div class="pbb-wci-head-title">Weekly Review</div><div class="pbb-wci-head-sub">' + escapeHtml(data.dateRange) + '</div></div>',
      '    <button type="button" class="pbb-wci-close" aria-label="Close weekly review">&times;</button>',
      '  </header>',
      '  <div class="pbb-wci-body">',
      '    <div class="pbb-wci-hero">',
      '      <div class="pbb-wci-kicker">' + escapeHtml(data.weekLabel) + '</div>',
      '      <div class="pbb-wci-profile">' + escapeHtml(data.profile.name) + '</div>',
      '      <h2>Here\'s my read on your week.</h2>',
      '      <p>' + escapeHtml(data.note) + '</p>',
      '      <div class="pbb-wci-metrics">',
      '        <div class="pbb-wci-metric"><span>Calories you are on</span><b>' + escapeHtml(data.calories.target) + '/day</b></div>',
      '        <div class="pbb-wci-metric"><span>Average logged</span><b>' + escapeHtml(data.calories.average) + '/day</b></div>',
      '        <div class="pbb-wci-metric"><span>Weekly goals</span><b>' + escapeHtml(data.goals.completed) + '/' + escapeHtml(data.goals.total) + ' hit</b></div>',
      '      </div>',
      '      <div class="pbb-wci-goal-banner">',
      '        <span>Your current goal</span>',
      '        <b>' + escapeHtml(data.objective.label) + '</b>',
      '        <small>' + escapeHtml(data.objective.detail) + '</small>',
      '        <em class="pbb-wci-goal-source">' + escapeHtml(data.objective.source || 'From onboarding') + '</em>',
      '      </div>',
      '    </div>',
      '    <section class="pbb-wci-section"><h3>What we made happen</h3>' + renderList(data.wins) + '</section>',
      '    <section class="pbb-wci-section"><h3>Calories and the call</h3><p>' + escapeHtml(data.calories.verdict) + '</p></section>',
      '    <section class="pbb-wci-section"><h3>Gym progress</h3>' + renderGym(data) + '<p style="margin-top:12px;">' + escapeHtml(data.training.highlight) + '</p></section>',
      '    <section class="pbb-wci-section"><h3>Weekly goals</h3>' + renderGoals(data) + '</section>',
      '    <section class="pbb-wci-section"><h3>Recovery snapshot</h3>' + renderRecovery(data) + '</section>',
      renderCheckinMood(data),
      '    <section class="pbb-wci-section"><h3>What we will change next week</h3>' + renderList(data.adjustments) + '</section>',
      '    <section class="pbb-wci-section"><h3>Tracking tip</h3><p>' + escapeHtml(data.tip) + '</p></section>',
      '    <div class="pbb-wci-actions">',
      '      <button type="button" class="pbb-wci-action primary" data-wci-action="goals">Set next week goals</button>',
      '    </div>',
      '  </div>',
      '</section>'
    ].join('');

    document.body.appendChild(overlay);
    state.overlayOpen = true;

    var sheet = overlay.querySelector('.pbb-wci-sheet');
    var closeBtn = overlay.querySelector('.pbb-wci-close');
    var goalsBtn = overlay.querySelector('[data-wci-action="goals"]');

    overlay.addEventListener('click', function(){
      closeWeeklyCheckinPreview();
    });
    if (sheet) sheet.addEventListener('click', function(e){ e.stopPropagation(); });
    if (closeBtn) closeBtn.addEventListener('click', closeWeeklyCheckinPreview);
    if (goalsBtn) goalsBtn.addEventListener('click', openNextGoals);

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
    if (!window.supabaseClient || !window.supabaseClient.from) return;

    state.loading = true;
    try {
      var live = await tryLoadLiveData();
      if (live) {
        state.data = normalizePreviewData(live);
        state.source = 'live';
        renderCard();
        if (state.overlayOpen) openWeeklyCheckinPreview();
      }
    } catch (err) {
      console.warn('[weekly-checkin-preview] live load failed', err);
    } finally {
      state.loading = false;
    }
  }

  function boot(){
    readPreviewFlagFromQuery();
    if (window.PBB_WEEKLY_CHECKIN_PREVIEW_DATA) {
      state.data = normalizePreviewData(window.PBB_WEEKLY_CHECKIN_PREVIEW_DATA);
      state.source = 'preview';
    } else {
      state.data = normalizePreviewData(DEFAULT_DATA);
      state.source = 'default';
    }
    renderCard();
    maybeLoadLiveData();
  }

  window.openWeeklyCheckinPreview = openWeeklyCheckinPreview;
  window.closeWeeklyCheckinPreview = closeWeeklyCheckinPreview;
  window.refreshWeeklyCheckinPreviewCard = renderCard;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
  window.addEventListener('pbbInitComplete', function(){
    renderCard();
    maybeLoadLiveData();
  });
})();
