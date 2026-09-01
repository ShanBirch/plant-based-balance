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
  var ONBOARDING_ACCOUNT_CUTOFF = Date.parse('2026-08-19T14:00:00Z'); // 20 Aug 2026, Brisbane
  var ONBOARDING_ACTION_IDS = [
    'meal_plan_intro',
    'shopping_list_intro',
    'nutrition_tracker_intro',
    'workout_week_intro',
    'feed_intro',
    'foundations_intro',
    'coach_message_intro',
    'weekly_goals_intro'
  ];
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
    if (window.metaAdTrialMode === true) return true;
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

  function isSundayWeighInDay(date) {
    return (date ? new Date(date) : new Date()).getDay() === 0;
  }

  function localDayRange(dateKey) {
    var start = new Date(dateKey + 'T00:00:00');
    var end = new Date(start.getTime());
    end.setDate(end.getDate() + 1);
    return { startIso: start.toISOString(), endIso: end.toISOString() };
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

  function onboardingStepKey(actionId) {
    var userId = String(window.currentUser && (window.currentUser.id || window.currentUser.email) || 'guest');
    return 'pbb_onboarding_step_seen:' + userId + ':' + actionId;
  }

  function hasSeenOnboardingStep(actionId) {
    try { return localStorage.getItem(onboardingStepKey(actionId)) === '1'; } catch (_) { return false; }
  }

  function markOnboardingStepSeen(actionId) {
    try { localStorage.setItem(onboardingStepKey(actionId), '1'); } catch (_) {}
    render();
  }

  function setOnboardingStepComplete(actionId, complete) {
    if (ONBOARDING_ACTION_IDS.indexOf(actionId) === -1 && actionId !== 'activity_insights_intro') return;
    try {
      if (complete) localStorage.setItem(onboardingStepKey(actionId), '1');
      else localStorage.removeItem(onboardingStepKey(actionId));
    } catch (_) {}
    render();
  }

  function getAccountCreatedAtMs() {
    var sources = [window.currentUser, window.userProfile];
    for (var i = 0; i < sources.length; i++) {
      var source = sources[i];
      if (!source || typeof source !== 'object') continue;
      var raw = source.created_at || source.createdAt;
      if (!raw) continue;
      var parsed = new Date(raw).getTime();
      if (Number.isFinite(parsed)) return parsed;
    }
    return NaN;
  }

  function isOnboardingAccount() {
    if (window.metaAdTrialMode === true) return true;
    var createdAt = getAccountCreatedAtMs();
    return Number.isFinite(createdAt) && createdAt >= ONBOARDING_ACCOUNT_CUTOFF;
  }

  function isOnboardingAction(actionId) {
    return ONBOARDING_ACTION_IDS.indexOf(String(actionId || '')) !== -1;
  }

  function isVisibleSelector(selector) {
    var el = null;
    try { el = document.querySelector(selector); } catch (_) {}
    if (!el) return false;
    var style = window.getComputedStyle ? window.getComputedStyle(el) : null;
    return style ? style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0' : el.style.display !== 'none';
  }

  function isSourceCardDue(selector) {
    var el = null;
    try { el = document.querySelector(selector); } catch (_) {}
    return !!(el && !el.hidden && el.style.display !== 'none');
  }

  function isWeeklyCheckinDue() {
    try {
      return typeof window.isWeeklyCheckinDue === 'function' && window.isWeeklyCheckinDue();
    } catch (_) {
      return false;
    }
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
      try {
        var result = callback();
        if (result && typeof result.catch === 'function') {
          result.catch(function(error){ console.warn('[next-steps] async action failed:', error); });
        }
      } catch (error) { console.warn('[next-steps] action failed:', error); }
    }, delay || 420);
  }

  function openDashboardTarget(selector, options) {
    switchTab('dashboard');
    afterTab(function(){ scrollToSelector(selector, options); }, 260);
  }

  function clickSourceCard(selector) {
    switchTab('dashboard');
    afterTab(function(){
      var el = null;
      try { el = document.querySelector(selector); } catch (_) {}
      if (el && typeof el.click === 'function') el.click();
    }, 260);
  }

  function openHiddenHomeCard(selector, expandName) {
    switchTab('dashboard');
    afterTab(function(){
      if (selector === '#fitness-diary-card' && typeof window.openFitnessDiaryForAction === 'function') {
        window.openFitnessDiaryForAction();
        return;
      }
      var el = null;
      try { el = document.querySelector(selector); } catch (_) {}
      if (el) el.classList.add('pbb-next-step-active-source');
      if (expandName && typeof window[expandName] === 'function') {
        try { window[expandName](); } catch (_) {}
      }
      if (selector === '#fitness-diary-card') {
        if (el) el.style.display = 'block';
        var collapsed = document.getElementById('fitness-diary-collapsed');
        var form = document.getElementById('fitness-diary-form');
        if (collapsed) collapsed.style.display = 'none';
        if (form) form.style.display = 'block';
      }
      scrollToSelector(selector, { block: 'center' });
    }, 620);
  }

  function isUnifiedPlanActive() {
    try {
      return !!(window.socialJourney && typeof window.socialJourney.isUnifiedPlanActive === 'function' && window.socialJourney.isUnifiedPlanActive());
    } catch (_) {
      return false;
    }
  }

  function getBalanceJourneyAction() {
    try {
      if (!window.socialJourney || typeof window.socialJourney.getUnifiedAction !== 'function') return null;
      var journeyAction = window.socialJourney.getUnifiedAction();
      if (!journeyAction) return null;
      var base = ACTIONS.find(function(action){ return action.id === 'balance_journey'; });
      return base ? Object.assign({}, base, journeyAction) : null;
    } catch (_) {
      return null;
    }
  }

  function isFirstProgramWeek() {
    try {
      if (window.socialJourney && typeof window.socialJourney.getCurrentWeek === 'function') {
        return Number(window.socialJourney.getCurrentWeek() || 1) <= 1;
      }
    } catch (_) {}
    var start = new Date((window.userProfile && window.userProfile.program_start_date) || '');
    return Number.isFinite(start.getTime()) && Date.now() < start.getTime() + (7 * 24 * 60 * 60 * 1000);
  }

  function hasReachedSecondProgramWeek() {
    try {
      if (window.socialJourney && typeof window.socialJourney.getCurrentWeek === 'function') {
        return Number(window.socialJourney.getCurrentWeek() || 1) >= 2;
      }
    } catch (_) {}
    var start = new Date((window.userProfile && window.userProfile.program_start_date) || '');
    return Number.isFinite(start.getTime()) && Date.now() >= start.getTime() + (7 * 24 * 60 * 60 * 1000);
  }

  function isHealthConnected() {
    try {
      if (localStorage.getItem('healthConnectEnabled') === 'true' || window._nativeHealthReady) return true;
    } catch (_) {}
    return ['fitbit-connect-btn', 'oura-connect-btn', 'whoop-connect-btn'].some(function(id){
      var button = document.getElementById(id);
      var label = String(button && button.textContent || '').trim().toLowerCase();
      return label === 'disconnect' || label.indexOf('connected') !== -1;
    });
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

  function openMealPlanTarget() {
    markOnboardingStepSeen('meal_plan_intro');
    switchTab('meals');
    afterTab(async function(){
      var pill = document.getElementById('browse-plans-pill');
      try {
        if (window.metaAdTrialMode === true && typeof window.ensureMetaPreviewMealPlan === 'function') {
          await window.ensureMetaPreviewMealPlan();
        }
        if (typeof window.switchWeek === 'function') window.switchWeek('meal-plan-store', pill);
        if (typeof window.selectAiPlanFirstDay === 'function') window.selectAiPlanFirstDay();
      } catch (_) {}
      scrollToSelector('#meal-plan-store', { block: 'start' });
    }, 520);
  }

  function openShoppingListTarget() {
    markOnboardingStepSeen('shopping_list_intro');
    switchTab('meals');
    afterTab(async function(){
      try {
        if (window.metaAdTrialMode === true && typeof window.ensureMetaPreviewMealPlan === 'function') {
          await window.ensureMetaPreviewMealPlan();
        }
        var pill = document.getElementById('meal-plan-shopping-pill') || document.getElementById('browse-plans-pill');
        if (typeof window.switchWeek === 'function') window.switchWeek('meal-plan-store', pill);
        if (typeof window.selectAiPlanFirstDay === 'function') window.selectAiPlanFirstDay();
        if (typeof window.openAiMealPlanShoppingList === 'function') {
          await window.openAiMealPlanShoppingList(pill, window.__balanceGuidedTourActive === true ? {
            resetChecked: true,
            scrollBehavior: 'auto',
            scrollBlock: 'start'
          } : {
            scrollBlock: 'start'
          });
        }
      } catch (error) {
        console.warn('[next-steps] shopping list failed:', error);
      }
      scrollToSelector('#ai-plan-shopping-card,#meal-plan-store', { block: 'start' });
    }, 520);
  }

  function openNutritionTrackerTarget() {
    markOnboardingStepSeen('nutrition_tracker_intro');
    openNutritionTarget('meals');
  }

  function openWorkoutWeekTarget() {
    var cycleButton = document.getElementById('nav-cycle-btn');
    try {
      if (typeof window.switchAppTab === 'function') window.switchAppTab('cycle', cycleButton);
      else if (cycleButton && typeof cycleButton.click === 'function') cycleButton.click();
    } catch (_) {}
    markOnboardingStepSeen('workout_week_intro');
    afterTab(function(){
      var calendarView = document.getElementById('view-calendar');
      var cycleView = document.getElementById('view-cycle');
      var calendarVisible = calendarView && window.getComputedStyle(calendarView).display !== 'none';
      var cycleVisible = cycleView && window.getComputedStyle(cycleView).display !== 'none';
      if (!calendarVisible && !cycleVisible) {
        try {
          if (typeof window.switchAppTab === 'function') window.switchAppTab('cycle', cycleButton);
          else if (cycleButton && typeof cycleButton.click === 'function') cycleButton.click();
        } catch (_) {}
      }
      try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (_) { window.scrollTo(0, 0); }
    }, 520);
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
    markOnboardingStepSeen('feed_intro');
    switchTab('friends');
    afterTab(function(){
      scrollToSelector('#feed-composer-card,#friends-feed-section', { block: 'start' });
    }, 520);
  }

  function openCoachMessageTarget() {
    markOnboardingStepSeen('coach_message_intro');
    switchTab('dashboard');
    afterTab(function(){
      try {
        if (window.BalanceMetaAdTrial && typeof window.BalanceMetaAdTrial.showInboxPreview === 'function') {
          window.BalanceMetaAdTrial.showInboxPreview();
          return;
        }
      } catch (_) {}
      var messageButton = document.querySelector('.header-msg-icon');
      if (messageButton && typeof messageButton.click === 'function') messageButton.click();
    }, 260);
  }

  function openWeeklyGoalsTarget() {
    markOnboardingStepSeen('weekly_goals_intro');
    switchTab('dashboard');
    afterTab(function(){
      try {
        if (typeof window.openWeeklyGoalsModal === 'function') {
          window.openWeeklyGoalsModal({ source:'meta_preview_setup', week:'current' });
        }
      } catch (_) {}
    }, 260);
  }

  function openFoundationsTarget() {
    markOnboardingStepSeen('foundations_intro');
    openNextCourseTarget('balance-foundations');
  }

  function getNextCourseId() {
    try {
      if (window.socialJourney && typeof window.socialJourney.getCurrentWeek === 'function') {
        return Number(window.socialJourney.getCurrentWeek() || 1) >= 7 ? 'balance-identity' : 'balance-foundations';
      }
    } catch (_) {}
    return 'balance-foundations';
  }

  function openNextCourseTarget(courseId) {
    var resolvedCourseId = courseId || getNextCourseId();
    var selector = resolvedCourseId === 'balance-identity'
      ? '#balance-identity-course-card'
      : '#balance-foundations-course-card';
    switchTab('learning');
    watchCourseGuidanceExit();
    afterTab(function(){
      if (typeof window.renderLearningHome === 'function') window.renderLearningHome();
      var attempts = 0;
      function revealCourseCard() {
        var card = document.querySelector(selector);
        if (!card && attempts++ < 12) {
          setTimeout(revealCourseCard, 150);
          return;
        }
        if (!card) return;
        document.querySelectorAll('.course-path-card.is-next-course-target').forEach(function(item){
          item.classList.remove('is-next-course-target');
        });
        card.classList.add('is-next-course-target');
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        var button = card.querySelector('.course-path-card-open');
        if (button) {
          button.focus({ preventScroll: true });
          button.addEventListener('click', function(){
            window.__pbbGuideNextCourseId = resolvedCourseId;
            card.classList.remove('is-next-course-target');
          }, { once: true, capture: true });
        }
      }
      revealCourseCard();
    }, 360);
  }

  function clearCourseGuidance() {
    window.__pbbGuideNextCourseId = null;
    document.querySelectorAll('.is-next-course-target,.is-next-course-lesson-target').forEach(function(item){
      item.classList.remove('is-next-course-target', 'is-next-course-lesson-target');
    });
  }

  function watchCourseGuidanceExit() {
    if (window.__pbbCourseGuidanceExitWatcher) return;
    var learningView = document.getElementById('view-learning');
    if (!learningView || typeof MutationObserver !== 'function') return;
    window.__pbbCourseGuidanceExitWatcher = new MutationObserver(function(){
      if (window.getComputedStyle(learningView).display === 'none') clearCourseGuidance();
    });
    window.__pbbCourseGuidanceExitWatcher.observe(learningView, { attributes: true, attributeFilter: ['style', 'class', 'hidden'] });
  }

  function openQuizTarget() {
    if (isVisibleSelector('#daily-quiz-card')) {
      openDashboardTarget('#daily-quiz-card', { block: 'center' });
      return;
    }
    openNextCourseTarget();
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
    if (action.id === 'balance_journey') return !getBalanceJourneyAction();
    if (visibleCompleteFallback(action.id)) return true;
    if (action.id === 'workout') return !!(dailyState.status && dailyState.status.workout && dailyState.status.workout_share);
    if (isOnboardingAction(action.id) || action.id === 'activity_insights_intro') return hasSeenOnboardingStep(action.id);
    if (action.id === 'connect_health') return isHealthConnected();
    if (action.id === 'nutrition' && getSelectedGoalIds().indexOf('share_meal_feed') !== -1) {
      return !!(dailyState.status && dailyState.status.nutrition && dailyState.status.meal_share);
    }
    return !!(dailyState.status && dailyState.status[action.id]);
  }

  var ACTIONS = [
    {
      id: 'feed_intro',
      title: 'See the Balance community',
      body: 'See where Shannon posts and members share meals, workouts, questions and wins.',
      cta: 'View Community',
      accent: '#b78a2e',
      priority: 960,
      goalIds: [],
      action: openCommunityTarget
    },
    {
      id: 'balance_journey',
      title: 'Open your Balance journey',
      body: 'Continue the lesson or action that is ready for you now.',
      cta: 'Open journey',
      accent: '#b78a2e',
      priority: 990,
      goalIds: [],
      action: function(){
        if (window.socialJourney && typeof window.socialJourney.openUnifiedAction === 'function') {
          window.socialJourney.openUnifiedAction();
        }
      }
    },
    {
      id: 'meal_plan_intro',
      title: 'Check out your meal plan',
      body: 'See the meals Shannon has prepared for your week and where to find them again.',
      cta: 'View Meal Plan',
      accent: '#16a34a',
      priority: 1000,
      goalIds: [],
      action: openMealPlanTarget
    },
    {
      id: 'shopping_list_intro',
      title: 'Open your weekly shopping list',
      body: 'See every ingredient from your meal plan combined into one list for the shops.',
      cta: 'View Shopping List',
      accent: '#b78a2e',
      priority: 990,
      goalIds: [],
      action: openShoppingListTarget
    },
    {
      id: 'nutrition_tracker_intro',
      title: 'See your nutrition tracker',
      body: 'Use a photo, barcode or quick entry to log what you actually eat.',
      cta: 'Open Tracker',
      accent: '#16a34a',
      priority: 980,
      goalIds: [],
      action: openNutritionTrackerTarget
    },
    {
      id: 'workout_week_intro',
      title: 'Check out your workouts for the week',
      body: 'Open your Calendar to see your assigned sessions and how the week fits together.',
      cta: 'Open Calendar',
      accent: '#2563eb',
      priority: 970,
      goalIds: [],
      action: openWorkoutWeekTarget
    },
    {
      id: 'coach_message_intro',
      title: 'Hear from your coach',
      body: 'Watch Shannon’s coach note and see how weekly support works inside Balance.',
      cta: 'Open Message',
      accent: '#b78a2e',
      priority: 950,
      goalIds: [],
      action: openCoachMessageTarget
    },
    {
      id: 'weekly_goals_intro',
      title: 'Choose your Weekly Goals',
      body: 'Pick the few realistic actions you want Shannon to review with you this week.',
      cta: 'Choose Goals',
      accent: '#7c3aed',
      priority: 930,
      goalIds: [],
      action: openWeeklyGoalsTarget
    },
    {
      id: 'foundations_intro',
      title: 'Start Balance Foundations',
      body: 'Open your first lesson and see how the course helps change work in real life.',
      cta: 'Start Course',
      accent: '#0f766e',
      priority: 955,
      goalIds: [],
      action: openFoundationsTarget
    },
    {
      id: 'weekly_review',
      title: 'Complete your weekly check-in',
      body: 'Review your goals, share how the week really went, and tell Shannon what support you need next.',
      cta: 'Check In',
      accent: '#b78a2e',
      priority: 950,
      goalIds: [],
      action: function(){
        if (typeof window.openWeeklyCheckinPreview === 'function') window.openWeeklyCheckinPreview();
      }
    },
    {
      id: 'connect_health',
      title: 'Connect Android Health or your watch',
      body: 'Bring steps, activity and sleep into Balance automatically.',
      cta: 'Connect Health',
      accent: '#0f766e',
      priority: 920,
      goalIds: [],
      action: function(){
        try {
          if (typeof window.toggleHealthConnect === 'function') window.toggleHealthConnect();
          else if (typeof window.showHealthConnectModal === 'function') window.showHealthConnectModal();
        } catch (_) {}
      }
    },
    {
      id: 'activity_insights_intro',
      title: 'Review your first week in Activity Insights',
      body: 'See how your workouts, recovery and health data came together before you begin Week 2.',
      cta: 'View Insights',
      accent: '#0f766e',
      priority: 910,
      goalIds: [],
      action: function(){
        markOnboardingStepSeen('activity_insights_intro');
        openInsightsTarget();
      }
    },
    {
      id: 'quiz',
      title: "Complete today's Balance lesson",
      body: 'Keep building the skills that make your training and food plan easier to follow.',
      cta: 'Open Course',
      accent: '#d97706',
      priority: 900,
      goalIds: ['daily_quiz_days', 'questions_answered', 'perfect_lessons'],
      action: openQuizTarget
    },
    {
      id: 'workout',
      title: "Complete and share today's workout",
      body: 'Finish the session that fits today, then share the completed workout to Feed.',
      cta: 'Open Movement',
      accent: '#2563eb',
      priority: 800,
      goalIds: ['complete_workouts', 'build_workouts', 'share_workout_feed'],
      action: openMovementTarget
    },
    {
      id: 'daily_checkin',
      title: "Complete today's check-in",
      body: 'Give Balance today\'s recovery information so the plan can respond.',
      cta: 'Open Check-In',
      accent: '#b45309',
      priority: 650,
      goalIds: [],
      action: function(){ openDashboardTarget('#check-in-prompt-card', { block: 'center' }); }
    },
    {
      id: 'nutrition',
      title: 'Track your meals',
      body: 'Food goal: log what you eat today.',
      cta: 'Open Nutrition',
      accent: '#16a34a',
      priority: 300,
      goalIds: ['protein_days', 'calorie_range_days', 'meal_log_days', 'share_meal_feed'],
      action: function(){ openNutritionTarget('meals'); }
    },
    {
      id: 'steps',
      title: 'Reach 10k steps',
      body: 'Your steps update automatically through the day.',
      cta: 'Progress',
      accent: '#059669',
      goalIds: ['steps_10k_days'],
      action: null
    },
    {
      id: 'weighin',
      title: 'Complete your Sunday weigh-in',
      body: 'Body goal: log this week\'s weight and keep the trend accurate.',
      cta: 'Open Weigh-In',
      accent: '#e11d48',
      priority: 700,
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
      id: 'progress_photo',
      title: 'Take your weekly progress photo',
      body: 'Keep a private visual record so progress is easier to see over time.',
      cta: 'Take Photo',
      accent: '#e11d48',
      priority: 600,
      goalIds: [],
      action: function(){ clickSourceCard('#weekly-progress-photo-card'); }
    },
    {
      id: 'fitness_diary',
      title: 'Complete your end-of-day check-in',
      body: 'Close the loop on today so tomorrow starts with useful information.',
      cta: 'Check In',
      accent: '#0f766e',
      priority: 400,
      goalIds: [],
      action: function(){ openHiddenHomeCard('#fitness-diary-card', 'expandFitnessDiary'); }
    },
    {
      id: 'first_meal',
      title: 'Log and share one normal meal',
      body: 'No perfect plate required. Share what you actually ate.',
      cta: 'Open Nutrition',
      accent: '#16a34a',
      priority: 550,
      goalIds: [],
      action: function(){ openNutritionTarget('meals'); }
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
        var completedGoalIds = {};
        var progressGoals = state && state.progress && Array.isArray(state.progress.goals) ? state.progress.goals : [];
        progressGoals.forEach(function(goal){
          if (goal && goal.complete && goal.id) completedGoalIds[String(goal.id)] = true;
        });
        return selected.map(function(goal){ return String(goal && goal.id || ''); })
          .filter(function(goalId){ return goalId && !completedGoalIds[goalId]; });
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

  function addUniqueAction(list, action) {
    if (!action || list.some(function(item){ return item.id === action.id; })) return;
    list.push(action);
  }

  function isActionTargetable(action, selectedGoalIds) {
    if (!action || !action.id) return false;
    if (action.id === 'mood') {
      return false;
    }
    if (action.id === 'quiz') return true;
    if (action.id === 'workout') return isSourceCardDue('#today-workout-card');
    if (action.id === 'weighin') {
      if (!isSundayWeighInDay()) return false;
      return isSourceCardDue('#daily-weigh-in-card') || isSourceCardDue('#daily-weigh-in-done-card') || matchingGoalCount(action, selectedGoalIds) > 0;
    }
    return true;
  }

  function dailyActionSet(selectedGoalIds) {
    var picked = [];
    var journeyAction = getBalanceJourneyAction();
    var onboardingEligible = isOnboardingAccount();
    var hasIncompleteOnboarding = onboardingEligible && ONBOARDING_ACTION_IDS.some(function(id){
      var action = ACTIONS.find(function(item){ return item.id === id; });
      return action && !isActionComplete(action);
    });
    if (hasIncompleteOnboarding) {
      addUniqueAction(picked, ACTIONS.find(function(item){ return item.id === 'meal_plan_intro'; }));
      addUniqueAction(picked, ACTIONS.find(function(item){ return item.id === 'shopping_list_intro'; }));
      addUniqueAction(picked, ACTIONS.find(function(item){ return item.id === 'nutrition_tracker_intro'; }));
      addUniqueAction(picked, ACTIONS.find(function(item){ return item.id === 'workout_week_intro'; }));
      addUniqueAction(picked, ACTIONS.find(function(item){ return item.id === 'feed_intro'; }));
      addUniqueAction(picked, ACTIONS.find(function(item){ return item.id === 'foundations_intro'; }));
      addUniqueAction(picked, ACTIONS.find(function(item){ return item.id === 'coach_message_intro'; }));
      addUniqueAction(picked, ACTIONS.find(function(item){ return item.id === 'weekly_goals_intro'; }));
      if (window.metaAdTrialMode === true) return picked;
    }
    addUniqueAction(picked, journeyAction);
    if (onboardingEligible && hasReachedSecondProgramWeek() && !hasSeenOnboardingStep('activity_insights_intro')) {
      addUniqueAction(picked, ACTIONS.find(function(item){ return item.id === 'activity_insights_intro'; }));
    }
    // The Foundations/Identity lesson is the Course priority while it is due.
    // Keep the separate daily quiz and its Weekly Goal credit available after
    // the weekly lesson has been opened, rather than showing two Course CTAs.
    if (!journeyAction || journeyAction.kind !== 'course_lesson') {
      addUniqueAction(picked, ACTIONS.find(function(item){ return item.id === 'quiz'; }));
    }
    goalMatchedActions(selectedGoalIds).forEach(function(action){
      if (hasIncompleteOnboarding && action.id === 'nutrition') return;
      if (isActionTargetable(action, selectedGoalIds)) addUniqueAction(picked, action);
    });
    ['daily_checkin', 'weighin'].forEach(function(id){
      var action = ACTIONS.find(function(item){ return item.id === id; });
      var selector = id === 'daily_checkin' ? '#check-in-prompt-card' : '#daily-weigh-in-card';
      if (action && isSourceCardDue(selector)) addUniqueAction(picked, action);
    });
    [
      ['progress_photo', '#weekly-progress-photo-card'],
      ['fitness_diary', '#fitness-diary-card']
    ].forEach(function(item){
      var action = ACTIONS.find(function(actionItem){ return actionItem.id === item[0]; });
      if (action && isSourceCardDue(item[1])) addUniqueAction(picked, action);
    });
    if (isWeeklyCheckinDue()) {
      addUniqueAction(picked, ACTIONS.find(function(item){ return item.id === 'weekly_review'; }));
    }
    return picked;
  }

  function completionActionSet(selectedGoalIds) {
    return dailyActionSet(selectedGoalIds);
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
    if (action.id === 'balance_journey') return !!getBalanceJourneyAction();
    if (isActionComplete(action)) return false;
    if (isOnboardingAction(action.id) && !isOnboardingAccount()) return false;
    if (action.id === 'mood') {
      return false;
    }
    if (action.id === 'daily_checkin') return isSourceCardDue('#check-in-prompt-card');
    if (isOnboardingAction(action.id)) return !hasSeenOnboardingStep(action.id);
    if (action.id === 'connect_health') return !isHealthConnected();
    if (action.id === 'activity_insights_intro') return hasReachedSecondProgramWeek() && !hasSeenOnboardingStep(action.id);
    if (action.id === 'quiz') return true;
    if (action.id === 'workout') return isSourceCardDue('#today-workout-card');
    if (action.id === 'weekly_review') return isWeeklyCheckinDue();
    if (action.id === 'progress_photo') return isSourceCardDue('#weekly-progress-photo-card');
    if (action.id === 'fitness_diary') return new Date().getHours() >= 18 && isSourceCardDue('#fitness-diary-card');
    if (action.id === 'weighin') {
      if (!isSundayWeighInDay()) return false;
      if (isVisibleSelector('#daily-weigh-in-done-card')) return false;
      return isSourceCardDue('#daily-weigh-in-card') || matchingGoalCount(action, selectedGoalIds) > 0;
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
    var score = Number(action.priority || 0) + matchingGoalCount(action, selectedGoalIds) * 80;
    if (action.id === 'daily_checkin' && isSourceCardDue('#check-in-prompt-card')) score += 32;
    if (action.id === 'weighin' && isSourceCardDue('#daily-weigh-in-card')) score += 28;
    if (action.id === 'quiz' && isSourceCardDue('#daily-quiz-card')) score += 16;
    return score;
  }

  function pickSuggestions() {
    var selectedGoalIds = getSelectedGoalIds();
    if (isShowAllEnabled()) return ACTIONS.slice();
    if (areDailyActionsComplete(selectedGoalIds)) return [];

    var targetActions = dailyActionSet(selectedGoalIds);
    var ranked = targetActions.map(function(action, index){
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
    var guidedSetup = window.metaAdTrialMode === true;
    var limit = (isUnifiedPlanActive() || guidedSetup) ? ranked.length : 3;
    ranked.forEach(function(item){
      if (picked.length >= limit) return;
      picked.push(item.action);
    });

    return (isUnifiedPlanActive() || guidedSetup) ? picked : picked.slice(0, 3);
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
        safeSupabaseQuery(function(supabase){ return supabase.from('stories').select('id,media_type,created_at').eq('user_id', userId).gte('created_at', range.startIso).lt('created_at', range.endIso).limit(25); }),
        safeSupabaseQuery(function(supabase){ return supabase.from('fitbit_daily_activity').select('date,steps').eq('user_id', userId).eq('date', dateKey); }),
        safeSupabaseQuery(function(supabase){ return supabase.from('oura_daily_activity').select('date,steps').eq('user_id', userId).eq('date', dateKey); }),
        safeSupabaseQuery(function(supabase){ return supabase.from('fitbit_sleep').select('date,duration_minutes').eq('user_id', userId).eq('date', dateKey); }),
        safeSupabaseQuery(function(supabase){ return supabase.from('oura_sleep').select('date,total_sleep_minutes').eq('user_id', userId).eq('date', dateKey); }),
        safeSupabaseQuery(function(supabase){ return supabase.from('whoop_sleep').select('date,duration_minutes').eq('user_id', userId).eq('date', dateKey); }),
        getNativeSteps(),
        safeSupabaseQuery(function(supabase){ return supabase.from('stories').select('id,media_type,created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(50); })
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
      var allStories = results[15] || [];

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
        workout_share: stories.some(function(row){ return row && row.media_type === 'workout_card'; }),
        nutrition: meals.length > 0 || nutrition.some(function(row){ return Number(row.total_calories || 0) > 0 || Number(row.meal_count || 0) > 0; }),
        meal_share: stories.some(function(row){ return row && (row.media_type === 'meal_card' || row.media_type === 'nutrition_card'); }),
        daily_checkin: checkins.length > 0,
        hydration: normalizeWaterMl(checkin.water_intake) >= getWaterGoalMl(),
        steps: bestSteps >= 10000,
        step_count: bestSteps,
        weighin: weighIns.length > 0,
        mood: !!(moodCompleted.morning && moodCompleted.afternoon && moodCompleted.evening) || !!(currentWindow && moodCompleted[currentWindow]),
        sleep: bestSleep >= 420,
        sleep_data: sleepValues.some(function(minutes){ return Number(minutes || 0) > 0; }),
        quiz: quizzes.length > 0,
        community: stories.length > 0,
        feed_intro: allStories.length > 0,
        first_meal: allStories.some(function(row){ return row && (row.media_type === 'meal_card' || row.media_type === 'nutrition_card'); })
      };
      dailyState.loaded = true;
    } finally {
      dailyState.loading = false;
      render();
      try { window.dispatchEvent(new CustomEvent('pbbNextStepsUpdated')); } catch (_) {}
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
      '.next-step-action.is-progress{cursor:default;}',
      '.next-step-progress-meta{display:flex!important;align-items:center;justify-content:space-between;gap:10px;margin-top:8px;color:#475569!important;}',
      '.next-step-progress-meta b{color:#047857;-webkit-text-fill-color:#047857;font-size:.7rem;white-space:nowrap;}',
      '.next-step-progress-track{height:8px;margin-top:7px;border-radius:999px;background:#d1fae5;overflow:hidden;}',
      '.next-step-progress-fill{height:100%;border-radius:inherit;background:linear-gradient(90deg,#10b981,#059669);transition:width .45s ease;}',
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

    var guidedSetup = window.metaAdTrialMode === true;
    var unified = isUnifiedPlanActive() || guidedSetup;
    if (guidedSetup && document.documentElement) {
      document.documentElement.classList.add('pbb-unified-next-steps');
    }
    if (!isPreviewEligible() && !unified) {
      card.style.display = 'none';
      card.innerHTML = '';
      return;
    }

    ensureStyles();
    card.classList.toggle('is-unified-plan', unified);
    if (unified) {
      var weeklyGoals = document.getElementById('weekly-goals-card');
      if (weeklyGoals && weeklyGoals.parentNode && weeklyGoals.nextElementSibling !== card) {
        weeklyGoals.parentNode.insertBefore(card, weeklyGoals.nextSibling);
      }
    }
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
              '<div class="next-steps-kicker">', unified ? 'Your plan' : 'Next steps', '</div>',
              '<div class="next-steps-title">', unified ? 'You are clear for now' : 'Tasks complete', '</div>',
            '</div>',
            '<div class="next-steps-head-actions">',
              unified ? '' : '<button type="button" class="next-steps-test-toggle" data-next-steps-test-toggle="1">Test all</button>',
              '<div class="next-steps-note">', unified ? 'Today' : (dailyState.awarded ? '10 XP banked' : '+10 XP'), '</div>',
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
            '<div class="next-steps-kicker">', guidedSetup ? 'Your guided app tour' : (unified ? 'Your plan' : 'Next steps'), '</div>',
            '<div class="next-steps-title">', unified ? 'To do next' : (showAll ? 'Test every route' : 'What to do today'), '</div>',
          '</div>',
          '<div class="next-steps-head-actions">',
            unified ? '' : '<button type="button" class="next-steps-test-toggle' + (showAll ? ' active' : '') + '" data-next-steps-test-toggle="1">' + (showAll ? 'Show 3' : 'Test all') + '</button>',
            '<div class="next-steps-note">', guidedSetup ? 'One step at a time' : (unified ? 'Today' : 'Private preview'), '</div>',
          '</div>',
        '</div>',
        '<div class="next-steps-list">',
          suggestions.map(function(action){
            if (action.id === 'steps') {
              var currentSteps = Math.max(0, Math.round(Number(dailyState.status && dailyState.status.step_count || 0)));
              var targetSteps = 10000;
              var stepPercent = Math.min(100, Math.round((currentSteps / targetSteps) * 100));
              return [
                '<div class="next-step-action is-progress" data-next-step-id="steps" data-next-step-readonly="true" role="status" aria-label="', escapeHtml(currentSteps.toLocaleString('en-AU') + ' of ' + targetSteps.toLocaleString('en-AU') + ' steps today'), '" style="--next-step-accent:', escapeHtml(action.accent), '">',
                  '<span class="next-step-mark" aria-hidden="true"></span>',
                  '<span class="next-step-copy"><strong>', escapeHtml(action.title), '</strong><span>', escapeHtml(action.body), '</span>',
                    '<span class="next-step-progress-meta"><span>', escapeHtml(currentSteps.toLocaleString('en-AU') + ' of ' + targetSteps.toLocaleString('en-AU') + ' today'), '</span><b>', stepPercent, '%</b></span>',
                    '<span class="next-step-progress-track" aria-hidden="true"><span class="next-step-progress-fill" style="width:', stepPercent, '%"></span></span>',
                  '</span>',
                '</div>'
              ].join('');
            }
            return [
              '<button type="button" class="next-step-action" data-next-step-id="', escapeHtml(action.id), '" data-next-step-direct="true" onclick="window.pbbNextSteps.runAction(\'', escapeHtml(action.id), '\')" style="--next-step-accent:', escapeHtml(action.accent), '">',
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
    if (button.getAttribute('data-next-step-direct') === 'true') return;
    if (button.getAttribute('data-next-step-readonly') === 'true') return;
    var id = button.getAttribute('data-next-step-id');
    var action = ACTIONS.find(function(item){ return item.id === id; });
    if (action && typeof action.action === 'function') action.action();
    setTimeout(function(){ refreshDailyStatus({ force: true }); }, 1400);
    setTimeout(function(){ refreshDailyStatus({ force: true }); }, 4500);
  }

  function init() {
    var card = document.getElementById('next-obvious-steps-card');
    if (!card) return;
    // The Home plan is re-rendered by several async account refreshes. Listen
    // on the stable document in capture phase so every visible action keeps a
    // working destination even when the card is replaced or another handler
    // stops bubbling.
    document.addEventListener('click', handleClick, true);
    document.addEventListener('click', function(event){
      var homeButton = event.target && event.target.closest ? event.target.closest('.bottom-nav .nav-item[onclick*="dashboard"]') : null;
      if (!homeButton) return;
      setTimeout(function(){ refreshDailyStatus({ force: true }); }, 180);
      setTimeout(function(){ refreshDailyStatus({ force: true }); }, 1200);
    });
    refreshSoon(0);
    refreshDailyStatus({ force: true });
    setTimeout(render, 1500);
    setTimeout(function(){ refreshDailyStatus({ force: true }); }, 1800);
    setTimeout(render, 3500);
  }

  window.pbbOpenNextCourseTarget = openNextCourseTarget;

  window.pbbNextSteps = {
    refresh: render,
    isPreviewEligible: isPreviewEligible,
    getSuggestions: pickSuggestions,
    getPlan: function(){
      var selectedGoalIds = getSelectedGoalIds();
      var actions = dailyActionSet(selectedGoalIds).map(function(action, index){
        return { action: action, score: scoreAction(action, selectedGoalIds), index: index };
      }).filter(function(item){ return item.score > -9999; }).sort(function(a, b){
        if (b.score !== a.score) return b.score - a.score;
        return a.index - b.index;
      }).map(function(item){ return item.action; });
      return actions.map(function(action){
        var planItem = { id: action.id, title: action.title, body: action.body, cta: action.cta, accent: action.accent, complete: isActionComplete(action) };
        if (action.id === 'steps') {
          var currentSteps = Math.max(0, Math.round(Number(dailyState.status && dailyState.status.step_count || 0)));
          planItem.kind = 'progress';
          planItem.current = currentSteps;
          planItem.target = 10000;
          planItem.percent = Math.min(100, Math.round((currentSteps / planItem.target) * 100));
        }
        return planItem;
      });
    },
    runAction: function(id){
      try {
        window.dispatchEvent(new CustomEvent('pbb-next-step-action', { detail: { id: id } }));
      } catch (_) {}
      var action = ACTIONS.find(function(item){ return item.id === id; });
      if (action && typeof action.action === 'function') action.action();
      setTimeout(function(){ refreshDailyStatus({ force: true }); }, 1400);
      setTimeout(function(){ refreshDailyStatus({ force: true }); }, 4500);
    },
    setOnboardingStepComplete: setOnboardingStepComplete,
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
    },
    resetOnboardingCards: function(){
      var resetIds = ONBOARDING_ACTION_IDS.concat(['activity_insights_intro']);
      resetIds.forEach(function(actionId){
        try { localStorage.removeItem(onboardingStepKey(actionId)); } catch (_) {}
      });
      try {
        for (var storageIndex = localStorage.length - 1; storageIndex >= 0; storageIndex -= 1) {
          var storedKey = localStorage.key(storageIndex);
          if (!storedKey || storedKey.indexOf('pbb_onboarding_step_seen:') !== 0) continue;
          if (resetIds.some(function(actionId){ return storedKey.endsWith(':' + actionId); })) {
            localStorage.removeItem(storedKey);
          }
        }
      } catch (_) {}
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
  window.addEventListener('pbbWeeklyCheckinAvailabilityChanged', function(){ refreshSoon(0); });
  document.addEventListener('pbbInitComplete', function(){ refreshSoon(300); });
  document.addEventListener('appCriticalContentReady', function(){ refreshSoon(300); });
  document.addEventListener('visibilitychange', function(){ if (!document.hidden) { refreshDailyStatus({ force: true }); refreshSoon(0); } });
  setInterval(function(){ if (!document.hidden) refreshDailyStatus({ force: true }); }, 90000);
})();
