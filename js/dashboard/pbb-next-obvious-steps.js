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
  var SHANNON_EMAILS = [
    'shannonbirch@cocospersonaltraining.com',
    'shannonrhysbirch@gmail.com'
  ];
  var renderTimer = null;

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
      action: function(){ openInsightsTarget('#insights-steps-container'); }
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
      action: function(){ openDashboardTarget('#mood-checkin-card', { block: 'center' }); }
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

  function ensureStyles() {
    if (document.getElementById('pbb-next-steps-style')) return;
    var style = document.createElement('style');
    style.id = 'pbb-next-steps-style';
    style.textContent = [
      '#next-obvious-steps-card{font-family:inherit;}',
      '.next-steps-shell{border-radius:18px;background:linear-gradient(135deg,#ffffff 0%,#f8fafc 100%);border:1px solid #e2e8f0;box-shadow:0 12px 28px rgba(15,23,42,.08);overflow:hidden;}',
      '.next-steps-head{padding:15px 16px 11px;display:flex;align-items:center;justify-content:space-between;gap:12px;border-bottom:1px solid #eef2f7;}',
      '.next-steps-kicker{font-size:.66rem;text-transform:uppercase;letter-spacing:.08em;color:#64748b;font-weight:950;margin-bottom:3px;}',
      '.next-steps-title{font-size:1.02rem;line-height:1.2;color:#0f172a;font-weight:950;}',
      '.next-steps-note{font-size:.74rem;color:#64748b;font-weight:800;white-space:nowrap;}',
      '.next-steps-list{display:grid;gap:8px;padding:11px;}',
      '.next-step-action{width:100%;border:1px solid #e5e7eb;background:#fff;color:#0f172a;border-radius:12px;padding:11px 12px;display:flex;align-items:center;gap:11px;text-align:left;font-family:inherit;cursor:pointer;box-shadow:0 6px 14px rgba(15,23,42,.05);}',
      '.next-step-action:active{transform:scale(.99);}',
      '.next-step-mark{width:9px;align-self:stretch;border-radius:999px;background:var(--next-step-accent,#16a34a);flex-shrink:0;}',
      '.next-step-copy{flex:1;min-width:0;}',
      '.next-step-copy strong{display:block;font-size:.9rem;line-height:1.18;color:#0f172a;font-weight:950;margin-bottom:3px;}',
      '.next-step-copy span{display:block;font-size:.75rem;line-height:1.25;color:#64748b;font-weight:700;}',
      '.next-step-cta{font-size:.68rem;font-weight:950;color:var(--next-step-accent,#16a34a);white-space:nowrap;}',
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
    if (!suggestions.length) {
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
            '<div class="next-steps-title">What to do today</div>',
          '</div>',
          '<div class="next-steps-note">Private preview</div>',
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
    var button = event.target && event.target.closest ? event.target.closest('[data-next-step-id]') : null;
    if (!button) return;
    var id = button.getAttribute('data-next-step-id');
    var action = ACTIONS.find(function(item){ return item.id === id; });
    if (action && typeof action.action === 'function') action.action();
  }

  function init() {
    var card = document.getElementById('next-obvious-steps-card');
    if (!card) return;
    card.addEventListener('click', handleClick);
    refreshSoon(0);
    setTimeout(render, 1500);
    setTimeout(render, 3500);
  }

  window.pbbNextSteps = {
    refresh: render,
    isPreviewEligible: isPreviewEligible,
    getSuggestions: pickSuggestions,
    enablePreview: function(){
      try { localStorage.setItem(PREVIEW_STORAGE_KEY, '1'); } catch (_) {}
      render();
    },
    disablePreview: function(){
      try { localStorage.removeItem(PREVIEW_STORAGE_KEY); } catch (_) {}
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
  document.addEventListener('visibilitychange', function(){ if (!document.hidden) refreshSoon(0); });
})();
