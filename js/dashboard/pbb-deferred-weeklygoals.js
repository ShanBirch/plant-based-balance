(function(){
  'use strict';

  const MAX_GOALS = 3;
  const DAY_MS = 24 * 60 * 60 * 1000;
  const TABLE_NAME = 'weekly_goals';

  const GOAL_CATALOG = [
    {
      category: 'Body',
      blurb: 'Scale trend or weigh-in rhythm',
      short: 'B',
      accent: '#e11d48',
      soft: '#fff1f2',
      border: '#fecdd3',
      gradient: 'linear-gradient(135deg,#fb7185,#f97316)',
      goals: [
        { id: 'weight_loss', label: 'Lose weight', target: 0.5, unit: 'kg', min: 0.1, max: 2, step: 0.1 },
        { id: 'weight_gain', label: 'Gain weight', target: 0.5, unit: 'kg', min: 0.1, max: 2, step: 0.1 },
        { id: 'weigh_in_days', label: 'Weigh in', target: 5, unit: 'days', min: 1, max: 7, step: 1 }
      ]
    },
    {
      category: 'Training',
      blurb: 'Sessions and independence',
      short: 'T',
      accent: '#2563eb',
      soft: '#eff6ff',
      border: '#bfdbfe',
      gradient: 'linear-gradient(135deg,#2563eb,#06b6d4)',
      goals: [
        { id: 'complete_workouts', label: 'Complete workouts', target: 3, unit: 'workouts', min: 1, max: 7, step: 1 },
        { id: 'build_workouts', label: 'Build your own workout', target: 1, unit: 'workouts', min: 1, max: 3, step: 1 }
      ]
    },
    {
      category: 'Food',
      blurb: 'Protein, calories, and logging',
      short: 'F',
      accent: '#16a34a',
      soft: '#f0fdf4',
      border: '#bbf7d0',
      gradient: 'linear-gradient(135deg,#16a34a,#84cc16)',
      goals: [
        { id: 'protein_days', label: 'Hit protein', target: 5, unit: 'days', min: 1, max: 7, step: 1 },
        { id: 'calorie_range_days', label: 'Stay in calorie range', target: 5, unit: 'days', min: 1, max: 7, step: 1 },
        { id: 'meal_log_days', label: 'Log meals', target: 5, unit: 'days', min: 1, max: 7, step: 1 }
      ]
    },
    {
      category: 'Recovery',
      blurb: 'Sleep, steps, water, check-ins',
      short: 'R',
      accent: '#7c3aed',
      soft: '#f5f3ff',
      border: '#ddd6fe',
      gradient: 'linear-gradient(135deg,#7c3aed,#ec4899)',
      goals: [
        { id: 'sleep_7h_nights', label: 'Sleep 7+ hours', target: 4, unit: 'nights', min: 1, max: 7, step: 1 },
        { id: 'steps_10k_days', label: 'Reach 10k steps', target: 4, unit: 'days', min: 1, max: 7, step: 1 },
        { id: 'water_goal_days', label: 'Hit water goal', target: 5, unit: 'days', min: 1, max: 7, step: 1 },
        { id: 'mood_checkin_days', label: 'Mood check-in', target: 5, unit: 'days', min: 1, max: 7, step: 1 }
      ]
    },
    {
      category: 'Health IQ',
      blurb: 'Learn through quizzes and games',
      short: 'IQ',
      accent: '#d97706',
      soft: '#fffbeb',
      border: '#fde68a',
      gradient: 'linear-gradient(135deg,#f59e0b,#ef4444)',
      goals: [
        { id: 'daily_quiz_days', label: 'Complete Daily Quiz', target: 3, unit: 'days', min: 1, max: 7, step: 1 },
        { id: 'questions_answered', label: 'Answer Health IQ questions', target: 20, unit: 'questions', min: 5, max: 80, step: 5 },
        { id: 'perfect_lessons', label: 'Score 100% on lessons', target: 1, unit: 'lessons', min: 1, max: 5, step: 1 }
      ]
    },
    {
      category: 'Community',
      blurb: 'Coach, Feed, friends, and games',
      short: 'C',
      accent: '#0891b2',
      soft: '#ecfeff',
      border: '#a5f3fc',
      gradient: 'linear-gradient(135deg,#0891b2,#14b8a6)',
      goals: [
        { id: 'share_workout_feed', label: 'Share workout to Feed', target: 1, unit: 'posts', min: 1, max: 3, step: 1 },
        { id: 'share_meal_feed', label: 'Share meal to Feed', target: 1, unit: 'posts', min: 1, max: 3, step: 1 },
        { id: 'message_coach', label: 'Message your coach', target: 1, unit: 'messages', min: 1, max: 3, step: 1 },
        { id: 'invite_friend', label: 'Invite a friend', target: 1, unit: 'friends', min: 1, max: 3, step: 1 },
        { id: 'complete_game', label: 'Complete a game', target: 1, unit: 'games', min: 1, max: 5, step: 1 }
      ]
    }
  ];

  const GOAL_BY_ID = {};
  GOAL_CATALOG.forEach(group => {
    group.goals.forEach(goal => {
      GOAL_BY_ID[goal.id] = Object.assign({ category: group.category }, goal);
    });
  });

  let state = {
    week: null,
    row: null,
    selected: [],
    draftSelected: [],
    progress: null,
    arc: null,
    tableAvailable: true,
    loading: false
  };

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function formatTarget(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return String(value == null ? '' : value);
    return number % 1 === 0 ? String(number) : number.toFixed(1);
  }

  function getCategoryMeta(category) {
    return GOAL_CATALOG.find(group => group.category === category) || {
      short: 'G',
      accent: '#0f766e',
      soft: '#f8fafc',
      border: '#cbd5e1',
      gradient: 'linear-gradient(135deg,#0f766e,#2563eb)'
    };
  }

  function styleVarsForMeta(meta) {
    return '--goal-accent:' + meta.accent + ';--goal-soft:' + meta.soft + ';--goal-border:' + meta.border + ';--goal-gradient:' + meta.gradient + ';';
  }

  function goalChoiceHint(goal, selected) {
    if (selected) {
      const picked = state.draftSelected.find(item => item.id === goal.id);
      const target = picked ? picked.target : goal.target;
      return 'Chosen: ' + formatTarget(target) + ' ' + goal.unit;
    }
    if (goal.unit === 'days') return 'Pick your days after choosing';
    if (goal.unit === 'nights') return 'Pick your nights after choosing';
    if (goal.unit === 'workouts') return 'Pick your workout count';
    if (goal.unit === 'kg') return 'Pick your body target';
    if (goal.unit === 'questions') return 'Pick your question goal';
    return 'Pick your target after choosing';
  }

  function getDateKey(date) {
    if (typeof window.getLocalDateString === 'function') {
      try { return window.getLocalDateString(date || new Date()); } catch (_) {}
    }
    const d = date instanceof Date ? new Date(date) : new Date(date || Date.now());
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 10);
  }

  function dateFromKey(key) {
    return new Date(String(key) + 'T00:00:00');
  }

  function addDaysKey(key, days) {
    const d = dateFromKey(key);
    d.setDate(d.getDate() + days);
    return getDateKey(d);
  }

  function getMondayKey(date) {
    const d = new Date(date || Date.now());
    d.setHours(0, 0, 0, 0);
    const day = d.getDay();
    const diff = day === 0 ? 6 : day - 1;
    d.setDate(d.getDate() - diff);
    return getDateKey(d);
  }

  function getPlanningWeek(date) {
    const now = new Date(date || Date.now());
    let start = getMondayKey(now);
    if (now.getDay() === 0 && now.getHours() >= 12) {
      start = addDaysKey(start, 7);
    }
    return {
      start,
      end: addDaysKey(start, 6),
      endExclusive: addDaysKey(start, 7),
      arcStart: addDaysKey(start, -21)
    };
  }

  function localStorageKey(userId, weekStart) {
    return 'pbb_weekly_goals_' + userId + '_' + weekStart;
  }

  function showToastSafe(message, type) {
    if (typeof window.showToast === 'function') {
      window.showToast(message, type || 'info');
    }
  }

  function normalizeGoal(raw) {
    const def = raw && GOAL_BY_ID[raw.id];
    if (!def) return null;
    let target = Number(raw.target);
    if (!Number.isFinite(target) || target <= 0) target = def.target;
    target = Math.min(def.max, Math.max(def.min, target));
    if (def.step >= 1) target = Math.round(target);
    else target = Math.round(target * 10) / 10;
    return {
      id: def.id,
      label: def.label,
      category: def.category,
      target,
      unit: def.unit
    };
  }

  function normalizeSelected(list) {
    if (!Array.isArray(list)) return [];
    const seen = new Set();
    const result = [];
    list.forEach(item => {
      const goal = normalizeGoal(item);
      if (!goal || seen.has(goal.id) || result.length >= MAX_GOALS) return;
      seen.add(goal.id);
      result.push(goal);
    });
    return result;
  }

  async function fetchWeeklyRow(userId, weekStart) {
    const fallback = readLocalRow(userId, weekStart);
    if (!window.supabaseClient || !state.tableAvailable) return fallback;
    try {
      const { data, error } = await window.supabaseClient
        .from(TABLE_NAME)
        .select('*')
        .eq('user_id', userId)
        .eq('week_start', weekStart)
        .maybeSingle();
      if (error) {
        state.tableAvailable = !isMissingTableError(error);
        return fallback;
      }
      return data || fallback;
    } catch (error) {
      state.tableAvailable = !isMissingTableError(error);
      return fallback;
    }
  }

  function readLocalRow(userId, weekStart) {
    try {
      const raw = localStorage.getItem(localStorageKey(userId, weekStart));
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  function isMissingTableError(error) {
    const msg = String((error && (error.message || error.details || error.code)) || '');
    return /weekly_goals|does not exist|schema cache|42P01/i.test(msg);
  }

  async function saveWeeklyRow(userId, week, selected, progress, arc) {
    const payload = {
      user_id: userId,
      week_start: week.start,
      week_end: week.end,
      selected_goals: selected,
      progress_snapshot: progress || {},
      arc_snapshot: arc || {},
      total_count: selected.length,
      completed_count: progress && Array.isArray(progress.goals)
        ? progress.goals.filter(g => g.complete).length
        : 0,
      completion_rate: progress && selected.length
        ? Math.round((progress.goals.filter(g => g.complete).length / selected.length) * 100)
        : 0,
      status: 'active'
    };

    try {
      localStorage.setItem(localStorageKey(userId, week.start), JSON.stringify(payload));
    } catch (_) {}

    if (!window.supabaseClient || !state.tableAvailable) return payload;

    try {
      const { data, error } = await window.supabaseClient
        .from(TABLE_NAME)
        .upsert(payload, { onConflict: 'user_id,week_start' })
        .select()
        .single();
      if (error) {
        state.tableAvailable = !isMissingTableError(error);
        if (!state.tableAvailable) return payload;
        throw error;
      }
      return data || payload;
    } catch (error) {
      console.warn('[weekly-goals] save failed, local fallback kept', error);
      return payload;
    }
  }

  async function safeQuery(label, queryFactory) {
    try {
      const result = await queryFactory();
      if (result && result.error) {
        console.warn('[weekly-goals] query failed:', label, result.error.message || result.error);
        return [];
      }
      return (result && Array.isArray(result.data)) ? result.data : [];
    } catch (error) {
      console.warn('[weekly-goals] query crashed:', label, error);
      return [];
    }
  }

  async function loadProgressData(userId, week) {
    const supabase = window.supabaseClient;
    if (!supabase) return {};

    const startIso = dateFromKey(week.arcStart).toISOString();
    const endIso = dateFromKey(week.endExclusive).toISOString();
    let coachId = window._coachUserId || null;
    if (!coachId && typeof window.getCoachUserId === 'function') {
      try { coachId = await window.getCoachUserId(); } catch (_) {}
    }

    const queries = [
      safeQuery('daily_nutrition', () => supabase.from('daily_nutrition')
        .select('nutrition_date,total_calories,total_protein_g,calorie_goal,protein_goal_g,meal_count')
        .eq('user_id', userId)
        .gte('nutrition_date', week.arcStart)
        .lt('nutrition_date', week.endExclusive)
        .order('nutrition_date', { ascending: true })),
      safeQuery('workouts history', () => supabase.from('workouts')
        .select('workout_date,workout_type,exercise_name,created_at')
        .eq('user_id', userId)
        .eq('workout_type', 'history')
        .gte('workout_date', week.arcStart)
        .lt('workout_date', week.endExclusive)
        .order('workout_date', { ascending: true })),
      safeQuery('custom workouts', () => supabase.from('workouts')
        .select('id,workout_name,template_name,created_at,workout_type')
        .eq('user_id', userId)
        .eq('workout_type', 'custom_template')
        .gte('created_at', startIso)
        .lt('created_at', endIso)),
      safeQuery('daily_weigh_ins', () => supabase.from('daily_weigh_ins')
        .select('weigh_in_date,weight_kg,created_at')
        .eq('user_id', userId)
        .gte('weigh_in_date', week.arcStart)
        .lt('weigh_in_date', week.endExclusive)
        .order('weigh_in_date', { ascending: true })),
      safeQuery('stories', () => supabase.from('stories')
        .select('id,media_type,created_at')
        .eq('user_id', userId)
        .gte('created_at', startIso)
        .lt('created_at', endIso)),
      safeQuery('lesson_completions', () => supabase.from('lesson_completions')
        .select('games_played,score_percentage,completed_at')
        .eq('user_id', userId)
        .gte('completed_at', startIso)
        .lt('completed_at', endIso)),
      safeQuery('learning_milestones', () => supabase.from('learning_milestones')
        .select('milestone_type,milestone_id,achieved_at')
        .eq('user_id', userId)
        .gte('achieved_at', startIso)
        .lt('achieved_at', endIso)),
      safeQuery('daily_checkins', () => supabase.from('daily_checkins')
        .select('checkin_date,water_intake,sleep')
        .eq('user_id', userId)
        .gte('checkin_date', week.arcStart)
        .lt('checkin_date', week.endExclusive)),
      safeQuery('mood_logs', () => supabase.from('mood_logs')
        .select('log_date,context,logged_at,created_at')
        .eq('user_id', userId)
        .gte('log_date', week.arcStart)
        .lt('log_date', week.endExclusive)),
      safeQuery('oura_daily_activity', () => supabase.from('oura_daily_activity')
        .select('date,steps')
        .eq('user_id', userId)
        .gte('date', week.arcStart)
        .lt('date', week.endExclusive)),
      safeQuery('fitbit_daily_activity', () => supabase.from('fitbit_daily_activity')
        .select('date,steps')
        .eq('user_id', userId)
        .gte('date', week.arcStart)
        .lt('date', week.endExclusive)),
      safeQuery('whoop_sleep', () => supabase.from('whoop_sleep')
        .select('date,duration_minutes')
        .eq('user_id', userId)
        .gte('date', week.arcStart)
        .lt('date', week.endExclusive)),
      safeQuery('oura_sleep', () => supabase.from('oura_sleep')
        .select('date,total_sleep_minutes')
        .eq('user_id', userId)
        .gte('date', week.arcStart)
        .lt('date', week.endExclusive)),
      safeQuery('fitbit_sleep', () => supabase.from('fitbit_sleep')
        .select('date,duration_minutes')
        .eq('user_id', userId)
        .gte('date', week.arcStart)
        .lt('date', week.endExclusive)),
      safeQuery('game_matches', () => supabase.from('game_matches')
        .select('id,status,winner_id,challenger_id,opponent_id,created_at')
        .or('challenger_id.eq.' + userId + ',opponent_id.eq.' + userId)
        .gte('created_at', startIso)
        .lt('created_at', endIso)),
      safeQuery('quiz_battles', () => supabase.from('quiz_battles')
        .select('id,status,winner_id,challenger_id,opponent_id,created_at')
        .or('challenger_id.eq.' + userId + ',opponent_id.eq.' + userId)
        .gte('created_at', startIso)
        .lt('created_at', endIso)),
      coachId
        ? safeQuery('nudges coach messages', () => supabase.from('nudges')
          .select('id,created_at')
          .eq('sender_id', userId)
          .eq('receiver_id', coachId)
          .gte('created_at', startIso)
          .lt('created_at', endIso))
        : Promise.resolve([]),
      safeQuery('referrals', () => supabase.from('referrals')
        .select('id,created_at,status')
        .eq('referrer_user_id', userId)
        .gte('created_at', startIso)
        .lt('created_at', endIso))
    ];

    const [
      nutrition, workouts, customWorkouts, weighIns, stories,
      lessons, milestones, checkins, moodLogs, ouraActivity,
      fitbitActivity, whoopSleep, ouraSleep, fitbitSleep,
      gameMatches, quizBattles, coachMessages, referrals
    ] = await Promise.all(queries);

    return {
      nutrition,
      workouts,
      customWorkouts,
      weighIns,
      stories,
      lessons,
      milestones,
      checkins,
      moodLogs,
      ouraActivity,
      fitbitActivity,
      whoopSleep,
      ouraSleep,
      fitbitSleep,
      gameMatches,
      quizBattles,
      coachMessages,
      referrals
    };
  }

  function isDateInWeek(dateKey, week) {
    return dateKey >= week.start && dateKey < week.endExclusive;
  }

  function createdDateKey(row) {
    return row && row.created_at ? getDateKey(new Date(row.created_at)) : null;
  }

  function countDistinctDates(rows, getKey) {
    const set = new Set();
    (rows || []).forEach(row => {
      const key = getKey(row);
      if (key) set.add(key);
    });
    return set.size;
  }

  function mergeDailyMax(rows, dateField, valueField, week) {
    const maxByDate = {};
    (rows || []).forEach(row => {
      const date = row && row[dateField];
      if (!date || !isDateInWeek(date, week)) return;
      const value = Number(row[valueField] || 0);
      maxByDate[date] = Math.max(maxByDate[date] || 0, value);
    });
    return maxByDate;
  }

  function completionStatuses(rows) {
    return (rows || []).filter(row => /^(complete|completed|draw|finished)$/i.test(String(row.status || '')));
  }

  function getWaterGoalMl() {
    const raw = localStorage.getItem('pbb_water_goal_ml');
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 2000;
  }

  function normalizeWaterMl(value) {
    const n = Number(value || 0);
    if (!Number.isFinite(n) || n <= 0) return 0;
    return n <= 40 ? n * 250 : n;
  }

  function weightValue(row) {
    const n = Number(row && (row.weight_kg != null ? row.weight_kg : row.weight));
    return Number.isFinite(n) ? n : null;
  }

  function weekRows(rows, week, dateGetter) {
    return (rows || []).filter(row => {
      const key = dateGetter(row);
      return key && isDateInWeek(key, week);
    });
  }

  function calculateGoal(goal, data, week) {
    const target = Number(goal.target || 1);
    let current = 0;
    let helper = '';
    let precision = 0;

    switch (goal.id) {
      case 'complete_workouts':
        current = countDistinctDates(data.workouts, row => row.workout_date && isDateInWeek(row.workout_date, week) ? row.workout_date : null);
        break;
      case 'build_workouts':
        current = weekRows(data.customWorkouts, week, createdDateKey).length;
        break;
      case 'protein_days':
        current = weekRows(data.nutrition, week, row => row.nutrition_date)
          .filter(row => Number(row.protein_goal_g || 0) > 0 && Number(row.total_protein_g || 0) >= Number(row.protein_goal_g || 0) * 0.9).length;
        break;
      case 'calorie_range_days':
        current = weekRows(data.nutrition, week, row => row.nutrition_date)
          .filter(row => {
            const goalCals = Number(row.calorie_goal || 0);
            const actual = Number(row.total_calories || 0);
            return goalCals > 0 && actual > 0 && Math.abs(actual - goalCals) <= goalCals * 0.2;
          }).length;
        break;
      case 'meal_log_days':
        current = weekRows(data.nutrition, week, row => row.nutrition_date)
          .filter(row => Number(row.meal_count || 0) > 0 || Number(row.total_calories || 0) > 0).length;
        break;
      case 'weight_loss':
      case 'weight_gain': {
        precision = 1;
        const rows = weekRows(data.weighIns, week, row => row.weigh_in_date).filter(row => weightValue(row) != null);
        if (rows.length >= 2) {
          const first = weightValue(rows[0]);
          const latest = weightValue(rows[rows.length - 1]);
          current = goal.id === 'weight_loss'
            ? Math.max(0, first - latest)
            : Math.max(0, latest - first);
        } else {
          helper = 'Log at least 2 weigh-ins to show the trend.';
        }
        break;
      }
      case 'weigh_in_days':
        current = countDistinctDates(data.weighIns, row => row.weigh_in_date && isDateInWeek(row.weigh_in_date, week) ? row.weigh_in_date : null);
        break;
      case 'sleep_7h_nights': {
        const sleepByDate = {};
        [
          mergeDailyMax(data.whoopSleep, 'date', 'duration_minutes', week),
          mergeDailyMax(data.ouraSleep, 'date', 'total_sleep_minutes', week),
          mergeDailyMax(data.fitbitSleep, 'date', 'duration_minutes', week)
        ].forEach(map => {
          Object.keys(map).forEach(date => {
            sleepByDate[date] = Math.max(sleepByDate[date] || 0, Number(map[date] || 0));
          });
        });
        current = Object.values(sleepByDate).filter(mins => Number(mins) >= 420).length;
        break;
      }
      case 'steps_10k_days': {
        const byDate = {};
        [data.ouraActivity, data.fitbitActivity].forEach(rows => {
          (rows || []).forEach(row => {
            if (!row.date || !isDateInWeek(row.date, week)) return;
            byDate[row.date] = Math.max(byDate[row.date] || 0, Number(row.steps || 0));
          });
        });
        current = Object.values(byDate).filter(steps => Number(steps) >= 10000).length;
        break;
      }
      case 'water_goal_days': {
        const goalMl = getWaterGoalMl();
        current = weekRows(data.checkins, week, row => row.checkin_date)
          .filter(row => normalizeWaterMl(row.water_intake) >= goalMl).length;
        break;
      }
      case 'mood_checkin_days':
        current = countDistinctDates(data.moodLogs, row => row.log_date && isDateInWeek(row.log_date, week) ? row.log_date : null);
        break;
      case 'daily_quiz_days':
        current = weekRows(data.milestones, week, row => row.achieved_at ? getDateKey(new Date(row.achieved_at)) : null)
          .filter(row => row.milestone_type === 'daily_quiz').length;
        break;
      case 'questions_answered':
        current = weekRows(data.lessons, week, row => row.completed_at ? getDateKey(new Date(row.completed_at)) : null)
          .reduce((sum, row) => sum + Number(row.games_played || 0), 0);
        break;
      case 'perfect_lessons':
        current = weekRows(data.lessons, week, row => row.completed_at ? getDateKey(new Date(row.completed_at)) : null)
          .filter(row => Number(row.score_percentage || 0) >= 100).length;
        break;
      case 'share_workout_feed':
        current = weekRows(data.stories, week, createdDateKey)
          .filter(row => row.media_type === 'workout_card').length;
        break;
      case 'share_meal_feed':
        current = weekRows(data.stories, week, createdDateKey)
          .filter(row => row.media_type === 'nutrition_card' || row.media_type === 'meal_card').length;
        break;
      case 'message_coach':
        current = weekRows(data.coachMessages, week, createdDateKey).length;
        break;
      case 'invite_friend':
        current = weekRows(data.referrals, week, createdDateKey).length;
        break;
      case 'complete_game':
        current = completionStatuses(weekRows(data.gameMatches, week, createdDateKey)).length
          + completionStatuses(weekRows(data.quizBattles, week, createdDateKey)).length;
        break;
      default:
        current = 0;
    }

    const complete = current >= target;
    const percent = Math.max(0, Math.min(100, target > 0 ? (current / target) * 100 : 0));
    return Object.assign({}, goal, {
      current: precision ? Math.round(current * 10) / 10 : Math.floor(current),
      target,
      percent,
      complete,
      helper
    });
  }

  function buildArcSnapshot(data, week) {
    const arcNutrition = (data.nutrition || []).filter(row => row.nutrition_date >= week.arcStart && row.nutrition_date < week.endExclusive);
    const proteinDays = arcNutrition.filter(row => Number(row.protein_goal_g || 0) > 0 && Number(row.total_protein_g || 0) >= Number(row.protein_goal_g || 0) * 0.9).length;
    const mealDays = arcNutrition.filter(row => Number(row.meal_count || 0) > 0 || Number(row.total_calories || 0) > 0).length;
    const workoutDays = countDistinctDates(data.workouts, row => row.workout_date && row.workout_date >= week.arcStart && row.workout_date < week.endExclusive ? row.workout_date : null);
    const feedPosts = (data.stories || []).filter(row => row.created_at && getDateKey(new Date(row.created_at)) >= week.arcStart).length;
    const questions = (data.lessons || []).reduce((sum, row) => sum + Number(row.games_played || 0), 0);

    const weights = (data.weighIns || []).filter(row => weightValue(row) != null);
    let weightChange = null;
    if (weights.length >= 2) {
      weightChange = Math.round((weightValue(weights[weights.length - 1]) - weightValue(weights[0])) * 10) / 10;
    }

    let headline = 'Keep stacking weeks to reveal your trend.';
    if (weightChange != null && Math.abs(weightChange) >= 0.2) {
      const sign = weightChange > 0 ? '+' : '';
      headline = '4-week body trend: ' + sign + weightChange + ' kg';
    } else if (workoutDays > 0) {
      headline = '4-week consistency: ' + workoutDays + ' workout day' + (workoutDays === 1 ? '' : 's');
    } else if (proteinDays > 0) {
      headline = '4-week protein rhythm: ' + proteinDays + ' day' + (proteinDays === 1 ? '' : 's');
    } else if (questions > 0) {
      headline = '4-week Health IQ: ' + questions + ' question' + (questions === 1 ? '' : 's');
    }

    return {
      headline,
      weight_change_kg: weightChange,
      workout_days: workoutDays,
      protein_days: proteinDays,
      meal_days: mealDays,
      feed_posts: feedPosts,
      questions_answered: questions
    };
  }

  async function calculateProgress(userId, week, selected) {
    const data = await loadProgressData(userId, week);
    const goals = selected.map(goal => calculateGoal(goal, data, week));
    const completed = goals.filter(goal => goal.complete).length;
    const arc = buildArcSnapshot(data, week);
    return {
      progress: {
        week_start: week.start,
        week_end: week.end,
        updated_at: new Date().toISOString(),
        completed_count: completed,
        total_count: selected.length,
        completion_rate: selected.length ? Math.round((completed / selected.length) * 100) : 0,
        goals
      },
      arc
    };
  }

  function renderProgressRows(goals) {
    return (goals || []).map(goal => {
      const meta = getCategoryMeta(goal.category);
      const current = formatTarget(goal.current);
      const target = formatTarget(goal.target);
      const muted = goal.helper ? '<div style="font-size:0.7rem;color:#64748b;margin-top:4px;font-weight:700;">' + escapeHtml(goal.helper) + '</div>' : '';
      return `
        <div style="padding:11px 12px;margin-top:8px;border:1px solid rgba(255,255,255,0.13);background:rgba(255,255,255,0.92);border-radius:14px;box-shadow:0 8px 18px rgba(15,23,42,0.08);">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:8px;">
            <div style="min-width:0;display:flex;gap:9px;align-items:flex-start;">
              <div style="width:30px;height:30px;border-radius:10px;background:${meta.gradient};color:white;font-size:0.72rem;font-weight:950;display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 8px 18px ${meta.border};">${escapeHtml(meta.short)}</div>
              <div style="min-width:0;">
                <div style="font-size:0.84rem;font-weight:900;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(goal.label)}</div>
                <div style="font-size:0.68rem;color:${meta.accent};font-weight:800;text-transform:uppercase;letter-spacing:0.04em;">${escapeHtml(goal.category)}</div>
                ${muted}
              </div>
            </div>
            <div style="font-size:0.82rem;font-weight:900;color:${goal.complete ? '#047857' : '#334155'};white-space:nowrap;">${escapeHtml(current)} / ${escapeHtml(target)}</div>
          </div>
          <div style="height:8px;background:#e2e8f0;border-radius:999px;overflow:hidden;">
            <div style="height:100%;width:${Math.round(goal.percent)}%;background:${goal.complete ? 'linear-gradient(90deg,#059669,#22c55e)' : meta.gradient};border-radius:999px;transition:width 0.35s ease;"></div>
          </div>
        </div>
      `;
    }).join('');
  }

  function renderCard() {
    const card = document.getElementById('weekly-goals-card');
    if (!card) return;

    card.style.display = 'block';
    card.style.background = 'radial-gradient(circle at 88% 14%, rgba(251,191,36,0.24) 0 38px, transparent 39px), radial-gradient(circle at 17% 92%, rgba(226,232,240,0.18) 0 44px, transparent 45px), linear-gradient(135deg,#24113f 0%,#3b1b66 48%,#160f2d 100%)';
    card.style.border = '1px solid rgba(255,255,255,0.16)';
    card.style.boxShadow = '0 16px 36px rgba(32,12,62,0.28)';
    if (state.loading) {
      card.innerHTML = '<div style="padding:18px 20px;font-weight:800;color:#0f172a;">Loading weekly goals...</div>';
      return;
    }

    if (!state.selected.length) {
      card.innerHTML = `
        <div style="padding:18px 20px;display:flex;gap:14px;align-items:center;position:relative;overflow:hidden;">
          <div style="position:absolute;right:14px;top:14px;width:62px;height:62px;border-radius:999px;background:#f8c55a;box-shadow:0 0 28px rgba(248,197,90,0.36);opacity:.9;"></div>
          <div style="position:absolute;right:32px;top:5px;width:54px;height:54px;border-radius:999px;background:#3b1b66;"></div>
          <div style="position:absolute;left:16px;bottom:-46px;width:96px;height:96px;border-radius:999px;border:1px solid rgba(255,255,255,0.14);"></div>
          <div style="width:52px;height:52px;border-radius:16px;background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.18);display:flex;align-items:center;justify-content:center;color:#fde68a;font-weight:950;font-size:1.18rem;flex-shrink:0;box-shadow:0 10px 24px rgba(15,23,42,0.22);position:relative;">3</div>
          <div style="flex:1;min-width:0;">
            <div style="font-size:0.68rem;color:#fde68a;text-transform:uppercase;letter-spacing:0.08em;font-weight:900;margin-bottom:3px;">Weekly goals</div>
            <div style="font-size:1.08rem;color:white;font-weight:900;line-height:1.18;">Choose your 3 for the week</div>
            <div style="font-size:0.8rem;color:rgba(255,255,255,0.74);margin-top:4px;">Body, training, food, recovery, Health IQ, or community.</div>
          </div>
          <button type="button" onclick="openWeeklyGoalsModal()" style="border:1px solid rgba(255,255,255,0.22);background:white;color:#24113f;font-size:0.78rem;font-weight:900;padding:10px 14px;border-radius:12px;cursor:pointer;box-shadow:0 10px 22px rgba(15,23,42,0.22);position:relative;">Set</button>
        </div>
      `;
      return;
    }

    const progress = state.progress || { goals: [], completed_count: 0, total_count: state.selected.length };
    const isFutureWeek = state.week && state.week.start > getDateKey(new Date());
    const title = isFutureWeek ? 'Next week is set' : 'This week';
    const completed = progress.completed_count || 0;
    const total = progress.total_count || state.selected.length;
    const arcLine = state.arc && state.arc.headline ? state.arc.headline : 'Your longer arc will build here.';
    const selectedChips = state.selected.map(goal => {
      const meta = getCategoryMeta(goal.category);
      return '<span style="display:inline-flex;align-items:center;gap:5px;padding:6px 8px;border-radius:999px;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.18);color:#fef3c7;font-size:0.68rem;font-weight:900;">' + escapeHtml(meta.short) + ' ' + escapeHtml(formatTarget(goal.target)) + ' ' + escapeHtml(goal.unit) + '</span>';
    }).join('');

    card.innerHTML = `
      <div style="padding:17px 20px 15px;position:relative;overflow:hidden;">
        <div style="position:absolute;right:18px;top:16px;width:64px;height:64px;border-radius:999px;background:#f8c55a;box-shadow:0 0 30px rgba(248,197,90,0.34);opacity:.88;"></div>
        <div style="position:absolute;right:36px;top:7px;width:56px;height:56px;border-radius:999px;background:#3b1b66;"></div>
        <div style="position:absolute;left:-36px;bottom:-54px;width:128px;height:128px;border-radius:999px;border:1px solid rgba(255,255,255,0.13);"></div>
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:14px;margin-bottom:8px;">
          <div style="min-width:0;position:relative;">
            <div style="font-size:0.68rem;color:#fde68a;text-transform:uppercase;letter-spacing:0.08em;font-weight:900;margin-bottom:3px;">Weekly goals</div>
            <div style="font-size:1.08rem;color:white;font-weight:900;">${escapeHtml(title)}</div>
            <div style="font-size:0.78rem;color:rgba(255,255,255,0.72);margin-top:3px;">${escapeHtml(state.week.start)} to ${escapeHtml(state.week.end)}</div>
          </div>
          <button type="button" onclick="openWeeklyGoalsModal()" style="border:1px solid rgba(255,255,255,0.2);background:white;color:#24113f;font-size:0.75rem;font-weight:900;padding:8px 10px;border-radius:10px;cursor:pointer;position:relative;">Edit</button>
        </div>
        <div style="display:flex;align-items:baseline;gap:7px;margin:10px 0 6px;position:relative;">
          <div style="font-size:2.15rem;line-height:1;font-weight:950;color:white;">${completed}</div>
          <div style="font-size:0.95rem;font-weight:800;color:rgba(255,255,255,0.72);">of ${total} hit</div>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin:0 0 5px;position:relative;">${selectedChips}</div>
        ${renderProgressRows(progress.goals)}
        <div style="margin-top:12px;padding:11px 12px;border-radius:12px;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.16);font-size:0.78rem;color:rgba(255,255,255,0.82);font-weight:800;position:relative;">
          ${escapeHtml(arcLine)}
        </div>
      </div>
    `;
  }

  function renderTargetSelector(goal) {
    const def = GOAL_BY_ID[goal.id];
    if (!def) return '';
    const rangeCount = Math.floor((def.max - def.min) / def.step) + 1;
    if (def.step === 1 && rangeCount <= 7) {
      const chips = [];
      for (let value = def.min; value <= def.max; value += def.step) {
        const selected = Number(goal.target) === value;
        chips.push(`
          <button type="button" class="weekly-goal-target-chip ${selected ? 'selected' : ''}" onclick="setWeeklyGoalTarget('${goal.id}', ${value})">
            ${escapeHtml(value)}
          </button>
        `);
      }
      return `
        <div class="weekly-goal-chip-wrap">
          ${chips.join('')}
          <span>${escapeHtml(goal.unit)}</span>
        </div>
      `;
    }

    return `
      <div class="weekly-goal-stepper">
        <button type="button" onclick="adjustWeeklyGoalTarget('${goal.id}', -1)">-</button>
        <input type="number" min="${def.min}" max="${def.max}" step="${def.step}" value="${escapeHtml(goal.target)}" onchange="changeWeeklyGoalTarget('${goal.id}', this)" oninput="changeWeeklyGoalTarget('${goal.id}', this)">
        <button type="button" onclick="adjustWeeklyGoalTarget('${goal.id}', 1)">+</button>
        <span>${escapeHtml(goal.unit)}</span>
      </div>
    `;
  }

  function ensureModal() {
    if (document.getElementById('weekly-goals-modal')) return;
    const modal = document.createElement('div');
    modal.id = 'weekly-goals-modal';
    modal.style.cssText = 'display:none;position:fixed;inset:0;z-index:10020;background:rgba(20,12,38,0.74);align-items:flex-end;justify-content:center;backdrop-filter:blur(4px);';
    modal.onclick = function(event) {
      if (event.target === modal) closeWeeklyGoalsModal();
    };
    document.body.appendChild(modal);

    const style = document.createElement('style');
    style.textContent = `
      .weekly-goal-sheet{background:linear-gradient(180deg,#2a1648 0%,#19102d 100%);width:100%;max-width:560px;max-height:88vh;overflow:auto;border-radius:24px 24px 0 0;box-shadow:0 -22px 56px rgba(18,8,34,0.42);font-family:inherit;}
      .weekly-goal-hero{position:sticky;top:0;z-index:2;padding:18px 20px 15px;border-bottom:1px solid rgba(255,255,255,.12);background:linear-gradient(135deg,#321a55 0%,#211039 56%,#120b24 100%);overflow:hidden;}
      .weekly-goal-hero:before{content:"";position:absolute;right:58px;top:15px;width:72px;height:72px;border-radius:999px;background:#f8c55a;box-shadow:0 0 34px rgba(248,197,90,.35);opacity:.95;}
      .weekly-goal-hero:after{content:"";position:absolute;right:77px;top:6px;width:62px;height:62px;border-radius:999px;background:#321a55;}
      .weekly-goal-choice{border:1px solid rgba(15,23,42,.08);background:rgba(255,255,255,.96);color:#0f172a;border-radius:14px;padding:11px 12px;text-align:left;font-family:inherit;cursor:pointer;min-height:70px;display:flex;flex-direction:column;justify-content:space-between;gap:7px;transition:all .16s ease;box-shadow:0 8px 18px rgba(26,11,50,.08);}
      .weekly-goal-choice strong{font-size:.84rem;line-height:1.2;font-weight:950;}
      .weekly-goal-choice span{font-size:.7rem;color:#475569;font-weight:800;}
      .weekly-goal-choice .weekly-goal-choice-bottom{display:flex;align-items:center;justify-content:space-between;gap:8px;}
      .weekly-goal-choice .weekly-goal-choice-pill{background:var(--goal-soft);border:1px solid var(--goal-border);color:var(--goal-accent);border-radius:999px;padding:4px 7px;font-size:.66rem;font-weight:950;white-space:nowrap;}
      .weekly-goal-choice.selected{border-color:var(--goal-accent);background:var(--goal-soft);box-shadow:0 0 0 2px rgba(15,23,42,.05) inset,0 10px 22px rgba(15,23,42,.08);}
      .weekly-goal-choice.selected .weekly-goal-choice-pill{background:#fff;}
      .weekly-goal-category{margin-top:14px;padding:13px;border-radius:18px;background:rgba(255,255,255,.92);border:1px solid rgba(255,255,255,.22);box-shadow:0 12px 26px rgba(18,8,34,.18);}
      .weekly-goal-category-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:9px;}
      .weekly-goal-category-title{display:flex;align-items:center;gap:8px;font-weight:950;color:#0f172a;font-size:.94rem;}
      .weekly-goal-category-badge{width:28px;height:28px;border-radius:10px;background:var(--goal-gradient);color:#fff;display:flex;align-items:center;justify-content:center;font-size:.68rem;font-weight:950;box-shadow:0 8px 16px var(--goal-border);}
      .weekly-goal-selected-row{display:flex;align-items:center;gap:10px;padding:11px 0;border-top:1px solid rgba(15,23,42,.08);}
      .weekly-goal-selected-row:first-of-type{border-top:0;}
      .weekly-goal-selected-badge{width:34px;height:34px;border-radius:12px;background:var(--goal-gradient);color:white;display:flex;align-items:center;justify-content:center;font-size:.72rem;font-weight:950;box-shadow:0 8px 16px var(--goal-border);flex-shrink:0;}
      .weekly-goal-chip-wrap{display:flex;align-items:center;justify-content:flex-end;gap:5px;flex-wrap:wrap;max-width:210px;}
      .weekly-goal-chip-wrap span,.weekly-goal-stepper span{font-size:.68rem;color:#64748b;font-weight:900;margin-left:2px;}
      .weekly-goal-target-chip{min-width:31px;height:31px;border-radius:10px;border:1px solid #cbd5e1;background:#fff;color:#334155;font-size:.82rem;font-weight:950;cursor:pointer;}
      .weekly-goal-target-chip.selected{border-color:var(--goal-accent);background:var(--goal-gradient);color:#fff;box-shadow:0 8px 16px var(--goal-border);}
      .weekly-goal-stepper{display:flex;align-items:center;justify-content:flex-end;gap:5px;flex-wrap:nowrap;}
      .weekly-goal-stepper button{width:31px;height:31px;border-radius:10px;border:1px solid var(--goal-border);background:var(--goal-soft);color:var(--goal-accent);font-size:1rem;font-weight:950;cursor:pointer;}
      .weekly-goal-stepper input{width:64px;border:1px solid #cbd5e1;border-radius:10px;padding:7px 8px;font-size:.88rem;font-weight:900;color:#0f172a;text-align:center;}
      @media (max-width:420px){
        .weekly-goal-selected-row{align-items:flex-start;flex-wrap:wrap;}
        .weekly-goal-chip-wrap,.weekly-goal-stepper{width:100%;max-width:none;justify-content:flex-start;padding-left:44px;}
      }
    `;
    document.head.appendChild(style);
  }

  function renderModal() {
    ensureModal();
    const modal = document.getElementById('weekly-goals-modal');
    if (!modal) return;
    const selectedIds = new Set(state.draftSelected.map(goal => goal.id));
    const groupHtml = GOAL_CATALOG.map(group => {
      const metaStyle = styleVarsForMeta(group);
      const goals = group.goals.map(goal => {
        const selected = selectedIds.has(goal.id);
        return `
          <button type="button" class="weekly-goal-choice ${selected ? 'selected' : ''}" style="${metaStyle}" onclick="toggleWeeklyGoalChoice('${goal.id}')">
            <strong>${escapeHtml(goal.label)}</strong>
            <div class="weekly-goal-choice-bottom">
              <span>${escapeHtml(goalChoiceHint(goal, selected))}</span>
              <span class="weekly-goal-choice-pill">${selected ? 'Picked' : 'Choose'}</span>
            </div>
          </button>
        `;
      }).join('');
      return `
        <div class="weekly-goal-category" style="${metaStyle}">
          <div class="weekly-goal-category-head">
            <div class="weekly-goal-category-title">
              <div class="weekly-goal-category-badge">${escapeHtml(group.short)}</div>
              <div>${escapeHtml(group.category)}</div>
            </div>
            <div style="font-size:.68rem;color:#475569;font-weight:800;text-align:right;">${escapeHtml(group.blurb)}</div>
          </div>
          <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;">${goals}</div>
        </div>
      `;
    }).join('');

    const selectedHtml = state.draftSelected.length
      ? state.draftSelected.map(goal => {
        const meta = getCategoryMeta(goal.category);
        return `
          <div class="weekly-goal-selected-row" style="${styleVarsForMeta(meta)}">
            <div class="weekly-goal-selected-badge">${escapeHtml(meta.short)}</div>
            <div style="flex:1;min-width:0;">
              <div style="font-size:.82rem;font-weight:900;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(goal.label)}</div>
              <div style="font-size:.68rem;color:${meta.accent};font-weight:900;">${escapeHtml(goal.category)}</div>
            </div>
            ${renderTargetSelector(goal)}
          </div>
        `;
      }).join('')
      : '<div style="font-size:.82rem;color:#64748b;font-weight:800;padding:12px 0;">Pick up to 3 goals. Nothing is mandatory.</div>';

    modal.innerHTML = `
      <div class="weekly-goal-sheet" onclick="event.stopPropagation()">
        <div class="weekly-goal-hero">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;position:relative;">
            <div>
              <div style="font-size:.68rem;letter-spacing:.08em;text-transform:uppercase;font-weight:900;color:#fde68a;">Weekly goals</div>
              <div style="font-size:1.25rem;font-weight:950;color:white;margin-top:2px;">Choose 3 for ${escapeHtml(state.week ? state.week.start : 'this week')}</div>
            </div>
            <button type="button" onclick="closeWeeklyGoalsModal()" style="width:38px;height:38px;border:none;border-radius:50%;background:white;color:#0f172a;font-size:1.4rem;line-height:1;cursor:pointer;box-shadow:0 8px 18px rgba(15,23,42,.08);">&times;</button>
          </div>
        </div>
        <div style="padding:16px 20px 92px;">
          <div style="padding:12px 14px;border-radius:16px;background:linear-gradient(135deg,#ffffff,#f8fafc);border:1px solid rgba(15,23,42,.08);box-shadow:0 8px 22px rgba(15,23,42,.05);">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:4px;">
              <div>
                <div style="font-weight:900;color:#0f172a;font-size:.88rem;">Selected</div>
                <div style="font-size:.68rem;color:#64748b;font-weight:800;margin-top:2px;">Set the amount that feels right for your week.</div>
              </div>
              <div style="font-size:.75rem;font-weight:900;color:${state.draftSelected.length === MAX_GOALS ? '#047857' : '#64748b'};">${state.draftSelected.length} / ${MAX_GOALS}</div>
            </div>
            ${selectedHtml}
          </div>
          ${groupHtml}
        </div>
        <div style="position:sticky;bottom:0;background:white;border-top:1px solid #e2e8f0;padding:13px 20px calc(13px + env(safe-area-inset-bottom));display:flex;gap:10px;">
          <button type="button" onclick="closeWeeklyGoalsModal()" style="flex:0 0 auto;border:1px solid #cbd5e1;background:white;color:#0f172a;border-radius:12px;padding:12px 14px;font-weight:900;cursor:pointer;">Cancel</button>
          <button type="button" onclick="saveWeeklyGoalsFromModal()" ${state.draftSelected.length ? '' : 'disabled'} style="flex:1;border:none;background:${state.draftSelected.length ? 'linear-gradient(135deg,#321a55,#4a2575 56%,#d8b25e)' : '#cbd5e1'};color:white;border-radius:12px;padding:12px 16px;font-weight:950;cursor:${state.draftSelected.length ? 'pointer' : 'not-allowed'};">Save goals</button>
        </div>
      </div>
    `;
  }

  window.openWeeklyGoalsModal = function() {
    state.draftSelected = state.selected.map(goal => Object.assign({}, goal));
    renderModal();
    const modal = document.getElementById('weekly-goals-modal');
    if (modal) modal.style.display = 'flex';
  };

  window.closeWeeklyGoalsModal = function() {
    const modal = document.getElementById('weekly-goals-modal');
    if (modal) modal.style.display = 'none';
  };

  window.toggleWeeklyGoalChoice = function(goalId) {
    const existing = state.draftSelected.find(goal => goal.id === goalId);
    if (existing) {
      state.draftSelected = state.draftSelected.filter(goal => goal.id !== goalId);
    } else {
      if (state.draftSelected.length >= MAX_GOALS) {
        showToastSafe('Choose up to 3 weekly goals.', 'info');
        return;
      }
      const def = GOAL_BY_ID[goalId];
      if (def) state.draftSelected.push(normalizeGoal(def));
    }
    renderModal();
  };

  function setDraftGoalTarget(goalId, value) {
    const index = state.draftSelected.findIndex(goal => goal.id === goalId);
    if (index === -1) return null;
    const def = GOAL_BY_ID[goalId];
    value = Number(value);
    if (!Number.isFinite(value)) value = def.target;
    value = Math.min(def.max, Math.max(def.min, value));
    const rounded = def.step >= 1 ? Math.round(value) : Math.round(value * 10) / 10;
    state.draftSelected[index].target = rounded;
    return rounded;
  }

  window.setWeeklyGoalTarget = function(goalId, value) {
    setDraftGoalTarget(goalId, value);
    renderModal();
  };

  window.adjustWeeklyGoalTarget = function(goalId, direction) {
    const goal = state.draftSelected.find(item => item.id === goalId);
    const def = GOAL_BY_ID[goalId];
    if (!goal || !def) return;
    setDraftGoalTarget(goalId, Number(goal.target) + (Number(direction) || 0) * def.step);
    renderModal();
  };

  window.changeWeeklyGoalTarget = function(goalId, input) {
    const next = setDraftGoalTarget(goalId, input && input.value);
    if (input && next != null) input.value = next;
  };

  window.saveWeeklyGoalsFromModal = async function() {
    if (!window.currentUser || !state.week) return;
    const selected = normalizeSelected(state.draftSelected);
    if (!selected.length) return;

    state.selected = selected;
    state.loading = true;
    renderCard();
    closeWeeklyGoalsModal();

    const result = await calculateProgress(window.currentUser.id, state.week, selected);
    state.progress = result.progress;
    state.arc = result.arc;
    state.row = await saveWeeklyRow(window.currentUser.id, state.week, selected, result.progress, result.arc);
    state.loading = false;
    renderCard();
    showToastSafe('Weekly goals saved.', 'success');
  };

  async function loadAndRender() {
    const card = document.getElementById('weekly-goals-card');
    if (!card || !window.currentUser || !window.currentUser.id) return;
    if (state.loading) return;

    state.loading = true;
    state.week = getPlanningWeek(new Date());
    renderCard();

    state.row = await fetchWeeklyRow(window.currentUser.id, state.week.start);
    state.selected = normalizeSelected(state.row && state.row.selected_goals);

    if (state.selected.length) {
      const result = await calculateProgress(window.currentUser.id, state.week, state.selected);
      state.progress = result.progress;
      state.arc = result.arc;
      state.row = await saveWeeklyRow(window.currentUser.id, state.week, state.selected, result.progress, result.arc);
    } else {
      state.progress = null;
      state.arc = null;
    }

    state.loading = false;
    renderCard();
  }

  function init() {
    ensureModal();
    loadAndRender();
  }

  window.refreshWeeklyGoalsCard = loadAndRender;
  window.weeklyGoals = {
    refresh: loadAndRender,
    getCatalog: function(){ return GOAL_CATALOG; },
    getState: function(){ return state; }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
  document.addEventListener('pbbInitComplete', loadAndRender);
  document.addEventListener('appCriticalContentReady', loadAndRender);
  document.addEventListener('visibilitychange', function(){
    if (!document.hidden) loadAndRender();
  });
})();
