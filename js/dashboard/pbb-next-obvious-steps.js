(function(){
  'use strict';

  if (window.__pbbNextObviousStepsLoaded) {
    if (window.pbbNextSteps && typeof window.pbbNextSteps.refresh === 'function') {
      setTimeout(window.pbbNextSteps.refresh, 0);
    }
    return;
  }
  window.__pbbNextObviousStepsLoaded = true;

  var PREVIEW_STORAGE_KEY = 'pbb_next_steps_preview';
  var SHOW_ALL_STORAGE_KEY = 'pbb_next_steps_show_all';
  var COMPLETION_XP = 10;
  var SHANNON_EMAILS = [
    'shannonbirch@cocospersonaltraining.com',
    'shannonrhysbirch@gmail.com'
  ];
  var renderTimer = null;
  var dailyState = {
    date: null,
    loaded: false,
    loading: false,
    awarding: false,
    awarded: false,
    status: {}
  };

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function normalizeEmail(value) {
    return String(value || '').trim().toLowerCase();
  }

  function isPreviewOverrideEnabled() {
    try {
      var params = new URLSearchParams(window.location.search || '');
      if (params.get('next_steps_preview') === '1') return true;
    } catch (_) {}
    try {
      var stored = String(localStorage.getItem(PREVIEW_STORAGE_KEY) || '').toLowerCase();
      return stored === '1' || stored === 'true' || stored === 'yes';
    } catch (_) {
      return false;
    }
  }

  function isShowAllEnabled() {
    try {
      var params = new URLSearchParams(window.location.search || '');
      if (params.get('next_steps_all') === '1') return true;
    } catch (_) {}
    try {
      var stored = String(localStorage.getItem(SHOW_ALL_STORAGE_KEY) || '').toLowerCase();
      return stored === '1' || stored === 'true' || stored === 'yes';
    } catch (_) {
      return false;
    }
  }

  function isPreviewEligible() {
    if (isPreviewOverrideEnabled()) return true;
    if (window.isAdminViewing) return false;
    var email = normalizeEmail(window.currentUser && window.currentUser.email);
    if (!email) return false;
    try {
      if (typeof window.isBalanceAdminEmail === 'function' && window.isBalanceAdminEmail(email)) return true;
    } catch (_) {}
    return SHANNON_EMAILS.indexOf(email) !== -1;
  }

  function todayKey(date) {
    try {
      if (typeof window.getLocalDateString === 'function') return window.getLocalDateString(date || new Date());
    } catch (_) {}
    var d = date ? new Date(date) : new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function localDayRange(dateKey) {
    var start = new Date(dateKey + 'T00:00:00');
    var end = new Date(start.getTime());
    end.setDate(end.getDate() + 1);
    return { startIso: start.toISOString(), endIso: end.toISOString() };
  }

  function yesterdayKey() {
    var d = new Date();
    d.setDate(d.getDate() - 1);
    return todayKey(d);
  }

  function getWaterGoalMl() {
    try {
      var raw = localStorage.getItem('pbb_water_goal_ml');
      var parsed = Number(raw);
      if (Number.isFinite(parsed) && parsed > 0) return parsed;
    } catch (_) {}
    return 2000;
  }

  function normalizeWaterMl(value) {
    var n = Number(value || 0);
    if (!Number.isFinite(n) || n <= 0) return 0;
    return n <= 40 ? n * 250 : n;
  }

  function getMoodTimeWindow() {
    var hour = new Date().getHours();
    if (hour >= 4 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 18) return 'afternoon';
    if (hour >= 18 || hour < 4) return 'evening';
    return null;
  }

  function readMoodLocalStatus(dateKey) {
    try {
      var raw = localStorage.getItem('moodCheckin_' + dateKey);
      return raw ? JSON.parse(raw) : {};
    } catch (_) {
      return {};
    }
  }

  function localAwardKey(userId, dateKey) {
    return 'pbb_next_steps_complete_xp:' + userId + ':' + dateKey;
  }

  function isVisibleSelector(selector) {
    var el = null;
    try { el = document.querySelector(selector); } catch (_) {}
    if (!el) return false;
    var style = window.getComputedStyle ? window.getComputedStyle(el) : null;
    return style ? style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0' : el.style.display !== 'none';
  }

  function scrollToSelector(selector, options) {
    options = options || {};
    var el = null;
    try { el = document.querySelector(selector); } catch (_) {}
    if (!el) return false;
    try {
      el.scrollIntoView({ behavior: options.instant ? 'auto' : 'smooth', block: options.block || 'center' });
    } catch (_) {
      el.scrollIntoView();
    }
    if (options.focusSelector) {
      setTimeout(function(){
        try {
          var focusEl = document.querySelector(options.focusSelector);
          if (focusEl && typeof focusEl.focus === 'function') focusEl.focus();
        } catch (_) {}
      }, 350);
    }
    return true;
  }

  function navButton(tabName) {
    var needle = "switchAppTab('" + tabName + "'";
    var buttons = document.querySelectorAll('.bottom-nav .nav-item');
    for (var i = 0; i < buttons.length; i++) {
      if (String(buttons[i].getAttribute('onclick') || '').indexOf(needle) !== -1) return buttons[i];
    }
    return null;
  }

  function switchTab(tabName) {
    try {
      if (typeof window.switchAppTab === 'function') {
        window.switchAppTab(tabName, navButton(tabName));
        return true;
      }
    } catch (error) {
      console.warn('[next-steps] tab switch failed:', tabName, error);
    }
    return false;
  }

  function afterTab(callback, delay) {
    setTimeout(function(){
      try { callback(); } catch (error) { console.warn('[next-steps] action failed:', error); }
    }, delay || 420);
  }

  function openDashboardTarget(selector, options) {
    switchTab('dashboard');
    afterTab(function(){ scrollToSelector(selector, options); }, 260);
  }

  function openMovementTarget() {
    switchTab('movement-tab');
    afterTab(function(){
      if (!scrollToSelector('#today-workout-card', { block: 'center' })) {
        scrollToSelector('#movement-grid-container,#form-check-quick-card', { block: 'start' });
      }
    }, 620);
  }

  function openNutritionTarget(target) {
    switchTab('meals');
    afterTab(function(){
      try { if (typeof window.switchWeek === 'function') window.switchWeek('calorie-tracker'); } catch (_) {}
      afterTab(function(){
        if (target === 'hydration') {
          scrollToSelector('#hydration-section,#hydration-bar', { block: 'center' });
        } else if (!scrollToSelector('.meal-icon-btn[onclick*="openMealCameraDirect"],.meal-icon-btn[onclick*="openMealTextInput"],#tracker-nutrition-title', { block: 'center' })) {
          scrollToSelector('#view-meals,#meals', { block: 'start' });
        }
      }, 260);
    }, 420);
  }

  function openWeighInTarget() {
    switchTab('dashboard');
    afterTab(function(){
      if (isVisibleSelector('#daily-weigh-in-card')) {
        scrollToSelector('#daily-weigh-in-card', { block: 'center', focusSelector: '#weigh-in-weight-input' });
        return;
      }
      if (typeof window.openWeighInModal === 'function') {
        window.openWeighInModal();
        return;
      }
      scrollToSelector('#daily-weigh-in-done-card,#transformation-hub-card', { block: 'center' });
    }, 260);
  }

  function openCommunityTarget() {
    switchTab('friends');
    afterTab(function(){
      scrollToSelector('#feed-composer-card,#friends-feed-section', { block: 'start' });
    }, 520);
  }

  function openQuizTarget() {
    if (isVisibleSelector('#daily-quiz-card')) {
      openDashboardTarget('#daily-quiz-card', { block: 'center' });
      return;
    }
    switchTab('learning');
  }

  function openInsightsTarget(selector) {
    try {
      if (typeof window.openInsightsView === 'function') {
        window.openInsightsView();
        afterTab(function(){ scrollToSelector(selector || '#view-insights', { block: 'center' }); }, 620);
        return;
      }
    } catch (error) {
      console.warn('[next-steps] insights view failed:', error);
    }
    openDashboardTarget('#fitbit-performance-card,#weekly-goals-card', { block: 'center' });
  }

  function visibleCompleteFallback(actionId) {
    if (actionId === 'weighin') return isVisibleSelector('#daily-weigh-in-done-card');
    if (actionId === 'mood') {
      var dateKey = todayKey();
      var completed = readMoodLocalStatus(dateKey);
      var currentWindow = getMoodTimeWindow();
      return !!(completed.morning && completed.afternoon && completed.evening) || !!(currentWindow && completed[currentWindow]);
    }
    if (actionId === 'quiz') return isVisibleSelector('#daily-quiz-done-card');
    return false;
  }

  function isActionComplete(action) {
    if (!action || !action.id) return false;
    if (visibleCompleteFallback(action.id)) return true;
    return !!(dailyState.status && dailyState.status[action.id]);
  }

  var ACTIONS = [
    {
      id: 'workout',
      title: "Complete today's workout",
      body: 'Training goal: keep the week moving.',
      cta: 'Open Movement',
      accent: '#2563eb',
      goalIds: ['complete_workouts', 'build_workouts', 'share_workout_feed'],
      action: openMovementTarget
    },
    {
      id: 'nutrition',
      title: 'Track your meals',
      body: 'Food goal: log what you eat today.',
      cta: 'Open Nutrition',
      accent: '#16a34a',
      goalIds: ['protein_days', 'calorie_range_days', 'meal_log_days', 'share_meal_feed'],
      action: function(){ openNutritionTarget('meals'); }
    },
    {
      id: 'hydration',
      title: 'Hit your water goal',
      body: 'Recovery goal: update your water today.',
      cta: 'Open Water',
      accent: '#0891b2',
      goalIds: ['water_goal_days'],
      action: function(){ openNutritionTarget('hydration'); }
    },
    {
      id: 'steps',
      title: 'Reach 10k steps',
      body: 'Steps goal: check progress and add a walk if needed.',
      cta: 'Open Steps',
      accent: '#059669',
      goalIds: ['steps_10k_days'],
      action: function(){ openDashboardTarget('#fitbit-performance-card', { block: 'center' }); }
    },
    {
      id: 'weighin',
      title: 'Weigh in for the day',
      body: 'Body goal: keep the trend accurate.',
      cta: 'Open Weigh-In',
      accent: '#e11d48',
      goalIds: ['weight_loss', 'weight_gain', 'weigh_in_days'],
      action: openWeighInTarget
    },
    {
      id: 'mood',
      title: 'Do a mood check-in',
      body: 'Recovery goal: log mood, energy, and stress.',
      cta: 'Open Check-In',
      accent: '#7c3aed',
      goalIds: ['mood_checkin_days'],
      action: function(){ openDashboardTarget('#mood-checkin-card,#mood-checkin-done-card', { block: 'center' }); }
    },
    {
      id: 'sleep',
      title: 'Check your sleep trend',
      body: 'Sleep goal: review the week and protect recovery.',
      cta: 'Open Sleep',
      accent: '#6366f1',
      goalIds: ['sleep_7h_nights'],
      action: function(){ openInsightsTarget('#insights-sleep-container'); }
    },
    {
      id: 'quiz',
      title: 'Complete Daily Quiz',
      body: 'Health IQ goal: learn and bank the XP.',
      cta: 'Open Quiz',
      accent: '#d97706',
      goalIds: ['daily_quiz_days', 'questions_answered', 'perfect_lessons'],
      action: openQuizTarget
    },
    {
      id: 'community',
      title: 'Post in the community',
      body: 'Community goal: share a win or update.',
      cta: 'Open Feed',
      accent: '#0f766e',
      goalIds: ['message_coach', 'invite_friend', 'complete_game'],
      action: openCommunityTarget
    }
  ];

  function getSelectedGoalIds() {
    try {
      if (window.weeklyGoals && typeof window.weeklyGoals.getState === 'function') {
        var state = window.weeklyGoals.getState();
        var selected = state && Array.isArray(state.selected) ? state.selected : [];
        return selected.map(function(goal){ return String(goal && goal.id || ''); }).filter(Boolean);
      }
    } catch (error) {
      console.warn('[next-steps] weekly goal read failed:', error);
    }
    return [];
  }

  function goalMatchedActions(selectedGoalIds) {
    if (!selectedGoalIds || !selectedGoalIds.length) return [];
    return ACTIONS.filter(function(action){ return matchingGoalCount(action, selectedGoalIds) > 0; });
  }

  function completionActionSet(selectedGoalIds) {
    var matched = goalMatchedActions(selectedGoalIds);
    if (matched.length) return matched;
    return ACTIONS.filter(function(action){
      return action.id === 'workout' || action.id === 'nutrition' || action.id === 'weighin';
    });
  }

  function matchingGoalCount(action, selectedGoalIds) {
    var goals = action.goalIds || [];
    var count = 0;
    goals.forEach(function(goalId){
      if (selectedGoalIds.indexOf(goalId) !== -1) count += 1;
    });
    return count;
  }

  function isActionAvailable(action, selectedGoalIds) {
    if (!action || !action.id) return false;
    if (isActionComplete(action)) return false;
    if (action.id === 'mood') {
      return isVisibleSelector('#mood-checkin-card');
    }
    if (action.id === 'quiz') {
      return isVisibleSelector('#daily-quiz-card');
    }
    if (action.id === 'weighin') {
      if (isVisibleSelector('#daily-weigh-in-done-card')) return false;
      return isVisibleSelector('#daily-weigh-in-card') || matchingGoalCount(action, selectedGoalIds) > 0 || selectedGoalIds.length === 0;
    }
    return true;
  }

  function areDailyActionsComplete(selectedGoalIds) {
    if (isShowAllEnabled()) return false;
    var actions = completionActionSet(selectedGoalIds);
    return actions.length > 0 && actions.every(isActionComplete);
  }

  function scoreAction(action, selectedGoalIds) {
    if (!isActionAvailable(action, selectedGoalIds)) return -9999;
    var score = matchingGoalCount(action, selectedGoalIds) * 80;
    if (selectedGoalIds.length === 0) score += action.id === 'workout' ? 30 : action.id === 'nutrition' ? 26 : action.id === 'weighin' ? 22 : 10;
    if (action.id === 'weighin' && isVisibleSelector('#daily-weigh-in-card')) score += 28;
    if (action.id === 'mood' && isVisibleSelector('#mood-checkin-card')) score += 16;
    if (action.id === 'quiz' && isVisibleSelector('#daily-quiz-card')) score += 16;
    return score;
  }

  function pickSuggestions() {
    var selectedGoalIds = getSelectedGoalIds();
    if (isShowAllEnabled()) return ACTIONS.slice();
    if (areDailyActionsComplete(selectedGoalIds)) return [];

    var ranked = ACTIONS.map(function(action, index){
      return {
        action: action,
        score: scoreAction(action, selectedGoalIds),
        index: index
      };
    }).filter(function(item){
      return item.score > -9999;
    }).sort(function(a, b){
      if (b.score !== a.score) return b.score - a.score;
      return a.index - b.index;
    });

    var picked = [];
    ranked.forEach(function(item){
      if (picked.length >= 3) return;
      if (item.score <= 0 && selectedGoalIds.length > 0 && picked.length >= 2) return;
      picked.push(item.action);
    });

    ACTIONS.forEach(function(action){
      if (picked.length >= 3) return;
      if (!isActionAvailable(action, selectedGoalIds)) return;
      if (!picked.some(function(item){ return item.id === action.id; })) picked.push(action);
    });

    return picked.slice(0, 3);
  }

  function hasCompletedDay() {
    return areDailyActionsComplete(getSelectedGoalIds());
  }

  function safeRows(result) {
    return result && Array.isArray(result.data) ? result.data : [];
  }

  async function safeSupabaseQuery(queryFactory) {
    try {
      if (!window.supabaseClient) return [];
      var result = await queryFactory(window.supabaseClient);
      if (result && result.error) return [];
      return safeRows(result);
    } catch (_) {
      return [];
    }
  }

  async function getNativeSteps() {
    try {
      if (!window.NativeHealth || typeof window.NativeHealth.getSummary !== 'function') return 0;
      var ready = !!window._nativeHealthReady;
      if (!ready && typeof window.NativeHealth.checkPermission === 'function') {
        ready = await window.NativeHealth.checkPermission();
      }
      if (!ready) return 0;
      var summary = await window.NativeHealth.getSummary();
      if (summary) window._pbbLastNativeHealthSummary = summary;
      return Math.max(0, Math.round(Number(summary && summary.steps) || 0));
    } catch (_) {
      return 0;
    }
  }

  async function refreshDailyStatus(options) {
    options = options || {};
    if (!window.currentUser || !window.currentUser.id || !window.supabaseClient) return;
    var dateKey = todayKey();
    if (dailyState.date && dailyState.date !== dateKey) {
      dailyState.loaded = false;
      dailyState.awarded = false;
      dailyState.status = {};
    }
    if (!options.force && dailyState.loading) return;
    if (!options.force && dailyState.loaded && dailyState.date === dateKey) return;

    dailyState.loading = true;
    dailyState.date = dateKey;
    var range = localDayRange(dateKey);
    var yKey = yesterdayKey();

    try {
      var userId = window.currentUser.id;
      var results = await Promise.all([
        safeSupabaseQuery(function(supabase){ return supabase.from('workouts').select('id,workout_date,created_at,workout_type').eq('user_id', userId).eq('workout_type', 'history').eq('workout_date', dateKey).limit(1); }),
        safeSupabaseQuery(function(supabase){ return supabase.from('workouts').select('id,created_at,workout_type').eq('user_id', userId).eq('workout_type', 'custom_template').gte('created_at', range.startIso).lt('created_at', range.endIso).limit(1); }),
        safeSupabaseQuery(function(supabase){ return supabase.from('daily_nutrition').select('nutrition_date,total_calories,meal_count').eq('user_id', userId).eq('nutrition_date', dateKey).limit(1); }),
        safeSupabaseQuery(function(supabase){ return supabase.from('meal_logs').select('id,meal_date,meal_type,created_at').eq('user_id', userId).neq('meal_type', 'water').eq('meal_date', dateKey).limit(1); }),
        safeSupabaseQuery(function(supabase){ return supabase.from('daily_checkins').select('checkin_date,water_intake,sleep').eq('user_id', userId).eq('checkin_date', dateKey).limit(1); }),
        safeSupabaseQuery(function(supabase){ return supabase.from('daily_weigh_ins').select('id,weigh_in_date').eq('user_id', userId).eq('weigh_in_date', dateKey).limit(1); }),
        safeSupabaseQuery(function(supabase){ return supabase.from('mood_logs').select('log_date,context').eq('user_id', userId).eq('log_date', dateKey); }),
        safeSupabaseQuery(function(supabase){ return supabase.from('learning_milestones').select('id,milestone_type,achieved_at').eq('user_id', userId).eq('milestone_type', 'daily_quiz').gte('achieved_at', range.startIso).lt('achieved_at', range.endIso).limit(1); }),
        safeSupabaseQuery(function(supabase){ return supabase.from('stories').select('id,media_type,created_at').eq('user_id', userId).gte('created_at', range.startIso).lt('created_at', range.endIso).limit(1); }),
        safeSupabaseQuery(function(supabase){ return supabase.from('fitbit_daily_activity').select('date,steps').eq('user_id', userId).in('date', [dateKey, yKey]); }),
        safeSupabaseQuery(function(supabase){ return supabase.from('oura_daily_activity').select('date,steps').eq('user_id', userId).in('date', [dateKey, yKey]); }),
        safeSupabaseQuery(function(supabase){ return supabase.from('fitbit_sleep').select('date,duration_minutes').eq('user_id', userId).in('date', [dateKey, yKey]); }),
        safeSupabaseQuery(function(supabase){ return supabase.from('oura_sleep').select('date,total_sleep_minutes').eq('user_id', userId).in('date', [dateKey, yKey]); }),
        safeSupabaseQuery(function(supabase){ return supabase.from('whoop_sleep').select('date,duration_minutes').eq('user_id', userId).in('date', [dateKey, yKey]); }),
        getNativeSteps()
      ]);

      var workouts = results[0] || [];
      var customWorkouts = results[1] || [];
      var nutrition = results[2] || [];
      var meals = results[3] || [];
      var checkins = results[4] || [];
      var weighIns = results[5] || [];
      var moodRows = results[6] || [];
      var quizzes = results[7] || [];
      var stories = results[8] || [];
      var fitbitSteps = results[9] || [];
      var ouraSteps = results[10] || [];
      var fitbitSleep = results[11] || [];
      var ouraSleep = results[12] || [];
      var whoopSleep = results[13] || [];
      var nativeSteps = Number(results[14] || 0);

      var checkin = checkins[0] || {};
      var moodCompleted = readMoodLocalStatus(dateKey);
      moodRows.forEach(function(row){
        if (row && row.context) moodCompleted[row.context] = true;
      });
      var currentWindow = getMoodTimeWindow();
      var stepValues = fitbitSteps.concat(ouraSteps).map(function(row){ return Number(row && row.steps || 0); });
      stepValues.push(nativeSteps);
      var bestSteps = Math.max.apply(Math, stepValues.concat([0]));
      var sleepValues = fitbitSleep.map(function(row){ return Number(row && row.duration_minutes || 0); })
        .concat(ouraSleep.map(function(row){ return Number(row && row.total_sleep_minutes || 0); }))
        .concat(whoopSleep.map(function(row){ return Number(row && row.duration_minutes || 0); }));
      var bestSleep = Math.max.apply(Math, sleepValues.concat([0]));

      dailyState.status = {
        workout: workouts.length > 0 || customWorkouts.length > 0,
        nutrition: meals.length > 0 || nutrition.some(function(row){ return Number(row.total_calories || 0) > 0 || Number(row.meal_count || 0) > 0; }),
        hydration: normalizeWaterMl(checkin.water_intake) >= getWaterGoalMl(),
        steps: bestSteps >= 10000,
        weighin: weighIns.length > 0,
        mood: !!(moodCompleted.morning && moodCompleted.afternoon && moodCompleted.evening) || !!(currentWindow && moodCompleted[currentWindow]),
        sleep: bestSleep >= 420,
        quiz: quizzes.length > 0,
        community: stories.length > 0
      };
      dailyState.loaded = true;
    } finally {
      dailyState.loading = false;
      render();
    }
  }

  async function awardCompletionXpIfNeeded() {
    if (isShowAllEnabled()) return;
    if (!hasCompletedDay()) return;
    if (!window.currentUser || !window.currentUser.id || !window.supabaseClient) return;
    if (dailyState.awarding || dailyState.awarded) return;

    var dateKey = todayKey();
    var userId = window.currentUser.id;
    var storageKey = localAwardKey(userId, dateKey);
    try {
      if (localStorage.getItem(storageKey) === '1') {
        dailyState.awarded = true;
        render();
        return;
      }
    } catch (_) {}

    dailyState.awarding = true;
    try {
      var range = localDayRange(dateKey);
      var existing = await safeSupabaseQuery(function(supabase){
        return supabase.from('point_transactions')
          .select('id')
          .eq('user_id', userId)
          .eq('transaction_type', 'next_steps_complete')
          .gte('created_at', range.startIso)
          .lt('created_at', range.endIso)
          .limit(1);
      });
      if (existing.length) {
        dailyState.awarded = true;
        try { localStorage.setItem(storageKey, '1'); } catch (_) {}
        render();
        return;
      }

      var txResult = await window.supabaseClient.from('point_transactions').insert({
        user_id: userId,
        transaction_type: 'next_steps_complete',
        points_amount: COMPLETION_XP,
        reference_type: 'next_steps',
        description: 'Completed all Next Steps for the day'
      });
      if (txResult && txResult.error) throw txResult.error;

      var pointsResult = await window.supabaseClient
        .from('user_points')
        .select('current_points,lifetime_points')
        .eq('user_id', userId)
        .maybeSingle();
      if (pointsResult && pointsResult.error) throw pointsResult.error;
      var current = pointsResult && pointsResult.data;
      if (current) {
        var updateResult = await window.supabaseClient
          .from('user_points')
          .update({
            current_points: Number(current.current_points || 0) + COMPLETION_XP,
            lifetime_points: Number(current.lifetime_points || 0) + COMPLETION_XP,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', userId);
        if (updateResult && updateResult.error) throw updateResult.error;
      } else {
        var insertResult = await window.supabaseClient
          .from('user_points')
          .insert({ user_id: userId, current_points: COMPLETION_XP, lifetime_points: COMPLETION_XP });
        if (insertResult && insertResult.error) throw insertResult.error;
      }

      dailyState.awarded = true;
      try { localStorage.setItem(storageKey, '1'); } catch (_) {}
      if (typeof window.triggerXPBarRainbow === 'function') window.triggerXPBarRainbow();
      if (typeof window.refreshLevelDisplay === 'function') window.refreshLevelDisplay();
      if (typeof window.refreshPointsDisplay === 'function') window.refreshPointsDisplay();
      if (typeof window.showToast === 'function') window.showToast('Next Steps complete: +10 XP', 'success');
    } catch (error) {
      console.warn('[next-steps] completion XP skipped:', error);
    } finally {
      dailyState.awarding = false;
      render();
    }
  }

  function ensureStyles() {
    if (document.getElementById('pbb-next-steps-style')) return;
    var style = document.createElement('style');
    style.id = 'pbb-next-steps-style';
    style.textContent = [
      '#next-obvious-steps-card{font-family:inherit;}',
      '@keyframes pbbNextStepsPulse{0%,100%{box-shadow:0 18px 44px rgba(217,119,6,.18),0 0 0 1px rgba(245,158,11,.28),0 0 0 rgba(245,158,11,0);transform:translateY(0)}50%{box-shadow:0 22px 52px rgba(217,119,6,.24),0 0 0 1px rgba(245,158,11,.48),0 0 30px rgba(245,158,11,.34);transform:translateY(-1px)}}',
      '@keyframes pbbNextStepsSheen{0%{transform:translateX(-130%) rotate(12deg);opacity:0}22%{opacity:.48}58%{opacity:.12}100%{transform:translateX(145%) rotate(12deg);opacity:0}}',
      '.next-steps-shell{position:relative;border-radius:20px;background:linear-gradient(135deg,#fffdf7 0%,#ffffff 43%,#f0fdfa 100%);border:1px solid rgba(245,158,11,.34);box-shadow:0 18px 44px rgba(217,119,6,.18),0 0 0 1px rgba(245,158,11,.28);overflow:hidden;animation:pbbNextStepsPulse 3.4s ease-in-out infinite;}',
      '.next-steps-shell::before{content:"";position:absolute;top:-45%;bottom:-45%;left:0;width:38%;background:linear-gradient(90deg,transparent,rgba(255,255,255,.9),transparent);filter:blur(1px);animation:pbbNextStepsSheen 4.8s ease-in-out infinite;pointer-events:none;z-index:0;}',
      '.next-steps-shell>*{position:relative;z-index:1;}',
      '.next-steps-head{padding:15px 16px 11px;display:flex;align-items:center;justify-content:space-between;gap:12px;border-bottom:1px solid rgba(226,232,240,.86);background:rgba(255,255,255,.66);}',
      '.next-steps-kicker{font-size:.66rem;text-transform:uppercase;letter-spacing:.08em;color:#b45309;font-weight:950;margin-bottom:3px;}',
      '.next-steps-title{font-size:1.02rem;line-height:1.2;color:#0f172a;font-weight:950;}',
      '.next-steps-head-actions{display:flex;align-items:center;gap:8px;flex-shrink:0;}',
      '.next-steps-note{font-size:.74rem;color:#64748b;font-weight:800;white-space:nowrap;}',
      '.next-steps-test-toggle{border:1px solid #e2e8f0;background:#f8fafc;color:#334155;border-radius:999px;padding:7px 9px;font-size:.66rem;font-weight:950;font-family:inherit;cursor:pointer;white-space:nowrap;}',
      '.next-steps-test-toggle.active{border-color:#0f766e;background:#ecfdf5;color:#0f766e;}',
      '.next-steps-list{display:grid;gap:8px;padding:11px;}',
      '.next-step-action{width:100%;border:1px solid #e5e7eb;background:#fff;color:#0f172a;border-radius:12px;padding:11px 12px;display:flex;align-items:center;gap:11px;text-align:left;font-family:inherit;cursor:pointer;box-shadow:0 6px 14px rgba(15,23,42,.05);}',
      '.next-step-action:active{transform:scale(.99);}',
      '.next-step-mark{width:9px;align-self:stretch;border-radius:999px;background:var(--next-step-accent,#16a34a);flex-shrink:0;}',
      '.next-step-copy{flex:1;min-width:0;}',
      '.next-step-copy strong{display:block;font-size:.9rem;line-height:1.18;color:#0f172a;font-weight:950;margin-bottom:3px;}',
      '.next-step-copy span{display:block;font-size:.75rem;line-height:1.25;color:#64748b;font-weight:700;}',
      '.next-step-cta{font-size:.68rem;font-weight:950;color:var(--next-step-accent,#16a34a);white-space:nowrap;}',
      '.next-steps-complete{padding:18px 16px 17px;display:flex;align-items:center;gap:13px;background:linear-gradient(135deg,#ecfdf5 0%,#ffffff 56%,#fff7ed 100%);}',
      '.next-steps-complete-icon{width:48px;height:48px;border-radius:16px;background:linear-gradient(135deg,#059669,#f59e0b);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:950;font-size:1.15rem;box-shadow:0 12px 24px rgba(5,150,105,.22);flex-shrink:0;}',
      '.next-steps-complete-copy strong{display:block;font-size:1.02rem;color:#0f172a;font-weight:950;line-height:1.15;margin-bottom:4px;}',
      '.next-steps-complete-copy span{display:block;font-size:.78rem;line-height:1.35;color:#475569;font-weight:750;}',
      '@media (prefers-reduced-motion:reduce){.next-steps-shell,.next-steps-shell::before{animation:none!important}}',
      '@media (max-width:380px){.next-steps-head{align-items:flex-start;flex-direction:column;gap:5px}.next-steps-note{white-space:normal}.next-step-cta{display:none}}'
    ].join('');
    document.head.appendChild(style);
  }

  function render() {
    var card = document.getElementById('next-obvious-steps-card');
    if (!card) return;

    if (!isPreviewEligible()) {
      card.style.display = 'none';
      card.innerHTML = '';
      return;
    }

    ensureStyles();
    var suggestions = pickSuggestions();
    var showAll = isShowAllEnabled();
    var complete = hasCompletedDay();
    if (!suggestions.length) {
      if (!complete) {
        card.style.display = 'none';
        card.innerHTML = '';
        return;
      }
      card.style.display = 'block';
      card.innerHTML = [
        '<div class="next-steps-shell">',
          '<div class="next-steps-head">',
            '<div>',
              '<div class="next-steps-kicker">Next steps</div>',
              '<div class="next-steps-title">Tasks complete</div>',
            '</div>',
            '<div class="next-steps-head-actions">',
              '<button type="button" class="next-steps-test-toggle" data-next-steps-test-toggle="1">Test all</button>',
              '<div class="next-steps-note">', dailyState.awarded ? '10 XP banked' : '+10 XP', '</div>',
            '</div>',
          '</div>',
          '<div class="next-steps-complete">',
            '<div class="next-steps-complete-icon">XP</div>',
            '<div class="next-steps-complete-copy"><strong>Come back tomorrow.</strong><span>', dailyState.awarded ? 'All clear for today. Your 10 XP reward has been added.' : 'All clear for today. Your 10 XP reward is being added.', '</span></div>',
          '</div>',
        '</div>'
      ].join('');
      awardCompletionXpIfNeeded();
      return;
    }

    card.style.display = 'block';
    card.innerHTML = [
      '<div class="next-steps-shell">',
        '<div class="next-steps-head">',
          '<div>',
            '<div class="next-steps-kicker">Next steps</div>',
            '<div class="next-steps-title">', showAll ? 'Test every route' : 'What to do today', '</div>',
          '</div>',
          '<div class="next-steps-head-actions">',
            '<button type="button" class="next-steps-test-toggle', showAll ? ' active' : '', '" data-next-steps-test-toggle="1">', showAll ? 'Show 3' : 'Test all', '</button>',
            '<div class="next-steps-note">Private preview</div>',
          '</div>',
        '</div>',
        '<div class="next-steps-list">',
          suggestions.map(function(action){
            return [
              '<button type="button" class="next-step-action" data-next-step-id="', escapeHtml(action.id), '" style="--next-step-accent:', escapeHtml(action.accent), '">',
                '<span class="next-step-mark" aria-hidden="true"></span>',
                '<span class="next-step-copy"><strong>', escapeHtml(action.title), '</strong><span>', escapeHtml(action.body), '</span></span>',
                '<span class="next-step-cta">', escapeHtml(action.cta), '</span>',
              '</button>'
            ].join('');
          }).join(''),
        '</div>',
      '</div>'
    ].join('');
  }

  function refreshSoon(delay) {
    if (renderTimer) clearTimeout(renderTimer);
    renderTimer = setTimeout(function(){
      renderTimer = null;
      render();
    }, delay || 120);
  }

  function handleClick(event) {
    var toggle = event.target && event.target.closest ? event.target.closest('[data-next-steps-test-toggle]') : null;
    if (toggle) {
      event.preventDefault();
      event.stopPropagation();
      try {
        if (isShowAllEnabled()) localStorage.removeItem(SHOW_ALL_STORAGE_KEY);
        else localStorage.setItem(SHOW_ALL_STORAGE_KEY, '1');
      } catch (_) {}
      render();
      return;
    }
    var button = event.target && event.target.closest ? event.target.closest('[data-next-step-id]') : null;
    if (!button) return;
    var id = button.getAttribute('data-next-step-id');
    var action = ACTIONS.find(function(item){ return item.id === id; });
    if (action && typeof action.action === 'function') action.action();
    setTimeout(function(){ refreshDailyStatus({ force: true }); }, 1400);
    setTimeout(function(){ refreshDailyStatus({ force: true }); }, 4500);
  }

  function init() {
    var card = document.getElementById('next-obvious-steps-card');
    if (!card) return;
    card.addEventListener('click', handleClick);
    refreshSoon(0);
    refreshDailyStatus({ force: true });
    setTimeout(render, 1500);
    setTimeout(function(){ refreshDailyStatus({ force: true }); }, 1800);
    setTimeout(render, 3500);
  }

  window.pbbNextSteps = {
    refresh: render,
    isPreviewEligible: isPreviewEligible,
    getSuggestions: pickSuggestions,
    refreshStatus: function(){ refreshDailyStatus({ force: true }); },
    enablePreview: function(){
      try { localStorage.setItem(PREVIEW_STORAGE_KEY, '1'); } catch (_) {}
      render();
    },
    disablePreview: function(){
      try { localStorage.removeItem(PREVIEW_STORAGE_KEY); } catch (_) {}
      render();
    },
    enableShowAll: function(){
      try { localStorage.setItem(SHOW_ALL_STORAGE_KEY, '1'); } catch (_) {}
      render();
    },
    disableShowAll: function(){
      try { localStorage.removeItem(SHOW_ALL_STORAGE_KEY); } catch (_) {}
      render();
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
  document.addEventListener('pbbWeeklyGoalsSaved', function(){ refreshSoon(120); });
  window.addEventListener('pbbCurrentUserReady', function(){ refreshSoon(120); });
  document.addEventListener('pbbInitComplete', function(){ refreshSoon(300); });
  document.addEventListener('appCriticalContentReady', function(){ refreshSoon(300); });
  document.addEventListener('visibilitychange', function(){ if (!document.hidden) { refreshDailyStatus({ force: true }); refreshSoon(0); } });
  setInterval(function(){ if (!document.hidden) refreshDailyStatus({ force: true }); }, 90000);
})();
