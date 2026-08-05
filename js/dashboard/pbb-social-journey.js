(function () {
  'use strict';

  if (window.__pbbSocialJourneyLoaded) return;
  window.__pbbSocialJourneyLoaded = true;

  const SHANNON_USER_ID = '00a6605e-8edb-4917-85ba-24a23f179059';
  const SHANNON_EMAIL = 'shannonbirch@cocospersonaltraining.com';
  const TABLE = 'social_journey_progress';
  const VERSION = 'social_identity_v1';
  const BRISBANE_TIMEZONE = 'Australia/Brisbane';

  const WEEK_DEFINITIONS = [
    {
      week: 1,
      phase: 'FOUNDATIONS · BUILD A RHYTHM THAT CAN STICK',
      title: 'Start where it feels safe.',
      body: 'Join the Balance community, show one normal meal and practise encouraging other people.',
      tasks: [
        task('w1_feed_intro', 'Introduce yourself in Feed', 'One honest post is enough.', 'feed_posts', 1, '👋', 'feed'),
        task('w1_meal_feed', 'Share one normal meal', 'No perfect plate required.', 'meal_feed_posts', 1, '🥗', 'meals'),
        task('w1_comments', 'Encourage three members', 'Meaningful replies only.', 'feed_comments', 3, '💬', 'feed')
      ]
    },
    {
      week: 2,
      phase: 'FOUNDATIONS · TRAIN FOR PROGRESS',
      title: 'Training becomes evidence.',
      body: 'Make the minimum visible. A normal session counts, and sharing it helps the repetition feel real.',
      tasks: [
        task('w2_workout_feed', 'Share a workout to Feed', 'A normal session still counts.', 'workout_feed_posts', 1, '🏋️', 'movement'),
        task('w2_workout_days', 'Complete two workouts', 'Keep the minimum repeatable.', 'workout_days', 2, '🎯', 'movement'),
        task('w2_comments', 'Support five Feed posts', 'Help someone else keep showing up.', 'feed_comments', 5, '💬', 'feed')
      ]
    },
    {
      week: 3,
      phase: 'FOUNDATIONS · FUEL THE WORK',
      title: 'Let normal meals count.',
      body: 'Document what you already eat. The goal is awareness and useful repetition, not performance.',
      tasks: [
        task('w3_meals', 'Post three meals to Feed', 'Use meals you are already eating.', 'meal_feed_posts', 3, '🥗', 'meals'),
        task('w3_reflection', 'Add one meal reflection', 'Write one line about how it fuelled the day.', 'manual', 1, '✍️', 'feed'),
        task('w3_comments', 'Leave five real replies', 'React to the person, not just the photo.', 'feed_comments', 5, '💬', 'feed')
      ]
    },
    {
      week: 4,
      phase: 'FOUNDATIONS · WORK WITH REAL LIFE',
      title: 'Teach your algorithm what belongs there.',
      body: 'Before posting publicly, deliberately change what you repeatedly see, save and return to.',
      instagramAction: true,
      tasks: [
        task('w4_mute', 'Mute five unhelpful accounts', 'Remove comparison, noise and old cues.', 'manual', 1, '🔇', 'instagram'),
        task('w4_follow', 'Follow ten useful accounts', 'Training, meals and honest progress.', 'manual', 1, '➕', 'instagram'),
        task('w4_save', 'Save three useful posts', 'Give the algorithm clearer evidence.', 'manual', 1, '🔖', 'instagram')
      ]
    },
    {
      week: 5,
      phase: 'FOUNDATIONS · MAKE THE PLAN FIT THE GOAL',
      title: 'Take one piece of evidence public.',
      body: 'Use a Balance share card so the first public step is attached to something you actually did.',
      tasks: [
        task('w5_workout_ig', 'Share one workout to IG Story', 'Use the share button after a workout.', 'workout_instagram_shares', 1, '◎', 'movement'),
        task('w5_meal_ig', 'Share one meal to Instagram', 'Use a real meal, not a staged one.', 'meal_instagram_shares', 1, '🥗', 'meals'),
        task('w5_comments', 'Leave five Feed replies', 'Keep practising connection inside Balance.', 'feed_comments', 5, '💬', 'feed')
      ]
    },
    {
      week: 6,
      phase: 'FOUNDATIONS · KEEP BECOMING THE PERSON WHO DOES IT',
      title: 'Show the process, not a performance.',
      body: 'Finish Foundations with a light routine that can survive an ordinary messy week.',
      tasks: [
        task('w6_ig_shares', 'Share three honest Instagram Stories', 'Meal, workout or reflection.', 'instagram_shares', 3, '◎', 'instagram'),
        task('w6_recap', 'Post a six-week recap to Feed', 'Name what changed and what still feels hard.', 'manual', 1, '📝', 'feed'),
        task('w6_comments', 'Support ten Feed posts', 'Close the phase by giving something back.', 'feed_comments', 10, '💬', 'feed')
      ]
    },
    {
      week: 7,
      phase: 'CONTINUATION · CHOOSE YOUR IDENTITY',
      title: 'Give the account one simple job.',
      body: 'Document the process, connect with people doing the same and keep your receipts.',
      instagramAction: true,
      tasks: [
        task('w7_purpose', 'Choose your account purpose', 'Write one sentence about what belongs there.', 'manual', 1, '🎯', 'instagram'),
        task('w7_bio', 'Write or refresh your bio', 'Say what you are working on.', 'manual', 1, '✍️', 'instagram'),
        task('w7_first_post', 'Make your first public post', 'Start with evidence you already shared in Balance.', 'manual', 1, '📷', 'instagram')
      ]
    },
    {
      week: 8,
      phase: 'CONTINUATION · KEEP IT LIGHT',
      title: 'Build a routine you can repeat.',
      body: 'Posting comes from the work you are already doing. It does not become another full-time job.',
      tasks: [
        task('w8_workouts', 'Complete two workouts', 'The behaviour still comes first.', 'workout_days', 2, '🏋️', 'movement'),
        task('w8_ig_shares', 'Share two Instagram Stories', 'Use one workout and one meal.', 'instagram_shares', 2, '◎', 'instagram'),
        task('w8_comments', 'Leave five Feed replies', 'Keep the safe community active too.', 'feed_comments', 5, '💬', 'feed')
      ]
    },
    {
      week: 9,
      phase: 'CONTINUATION · REVIEW THE INPUTS',
      title: 'Notice what your feed is teaching you.',
      body: 'Review the algorithm again and keep only the signals that help the pattern you want.',
      instagramAction: true,
      tasks: [
        task('w9_review', 'Review your Explore page', 'Notice what your recent behaviour trained.', 'manual', 1, '🔎', 'instagram'),
        task('w9_remove', 'Remove five noisy inputs', 'Mute, unfollow or stop feeding them.', 'manual', 1, '🔇', 'instagram'),
        task('w9_save', 'Save three useful examples', 'Collect ideas you would actually use.', 'manual', 1, '🔖', 'instagram')
      ]
    },
    {
      week: 10,
      phase: 'CONTINUATION · YOUR WEEKLY RHYTHM',
      title: 'Do the work, then document it.',
      body: 'The public routine stays downstream of training, food and real life.',
      tasks: [
        task('w10_workouts', 'Complete two workouts', 'Keep the centre of the system intact.', 'workout_days', 2, '🏋️', 'movement'),
        task('w10_ig_shares', 'Share three Instagram Stories', 'Use evidence from the week.', 'instagram_shares', 3, '◎', 'instagram'),
        task('w10_comments', 'Leave five Feed replies', 'Support people without spamming them.', 'feed_comments', 5, '💬', 'feed')
      ]
    },
    {
      week: 11,
      phase: 'CONTINUATION · TELL ONE USEFUL STORY',
      title: 'Give the evidence some meaning.',
      body: 'Move beyond posting a receipt and explain one small thing you learned from it.',
      tasks: [
        task('w11_story', 'Tell one useful progress story', 'What happened, what helped and what comes next.', 'manual', 1, '🗣️', 'instagram'),
        task('w11_ig_shares', 'Share three Instagram Stories', 'Keep the rest simple and honest.', 'instagram_shares', 3, '◎', 'instagram'),
        task('w11_comments', 'Leave five Feed replies', 'Stay connected inside Balance.', 'feed_comments', 5, '💬', 'feed')
      ]
    },
    {
      week: 12,
      phase: 'CONTINUATION · KEEP THE PATTERN',
      title: 'Choose what you will keep doing.',
      body: 'Finish with a sustainable rhythm and a clear reason for documenting the journey.',
      tasks: [
        task('w12_recap', 'Post your twelve-week recap', 'Share the pattern, not just the result.', 'manual', 1, '📝', 'instagram'),
        task('w12_ig_shares', 'Share three Instagram Stories', 'Keep your normal weekly rhythm.', 'instagram_shares', 3, '◎', 'instagram'),
        task('w12_comments', 'Support ten Feed posts', 'Finish by contributing to the community.', 'feed_comments', 10, '💬', 'feed')
      ]
    }
  ];

  let state = null;
  let progress = null;
  let candidates = [];
  let candidatesLoaded = false;
  let loading = false;
  let onboardingStep = 0;
  let initialized = false;

  function task(id, label, hint, type, target, icon, action) {
    return { id, label, hint, type, target, icon, action };
  }

  function isPilotUser() {
    const user = window.currentUser;
    if (!user || window.isAdminViewing) return false;
    return String(user.id || '') === SHANNON_USER_ID
      && String(user.email || '').trim().toLowerCase() === SHANNON_EMAIL;
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function safeObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  }

  function safeArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function brisbaneDateKey(date) {
    try {
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: BRISBANE_TIMEZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).formatToParts(date || new Date());
      const map = {};
      parts.forEach(part => { if (part.type !== 'literal') map[part.type] = part.value; });
      return map.year + '-' + map.month + '-' + map.day;
    } catch (_) {
      return new Date().toISOString().slice(0, 10);
    }
  }

  function dateFromKey(key) {
    return new Date(String(key || brisbaneDateKey()) + 'T00:00:00+10:00');
  }

  function addDaysKey(key, days) {
    const date = dateFromKey(key);
    date.setUTCDate(date.getUTCDate() + Number(days || 0));
    return brisbaneDateKey(date);
  }

  function getWeekDefinition() {
    const week = Math.max(1, Math.min(12, Number(state && state.current_week) || 1));
    return WEEK_DEFINITIONS[week - 1];
  }

  function defaultState() {
    return {
      user_id: SHANNON_USER_ID,
      journey_version: VERSION,
      current_week: 1,
      week_started_at: brisbaneDateKey(),
      onboarding_complete: false,
      completed_task_ids: [],
      progress_snapshot: {},
      settings: {},
      reminder_receipts: []
    };
  }

  function normalizeState(row) {
    const base = defaultState();
    const next = Object.assign(base, row || {});
    next.current_week = Math.max(1, Math.min(12, Number(next.current_week) || 1));
    next.completed_task_ids = safeArray(next.completed_task_ids);
    next.progress_snapshot = safeObject(next.progress_snapshot);
    next.settings = safeObject(next.settings);
    next.reminder_receipts = safeArray(next.reminder_receipts);
    return next;
  }

  function getCard() {
    return document.getElementById('social-journey-card');
  }

  function ensureUi() {
    if (!document.getElementById('social-journey-view')) {
      const view = document.createElement('section');
      view.id = 'social-journey-view';
      view.setAttribute('aria-hidden', 'true');
      view.innerHTML = '<header class="social-journey-header"><h1 class="social-journey-header__title">Build the Pattern</h1><div class="social-journey-header__week">Social journey</div></header><div class="social-journey-scroll" id="social-journey-content"></div>';
      document.body.appendChild(view);
    }

    if (!document.getElementById('social-journey-onboarding')) {
      const onboarding = document.createElement('section');
      onboarding.id = 'social-journey-onboarding';
      onboarding.setAttribute('aria-hidden', 'true');
      onboarding.innerHTML = '<div class="social-journey-onboarding__sheet" id="social-journey-onboarding-sheet"></div>';
      document.body.appendChild(onboarding);
    }

    if (typeof window.enableSwipeBackNavigation === 'function') {
      try { window.enableSwipeBackNavigation('social-journey-view', closeJourney); } catch (_) {}
    }
  }

  async function upsertState(patch) {
    if (!window.supabaseClient || !state) return state;
    state = normalizeState(Object.assign({}, state, patch || {}));
    const payload = {
      user_id: SHANNON_USER_ID,
      journey_version: VERSION,
      current_week: state.current_week,
      week_started_at: state.week_started_at,
      onboarding_complete: !!state.onboarding_complete,
      completed_task_ids: state.completed_task_ids,
      progress_snapshot: state.progress_snapshot,
      settings: state.settings,
      reminder_receipts: state.reminder_receipts
    };
    const result = await window.supabaseClient
      .from(TABLE)
      .upsert(payload, { onConflict: 'user_id' })
      .select()
      .single();
    if (result.error) throw result.error;
    state = normalizeState(result.data || payload);
    return state;
  }

  async function loadState() {
    if (!window.supabaseClient) throw new Error('Balance is still connecting.');
    const result = await window.supabaseClient
      .from(TABLE)
      .select('*')
      .eq('user_id', SHANNON_USER_ID)
      .maybeSingle();
    if (result.error) throw result.error;
    state = normalizeState(result.data || defaultState());
    if (!result.data) await upsertState({});
    await rollForwardElapsedWeeks();
    return state;
  }

  async function rollForwardElapsedWeeks() {
    if (!state || state.current_week >= 12) return;
    const today = dateFromKey(brisbaneDateKey());
    const start = dateFromKey(state.week_started_at);
    const elapsed = Math.max(0, Math.floor((today.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000)));
    if (!elapsed) return;
    const nextWeek = Math.min(12, state.current_week + elapsed);
    const moved = nextWeek - state.current_week;
    await upsertState({
      current_week: nextWeek,
      week_started_at: addDaysKey(state.week_started_at, moved * 7),
      progress_snapshot: {}
    });
  }

  async function safeQuery(factory) {
    try {
      const result = await factory();
      if (result && result.error) return [];
      return result && Array.isArray(result.data) ? result.data : [];
    } catch (_) {
      return [];
    }
  }

  async function calculateProgress() {
    if (!state || !window.supabaseClient) return null;
    const supabase = window.supabaseClient;
    const startIso = dateFromKey(state.week_started_at).toISOString();
    const endIso = dateFromKey(addDaysKey(state.week_started_at, 7)).toISOString();
    const [stories, comments, transactions, workouts] = await Promise.all([
      safeQuery(() => supabase.from('stories')
        .select('id,media_type,created_at')
        .eq('user_id', SHANNON_USER_ID)
        .gte('created_at', startIso)
        .lt('created_at', endIso)),
      safeQuery(() => supabase.from('feed_comments')
        .select('id,created_at')
        .eq('user_id', SHANNON_USER_ID)
        .gte('created_at', startIso)
        .lt('created_at', endIso)),
      safeQuery(() => supabase.from('point_transactions')
        .select('id,transaction_type,created_at')
        .eq('user_id', SHANNON_USER_ID)
        .gte('created_at', startIso)
        .lt('created_at', endIso)
        .in('transaction_type', [
          'earn_meal_instagram_share',
          'earn_activity_instagram_share',
          'earn_workout_instagram_share'
        ])),
      safeQuery(() => supabase.from('workouts')
        .select('workout_date')
        .eq('user_id', SHANNON_USER_ID)
        .eq('workout_type', 'history')
        .gte('workout_date', state.week_started_at)
        .lt('workout_date', addDaysKey(state.week_started_at, 7)))
    ]);

    const manual = new Set(state.completed_task_ids);
    const workoutDays = new Set(workouts.map(row => row.workout_date).filter(Boolean)).size;
    const instagramShares = transactions.length;
    const counts = {
      feed_posts: stories.length,
      meal_feed_posts: stories.filter(row => row.media_type === 'meal_card' || row.media_type === 'nutrition_card').length,
      workout_feed_posts: stories.filter(row => row.media_type === 'workout_card').length,
      feed_comments: comments.length,
      instagram_shares: instagramShares,
      workout_instagram_shares: transactions.filter(row => row.transaction_type === 'earn_workout_instagram_share').length,
      meal_instagram_shares: transactions.filter(row => row.transaction_type === 'earn_meal_instagram_share').length,
      workout_days: workoutDays
    };
    const definition = getWeekDefinition();
    const tasks = definition.tasks.map(item => {
      const current = item.type === 'manual' ? (manual.has(item.id) ? 1 : 0) : Number(counts[item.type] || 0);
      return Object.assign({}, item, {
        current,
        complete: current >= item.target,
        percent: Math.max(0, Math.min(100, item.target ? (current / item.target) * 100 : 0))
      });
    });
    progress = {
      week: definition.week,
      week_started_at: state.week_started_at,
      updated_at: new Date().toISOString(),
      completed_count: tasks.filter(item => item.complete).length,
      total_count: tasks.length,
      tasks
    };
    state.progress_snapshot = progress;
    await upsertState({ progress_snapshot: progress });
    return progress;
  }

  function weekDots() {
    return '<div class="social-journey-week-dots">' + WEEK_DEFINITIONS.map(item => '<span class="' + (item.week <= state.current_week ? 'done' : '') + '"></span>').join('') + '</div>';
  }

  function renderCard() {
    const card = getCard();
    if (!card || !isPilotUser() || !state) return;
    const definition = getWeekDefinition();
    const completed = progress ? progress.completed_count : 0;
    const total = progress ? progress.total_count : 3;
    const percent = total ? Math.round((completed / total) * 100) : 0;
    card.style.display = 'block';
    card.innerHTML = '<div class="social-journey-card__inner">'
      + '<div class="social-journey-card__eyebrow">Journey Goals · Week ' + definition.week + ' of 12</div>'
      + '<div class="social-journey-card__title">' + escapeHtml(definition.title) + '</div>'
      + '<div class="social-journey-card__copy">' + escapeHtml(definition.body) + '</div>'
      + '<div class="social-journey-card__row"><div class="social-journey-card__progress"><span style="width:' + percent + '%"></span></div><div class="social-journey-card__count">' + completed + ' / ' + total + '</div></div>'
      + '<div class="social-journey-card__arrow">→</div></div>';
  }

  function taskActionLabel(item) {
    if (item.type === 'manual') return item.complete ? 'Completed' : 'Mark done';
    if (item.action === 'feed') return 'Open Feed';
    if (item.action === 'meals') return 'Open Nutrition';
    if (item.action === 'movement') return 'Open Movement';
    if (item.action === 'instagram') return 'Open Instagram';
    return 'Open';
  }

  function renderTasks() {
    const tasks = progress ? progress.tasks : getWeekDefinition().tasks.map(item => Object.assign({}, item, { current: 0, complete: false }));
    return tasks.map(item => {
      const value = item.type === 'manual'
        ? (item.complete ? 'Done' : 'Open')
        : Math.min(item.current, item.target) + ' / ' + item.target;
      return '<article class="social-journey-task ' + (item.complete ? 'is-complete' : '') + '">'
        + '<div class="social-journey-task__icon">' + (item.complete ? '✓' : item.icon) + '</div>'
        + '<div><div class="social-journey-task__title">' + escapeHtml(item.label) + '</div><div class="social-journey-task__hint">' + escapeHtml(item.hint) + '</div></div>'
        + '<div class="social-journey-task__value">' + escapeHtml(value) + '</div>'
        + '<button type="button" class="social-journey-task__action ' + (item.type === 'manual' ? 'is-check' : '') + '" onclick="socialJourney.taskAction(\'' + item.id + '\')">' + escapeHtml(taskActionLabel(item)) + '</button>'
        + '</article>';
    }).join('');
  }

  function renderJourney() {
    ensureUi();
    const container = document.getElementById('social-journey-content');
    if (!container || !state) return;
    const definition = getWeekDefinition();
    const settings = safeObject(state.settings);
    const connectedHandle = settings.instagram_username ? '@' + settings.instagram_username : '';
    const reminderText = settings.instagram_reminders_enabled && connectedHandle
      ? 'Instagram reminders are connected to ' + connectedHandle + '. Balance only sends one when a journey goal is still open and the messaging window allows it.'
      : 'In-app reminders stay on. Connect an eligible Instagram conversation if you also want a specific DM about an unfinished journey goal.';
    const instagramButton = definition.instagramAction
      ? '<button type="button" class="social-journey-button secondary" onclick="socialJourney.openInstagram()">Open Instagram</button>'
      : '';
    const complete = progress && progress.completed_count >= progress.total_count;

    document.querySelector('.social-journey-header__title').textContent = definition.title;
    document.querySelector('.social-journey-header__week').textContent = 'Week ' + definition.week + ' of 12';
    container.innerHTML = '<section class="social-journey-hero">'
      + '<div class="social-journey-hero__eyebrow">' + escapeHtml(definition.phase) + '</div>'
      + '<h2>' + escapeHtml(definition.title) + '</h2><p>' + escapeHtml(definition.body) + '</p>' + weekDots() + '</section>'
      + '<section class="social-journey-section"><h3 class="social-journey-section__heading">This week</h3>' + renderTasks() + '</section>'
      + (definition.week === 6 ? '<div class="social-journey-callout"><strong>Foundations is complete after this phase.</strong><p>Weeks 7 to 12 are the optional continuation track for building a public rhythm.</p></div>' : '')
      + (complete ? '<div class="social-journey-callout"><strong>This week is complete.</strong><p>You can let the next week arrive naturally or use the pilot control below to preview it now.</p></div>' : '')
      + '<section class="social-journey-section"><h3 class="social-journey-section__heading">Reminder route</h3><div class="social-journey-callout"><strong>' + (connectedHandle ? connectedHandle : 'In-app first') + '</strong><p>' + escapeHtml(reminderText) + '</p></div>'
      + '<button type="button" class="social-journey-button secondary" onclick="socialJourney.openReminderSetup()">' + (connectedHandle ? 'Review Instagram reminder' : 'Connect Instagram reminder') + '</button>' + instagramButton + '</section>'
      + '<section class="social-journey-pilot-controls"><h3>Shannon pilot controls</h3><p>These controls change only this social journey. They never reset your character, levels, coins, workouts, meals or other account data.</p>'
      + '<button type="button" class="social-journey-button secondary" onclick="socialJourney.sendTestReminder()" ' + (connectedHandle ? '' : 'disabled') + '>Send a test Instagram reminder</button>'
      + '<button type="button" class="social-journey-button secondary" onclick="socialJourney.advanceWeek()">' + (state.current_week >= 12 ? 'Journey is at Week 12' : 'Preview the next week') + '</button>'
      + '<button type="button" class="social-journey-button danger" onclick="socialJourney.restart()">Restart only this journey</button></section>';
  }

  function openJourney() {
    if (!isPilotUser() || !state) return;
    ensureUi();
    calculateProgress().catch(function () {}).finally(function () {
      renderCard();
      renderJourney();
    });
    const view = document.getElementById('social-journey-view');
    view.classList.add('is-open');
    view.setAttribute('aria-hidden', 'false');
    if (typeof window.pushNavigationState === 'function') {
      try { window.pushNavigationState('social-journey-view', closeJourney); } catch (_) {}
    }
  }

  function closeJourney() {
    const view = document.getElementById('social-journey-view');
    if (!view) return;
    view.classList.remove('is-open');
    view.setAttribute('aria-hidden', 'true');
  }

  function switchTo(action) {
    closeJourney();
    if (action === 'instagram') return openInstagram();
    const tab = action === 'feed' ? 'friends' : (action === 'meals' ? 'meals' : (action === 'movement' ? 'movement-tab' : 'dashboard'));
    if (typeof window.switchAppTab === 'function') {
      try { window.switchAppTab(tab); } catch (_) {}
    }
    if (action === 'feed') {
      setTimeout(function () {
        const composer = document.querySelector('#feed-composer-card textarea,#feed-composer-card input');
        if (composer && typeof composer.focus === 'function') composer.focus();
      }, 450);
    }
  }

  async function toggleManualTask(taskId) {
    const ids = new Set(state.completed_task_ids);
    if (ids.has(taskId)) ids.delete(taskId); else ids.add(taskId);
    await upsertState({ completed_task_ids: Array.from(ids) });
    await calculateProgress();
    renderCard();
    renderJourney();
  }

  function openInstagram() {
    const url = 'https://www.instagram.com/';
    try {
      const opened = window.open(url, '_blank', 'noopener');
      if (!opened) window.location.href = url;
    } catch (_) {
      window.location.href = url;
    }
  }

  async function getAccessToken() {
    const result = await window.supabaseClient.auth.getSession();
    return result && result.data && result.data.session ? result.data.session.access_token : '';
  }

  async function callPilot(action, payload) {
    const token = await getAccessToken();
    if (!token) throw new Error('Your Balance session needs refreshing.');
    const response = await fetch('/.netlify/functions/social-journey-pilot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify(Object.assign({ action }, payload || {}))
    });
    const result = await response.json().catch(function () { return {}; });
    if (!response.ok) throw new Error(result.error || result.message || 'That action did not work.');
    return result;
  }

  async function loadCandidates() {
    const result = await callPilot('candidates');
    candidates = safeArray(result.candidates);
    candidatesLoaded = true;
    return candidates;
  }

  function showToast(message, type) {
    if (typeof window.showToast === 'function') window.showToast(message, type || 'info');
  }

  function onboardingCopy(stepIndex) {
    const steps = [
      {
        eyebrow: 'Your new member experience',
        title: 'Build the pattern, then share it.',
        body: 'The first six weeks use the Balance Feed as a safe rehearsal space. The next six help you take the same evidence to Instagram.',
        content: '<div class="social-journey-onboarding__proof"><div>1 · Practise inside Balance</div><div>2 · Change the inputs around you</div><div>3 · Share publicly when you are ready</div></div>'
      },
      {
        eyebrow: 'Your existing account stays intact',
        title: 'Nothing you have earned is being reset.',
        body: 'This is a separate onboarding experience for the pilot. It does not touch the rest of your Balance account.',
        content: '<div class="social-journey-onboarding__proof"><div>✓ Character and levels stay</div><div>✓ Coins, workouts and meals stay</div><div>✓ Programs, friends and history stay</div></div>'
      },
      {
        eyebrow: 'Course lesson → journey goals',
        title: 'Every lesson ends with something visible.',
        body: 'Your three Journey Goals sit directly under Weekly Goals. Real Feed posts, comments and Instagram shares update them automatically.',
        content: '<div class="social-journey-onboarding__proof"><div>👋 Introduce yourself in Feed</div><div>🥗 Share one normal meal</div><div>💬 Encourage three members</div></div>'
      },
      {
        eyebrow: 'Optional Instagram reminders',
        title: 'Use Shannon’s Instagram to close the loop.',
        body: 'In-app remains the default. You can connect one of your eligible Instagram test conversations for a specific reminder when a journey goal is still open.',
        content: '<div id="social-journey-connect-box"><div class="social-journey-status">Loading eligible Instagram conversations...</div></div>'
      }
    ];
    return steps[stepIndex] || steps[0];
  }

  function onboardingDots() {
    return '<div class="social-journey-onboarding__dots">' + [0,1,2,3].map(function (index) { return '<span class="' + (index === onboardingStep ? 'active' : '') + '"></span>'; }).join('') + '</div>';
  }

  function renderOnboarding() {
    ensureUi();
    const sheet = document.getElementById('social-journey-onboarding-sheet');
    const copy = onboardingCopy(onboardingStep);
    const final = onboardingStep === 3;
    sheet.innerHTML = '<div class="social-journey-onboarding__visual"><div class="social-journey-onboarding__step">' + escapeHtml(copy.eyebrow) + '</div><h2>' + escapeHtml(copy.title) + '</h2><p>' + escapeHtml(copy.body) + '</p></div>'
      + '<div class="social-journey-onboarding__body">' + copy.content + onboardingDots()
      + '<button type="button" class="social-journey-button" onclick="socialJourney.onboardingNext()">' + (final ? (state && state.onboarding_complete ? 'Done' : 'Start Week 1') : 'Continue') + '</button>'
      + (onboardingStep > 0 ? '<button type="button" class="social-journey-button secondary" onclick="socialJourney.onboardingBack()">Back</button>' : '')
      + '</div>';
    if (final) renderCandidateSelect();
  }

  function renderCandidateSelect() {
    const box = document.getElementById('social-journey-connect-box');
    if (!box) return;
    if (!candidatesLoaded) {
      box.innerHTML = '<div class="social-journey-status">Loading eligible Instagram conversations...</div>';
      loadCandidates().then(renderCandidateSelect).catch(function (error) {
        candidatesLoaded = true;
        box.innerHTML = '<div class="social-journey-status">' + escapeHtml(error.message) + ' You can connect it later.</div>';
      });
      return;
    }
    if (!candidates.length) {
      box.innerHTML = '<div class="social-journey-status">No eligible test conversation is available right now. In-app reminders will stay on.</div>';
      return;
    }
    const currentHandle = safeObject(state.settings).instagram_username || '';
    box.innerHTML = '<select id="social-journey-instagram-select" class="social-journey-instagram-select"><option value="">Keep in-app reminders only</option>'
      + candidates.map(function (item) { return '<option value="' + escapeHtml(item.username) + '" ' + (item.username === currentHandle ? 'selected' : '') + '>@' + escapeHtml(item.username) + (item.send_ready ? ' · ready now' : ' · needs a fresh DM') + '</option>'; }).join('')
      + '</select><button type="button" class="social-journey-button secondary" style="margin-top:9px" onclick="socialJourney.connectSelectedInstagram()">Save reminder choice</button><div class="social-journey-status" id="social-journey-connect-status">Nothing is sent until you explicitly connect a conversation.</div>';
  }

  function openOnboarding() {
    ensureUi();
    onboardingStep = 0;
    renderOnboarding();
    const overlay = document.getElementById('social-journey-onboarding');
    overlay.classList.add('is-open');
    overlay.setAttribute('aria-hidden', 'false');
  }

  function closeOnboarding() {
    const overlay = document.getElementById('social-journey-onboarding');
    if (!overlay) return;
    overlay.classList.remove('is-open');
    overlay.setAttribute('aria-hidden', 'true');
  }

  async function finishOnboarding() {
    await upsertState({ onboarding_complete: true, current_week: 1, week_started_at: brisbaneDateKey(), progress_snapshot: {} });
    closeOnboarding();
    await calculateProgress();
    renderCard();
    openJourney();
  }

  async function connectSelectedInstagram() {
    const select = document.getElementById('social-journey-instagram-select');
    const username = select ? select.value : '';
    const status = document.getElementById('social-journey-connect-status');
    if (!username) {
      const result = await callPilot('disconnect_instagram');
      if (result.state) state = normalizeState(result.state);
      if (status) status.textContent = 'Instagram reminders are off. In-app reminders remain active.';
      renderJourney();
      return;
    }
    if (status) status.textContent = 'Connecting @' + username + '...';
    try {
      const result = await callPilot('connect_instagram', { username });
      if (result.state) state = normalizeState(result.state);
      if (status) status.textContent = result.send_ready
        ? '@' + username + ' is connected and inside the current messaging window.'
        : '@' + username + ' is connected. Send Balance a fresh DM before a reminder is due.';
      showToast('Instagram reminder choice saved.', 'success');
      renderJourney();
    } catch (error) {
      if (status) status.textContent = error.message;
      showToast(error.message, 'error');
    }
  }

  function openReminderSetup() {
    onboardingStep = 3;
    renderOnboarding();
    const overlay = document.getElementById('social-journey-onboarding');
    overlay.classList.add('is-open');
    overlay.setAttribute('aria-hidden', 'false');
  }

  async function sendTestReminder() {
    try {
      const result = await callPilot('send_test_reminder');
      if (result.state) state = normalizeState(result.state);
      showToast(result.message || 'Test Instagram reminder sent.', 'success');
      renderJourney();
    } catch (error) {
      showToast(error.message, 'error');
    }
  }

  async function advanceWeek() {
    if (!state || state.current_week >= 12) return;
    await upsertState({ current_week: state.current_week + 1, week_started_at: brisbaneDateKey(), progress_snapshot: {} });
    await calculateProgress();
    renderCard();
    renderJourney();
    const scroll = document.getElementById('social-journey-content');
    if (scroll) scroll.scrollTop = 0;
  }

  async function restart() {
    const confirmed = window.confirm('Restart only the social journey from Week 1? Your character, levels, coins and all other Balance data stay exactly as they are.');
    if (!confirmed) return;
    const settings = safeObject(state.settings);
    await upsertState({
      current_week: 1,
      week_started_at: brisbaneDateKey(),
      onboarding_complete: false,
      completed_task_ids: [],
      progress_snapshot: {},
      reminder_receipts: [],
      settings
    });
    progress = null;
    closeJourney();
    openOnboarding();
  }

  async function refresh() {
    if (!isPilotUser() || loading) return;
    loading = true;
    try {
      await loadState();
      ensureUi();
      await calculateProgress();
      renderCard();
      if (!state.onboarding_complete && !document.getElementById('social-journey-onboarding').classList.contains('is-open')) {
        setTimeout(openOnboarding, 600);
      }
    } catch (error) {
      console.warn('[social-journey] refresh failed', error);
      const card = getCard();
      if (card) card.style.display = 'none';
    } finally {
      loading = false;
    }
  }

  async function taskAction(taskId) {
    const definition = getWeekDefinition();
    const item = definition.tasks.find(candidate => candidate.id === taskId);
    if (!item) return;
    if (item.type === 'manual') {
      await toggleManualTask(item.id);
      return;
    }
    switchTo(item.action);
  }

  function init() {
    if (initialized || !isPilotUser()) return;
    initialized = true;
    const card = getCard();
    if (card) card.addEventListener('click', openJourney);
    ensureUi();
    refresh();
  }

  window.socialJourney = {
    isPilotUser,
    isOnboardingComplete: function () { return !!(state && state.onboarding_complete); },
    open: openJourney,
    close: closeJourney,
    refresh,
    taskAction,
    openInstagram,
    openReminderSetup,
    connectSelectedInstagram,
    sendTestReminder,
    advanceWeek,
    restart,
    onboardingNext: function () {
      if (onboardingStep < 3) {
        onboardingStep += 1;
        renderOnboarding();
      } else {
        if (state && state.onboarding_complete) closeOnboarding();
        else finishOnboarding().catch(function (error) { showToast(error.message, 'error'); });
      }
    },
    onboardingBack: function () {
      if (onboardingStep > 0) onboardingStep -= 1;
      renderOnboarding();
    },
    _test: {
      WEEK_DEFINITIONS,
      brisbaneDateKey,
      getWeekDefinition: function () { return getWeekDefinition(); }
    }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
  document.addEventListener('pbbInitComplete', init);
  document.addEventListener('appCriticalContentReady', init);
  window.addEventListener('pbbInitComplete', init);
  window.addEventListener('appCriticalContentReady', init);
  window.addEventListener('pbbWeeklyGoalsSaved', refresh);
  document.addEventListener('visibilitychange', function () { if (!document.hidden && initialized) refresh(); });
})();
