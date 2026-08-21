(function () {
  'use strict';

  if (window.__pbbSocialJourneyLoaded) return;
  window.__pbbSocialJourneyLoaded = true;

  const SHANNON_USER_ID = '00a6605e-8edb-4917-85ba-24a23f179059';
  const SHANNON_EMAIL = 'shannonbirch@cocospersonaltraining.com';
  const TABLE = 'social_journey_progress';
  const VERSION = 'social_identity_v1';
  const BRISBANE_TIMEZONE = 'Australia/Brisbane';
  const WELCOME_AUDIO_URL = window.PBB_BALANCE_WELCOME_AUDIO_URL || '/assets/audio/shannon-balance-welcome.mp3';

  const WEEK_DEFINITIONS = [
    {
      week: 1,
      phase: 'FOUNDATIONS · BUILD THE EVIDENCE',
      title: 'Make the first reps visible.',
      body: 'Do one real action, then record it. Feed is not a performance; it is a supportive environment that helps the new pattern feel normal.',
      tasks: [
      task('w1_feed_intro', 'Introduce yourself to the Feed', 'Write a simple hello. No photo needed.', 'feed_posts', 1, '\uD83D\uDC4B', 'feed'),
        task('w1_first_workout_share', 'Complete and share your first workout', 'Finish the version that fits today, then share the completed workout to Feed.', 'workout_bundle', 1, '\uD83C\uDFAF', 'movement'),
        task('w1_meal_feed', 'Share one normal meal', 'Eat first, then post it. No perfect plate required.', 'meal_feed_posts', 1, '\uD83E\uDD57', 'meals')
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
      phase: 'BALANCE IDENTITY · TRAIN THE INPUTS',
      title: 'Choose the inputs. Then choose the account.',
      body: 'Your attention trains your feed, and your feed influences what feels normal. Reset the loop, plan a clear fitness account and start participating on purpose.',
      instagramAction: true,
      tasks: [
        task('w7_plan', 'Build your fitness Instagram plan', 'Define the purpose, niche, audience, pillars, bio, boundaries and first posts.', 'planner', 1, '🧭', 'planner'),
        task('w7_account', 'Create or repurpose your account', 'Set up the handle and bio from your plan. A private account is allowed.', 'manual', 1, '📱', 'instagram'),
        task('w7_reset', 'Reset twenty algorithm inputs', 'Mute five noisy accounts, follow ten useful accounts and save five useful posts.', 'manual', 1, '🔄', 'instagram'),
        task('w7_daily_comments', 'Leave 3 meaningful Instagram comments today', 'Do this on at least seven days this week. Respond to the person or the idea, not just the photo.', 'daily_manual', 7, '💬', 'instagram')
      ]
    },
    {
      week: 8,
      phase: 'BALANCE IDENTITY · PUBLISH THE EVIDENCE',
      title: 'Build your first content rhythm.',
      body: 'Publish from work you already did, then use deliberate conversations to become part of the fitness community.',
      tasks: [
        task('w8_workouts', 'Complete two workouts', 'The behaviour still comes first.', 'workout_days', 2, '🏋️', 'movement'),
        task('w8_first_post', 'Publish your first fitness post', 'Use one of the three post ideas in your plan and evidence you already have.', 'manual', 1, '📷', 'instagram'),
        task('w8_ig_shares', 'Share three Instagram Stories', 'Use a workout, a meal and one honest reflection.', 'instagram_shares', 3, '◎', 'instagram'),
        task('w8_daily_comments', 'Leave 3 meaningful Instagram comments today', 'Repeat on at least seven days. Start real conversations in your niche.', 'daily_manual', 7, '💬', 'instagram')
      ]
    },
    {
      week: 9,
      phase: 'BALANCE IDENTITY · AUDIT THE LOOP',
      title: 'Notice what your feed is teaching you.',
      body: 'Review the algorithm again and keep only the signals that help the pattern you want.',
      instagramAction: true,
      tasks: [
        task('w9_review', 'Review your Explore page', 'Notice what your recent behaviour trained.', 'manual', 1, '🔎', 'instagram'),
        task('w9_remove', 'Remove five noisy inputs', 'Mute, unfollow or stop feeding them.', 'manual', 1, '🔇', 'instagram'),
        task('w9_save', 'Save ten useful examples', 'Collect ideas you would genuinely adapt, not copy.', 'manual', 1, '🔖', 'instagram'),
        task('w9_daily_comments', 'Leave 3 meaningful Instagram comments today', 'Repeat on at least seven days and notice which conversations change your feed.', 'daily_manual', 7, '💬', 'instagram')
      ]
    },
    {
      week: 10,
      phase: 'BALANCE IDENTITY · YOUR WEEKLY RHYTHM',
      title: 'Do the work, then document it.',
      body: 'The public routine stays downstream of training, food and real life.',
      tasks: [
        task('w10_workouts', 'Complete two workouts', 'Keep the centre of the system intact.', 'workout_days', 2, '🏋️', 'movement'),
        task('w10_post', 'Publish one useful fitness post', 'Teach or document one thing from your real week.', 'manual', 1, '📷', 'instagram'),
        task('w10_ig_shares', 'Share three Instagram Stories', 'Use evidence from the week.', 'instagram_shares', 3, '◎', 'instagram'),
        task('w10_daily_comments', 'Leave 3 meaningful Instagram comments today', 'Repeat on at least seven days. Be specific, useful and human.', 'daily_manual', 7, '💬', 'instagram')
      ]
    },
    {
      week: 11,
      phase: 'BALANCE IDENTITY · TELL ONE USEFUL STORY',
      title: 'Give the evidence some meaning.',
      body: 'Move beyond posting a receipt and explain one small thing you learned from it.',
      tasks: [
        task('w11_story', 'Tell one useful progress story', 'What happened, what helped and what comes next.', 'manual', 1, '🗣️', 'instagram'),
        task('w11_ig_shares', 'Share three Instagram Stories', 'Keep the rest simple and honest.', 'instagram_shares', 3, '◎', 'instagram'),
        task('w11_balance_support', 'Support ten people in Balance Feed', 'Keep contributing inside the safe practice space too.', 'feed_comments', 10, '🤝', 'feed'),
        task('w11_daily_comments', 'Leave 3 meaningful Instagram comments today', 'Repeat on at least seven days. Ask questions and follow up on replies.', 'daily_manual', 7, '💬', 'instagram')
      ]
    },
    {
      week: 12,
      phase: 'BALANCE IDENTITY · KEEP THE PATTERN',
      title: 'Choose what you will keep doing.',
      body: 'Finish with a sustainable rhythm and a clear reason for documenting the journey.',
      tasks: [
        task('w12_recap', 'Post your twelve-week recap', 'Share the pattern, not just the result.', 'manual', 1, '📝', 'instagram'),
        task('w12_ig_shares', 'Share three Instagram Stories', 'Keep your normal weekly rhythm.', 'instagram_shares', 3, '◎', 'instagram'),
        task('w12_rhythm', 'Write your next four-week rhythm', 'Choose a sustainable number of workouts, posts, Stories and conversations.', 'manual', 1, '🗓️', 'planner'),
        task('w12_daily_comments', 'Leave 3 meaningful Instagram comments today', 'Repeat on at least seven days. Finish as a contributor, not a broadcaster.', 'daily_manual', 7, '💬', 'instagram')
      ]
    }
  ];

  const WEEK_LESSONS = [
    lesson('Build the evidence. Edit the environment.', 'Identity is not something you have to declare or feel ready for. Your brain updates its idea of who you are from the actions it repeatedly sees. Every workout completed, normal meal shared and honest Feed post becomes evidence. Feed also changes the environment around you, making looking after your health more visible, supported and normal.', ['Do the action first. Posting is the receipt, not the performance.', 'Make the useful choice easier to see and repeat; that is how you edit the environment.', 'Keep the action small enough for an ordinary week. Repetition builds identity better than one perfect effort.']),
    lesson('Progress needs a repeatable minimum.', 'The best training week is not the hardest one. It is the one you can complete and build from.', ['A normal workout is worth recording.', 'Two completed sessions beat five imagined ones.', 'Make the work visible so it does not disappear from memory.']),
    lesson('Food works better as evidence.', 'Seeing your normal meals clearly makes useful changes easier than judging them from memory.', ['Post what you already eat.', 'Notice what fuels training and keeps you satisfied.', 'Aim for useful repetition, not perfect plates.']),
    lesson('Your environment is part of the plan.', 'What you repeatedly see, save and return to quietly shapes what feels normal.', ['Mute inputs that create noise or comparison.', 'Follow people who model the pattern you want.', 'Train your algorithm with deliberate attention.']),
    lesson('Let the goal choose the share.', 'Sharing works best when it comes from real training and food choices instead of pressure to create content.', ['Start with a workout or meal you already completed.', 'Use Balance share tools to lower the friction.', 'One honest public rep is enough.']),
    lesson('Identity grows from visible repetitions.', 'You do not need to perform a new personality. Keep showing the small actions that already belong to you.', ['Document the process instead of proving a result.', 'Choose a rhythm that survives messy weeks.', 'Let consistency become the interesting part.']),
    lesson('Your inputs train two prediction systems.', 'Instagram learns from what you watch, search, save, follow, share and comment on. It predicts what will hold your attention and gives you more of it. Your own brain is also learning from repeated exposure: what you see often can start to feel more available, important and normal. The feed does not determine who you become, but it is part of the environment shaping your attention. Data input affects output, and that output becomes your next input.', ['Audit before you create: mute comparison and noise, then deliberately search, follow and save the kind of fitness you want around you.', 'Participate before you broadcast: three meaningful comments a day gives the platform clearer signals and gives you evidence that you belong in the conversation.', 'Plan an account with one purpose, a specific niche and honest boundaries. Every post then becomes both public evidence and a vote for the identity you are practising.']),
    lesson('Keep content downstream of the work.', 'Training and food remain the centre. Sharing is a light record of what happened.', ['Complete the behaviour first.', 'Reuse a meal or workout as a Story.', 'Keep Balance Feed as your safe practice space.']),
    lesson('Your feed reflects your attention.', 'An algorithm audit shows whether your recent choices are supporting the person you want to become.', ['Review Explore without judging it.', 'Remove five inputs that pull you off course.', 'Save examples you would genuinely use.']),
    lesson('A rhythm should fit real life.', 'A simple weekly pattern is more useful than a posting plan that needs perfect energy and spare time.', ['Keep workouts at the centre.', 'Choose three honest Story moments.', 'Stay connected without turning it into a job.']),
    lesson('A useful story gives evidence meaning.', 'People connect with what changed, what helped and what you are trying next.', ['Start with one real moment.', 'Say what you learned in plain language.', 'Leave room for the process to stay unfinished.']),
    lesson('Keep only what you can sustain.', 'The final goal is not more posting. It is a pattern that supports your training, food and identity.', ['Review what felt natural.', 'Choose the smallest rhythm you will keep.', 'Share the pattern, not only the result.'])
  ];

  let state = null;
  let progress = null;
  let candidates = [];
  let candidatesLoaded = false;
  let loading = false;
  let viewStage = 'lesson';
  let initialized = false;
  let welcomeAudioComplete = false;
  let welcomeAudioCompleteUserId = '';

  function hasCompletedWelcomeAudio() {
    const userId = window.currentUser && window.currentUser.id ? String(window.currentUser.id) : '';
    return !!welcomeAudioComplete && !!userId && welcomeAudioCompleteUserId === userId;
  }

  function task(id, label, hint, type, target, icon, action) {
    return { id, label, hint, type, target, icon, action };
  }

  function lesson(title, body, points) {
    return { title, body, points };
  }

  function currentUserId() {
    return String(window.currentUser && window.currentUser.id || '');
  }

  function isActivationPreview() {
    try {
      const host = String(window.location && window.location.hostname || '');
      return (host === '127.0.0.1' || host === 'localhost')
        && new URLSearchParams(window.location.search).get('tourTest') === '1';
    } catch (_) {
      return false;
    }
  }

  function isJourneyEligible() {
    if (isActivationPreview()) return true;
    if (!window.currentUser || window.guestMode || window.isAdminViewing) return false;
    try { return localStorage.getItem('onboardingComplete') === 'true'; } catch (_) { return false; }
  }

  function isPilotUser() {
    const user = window.currentUser;
    if (!user || window.isAdminViewing) return false;
    return String(user.id || '') === SHANNON_USER_ID
      && String(user.email || '').trim().toLowerCase() === SHANNON_EMAIL;
  }

  function isOnboardingTestUser() {
    return currentUserId() === 'cc632168-874c-447e-a4ad-ee7f6b40bb7e';
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
      user_id: currentUserId(),
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
    if (isActivationPreview()) {
      state = normalizeState(Object.assign({}, state || defaultState(), patch || {}));
      return state;
    }
    if (!window.supabaseClient || !state) return state;
    state = normalizeState(Object.assign({}, state, patch || {}));
    const payload = {
      user_id: currentUserId(),
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
    if (isActivationPreview()) {
      state = normalizeState(defaultState());
      return state;
    }
    if (!window.supabaseClient) throw new Error('Balance is still connecting.');
    const result = await window.supabaseClient
      .from(TABLE)
      .select('*')
      .eq('user_id', currentUserId())
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
    if (isActivationPreview() && state) {
      const previewTasks = getWeekDefinition().tasks.map(item => Object.assign({}, item, { current: 0, complete: false }));
      progress = { tasks: previewTasks, completed_count: 0, total_count: previewTasks.length };
      return progress;
    }
    if (!state || !window.supabaseClient) return null;
    const supabase = window.supabaseClient;
    const startIso = dateFromKey(state.week_started_at).toISOString();
    const endIso = dateFromKey(addDaysKey(state.week_started_at, 7)).toISOString();
    const [stories, comments, transactions, workouts] = await Promise.all([
      safeQuery(() => supabase.from('stories')
        .select('id,media_type,created_at')
        .eq('user_id', currentUserId())
        .gte('created_at', startIso)
        .lt('created_at', endIso)),
      safeQuery(() => supabase.from('feed_comments')
        .select('id,created_at')
        .eq('user_id', currentUserId())
        .gte('created_at', startIso)
        .lt('created_at', endIso)),
      safeQuery(() => supabase.from('point_transactions')
        .select('id,transaction_type,created_at')
        .eq('user_id', currentUserId())
        .gte('created_at', startIso)
        .lt('created_at', endIso)
        .in('transaction_type', [
          'earn_meal_instagram_share',
          'earn_activity_instagram_share',
          'earn_workout_instagram_share'
        ])),
      safeQuery(() => supabase.from('workouts')
        .select('workout_date')
        .eq('user_id', currentUserId())
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
      workout_days: workoutDays,
      workout_bundle: Math.min(workoutDays, stories.filter(row => row.media_type === 'workout_card').length)
    };
    const definition = getWeekDefinition();
    const tasks = definition.tasks.map(item => {
      const current = item.type === 'manual'
        ? (manual.has(item.id) ? 1 : 0)
        : (item.type === 'planner'
          ? (isInstagramPlanComplete(instagramPlan()) ? 1 : 0)
          : (item.type === 'daily_manual' ? currentWeekDailyTaskCount(item.id) : Number(counts[item.type] || 0)));
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

  function lessonSeenWeeks() {
    return safeArray(safeObject(state && state.settings).lesson_seen_weeks)
      .map(Number)
      .filter(week => week >= 1 && week <= 12);
  }

  function instagramPlan() {
    return safeObject(safeObject(state && state.settings).instagram_plan);
  }

  function isInstagramPlanComplete(plan) {
    const value = safeObject(plan);
    const required = ['purpose', 'niche', 'audience', 'identity_statement', 'account_name', 'bio', 'posting_rhythm', 'boundaries', 'first_posts'];
    const pillars = String(value.content_pillars || '').split(/\n|,/).map(item => item.trim()).filter(Boolean);
    return required.every(key => String(value[key] || '').trim().length > 0) && pillars.length >= 3;
  }

  function dailyTaskDates(taskId) {
    const dates = safeObject(safeObject(state && state.settings).daily_task_dates)[taskId];
    return safeArray(dates).map(String);
  }

  function currentWeekDailyTaskCount(taskId) {
    const start = state.week_started_at;
    const end = addDaysKey(start, 7);
    return new Set(dailyTaskDates(taskId).filter(key => key >= start && key < end)).size;
  }

  function isCurrentLessonSeen() {
    if (!state) return false;
    try {
      if (isOnboardingTestUser() && sessionStorage.getItem('pbb_activation_force_fresh') === 'true') return false;
    } catch (_) {}
    if (lessonSeenWeeks().includes(Number(state.current_week))) return true;
    return Number(state.current_week) === 1 && hasCompletedFirstFoundationsLesson();
  }

  function hasCompletedFirstFoundationsLesson() {
    try {
      return typeof window._isLessonCompleted === 'function' && window._isLessonCompleted('mind-1-1');
    } catch (_) {
      return false;
    }
  }

  function markJourneyFeatureSeen() {
    try {
      const featureId = 'balance-foundations-journey-v1';
      const stored = JSON.parse(localStorage.getItem('pbb_seen_features') || '[]');
      const seen = Array.isArray(stored) ? stored : [];
      if (!seen.includes(featureId)) {
        seen.push(featureId);
        localStorage.setItem('pbb_seen_features', JSON.stringify(seen));
      }
    } catch (_) {}
  }

  function renderCard() {
    const card = getCard();
    if (!card || !isJourneyEligible() || !state) return;
    const character = document.getElementById('tamagotchi-widget-container');
    const levelStrip = document.getElementById('tamagotchi-stats-bar')
      || document.getElementById('balance-level-bar')
      || character;
    const characterBlockTail = document.getElementById('battle-stats-row') || levelStrip;
    const programStart = new Date(safeObject(window.userProfile).program_start_date || '');
    const beforeFirstWeek = Number.isFinite(programStart.getTime())
      && Date.now() < programStart.getTime() + (7 * 24 * 60 * 60 * 1000);
    document.documentElement.classList.toggle('pbb-before-first-week', beforeFirstWeek);
    const unified = isPilotUser() || isOnboardingTestUser();
    document.documentElement.classList.toggle('pbb-unified-next-steps', unified);
    if (unified) {
      const weeklyGoals = document.getElementById('weekly-goals-card');
      const nextSteps = document.getElementById('next-obvious-steps-card');
      if (characterBlockTail && characterBlockTail.parentNode && weeklyGoals && characterBlockTail.nextElementSibling !== weeklyGoals) {
        characterBlockTail.parentNode.insertBefore(weeklyGoals, characterBlockTail.nextSibling);
      }
      if (weeklyGoals && weeklyGoals.parentNode && nextSteps && weeklyGoals.nextElementSibling !== nextSteps) {
        weeklyGoals.parentNode.insertBefore(nextSteps, weeklyGoals.nextSibling);
      }
      card.style.display = 'none';
      card.innerHTML = '';
      setTimeout(function () {
        try {
          if (window.pbbNextSteps && typeof window.pbbNextSteps.refresh === 'function') window.pbbNextSteps.refresh();
        } catch (_) {}
      }, 0);
      return;
    }
    if (characterBlockTail && characterBlockTail.parentNode && characterBlockTail.nextElementSibling !== card) {
      characterBlockTail.parentNode.insertBefore(card, characterBlockTail.nextSibling);
    }
    const definition = getWeekDefinition();
    const completed = progress ? progress.completed_count : 0;
    const total = progress ? progress.total_count : 3;
    const percent = total ? Math.round((completed / total) * 100) : 0;
    const lessonSeen = isCurrentLessonSeen();
    const weekComplete = lessonSeen && total > 0 && completed >= total;
    const dailyPlan = getUnifiedDailyPlan();
    const nextAction = dailyPlan[0] || null;
    const cardTitle = !lessonSeen
      ? 'Your Next Step'
      : (weekComplete ? 'This week is complete.' : (nextAction ? nextAction.title : 'Your next steps are ready.'));
    const cardCopy = !lessonSeen
      ? 'Finish the App Tour and your first Foundations lesson, then come back here to see exactly what to do next.'
      : (weekComplete ? 'You built the evidence. Open this week whenever you want to review it.' : (nextAction ? nextAction.body : definition.body));
    const cardCta = !lessonSeen
      ? 'Open my first check-in'
      : (weekComplete ? 'Review this week' : 'Open my next steps');
    card.style.display = 'block';
    card.innerHTML = '<div class="social-journey-card__inner">'
      + '<div class="social-journey-card__week-art"><span>WEEK</span><strong>' + String(definition.week).padStart(2, '0') + '</strong></div>'
      + '<div class="social-journey-card__eyebrow">' + (!lessonSeen ? 'A message from Coach Shannon' : (definition.week >= 7 ? 'Balance Identity' : 'Balance Foundations') + ' &middot; Week ' + definition.week) + '</div>'
      + '<div class="social-journey-card__title">' + escapeHtml(cardTitle) + '</div>'
      + '<div class="social-journey-card__copy">' + escapeHtml(cardCopy) + '</div>'
      + '<div class="social-journey-card__row"><div class="social-journey-card__progress"><span style="width:' + percent + '%"></span></div><div class="social-journey-card__count">' + completed + ' / ' + total + '</div></div>'
      + '<div class="social-journey-card__cta">' + escapeHtml(cardCta) + ' <span>→</span></div></div>';
  }

  function taskActionLabel(item) {
    if (item.type === 'manual') return item.complete ? 'Completed' : 'Mark done';
    if (item.type === 'planner') return item.complete ? 'Edit plan' : 'Build plan';
    if (item.type === 'daily_manual') return dailyTaskDates(item.id).includes(brisbaneDateKey()) ? 'Today done' : 'Mark today done';
    if (item.action === 'feed') return 'Open Feed';
    if (item.action === 'feed-photo') return 'Take my first Feed photo';
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
        : (item.type === 'planner'
          ? (item.complete ? 'Ready' : 'Not started')
          : (item.type === 'daily_manual' ? Math.min(item.current, item.target) + ' / ' + item.target + ' days' : Math.min(item.current, item.target) + ' / ' + item.target));
      return '<article class="social-journey-task ' + (item.complete ? 'is-complete' : '') + '">'
        + '<div class="social-journey-task__icon">' + (item.complete ? '✓' : item.icon) + '</div>'
        + '<div><div class="social-journey-task__title">' + escapeHtml(item.label) + '</div><div class="social-journey-task__hint">' + escapeHtml(item.hint) + '</div></div>'
        + '<div class="social-journey-task__value">' + escapeHtml(value) + '</div>'
        + '<button type="button" class="social-journey-task__action ' + ((item.type === 'manual' || item.type === 'daily_manual') ? 'is-check' : '') + '" onclick="socialJourney.taskAction(\'' + item.id + '\')">' + escapeHtml(taskActionLabel(item)) + '</button>'
        + '</article>';
    }).join('');
  }

  function getUnifiedDailyPlan() {
    try {
      if (window.pbbNextSteps && typeof window.pbbNextSteps.getPlan === 'function') return safeArray(window.pbbNextSteps.getPlan());
    } catch (_) {}
    return [];
  }

  function renderDailyPlan() {
    const plan = getUnifiedDailyPlan();
    if (!plan.length) {
      return '<section class="social-journey-section"><h3 class="social-journey-section__heading">Today</h3><div class="social-journey-callout"><strong>You are clear for now.</strong><p>Your next scheduled action will appear here when it is due.</p></div></section>';
    }
    const first = plan[0];
    const remaining = plan.slice(1);
    const actionButton = item => {
      if (item.kind === 'progress') {
        const current = Math.max(0, Math.round(Number(item.current || 0)));
        const target = Math.max(1, Math.round(Number(item.target || 10000)));
        const percent = Math.min(100, Math.max(0, Math.round(Number(item.percent || (current / target) * 100))));
        return '<div class="social-journey-plan-action is-progress" role="status" aria-label="' + escapeHtml(current.toLocaleString('en-AU') + ' of ' + target.toLocaleString('en-AU') + ' steps today') + '" style="--journey-action-accent:' + escapeHtml(item.accent || '#059669') + '"><span class="social-journey-plan-action__mark"></span><span><strong>' + escapeHtml(item.title) + '</strong><small>' + escapeHtml(current.toLocaleString('en-AU') + ' of ' + target.toLocaleString('en-AU') + ' today') + '</small><span class="social-journey-plan-progress"><span style="width:' + percent + '%"></span></span></span><b>' + percent + '%</b></div>';
      }
      return '<button type="button" class="social-journey-plan-action" onclick="socialJourney.runDailyAction(\'' + escapeHtml(item.id) + '\')" style="--journey-action-accent:' + escapeHtml(item.accent || '#b78a2e') + '"><span class="social-journey-plan-action__mark"></span><span><strong>' + escapeHtml(item.title) + '</strong><small>' + escapeHtml(item.body) + '</small></span><b>' + escapeHtml(item.cta || 'Open') + '</b></button>';
    };
    return '<section class="social-journey-section"><h3 class="social-journey-section__heading">Up next</h3><div class="social-journey-up-next">' + actionButton(first) + '</div></section>'
      + (remaining.length ? '<section class="social-journey-section"><h3 class="social-journey-section__heading">Later today</h3><div class="social-journey-plan-list">' + remaining.map(actionButton).join('') + '</div></section>' : '');
  }

  function renderWeeklyGoalFocus() {
    let weeklyState = null;
    try { weeklyState = window.weeklyGoals && typeof window.weeklyGoals.getState === 'function' ? window.weeklyGoals.getState() : null; } catch (_) {}
    const selected = safeArray(weeklyState && weeklyState.selected);
    const progressGoals = safeArray(weeklyState && weeklyState.progress && weeklyState.progress.goals);
    const goals = progressGoals.length ? progressGoals : selected.map(goal => Object.assign({}, goal, { current: 0, complete: false }));
    if (!goals.length) return '';
    const rows = goals.map(goal => {
      const current = Number(goal.current || 0);
      const target = Number(goal.target || 1);
      return '<div class="social-journey-weekly-focus__row ' + (goal.complete ? 'is-complete' : '') + '"><span><strong>' + escapeHtml(goal.label || goal.id) + '</strong><small>' + escapeHtml(current + ' / ' + target + ' ' + (goal.unit || '')) + '</small></span><b>' + (goal.complete ? 'Done' : Math.min(100, Math.round((current / target) * 100)) + '%') + '</b></div>';
    }).join('');
    return '<section class="social-journey-section"><div class="social-journey-section-heading-row"><h3 class="social-journey-section__heading">This week\'s focus</h3><button type="button" onclick="socialJourney.editWeeklyGoals()">Edit goals</button></div><div class="social-journey-weekly-focus">' + rows + '</div></section>';
  }

  function renderInstagramPlanSummary() {
    if (!state || Number(state.current_week) < 7) return '';
    const plan = instagramPlan();
    if (!isInstagramPlanComplete(plan)) {
      return '<section class="social-journey-section"><h3 class="social-journey-section__heading">Your fitness Instagram plan</h3><div class="social-journey-callout"><strong>Turn the idea into a decision.</strong><p>Define who the account is for, what it will document and the boundaries that keep it healthy.</p></div><button type="button" class="social-journey-button secondary" onclick="socialJourney.openInstagramPlanner()">Build my plan</button></section>';
    }
    return '<section class="social-journey-section"><h3 class="social-journey-section__heading">Your fitness Instagram plan</h3><div class="social-journey-plan-summary"><span>Purpose</span><strong>' + escapeHtml(plan.purpose) + '</strong><span>Niche</span><strong>' + escapeHtml(plan.niche) + '</strong><span>Identity</span><strong>' + escapeHtml(plan.identity_statement) + '</strong></div><button type="button" class="social-journey-button secondary" onclick="socialJourney.openInstagramPlanner()">Review my plan</button></section>';
  }

  function renderJourney() {
    ensureUi();
    const container = document.getElementById('social-journey-content');
    if (!container || !state) return;
    const definition = getWeekDefinition();
    if (viewStage === 'lesson') {
      renderLesson();
      return;
    }
    if (viewStage === 'welcome') {
      renderWelcome();
      return;
    }
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
    container.innerHTML = '<section class="social-journey-hero social-journey-goals-hero">'
      + '<div class="social-journey-hero__eyebrow">' + escapeHtml(definition.phase) + '</div>'
      + '<div class="social-journey-goals-hero__label">YOUR NEXT STEPS</div><h2>' + escapeHtml(definition.title) + '</h2><p>' + escapeHtml(definition.body) + '</p>' + weekDots() + '</section>'
      + renderDailyPlan()
      + renderWeeklyGoalFocus()
      + renderInstagramPlanSummary()
      + '<section class="social-journey-section"><h3 class="social-journey-section__heading">' + (definition.week >= 7 ? 'Balance Identity this week' : 'Foundations this week') + '</h3>' + renderTasks() + '</section>'
      + (definition.week === 6 ? '<div class="social-journey-callout"><strong>Next: Balance Identity.</strong><p>Before planning an account, you will learn how your data inputs train your feed and how repeated exposure can shape what feels normal.</p></div>' : '')
      + (complete ? '<div class="social-journey-callout"><strong>This week is complete.</strong><p>Your next lesson will arrive with the next week. For now, keep the actions small and repeatable.</p></div>' : '')
      + '<section class="social-journey-section"><h3 class="social-journey-section__heading">Reminder route</h3><div class="social-journey-callout"><strong>' + (connectedHandle ? connectedHandle : 'In-app first') + '</strong><p>' + escapeHtml(reminderText) + '</p></div>'
      + '<button type="button" class="social-journey-button secondary" onclick="socialJourney.openReminderSetup()">' + (connectedHandle ? 'Review Instagram reminder' : 'Connect Instagram reminder') + '</button>' + instagramButton + '</section>'
      + '<section class="social-journey-finish"><button type="button" class="social-journey-button" onclick="socialJourney.useGoals()">Use these next steps</button><button type="button" class="social-journey-text-button" onclick="socialJourney.reviewLesson()">Review this week\'s lesson</button></section>'
      + '<section class="social-journey-pilot-controls"><h3>Shannon pilot controls</h3><p>These controls change only this social journey. They never reset your character, levels, coins, workouts, meals or other account data.</p>'
      + '<button type="button" class="social-journey-button secondary" onclick="socialJourney.sendTestReminder()" ' + (connectedHandle ? '' : 'disabled') + '>Send a test Instagram reminder</button>'
      + '<button type="button" class="social-journey-button secondary" onclick="socialJourney.advanceWeek()">' + (state.current_week >= 12 ? 'Journey is at Week 12' : 'Preview the next week') + '</button>'
      + '<button type="button" class="social-journey-button danger" onclick="socialJourney.restart()">Restart only this journey</button></section>';
    if (!isPilotUser()) {
      container.querySelectorAll('.social-journey-pilot-controls').forEach(function(element){ element.remove(); });
      container.querySelectorAll('.social-journey-section__heading').forEach(function(heading){
        if (heading.textContent.trim() === 'Reminder route' && heading.parentElement) heading.parentElement.remove();
      });
    }
  }

  function renderLesson() {
    ensureUi();
    const container = document.getElementById('social-journey-content');
    if (!container || !state) return;
    const definition = getWeekDefinition();
    const lessonCopy = WEEK_LESSONS[definition.week - 1];
    const isFirstLesson = definition.week === 1;
    document.querySelector('.social-journey-header__title').textContent = isFirstLesson ? 'Your first lesson' : (definition.week >= 7 ? 'Balance Identity' : 'Week ' + definition.week + ' lesson');
    document.querySelector('.social-journey-header__week').textContent = 'Week ' + definition.week + ' of 12';
    container.innerHTML = '<section class="social-journey-lesson">'
      + '<div class="social-journey-lesson__number"><span>WEEK</span><strong>' + String(definition.week).padStart(2, '0') + '</strong></div>'
      + '<div class="social-journey-lesson__eyebrow">' + escapeHtml(definition.phase) + '</div>'
      + '<h2>' + escapeHtml(lessonCopy.title) + '</h2><p>' + escapeHtml(isFirstLesson ? 'Your first Balance Foundations lesson is interactive. Read each part, then choose the answer that makes the most sense to you.' : lessonCopy.body) + '</p></section>'
      + '<section class="social-journey-learn-card"><div class="social-journey-section__heading">' + (isFirstLesson ? 'How to answer' : 'Put it into practice') + '</div>'
      + '<div class="social-journey-learn-points">' + (isFirstLesson
        ? '<div><span>01</span><p>Answer honestly rather than trying to guess the perfect response.</p></div><div><span>02</span><p>If you miss one, keep going. The explanation is part of the lesson.</p></div><div><span>03</span><p>When you finish, Balance will bring you back to your next steps.</p></div>'
        : lessonCopy.points.map(function(point, index){ return '<div><span>' + String(index + 1).padStart(2, '0') + '</span><p>' + escapeHtml(point) + '</p></div>'; }).join('')) + '</div></section>'
      + '<div class="social-journey-lesson-action"><button type="button" class="social-journey-button" onclick="' + (isFirstLesson ? 'socialJourney.startFirstCourseLesson()' : 'socialJourney.showGoals()') + '">' + (isFirstLesson ? 'Begin my first lesson' : (definition.week === 7 ? 'I understand the loop - build my plan' : 'Use this lesson')) + '</button><button type="button" class="social-journey-text-button" onclick="socialJourney.close()">Not now</button></div>';
  }

  function renderWelcome() {
    ensureUi();
    const container = document.getElementById('social-journey-content');
    if (!container) return;
    document.querySelector('.social-journey-header__title').textContent = 'Your Next Step';
    document.querySelector('.social-journey-header__week').textContent = 'A message from Coach Shannon';
    const welcomeReady = hasCompletedWelcomeAudio();
    container.innerHTML = '<section class="social-journey-welcome">'
      + '<div class="social-journey-welcome__eyebrow">YOUR FIRST CHECK-IN &middot; PRESS PLAY</div>'
      + '<h2>Start here.</h2>'
      + '<p>Press play for your first check-in, then complete your first Balance Foundations lesson. After that, Your Next Step will show you exactly what to do next.</p>'
      + '<audio id="social-journey-welcome-audio" class="social-journey-welcome__audio" controls preload="metadata" onended="socialJourney.completeWelcomeAudio()" onerror="socialJourney.welcomeAudioError(this)"><source src="' + escapeHtml(WELCOME_AUDIO_URL) + '" type="audio/mpeg"></audio>'
      + '<div class="social-journey-welcome__transcript"><strong>The short version</strong><p>Use the app as evidence, not judgment. Log the meal you actually ate, complete the workout that fits today, and share the ordinary reps. That is how we build something that lasts.</p></div>'
      + '</section><div class="social-journey-lesson-action"><div id="social-journey-welcome-status" role="status" aria-live="polite" style="font-size:.78rem;font-weight:800;color:#765315;margin-bottom:8px;">' + (welcomeReady ? 'Voice note complete. Your first lesson is ready.' : 'Listen to the full voice note to unlock your first lesson.') + '</div><button id="social-journey-welcome-continue" type="button" class="social-journey-button" onclick="socialJourney.reviewLesson()" ' + (welcomeReady ? '' : 'disabled') + ' style="opacity:' + (welcomeReady ? '1' : '.55') + ';cursor:' + (welcomeReady ? 'pointer' : 'not-allowed') + ';">' + (welcomeReady ? 'Open my first lesson' : 'Listen first') + '</button><button type="button" class="social-journey-text-button" onclick="socialJourney.close()">Not now</button></div>';
  }

  function startFirstCourseLesson() {
    try { window.trackBalanceActivity('foundations_first_lesson_started', { source: 'activation_journey' }, { immediate: true }); } catch (_) {}
    closeJourney();
    try { sessionStorage.setItem('pbb_activation_first_lesson', 'true'); } catch (_) {}
    if (typeof window.switchAppTab === 'function') {
      try { window.switchAppTab('learning'); } catch (_) {}
    }
    let attempts = 0;
    const openLesson = function () {
      if (typeof window.startFoundationsLesson === 'function') {
        window.startFoundationsLesson('mind-1-1');
        return;
      }
      attempts += 1;
      if (attempts < 40) setTimeout(openLesson, 150);
      else showToast('Your course is still loading. Open Course to start Balance Foundations.', 'info');
    };
    setTimeout(openLesson, 100);
  }

  async function completeFirstCourseLesson() {
    if (window.__pbbActivationNextStepsTimer) {
      clearTimeout(window.__pbbActivationNextStepsTimer);
      window.__pbbActivationNextStepsTimer = null;
    }
    try { sessionStorage.removeItem('pbb_activation_first_lesson'); } catch (_) {}
    try { sessionStorage.removeItem('pbb_activation_force_fresh'); } catch (_) {}
    await showGoals();
    closeJourney();
    if (typeof window.switchAppTab === 'function') {
      try { window.switchAppTab('dashboard'); } catch (_) {}
    }
    renderCard();
    setTimeout(function () {
      try {
        if (window.pbbNextSteps && typeof window.pbbNextSteps.refresh === 'function') window.pbbNextSteps.refresh();
      } catch (_) {}
      const nextSteps = document.getElementById('next-obvious-steps-card');
      if (nextSteps) nextSteps.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 180);
    showToast('Your next steps are ready on Home.', 'success');
  }

  function showWelcome() {
    viewStage = 'welcome';
    renderJourney();
    const scroll = document.getElementById('social-journey-content');
    if (scroll) scroll.scrollTop = 0;
  }

  async function showGoals() {
    if (!state) return;
    const settings = safeObject(state.settings);
    const weeks = new Set(lessonSeenWeeks());
    weeks.add(Number(state.current_week));
    try {
      await upsertState({
        onboarding_complete: true,
        settings: Object.assign({}, settings, { lesson_seen_weeks: Array.from(weeks).sort((a, b) => a - b) })
      });
    } catch (error) {
      showToast(error.message || 'That lesson could not be saved yet.', 'error');
      return;
    }
    viewStage = 'goals';
    renderCard();
    renderJourney();
    const scroll = document.getElementById('social-journey-content');
    if (scroll) scroll.scrollTop = 0;
  }

  function previewGoalsForTest() {
    if (!isPilotUser() && !isOnboardingTestUser()) return false;
    try { sessionStorage.removeItem('pbb_activation_force_fresh'); } catch (_) {}
    if (!state) state = normalizeState(defaultState());
    const settings = safeObject(state.settings);
    const weeks = new Set(lessonSeenWeeks());
    weeks.add(Number(state.current_week));
    state.onboarding_complete = true;
    state.settings = Object.assign({}, settings, {
      lesson_seen_weeks: Array.from(weeks).sort((a, b) => a - b)
    });
    viewStage = 'goals';
    closeJourney();
    if (typeof window.switchAppTab === 'function') {
      try { window.switchAppTab('dashboard'); } catch (_) {}
    }
    renderCard();
    setTimeout(function () {
      try {
        if (window.pbbNextSteps && typeof window.pbbNextSteps.refresh === 'function') window.pbbNextSteps.refresh();
      } catch (_) {}
      const nextSteps = document.getElementById('next-obvious-steps-card');
      if (nextSteps) nextSteps.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 120);
    return true;
  }

  function resetActivationForTest() {
    if (!isPilotUser() && !isOnboardingTestUser()) return false;
    const existingSettings = safeObject(state && state.settings);
    const settings = Object.assign({}, existingSettings);
    delete settings.lesson_seen_weeks;
    state = normalizeState(Object.assign({}, defaultState(), {
      onboarding_complete: false,
      settings
    }));
    progress = null;
    viewStage = 'welcome';
    try {
      sessionStorage.setItem('pbb_activation_force_fresh', 'true');
      sessionStorage.removeItem('pbb_activation_first_lesson');
    } catch (_) {}
    try {
      if (window.pbbNextSteps && typeof window.pbbNextSteps.resetOnboardingCards === 'function') window.pbbNextSteps.resetOnboardingCards();
    } catch (_) {}
    ensureUi();
    renderCard();
    return true;
  }

  function useGoals() {
    closeJourney();
    if (typeof window.switchAppTab === 'function') {
      try { window.switchAppTab('dashboard'); } catch (_) {}
    }
    showToast('Your next steps are ready on Home.', 'success');
  }

  function runDailyAction(actionId) {
    closeJourney();
    if (window.pbbNextSteps && typeof window.pbbNextSteps.runAction === 'function') window.pbbNextSteps.runAction(actionId);
  }

  function editWeeklyGoals() {
    closeJourney();
    if (typeof window.openWeeklyGoalsModal === 'function') window.openWeeklyGoalsModal({ source: 'unified-next-steps' });
  }

  function reviewLesson() {
    if (Number(state && state.current_week) === 1 && !hasCompletedWelcomeAudio()) {
      showToast('Listen to Shannon’s full voice note before continuing.', 'info');
      const audio = document.getElementById('social-journey-welcome-audio');
      if (audio) {
        try { audio.scrollIntoView({ block: 'center', behavior: 'smooth' }); audio.focus(); } catch (_) {}
      }
      return false;
    }
    viewStage = 'lesson';
    renderJourney();
    const scroll = document.getElementById('social-journey-content');
    if (scroll) scroll.scrollTop = 0;
    return true;
  }

  function openJourney(stage) {
    if (!isJourneyEligible() || !state) return;
    if (stage === 'welcome') {
      openCoachInbox();
      return;
    }
    ensureUi();
    markJourneyFeatureSeen();
    viewStage = typeof stage === 'string' ? stage : (isCurrentLessonSeen() ? 'goals' : 'lesson');
    renderJourney();
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

  async function startActivation(attempt) {
    if (!isJourneyEligible()) return;
    const retry = Math.max(0, Number(attempt) || 0);
    if (!initialized) init();
    if (!initialized) return;
    await refresh();
    if (!state) {
      if (retry < 40) setTimeout(function () { startActivation(retry + 1); }, 250);
      return;
    }
    const view = document.getElementById('social-journey-view');
    if (view) view.classList.add('is-activation');
    if (isCurrentLessonSeen()) {
      openJourney('goals');
      return;
    }
    if (typeof window.showNativePermissionsModal === 'function') {
      const opened = await window.showNativePermissionsModal({ onComplete: openCoachInbox });
      if (opened) return;
    }
    openCoachInbox();
  }

  function openCoachInbox(attempt) {
    const retry = Math.max(0, Number(attempt) || 0);
    if (typeof window.openDirectMessage === 'function') {
      try { window.trackBalanceActivity('coach_inbox_opened', { source: 'activation_journey', attempt: retry }, { immediate: true }); } catch (_) {}
      closeJourney();
      window.openDirectMessage(SHANNON_USER_ID, 'Coach Shannon', 'assets/coach_shannon.jpg');
      return;
    }
    if (retry < 40) setTimeout(function () { openCoachInbox(retry + 1); }, 150);
    else showToast('Messages are still loading. Tap the messages icon and open Coach Shannon.', 'info');
  }

  function continueFromInbox() {
    if (!hasCompletedWelcomeAudio()) {
      showToast('Listen to Shannon’s full voice note before continuing.', 'info');
      const audio = document.getElementById('balance-onboarding-welcome-audio');
      if (audio) {
        try { audio.scrollIntoView({ block: 'center', behavior: 'smooth' }); audio.focus(); } catch (_) {}
      }
      return false;
    }
    try { window.trackBalanceActivity('coach_inbox_continued_to_lesson', { source: 'activation_journey' }, { immediate: true }); } catch (_) {}
    if (typeof window.closeDirectMessageModal === 'function') {
      window.closeDirectMessageModal();
    } else {
      const modal = document.getElementById('direct-message-modal');
      if (modal) modal.style.display = 'none';
    }
    openJourney('lesson');
    return true;
  }

  function completeWelcomeAudio() {
    welcomeAudioComplete = true;
    welcomeAudioCompleteUserId = window.currentUser && window.currentUser.id ? String(window.currentUser.id) : '';
    ['balance-onboarding-welcome-continue', 'social-journey-welcome-continue'].forEach(function(id){
      const button = document.getElementById(id);
      if (!button) return;
      button.disabled = false;
      button.style.opacity = '1';
      button.style.cursor = 'pointer';
      button.textContent = id === 'balance-onboarding-welcome-continue' ? 'Continue to my first lesson' : 'Open my first lesson';
    });
    ['balance-onboarding-welcome-status', 'social-journey-welcome-status'].forEach(function(id){
      const status = document.getElementById(id);
      if (status) status.textContent = 'Voice note complete. Your first lesson is ready.';
    });
    try { window.trackBalanceActivity('coach_welcome_audio_completed', { source: 'activation_journey' }, { immediate: true }); } catch (_) {}
  }

  function welcomeAudioError(audio) {
    if (audio && audio.classList) audio.classList.add('is-unavailable');
    const status = document.getElementById('balance-onboarding-welcome-status') || document.getElementById('social-journey-welcome-status');
    if (status) status.textContent = 'The voice note could not load. Tap play to try again.';
  }

  function shouldShowWelcomeMessage(recipientId) {
    return String(recipientId || '') === SHANNON_USER_ID
      && isJourneyEligible()
      && !!state
      && !isCurrentLessonSeen();
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
    const isFeedAction = action === 'feed' || action === 'feed-photo';
    const tab = isFeedAction ? 'friends' : (action === 'meals' ? 'meals' : (action === 'movement' ? 'movement-tab' : 'dashboard'));
    if (typeof window.switchAppTab === 'function') {
      try { window.switchAppTab(tab); } catch (_) {}
    }
    if (action === 'feed-photo') {
      try {
        if (typeof window.openFeedComposerMediaSource === 'function') {
          window.openFeedComposerMediaSource('camera-photo');
          return;
        }
        const input = document.getElementById('feed-composer-camera-photo-input');
        if (input) input.click();
      } catch (_) {}
    } else if (action === 'feed') {
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

  async function completeDailyTask(taskId) {
    const today = brisbaneDateKey();
    const settings = Object.assign({}, safeObject(state.settings));
    const allDates = Object.assign({}, safeObject(settings.daily_task_dates));
    const dates = new Set(safeArray(allDates[taskId]).map(String));
    if (dates.has(today)) {
      showToast('Today is already counted. Come back tomorrow for the next three conversations.', 'info');
      return;
    }
    dates.add(today);
    allDates[taskId] = Array.from(dates).sort();
    settings.daily_task_dates = allDates;
    await upsertState({ settings });
    await calculateProgress();
    renderCard();
    renderJourney();
    showToast('Three meaningful Instagram comments counted for today.', 'success');
  }

  function plannerField(id, label, prompt, value, multiline) {
    const tag = multiline
      ? '<textarea id="' + id + '" rows="3" placeholder="' + escapeHtml(prompt) + '">' + escapeHtml(value || '') + '</textarea>'
      : '<input id="' + id + '" type="text" placeholder="' + escapeHtml(prompt) + '" value="' + escapeHtml(value || '') + '">';
    return '<label class="social-journey-planner-field"><span>' + escapeHtml(label) + '</span><small>' + escapeHtml(prompt) + '</small>' + tag + '</label>';
  }

  function renderInstagramPlanner() {
    ensureUi();
    const sheet = document.getElementById('social-journey-onboarding-sheet');
    const plan = instagramPlan();
    sheet.innerHTML = '<div class="social-journey-onboarding__visual"><div class="social-journey-onboarding__step">Balance Identity</div><h2>Plan your fitness Instagram.</h2><p>Make the decisions once, so posting becomes evidence instead of a daily identity crisis.</p></div>'
      + '<form class="social-journey-onboarding__body social-journey-planner" onsubmit="event.preventDefault();socialJourney.saveInstagramPlan()">'
      + plannerField('sj-plan-purpose', 'Purpose', 'Why does this account exist?', plan.purpose, true)
      + plannerField('sj-plan-niche', 'Niche', 'Be specific: topic, angle and stage of the journey.', plan.niche, false)
      + plannerField('sj-plan-audience', 'Audience', 'Who should feel understood or helped here?', plan.audience, true)
      + plannerField('sj-plan-identity', 'Identity statement', 'I am someone who...', plan.identity_statement, true)
      + plannerField('sj-plan-pillars', 'Three content pillars', 'Write at least three, one per line. Example: workouts, plant-based meals, honest progress.', plan.content_pillars, true)
      + plannerField('sj-plan-account', 'Account name or handle', 'New account, existing account or a working name.', plan.account_name, false)
      + plannerField('sj-plan-bio', 'Bio draft', 'Who you are, what you document and why someone should stay.', plan.bio, true)
      + plannerField('sj-plan-rhythm', 'Posting rhythm', 'Example: one post and three Stories each week.', plan.posting_rhythm, false)
      + plannerField('sj-plan-boundaries', 'Privacy and boundaries', 'Public or private? What will you never share?', plan.boundaries, true)
      + plannerField('sj-plan-first-posts', 'First three post ideas', 'Write three simple posts you can make from real evidence.', plan.first_posts, true)
      + '<div id="sj-plan-status" class="social-journey-status" role="status" aria-live="polite">Complete every field and include at least three content pillars.</div>'
      + '<button type="submit" class="social-journey-button">Save my Instagram plan</button><button type="button" class="social-journey-text-button" onclick="socialJourney.closeReminderSetup()">Close</button></form>';
  }

  function openInstagramPlanner() {
    renderInstagramPlanner();
    const overlay = document.getElementById('social-journey-onboarding');
    overlay.classList.add('is-open');
    overlay.setAttribute('aria-hidden', 'false');
  }

  async function saveInstagramPlan() {
    const read = id => String((document.getElementById(id) || {}).value || '').trim();
    const plan = {
      purpose: read('sj-plan-purpose'),
      niche: read('sj-plan-niche'),
      audience: read('sj-plan-audience'),
      identity_statement: read('sj-plan-identity'),
      content_pillars: read('sj-plan-pillars'),
      account_name: read('sj-plan-account'),
      bio: read('sj-plan-bio'),
      posting_rhythm: read('sj-plan-rhythm'),
      boundaries: read('sj-plan-boundaries'),
      first_posts: read('sj-plan-first-posts'),
      updated_at: new Date().toISOString()
    };
    const status = document.getElementById('sj-plan-status');
    if (!isInstagramPlanComplete(plan)) {
      if (status) status.textContent = 'Please complete every field and list at least three distinct content pillars.';
      return;
    }
    if (status) status.textContent = 'Saving your plan...';
    try {
      const settings = Object.assign({}, safeObject(state.settings), { instagram_plan: plan });
      await upsertState({ settings });
      await calculateProgress();
      renderCard();
      renderJourney();
      closeReminderSetup();
      showToast('Your fitness Instagram plan is ready.', 'success');
    } catch (error) {
      if (status) status.textContent = error.message || 'Your plan could not be saved yet.';
    }
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

  function renderReminderSetup() {
    ensureUi();
    const sheet = document.getElementById('social-journey-onboarding-sheet');
    sheet.innerHTML = '<div class="social-journey-onboarding__visual"><div class="social-journey-onboarding__step">Optional reminder</div><h2>Keep the loop gentle.</h2><p>Choose one of your Instagram test conversations if you want a reminder about an unfinished Journey Goal.</p></div>'
      + '<div class="social-journey-onboarding__body"><div id="social-journey-connect-box"><div class="social-journey-status">Loading eligible Instagram conversations...</div></div>'
      + '<button type="button" class="social-journey-button" style="margin-top:14px" onclick="socialJourney.closeReminderSetup()">Done</button></div>';
    renderCandidateSelect();
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

  function closeReminderSetup() {
    const overlay = document.getElementById('social-journey-onboarding');
    if (!overlay) return;
    overlay.classList.remove('is-open');
    overlay.setAttribute('aria-hidden', 'true');
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
    renderReminderSetup();
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
    viewStage = 'lesson';
    renderJourney();
    const scroll = document.getElementById('social-journey-content');
    if (scroll) scroll.scrollTop = 0;
  }

  async function restart() {
    const confirmed = window.confirm('Restart only the social journey from Week 1? Your character, levels, coins and all other Balance data stay exactly as they are.');
    if (!confirmed) return;
    const settings = Object.assign({}, safeObject(state.settings));
    delete settings.lesson_seen_weeks;
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
    await calculateProgress();
    renderCard();
    viewStage = 'lesson';
    renderJourney();
  }

  async function refresh() {
    if (!isJourneyEligible() || loading) return;
    loading = true;
    try {
      await loadState();
      ensureUi();
      await calculateProgress();
      const forceFreshTest = isOnboardingTestUser() && sessionStorage.getItem('pbb_activation_force_fresh') === 'true';
      if (!forceFreshTest && state && Number(state.current_week) === 1 && hasCompletedFirstFoundationsLesson() && !lessonSeenWeeks().includes(1)) {
        await showGoals();
      }
      renderCard();
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
    if (item.type === 'planner') {
      openInstagramPlanner();
      return;
    }
    if (item.type === 'daily_manual') {
      await completeDailyTask(item.id);
      return;
    }
    switchTo(item.action);
  }

  let onboardingTestResetRunning = false;

  async function maybeResetOnboardingTest() {
    let requested = false;
    try { requested = new URLSearchParams(window.location.search).get('onboarding_test_reset') === '1'; } catch (_) {}
    if (!requested || onboardingTestResetRunning) return false;
    const profile = safeObject(window.userProfile);
    if (!profile.id || !profile.email) {
      setTimeout(maybeResetOnboardingTest, 200);
      return true;
    }
    if (!profile.is_test_account || profile.email !== 'shannonrhysbirch+arunima-onboarding-test@gmail.com') {
      showToast('This reset link only works for the dedicated onboarding test account.', 'error');
      try { history.replaceState({}, '', window.location.pathname); } catch (_) {}
      return true;
    }

    onboardingTestResetRunning = true;
    try {
      const client = window.supabaseClient || window.supabase;
      if (!client || !client.auth) throw new Error('The test account is still loading.');
      const authResult = await client.auth.getUser();
      const user = authResult && authResult.data && authResult.data.user;
      if (!user || user.id !== profile.id || user.email !== profile.email) throw new Error('The signed-in test account could not be confirmed.');

      const updateResult = await client.from('users').update({
        onboarding_complete: true,
        is_transferred_client: true,
        sex: 'female'
      }).eq('id', user.id).select('id,onboarding_complete,is_transferred_client,sex').single();
      if (updateResult.error) throw updateResult.error;

      const factsResult = await client.from('user_facts').select('id').eq('user_id', user.id).maybeSingle();
      if (factsResult.error) throw factsResult.error;
      if (factsResult.data && factsResult.data.id) {
        const baselineDetails = {
          0: 'Age: 36',
          1: 'Location: Sydney',
          2: 'Timezone: Australia/Sydney',
          3: 'Works on university education projects, often from home.',
          4: 'Wake time: 7:00-7:30 AM; morning meditation around 30 minutes.',
          5: 'Metric units.',
          age: 36,
          user_gender: 'female',
          why_now: 'Fit comfortably into size 10-12 clothes and build a health routine that lasts.',
          main_blocker: 'When structure drops, mood-based eating, desk snacking and injury flare-ups can knock me off track.',
          dietary_preference: 'vegetarian',
          dietary_requirements: ['vegetarian'],
          equipment_access: 'dumbbells',
          exercise_preferences: { avoid: [], liked: ['dance'] }
        };
        const factsUpdate = await client.from('user_facts').update({
          personal_details: baselineDetails
        }).eq('id', factsResult.data.id).select('id').single();
        if (factsUpdate.error) throw factsUpdate.error;
      }

      const originalConfirm = window.confirm;
      try {
        window.confirm = function () { return true; };
        await refresh();
        if (state) await restart();
      } catch (journeyError) {
        console.warn('[onboarding-test-reset] Inbox state will initialize fresh after onboarding.', journeyError);
      } finally {
        window.confirm = originalConfirm;
      }

      const removableKeys = [];
      for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index);
        if (key && /onboard|featuretour|feature_tour|journey|userprofile|permission/i.test(key)) removableKeys.push(key);
      }
      removableKeys.concat([
        'onboardingComplete',
        'featureTourComplete',
        'pbb_seen_features',
        'pbb_onboarding_owner_user_id',
        'userProfile'
      ]).forEach(function (key) { try { localStorage.removeItem(key); } catch (_) {} });
      try { sessionStorage.clear(); } catch (_) {}
      try { history.replaceState({}, '', window.location.pathname); } catch (_) {}
      window.location.reload();
    } catch (error) {
      onboardingTestResetRunning = false;
      showToast(error.message || 'The onboarding test account could not be reset.', 'error');
    }
    return true;
  }

  function init() {
    let resetRequested = false;
    try { resetRequested = new URLSearchParams(window.location.search).get('onboarding_test_reset') === '1'; } catch (_) {}
    if (resetRequested) {
      maybeResetOnboardingTest();
      return;
    }
    if (initialized || !isJourneyEligible()) return;
    initialized = true;
    const card = getCard();
    if (card) card.addEventListener('click', async function () {
      if (Number(state && state.current_week) === 1 && hasCompletedFirstFoundationsLesson() && !lessonSeenWeeks().includes(1)) {
        await showGoals();
      }
      openJourney(isCurrentLessonSeen() ? 'goals' : 'welcome');
    });
    ensureUi();
    refresh();
  }

  window.socialJourney = {
    isPilotUser,
    isEligibleUser: isJourneyEligible,
    isOnboardingComplete: function () { return !!(state && state.onboarding_complete); },
    open: openJourney,
    close: closeJourney,
    showGoals,
    previewGoalsForTest,
    resetActivationForTest,
    isUnifiedPlanActive: function () { return isPilotUser() || isOnboardingTestUser(); },
    getCurrentWeek: function () { return Number(state && state.current_week || 1); },
    runDailyAction,
    editWeeklyGoals,
    showWelcome,
    openCoachInbox,
    continueFromInbox,
    completeWelcomeAudio,
    welcomeAudioError,
    isWelcomeAudioComplete: hasCompletedWelcomeAudio,
    shouldShowWelcomeMessage,
    getWelcomeAudioUrl: function () { return WELCOME_AUDIO_URL; },
    startActivation,
    useGoals,
    showGoals,
    reviewLesson,
    startFirstCourseLesson,
    completeFirstCourseLesson,
    refresh,
    taskAction,
    openInstagram,
    openInstagramPlanner,
    saveInstagramPlan,
    openReminderSetup,
    closeReminderSetup,
    connectSelectedInstagram,
    sendTestReminder,
    advanceWeek,
    restart,
    _test: {
      WEEK_DEFINITIONS,
      WEEK_LESSONS,
      isInstagramPlanComplete,
      brisbaneDateKey,
      getWeekDefinition: function () { return getWeekDefinition(); }
    }
  };

  window.finishBalanceActivationLesson = completeFirstCourseLesson;

  try {
    if (new URLSearchParams(window.location.search).get('onboarding_test_reset') === '1') {
      setTimeout(maybeResetOnboardingTest, 0);
    }
  } catch (_) {}

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
  document.addEventListener('pbbInitComplete', init);
  document.addEventListener('appCriticalContentReady', init);
  window.addEventListener('pbbInitComplete', init);
  window.addEventListener('appCriticalContentReady', init);
  window.addEventListener('pbbWeeklyGoalsSaved', refresh);
  window.addEventListener('pbbNextStepsUpdated', function () {
    if (!initialized || !state) return;
    renderCard();
    const view = document.getElementById('social-journey-view');
    if (view && view.classList.contains('is-open') && viewStage === 'goals') renderJourney();
  });
  document.addEventListener('visibilitychange', function () { if (!document.hidden && initialized) refresh(); });
})();
