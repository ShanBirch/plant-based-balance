(function () {
  'use strict';

  if (window.__pbbSocialJourneyLoaded) return;
  window.__pbbSocialJourneyLoaded = true;

  const SHANNON_USER_ID = '00a6605e-8edb-4917-85ba-24a23f179059';
  const SHANNON_EMAIL = 'shannonbirch@cocospersonaltraining.com';
  const TABLE = 'social_journey_progress';
  const VERSION = 'social_identity_v1';
  const BRISBANE_TIMEZONE = 'Australia/Brisbane';
  const WELCOME_VIDEO_URL = window.PBB_BALANCE_WELCOME_VIDEO_URL || '/assets/balance-onboarding-coach-note-captioned.mp4';

  const WEEK_DEFINITIONS = [
    {
      week: 1,
      phase: 'FOUNDATIONS · BUILD THE EVIDENCE',
      title: 'Make the first reps visible.',
      body: 'Do one real action, then record it. Feed is not a performance; it is a supportive environment that helps the new pattern feel normal.',
      tasks: [
        task('w1_feed_intro', 'Introduce yourself to the Feed', 'Write a simple hello in Balance Feed. No photo needed.', 'foundations_feed_intro', 1, '\uD83D\uDC4B', 'feed'),
        task('w1_wearable_setup', 'Connect your fitness watch, if you use one', 'Connect a compatible watch, or choose the honest no-watch option. Both paths receive the same course credit.', 'wearable_setup', 1, '\u231A', 'wearable'),
        task('w1_weekly_checkin', 'Complete your weekly check-in', 'Tell Shannon what worked, what got in the way and what you need next.', 'weekly_checkin', 1, '✓', 'checkin')
      ]
    },
    {
      week: 2,
      phase: 'FOUNDATIONS · TRAIN FOR PROGRESS',
      title: 'Training becomes evidence.',
      body: 'Make the minimum visible. A normal session counts, and sharing it helps the repetition feel real.',
      tasks: [
        task('w2_feed_comment', 'Comment on someone else\'s Feed post', 'Respond to the person or what they shared.', 'foundations_feed_comments', 1, '💬', 'feed'),
        task('w2_weekly_checkin', 'Complete your weekly check-in', 'Tell Shannon what worked, what got in the way and what you need next.', 'weekly_checkin', 1, '✓', 'checkin')
      ]
    },
    {
      week: 3,
      phase: 'FOUNDATIONS · FUEL THE WORK',
      title: 'Let normal meals count.',
      body: 'Document what you already eat. The goal is awareness and useful repetition, not performance.',
      tasks: [
        task('w3_workout_feed', 'Share a completed workout to Feed', 'Choose a workout you completed in Balance and share its workout card.', 'foundations_workout_feed', 1, '🏋️', 'movement'),
        task('w3_weekly_checkin', 'Complete your weekly check-in', 'Tell Shannon what worked, what got in the way and what you need next.', 'weekly_checkin', 1, '✓', 'checkin')
      ]
    },
    {
      week: 4,
      phase: 'FOUNDATIONS · WORK WITH REAL LIFE',
      title: 'Make a normal meal visible.',
      body: 'Share food you actually logged in Balance. The useful meal counts without needing to look perfect.',
      tasks: [
        task('w4_meal_feed', 'Share a meal to Feed', 'Choose a meal you logged in Balance and share its meal card.', 'foundations_meal_feed', 1, '🥗', 'meals'),
        task('w4_diary_feed', 'Create a Fitness Diary entry and share it to Feed', 'Complete a real Fitness Diary entry, then share that exact diary entry to Balance Feed.', 'foundations_diary_feed', 1, '📓', 'diary'),
        task('w4_weekly_checkin', 'Complete your weekly check-in', 'Tell Shannon what worked, what got in the way and what you need next.', 'weekly_checkin', 1, '✓', 'checkin')
      ]
    },
    {
      week: 5,
      phase: 'FOUNDATIONS · MAKE THE PLAN FIT THE GOAL',
      title: 'Make progress visible.',
      body: 'A personal best is evidence that the work is moving. Share the result from your Balance workout history.',
      tasks: [
        task('w5_pb_feed', 'Achieve and share one exercise PB to Feed', 'Share a personal best recorded by Balance from a completed exercise.', 'foundations_pb_feed', 1, '🏆', 'movement'),
        task('w5_weekly_checkin', 'Complete your weekly check-in', 'Tell Shannon what worked, what got in the way and what you need next.', 'weekly_checkin', 1, '✓', 'checkin')
      ]
    },
    {
      week: 6,
      phase: 'FOUNDATIONS · KEEP BECOMING THE PERSON WHO DOES IT',
      title: 'Show the process, not a performance.',
      body: 'Finish Foundations with a light routine that can survive an ordinary messy week.',
      tasks: [
        task('w6_feed_reflection', 'Share your course reflections in Feed', 'Write what changed, what helped and what you want to keep doing.', 'foundations_feed_reflection', 1, '📝', 'feed'),
        task('w6_weekly_checkin', 'Complete your weekly check-in', 'Tell Shannon what worked, what got in the way and what you need next.', 'weekly_checkin', 1, '✓', 'checkin')
      ]
    },
    {
      week: 7,
      phase: 'BALANCE IDENTITY · TRAIN THE INPUTS',
      title: 'Choose the inputs. Then choose the account.',
      body: 'Your attention trains your feed, and your feed influences what feels normal. Reset the loop, plan a clear fitness account and start participating on purpose.',
      instagramAction: true,
      tasks: [
        task('w7_diary_feed', 'Create a Fitness Diary entry and share it to Balance Feed', 'Do the health behaviour first, then use your real diary entry as this week\'s community reflection.', 'identity_diary_feed', 1, '📓', 'diary'),
        task('w7_profile', 'Add your Instagram handle to Balance', 'Confirm which Instagram profile belongs to your plan. This identifies your chosen profile, but does not prove any Instagram setting or post.', 'instagram_profile', 1, '@', 'planner'),
        task('w7_plan', 'Build your fitness Instagram plan', 'Define the purpose, niche, audience, pillars, bio, boundaries and first posts.', 'planner', 1, '🧭', 'planner'),
        task('w7_account', 'Create or repurpose your account', 'Set up the handle and bio from your plan. A private account is allowed.', 'manual', 1, '📱', 'instagram'),
        task('w7_reset', 'Curate your Instagram recommendations', 'After using the available controls to signal what you want more of and less of, confirm the action here. Balance cannot read or verify your Instagram settings.', 'member_attestation', 1, '🔄', 'instagram'),
        task('w7_daily_comments', 'Leave 3 meaningful Instagram comments today', 'Do this on at least seven days this week. Respond to the person or the idea, not just the photo.', 'daily_manual', 7, '💬', 'instagram')
      ]
    },
    {
      week: 8,
      phase: 'BALANCE IDENTITY · PUBLISH THE EVIDENCE',
      title: 'Build your first content rhythm.',
      body: 'Publish from work you already did, then use deliberate conversations to become part of the fitness community.',
      tasks: [
        task('w8_diary_feed', 'Create a Fitness Diary entry and share it to Balance Feed', 'Reflect on one real day in Balance before sharing anything outward.', 'identity_diary_feed', 1, '📓', 'diary'),
        task('w8_workouts', 'Complete two workouts', 'The behaviour still comes first.', 'workout_days', 2, '🏋️', 'movement'),
        task('w8_first_post', 'Publish your first fitness post', 'Use one of the three post ideas in your plan and evidence you already have.', 'manual', 1, '📷', 'instagram'),
        task('w8_ig_shares', 'Use Balance to share three Instagram Stories', 'Use real workout, meal or activity cards. Balance records its completed share handoffs, but cannot confirm an Instagram post was published.', 'instagram_shares', 3, '◎', 'instagram'),
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
        task('w9_diary_feed', 'Create a Fitness Diary entry and share it to Balance Feed', 'Use your real diary entry as this week\'s community and reflection home.', 'identity_diary_feed', 1, '📓', 'diary'),
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
        task('w10_diary_feed', 'Create a Fitness Diary entry and share it to Balance Feed', 'Record the work and the real-life context in Balance first.', 'identity_diary_feed', 1, '📓', 'diary'),
        task('w10_workouts', 'Complete two workouts', 'Keep the centre of the system intact.', 'workout_days', 2, '🏋️', 'movement'),
        task('w10_post', 'Publish one useful fitness post', 'Teach or document one thing from your real week.', 'manual', 1, '📷', 'instagram'),
        task('w10_ig_shares', 'Use Balance to share three Instagram Stories', 'Use evidence from the week. Completion comes from Balance-origin share handoff receipts, not an assumed public post.', 'instagram_shares', 3, '◎', 'instagram'),
        task('w10_daily_comments', 'Leave 3 meaningful Instagram comments today', 'Repeat on at least seven days. Be specific, useful and human.', 'daily_manual', 7, '💬', 'instagram')
      ]
    },
    {
      week: 11,
      phase: 'BALANCE IDENTITY · TELL ONE USEFUL STORY',
      title: 'Give the evidence some meaning.',
      body: 'Move beyond posting a receipt and explain one small thing you learned from it.',
      tasks: [
        task('w11_diary_feed', 'Create a Fitness Diary entry and share it to Balance Feed', 'Reflect with the Balance community before turning one lesson outward.', 'identity_diary_feed', 1, '📓', 'diary'),
        task('w11_story', 'Tell one useful progress story', 'What happened, what helped and what comes next.', 'manual', 1, '🗣️', 'instagram'),
        task('w11_ig_shares', 'Use Balance to share three Instagram Stories', 'Keep the cards simple and honest. Balance records the handoff, not Instagram publication.', 'instagram_shares', 3, '◎', 'instagram'),
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
        task('w12_diary_feed', 'Create a Fitness Diary entry and share it to Balance Feed', 'Close the course with one honest weekly reflection in your Balance home.', 'identity_diary_feed', 1, '📓', 'diary'),
        task('w12_recap', 'Post your twelve-week recap', 'Share the pattern, not just the result.', 'manual', 1, '📝', 'instagram'),
        task('w12_ig_shares', 'Use Balance to share three Instagram Stories', 'Keep your normal rhythm. Only completed Balance share handoffs count automatically.', 'instagram_shares', 3, '◎', 'instagram'),
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
    lesson('Your inputs train two prediction systems.', 'Do the health behaviour first and reflect on it in Balance Feed. Then choose what you repeatedly put in front of your attention. Instagram learns from what you watch, search, save, follow, share and comment on. Your own brain also learns from repeated exposure. Neither feed determines who you become, but both can make some choices feel more available and normal.', ['Use the recommendation controls available to deliberately mark what you want more of and what you want less of. Exact labels can change, so use the closest hide, mute, unfollow, recommendation, search, follow and save options you see.', 'Keep Balance Feed as the weekly community and reflection home. Participate before you broadcast outward.', 'Plan Instagram with one purpose and honest boundaries. It is an outward extension of behaviours you are already practising, not the main goal.']),
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
  let coursePreviewWeek = null;
  let initialized = false;
  let welcomeVideoComplete = false;
  let welcomeVideoCompleteUserId = '';

  function hasCompletedWelcomeVideo() {
    const userId = window.currentUser && window.currentUser.id ? String(window.currentUser.id) : '';
    return !!welcomeVideoComplete && !!userId && welcomeVideoCompleteUserId === userId;
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

  function brisbaneClockParts(date) {
    try {
      const parts = new Intl.DateTimeFormat('en-AU', {
        timeZone: BRISBANE_TIMEZONE,
        weekday: 'short',
        hour: '2-digit',
        hour12: false
      }).formatToParts(date || new Date());
      const map = {};
      parts.forEach(part => { if (part.type !== 'literal') map[part.type] = part.value; });
      return { weekday: map.weekday || '', hour: Number(map.hour || 0) };
    } catch (_) {
      const fallback = date || new Date();
      return { weekday: ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][fallback.getDay()], hour: fallback.getHours() };
    }
  }

  function taskAvailability(item, date) {
    const clock = brisbaneClockParts(date);
    if (item && item.type === 'weekly_checkin') {
      const availableNow = ['Fri', 'Sat', 'Sun'].includes(clock.weekday);
      return {
        availableNow,
        availabilityLabel: availableNow ? 'Available now · closes Sunday' : 'Available Friday–Sunday',
        availabilityButtonLabel: availableNow ? 'Open' : 'Friday'
      };
    }
    if (item && (item.type === 'foundations_diary_feed' || item.type === 'identity_diary_feed')) {
      const availableNow = clock.hour >= 18;
      return {
        availableNow,
        availabilityLabel: availableNow ? 'Available now · daily after 6 pm' : 'Available from 6 pm today',
        availabilityButtonLabel: availableNow ? 'Open' : '6 pm'
      };
    }
    return { availableNow: true, availabilityLabel: '', availabilityButtonLabel: 'Open' };
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
    const [stories, comments, transactions, workouts, checkins, personalBests, wearableConnections, nativeWearableRows, memberProfile] = await Promise.all([
      safeQuery(() => supabase.from('stories')
        .select('id,media_type,caption,course_action_id,created_at')
        .eq('user_id', currentUserId())
        .gte('created_at', startIso)
        .lt('created_at', endIso)),
      safeQuery(() => supabase.from('feed_comments')
        .select('id,story_id,created_at,stories!inner(user_id)')
        .eq('user_id', currentUserId())
        .neq('stories.user_id', currentUserId())
        .gte('created_at', startIso)
        .lt('created_at', endIso)),
      safeQuery(() => supabase.from('point_transactions')
        .select('id,transaction_type,reference_id,reference_type,verification_method,created_at')
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
        .lt('workout_date', addDaysKey(state.week_started_at, 7))),
      safeQuery(() => supabase.from('daily_checkins')
        .select('checkin_date,additional_data')
        .eq('user_id', currentUserId())
        .gte('checkin_date', state.week_started_at)
        .lt('checkin_date', addDaysKey(state.week_started_at, 7))),
      safeQuery(() => supabase.from('pb_history')
        .select('id,achieved_at')
        .eq('user_id', currentUserId())
        .gte('achieved_at', startIso)
        .lt('achieved_at', endIso)),
      Promise.all(['fitbit_connections', 'whoop_connections', 'oura_connections', 'strava_connections'].map(table =>
        safeQuery(() => supabase.from(table)
          .select('id,connected_at,is_active')
          .eq('user_id', currentUserId())
          .eq('is_active', true)
          .limit(1)).then(rows => rows.map(row => Object.assign({ source: table.replace('_connections', '') }, row)))
      )).then(groups => groups.flat()),
      safeQuery(() => supabase.from('activity_logs')
        .select('id,source,imported_at')
        .eq('user_id', currentUserId())
        .eq('source', 'native_health')
        .not('imported_at', 'is', null)
        .order('imported_at', { ascending: false })
        .limit(1)),
      safeQuery(() => supabase.from('users')
        .select('id,ig_handle')
        .eq('id', currentUserId())
        .limit(1))
    ]);

    const manual = new Set(state.completed_task_ids);
    const memberAttestations = safeObject(safeObject(state.settings).member_attestations);
    const workoutDays = new Set(workouts.map(row => row.workout_date).filter(Boolean)).size;
    const instagramShares = transactions.length;
    const weeklyCheckinComplete = checkins.some(row => {
      const extra = safeObject(row && row.additional_data);
      const responses = safeArray(extra.weekly_checkins).concat(extra.weekly_checkin ? [Object.assign({ occurrence: 'weekly' }, extra.weekly_checkin)] : []);
      return responses.some(item => item && item.week_start === state.week_started_at && (item.occurrence || 'weekly') === 'weekly' && !!item.submitted_at);
    });
    const storyCard = row => {
      try { return safeObject(JSON.parse(String(row && row.caption || '{}'))); } catch (_) { return {}; }
    };
    const linkedTextPostCount = actionId => stories.filter(row =>
      row.course_action_id === actionId && String(row.caption || '').trim().length > 0
    ).length;
    const currentWeekPbIds = new Set(personalBests.map(row => String(row.id || '')).filter(Boolean));
    const diaryEntryDates = new Set(checkins.filter(row => {
      const extra = safeObject(row && row.additional_data);
      const diary = safeObject(extra.fitness_diary || (extra.type === 'fitness_diary' ? extra : null));
      return diary.type === 'fitness_diary' || Object.keys(diary).length > 0;
    }).map(row => String(row.checkin_date || '')));
    const currentDiaryTaskId = getWeekDefinition().tasks.find(item => item.type === 'foundations_diary_feed' || item.type === 'identity_diary_feed')?.id || '';
    const linkedDiaryShares = stories.filter(row => {
      const card = storyCard(row);
      return row.course_action_id === currentDiaryTaskId
        && card.card_type === 'fitness_diary'
        && diaryEntryDates.has(String(card.diary_date || ''));
    }).length;
    const verifiedWearable = wearableConnections[0] || (nativeWearableRows[0] ? Object.assign({ source: 'native_health' }, nativeWearableRows[0]) : null);
    const settingsBeforeProgress = Object.assign({}, safeObject(state.settings));
    const priorWearableSetup = safeObject(settingsBeforeProgress.foundations_wearable_setup);
    if (verifiedWearable && priorWearableSetup.status !== 'verified_connection') {
      settingsBeforeProgress.foundations_wearable_setup = {
        status: 'verified_connection',
        source: verifiedWearable.source,
        source_record_id: verifiedWearable.id || null,
        verified_at: new Date().toISOString(),
        course_week: 1,
        course_credit: 1
      };
    }
    const wearableSetup = safeObject(settingsBeforeProgress.foundations_wearable_setup);
    const instagramHandle = String(memberProfile[0] && memberProfile[0].ig_handle || '').replace(/^@+/, '').trim();
    const counts = {
      feed_posts: stories.length,
      meal_feed_posts: stories.filter(row => row.media_type === 'meal_card' || row.media_type === 'nutrition_card').length,
      workout_feed_posts: stories.filter(row => row.media_type === 'workout_card').length,
      feed_comments: comments.length,
      instagram_shares: instagramShares,
      instagram_profile: instagramHandle ? 1 : 0,
      workout_instagram_shares: transactions.filter(row => row.transaction_type === 'earn_workout_instagram_share').length,
      meal_instagram_shares: transactions.filter(row => row.transaction_type === 'earn_meal_instagram_share').length,
      workout_days: workoutDays,
      workout_bundle: Math.min(workoutDays, stories.filter(row => row.media_type === 'workout_card').length),
      foundations_feed_intro: linkedTextPostCount('w1_feed_intro'),
      foundations_feed_comments: comments.length,
      foundations_workout_feed: stories.filter(row => row.media_type === 'workout_card' && storyCard(row).card_type === 'workout' && !!storyCard(row).workout_date).length,
      foundations_meal_feed: stories.filter(row => row.media_type === 'meal_card' && storyCard(row).card_type === 'meal').length,
      foundations_diary_feed: linkedDiaryShares,
      identity_diary_feed: linkedDiaryShares,
      foundations_pb_feed: stories.filter(row => row.media_type === 'workout_card' && storyCard(row).card_type === 'pb' && currentWeekPbIds.has(String(storyCard(row).pb_history_id || ''))).length,
      foundations_feed_reflection: linkedTextPostCount('w6_feed_reflection'),
      wearable_setup: ['verified_connection', 'no_compatible_watch'].includes(wearableSetup.status) ? 1 : 0,
      weekly_checkin: weeklyCheckinComplete ? 1 : 0
    };
    const definition = getWeekDefinition();
    const tasks = definition.tasks.map(item => {
      const current = item.type === 'manual'
        ? (manual.has(item.id) ? 1 : 0)
        : (item.type === 'planner'
          ? (isInstagramPlanComplete(instagramPlan()) ? 1 : 0)
          : (item.type === 'member_attestation'
            ? (safeObject(memberAttestations[item.id]).confirmed_at ? 1 : 0)
            : (item.type === 'daily_manual' ? currentWeekDailyTaskCount(item.id) : Number(counts[item.type] || 0))));
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
    const settings = settingsBeforeProgress;
    const foundationWeekProgress = Object.assign({}, safeObject(settings.foundation_week_progress));
    if (definition.week <= 6) {
      foundationWeekProgress[String(definition.week)] = progress;
      settings.foundation_week_progress = foundationWeekProgress;
    }
    await upsertState({ progress_snapshot: progress, settings });
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
    const required = ['purpose', 'niche', 'audience', 'identity_statement', 'instagram_handle', 'account_name', 'bio', 'posting_rhythm', 'boundaries', 'first_posts'];
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
    const unified = isJourneyEligible() && !!state;
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
          if (typeof window.refreshLearningCourseHome === 'function') window.refreshLearningCourseHome();
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
    try {
      if (typeof window.refreshLearningCourseHome === 'function') window.refreshLearningCourseHome();
    } catch (_) {}
  }

  function taskActionLabel(item) {
    if (item.type === 'manual') return item.complete ? 'Completed' : 'Mark done';
    if (item.type === 'planner') return item.complete ? 'Edit plan' : 'Build plan';
    if (item.type === 'instagram_profile') return item.complete ? 'Profile saved' : 'Add profile';
    if (item.type === 'daily_manual') return dailyTaskDates(item.id).includes(brisbaneDateKey()) ? 'Today done' : 'Mark today done';
    if (item.type === 'member_attestation') return item.complete ? 'Confirmed by you' : 'Confirm I did this';
    if (item.type === 'weekly_checkin') return item.complete ? 'Sent' : 'Open check-in';
    if (item.type === 'wearable_setup') return item.complete ? 'Setup recorded' : 'Choose setup';
    if (item.type === 'foundations_diary_feed' || item.type === 'identity_diary_feed') return item.complete ? 'Shared' : 'Open Fitness Diary';
    if (item.action === 'feed') return 'Open Feed';
    if (item.action === 'feed-photo') return 'Take my first Feed photo';
    if (item.action === 'meals') return 'Open Nutrition';
    if (item.action === 'movement') return 'Open Movement';
    if (item.action === 'instagram') return 'Open Instagram';
    return 'Open';
  }

  function isTaskDueToday(item) {
    if (!item || item.complete) return false;
    if (item.type !== 'daily_manual') return true;
    return !dailyTaskDates(item.id).includes(brisbaneDateKey());
  }

  function getNextJourneyTask() {
    const tasks = progress ? safeArray(progress.tasks) : [];
    return tasks.find(isTaskDueToday) || null;
  }

  function getUnifiedAction() {
    if (!isJourneyEligible() || !state) return null;
    const definition = getWeekDefinition();
    const lesson = WEEK_LESSONS[definition.week - 1];
    if (!isCurrentLessonSeen()) {
      return {
        kind: 'course_lesson',
        courseId: definition.week >= 7 ? 'balance-identity' : 'balance-foundations',
        title: definition.week >= 7
          ? 'Start Balance Identity: Week ' + definition.week
          : 'Complete this week\'s Balance Foundations lesson',
        body: lesson ? lesson.title : definition.title,
        cta: 'Open lesson',
        accent: '#b78a2e'
      };
    }
    const nextTask = getNextJourneyTask();
    if (!nextTask) return null;
    return {
      title: (definition.week >= 7 ? 'Balance Identity: ' : 'Foundations: ') + nextTask.label,
      body: nextTask.hint || definition.body,
      cta: taskActionLabel(nextTask),
      accent: definition.week >= 7 ? '#b78a2e' : '#0f766e'
    };
  }

  function openUnifiedAction() {
    if (!isJourneyEligible() || !state) return;
    if (!isCurrentLessonSeen()) {
      const courseId = Number(state.current_week || 1) >= 7 ? 'balance-identity' : 'balance-foundations';
      if (typeof window.pbbOpenNextCourseTarget === 'function') {
        window.pbbOpenNextCourseTarget(courseId);
      } else if (typeof window.switchAppTab === 'function') {
        window.switchAppTab('learning');
      }
      return;
    }
    const nextTask = getNextJourneyTask();
    if (nextTask) {
      taskAction(nextTask.id);
      return;
    }
    openJourney('goals');
  }

  function renderTasks() {
    const tasks = progress ? progress.tasks : getWeekDefinition().tasks.map(item => Object.assign({}, item, { current: 0, complete: false }));
    return tasks.map(item => {
      const value = item.type === 'manual'
        ? (item.complete ? 'Done' : 'Open')
        : (item.type === 'planner'
          ? (item.complete ? 'Ready' : 'Not started')
          : (item.type === 'instagram_profile'
            ? (item.complete ? 'Saved' : 'Not added')
            : (item.type === 'member_attestation'
            ? (item.complete ? 'Confirmed' : 'Your confirmation')
            : (item.type === 'daily_manual' ? Math.min(item.current, item.target) + ' / ' + item.target + ' days' : Math.min(item.current, item.target) + ' / ' + item.target))));
      return '<article class="social-journey-task ' + (item.complete ? 'is-complete' : '') + '">'
        + '<div class="social-journey-task__icon">' + (item.complete ? '✓' : item.icon) + '</div>'
        + '<div><div class="social-journey-task__title">' + escapeHtml(item.label) + '</div><div class="social-journey-task__hint">' + escapeHtml(item.hint) + '</div></div>'
        + '<div class="social-journey-task__value">' + escapeHtml(value) + '</div>'
        + '<button type="button" class="social-journey-task__action ' + ((item.type === 'manual' || item.type === 'daily_manual' || item.type === 'member_attestation') ? 'is-check' : '') + '" onclick="socialJourney.taskAction(\'' + item.id + '\')">' + escapeHtml(taskActionLabel(item)) + '</button>'
        + '</article>';
    }).join('');
  }

  function getFitnessDiaryCourseActionId() {
    if (!state) return null;
    const definition = getWeekDefinition();
    const taskItem = definition.tasks.find(item => item.type === 'foundations_diary_feed' || item.type === 'identity_diary_feed');
    return taskItem ? taskItem.id : null;
  }

  function renderWearableSetup() {
    const setup = safeObject(safeObject(state && state.settings).foundations_wearable_setup);
    const sheet = document.getElementById('social-journey-onboarding-sheet');
    if (!sheet) return;
    sheet.innerHTML = '<div class="social-journey-onboarding__visual"><div class="social-journey-onboarding__step">Foundations Week 1</div><h2>Do you use a fitness watch?</h2><p>If you have a compatible watch, connect it so Balance can verify the setup. If you do not use one, say so honestly. Both choices receive the same course credit.</p></div>'
      + (setup.status ? '<div class="social-journey-callout"><strong>Current choice</strong><p>' + escapeHtml(setup.status === 'verified_connection' ? 'Verified watch connection: ' + String(setup.source || 'connected wearable') : 'No compatible fitness watch') + '</p></div>' : '')
      + '<button type="button" class="social-journey-button" onclick="socialJourney.verifyWearableSetup()">Connect or verify my watch</button>'
      + '<button type="button" class="social-journey-button secondary" onclick="socialJourney.recordNoWatch()">I do not use a compatible fitness watch</button>'
      + '<button type="button" class="social-journey-text-button" onclick="socialJourney.closeOnboarding()">Not now</button>';
  }

  function openWearableSetup() {
    renderWearableSetup();
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

  async function recordNoWatch() {
    const settings = Object.assign({}, safeObject(state.settings));
    const existing = safeObject(settings.foundations_wearable_setup);
    settings.foundations_wearable_setup = existing.status === 'no_compatible_watch' ? existing : {
      status: 'no_compatible_watch',
      selected_at: new Date().toISOString(),
      course_week: 1,
      course_credit: 1
    };
    await upsertState({ settings });
    await calculateProgress();
    closeOnboarding();
    renderCard();
    renderJourney();
    showToast('No-watch option recorded with full course credit.', 'success');
  }

  async function verifyWearableSetup() {
    await calculateProgress();
    const setup = safeObject(safeObject(state.settings).foundations_wearable_setup);
    if (setup.status === 'verified_connection') {
      closeOnboarding();
      renderCard();
      renderJourney();
      showToast('Your fitness watch connection is verified.', 'success');
      return;
    }
    closeOnboarding();
    if (typeof window.toggleHealthConnect === 'function') window.toggleHealthConnect();
    else showToast('Open Settings to connect your fitness watch, then return here to verify it.', 'info');
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
    if (viewStage === 'course-lesson') {
      renderIdentityCourseLesson();
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

  function renderIdentityCourseLesson() {
    ensureUi();
    const container = document.getElementById('social-journey-content');
    const week = Math.max(7, Math.min(12, Number(coursePreviewWeek) || 7));
    const definition = WEEK_DEFINITIONS[week - 1];
    const lessonCopy = WEEK_LESSONS[week - 1];
    if (!container || !definition || !lessonCopy) return;
    const isCurrentWeek = Number(state && state.current_week) === week;
    document.querySelector('.social-journey-header__title').textContent = 'Balance Identity';
    document.querySelector('.social-journey-header__week').textContent = 'Week ' + (week - 6) + ' of 6';
    container.innerHTML = '<section class="social-journey-lesson">'
      + '<div class="social-journey-lesson__number"><span>IDENTITY</span><strong>' + String(week - 6).padStart(2, '0') + '</strong></div>'
      + '<div class="social-journey-lesson__eyebrow">' + escapeHtml(definition.phase) + '</div>'
      + '<h2>' + escapeHtml(lessonCopy.title) + '</h2><p>' + escapeHtml(lessonCopy.body) + '</p></section>'
      + '<section class="social-journey-learn-card"><div class="social-journey-section__heading">Put it into practice</div>'
      + '<div class="social-journey-learn-points">' + lessonCopy.points.map(function(point, index){ return '<div><span>' + String(index + 1).padStart(2, '0') + '</span><p>' + escapeHtml(point) + '</p></div>'; }).join('') + '</div></section>'
      + '<div class="social-journey-lesson-action">'
      + (isCurrentWeek ? '<button type="button" class="social-journey-button" onclick="socialJourney.showGoals()">' + (week === 7 ? 'I understand the loop - build my plan' : 'Use this lesson') + '</button>' : '')
      + '<button type="button" class="social-journey-button secondary" onclick="socialJourney.returnToCourse()">Back to Balance Identity</button></div>';
  }

  function getIdentityCourseProgress() {
    const currentJourneyWeek = Math.max(1, Math.min(12, Number(state && state.current_week) || 1));
    const seenWeeks = new Set(lessonSeenWeeks());
    const weekProgress = WEEK_DEFINITIONS.slice(6).map(function(definition, index){
      const journeyWeek = index + 7;
      const lessonCopy = WEEK_LESSONS[journeyWeek - 1];
      return {
        number: index + 1,
        journeyWeek,
        title: lessonCopy.title,
        description: definition.body,
        isComplete: seenWeeks.has(journeyWeek),
        isLocked: currentJourneyWeek < journeyWeek
      };
    });
    const completed = weekProgress.filter(function(week){ return week.isComplete; }).length;
    return {
      completed,
      total: weekProgress.length,
      percent: Math.round((completed / weekProgress.length) * 100),
      isComplete: completed === weekProgress.length,
      isUnlocked: currentJourneyWeek >= 7,
      currentJourneyWeek,
      weekProgress
    };
  }

  function getFoundationsCourseProgress() {
    if (!state) return { available: false, currentJourneyWeek: 1, weekProgress: [] };
    const currentJourneyWeek = Math.max(1, Math.min(12, Number(state.current_week) || 1));
    const snapshots = safeObject(safeObject(state.settings).foundation_week_progress);
    const weekProgress = WEEK_DEFINITIONS.slice(0, 6).map(function(definition){
      const saved = definition.week === currentJourneyWeek
        ? progress
        : safeObject(snapshots[String(definition.week)]);
      const savedTasks = new Map(safeArray(saved && saved.tasks).map(function(item){ return [item.id, item]; }));
      const tasks = definition.tasks.map(function(item){
        const stored = savedTasks.get(item.id);
        const current = Math.max(0, Number(stored && stored.current) || 0);
        const complete = !!(stored && stored.complete) || current >= item.target;
        return Object.assign({}, item, taskAvailability(item), {
          current,
          complete,
          actionLabel: definition.week === currentJourneyWeek ? taskActionLabel(Object.assign({}, item, { current, complete })) : (complete ? 'Done' : 'Not completed')
        });
      });
      const completedTasks = tasks.filter(function(item){ return item.complete; }).length;
      return {
        number: definition.week,
        title: definition.title,
        description: definition.body,
        tasks,
        completedTasks,
        totalTasks: tasks.length,
        tasksComplete: tasks.length > 0 && completedTasks === tasks.length,
        isCurrent: definition.week === currentJourneyWeek,
        isLocked: definition.week > currentJourneyWeek
      };
    });
    return { available: true, currentJourneyWeek, weekProgress };
  }

  function taskActionForCourse(weekNumber, taskId) {
    const week = Math.max(1, Math.min(6, Number(weekNumber) || 1));
    if (!state || week > Number(state.current_week)) {
      showToast('That week will unlock when you reach it.', 'info');
      return;
    }
    if (week !== Number(state.current_week)) {
      showToast('This is a previous week. Its saved result is shown here.', 'info');
      return;
    }
    taskAction(taskId);
  }

  function openIdentityCourseWeek(weekNumber) {
    if (!isJourneyEligible() || !state) return;
    const week = Math.max(7, Math.min(12, Number(weekNumber) || 7));
    if (week > Number(state.current_week)) {
      showToast('That Balance Identity week will unlock when you reach it.', 'info');
      return;
    }
    coursePreviewWeek = week;
    ensureUi();
    viewStage = 'course-lesson';
    renderJourney();
    const view = document.getElementById('social-journey-view');
    view.classList.add('is-open');
    view.setAttribute('aria-hidden', 'false');
  }

  function returnToCourse() {
    closeJourney();
    if (typeof window.switchAppTab === 'function') {
      try { window.switchAppTab('learning'); } catch (_) {}
    }
    setTimeout(function(){
      if (typeof window.openBalanceIdentityCourse === 'function') window.openBalanceIdentityCourse();
    }, 80);
  }

  function renderWelcome() {
    ensureUi();
    const container = document.getElementById('social-journey-content');
    if (!container) return;
    document.querySelector('.social-journey-header__title').textContent = 'Your Next Step';
    document.querySelector('.social-journey-header__week').textContent = 'A message from Coach Shannon';
    const welcomeReady = hasCompletedWelcomeVideo();
    container.innerHTML = '<section class="social-journey-welcome">'
      + '<div class="social-journey-welcome__eyebrow">YOUR COACH NOTE &middot; PRESS PLAY</div>'
      + '<h2>Start here.</h2>'
      + '<p>Watch Shannon’s coach note, then complete your first Balance Foundations lesson. After that, Your Next Step will show you exactly what to do next.</p>'
      + '<video id="social-journey-welcome-video" class="social-journey-welcome__video" poster="/assets/balance-onboarding-coach-note-poster.jpg" controls playsinline preload="metadata" controlslist="nodownload noplaybackrate" disablepictureinpicture onloadedmetadata="socialJourney.guardWelcomeVideo(this)" onerror="socialJourney.welcomeVideoError(this)"><source src="' + escapeHtml(WELCOME_VIDEO_URL) + '" type="video/mp4"></video>'
      + '<div class="social-journey-welcome__transcript"><strong>The short version</strong><p>Use the app as evidence, not judgment. Log the meal you actually ate, complete the workout that fits today, and share the ordinary reps. That is how we build something that lasts.</p></div>'
      + '</section><div class="social-journey-lesson-action"><div id="social-journey-welcome-status" role="status" aria-live="polite" style="font-size:.78rem;font-weight:800;color:#765315;margin-bottom:8px;">' + (welcomeReady ? 'Coach note complete. Your first lesson is ready.' : 'Watch the full coach note to unlock your first lesson.') + '</div><button id="social-journey-welcome-continue" type="button" class="social-journey-button" onclick="socialJourney.reviewLesson()" ' + (welcomeReady ? '' : 'disabled') + ' style="opacity:' + (welcomeReady ? '1' : '.55') + ';cursor:' + (welcomeReady ? 'pointer' : 'not-allowed') + ';">' + (welcomeReady ? 'Open my first lesson' : 'Watch first') + '</button><button type="button" class="social-journey-text-button" onclick="socialJourney.close()">Not now</button></div>';
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
    if (Number(state && state.current_week) === 1 && !hasCompletedWelcomeVideo()) {
      showToast('Watch Shannon’s full coach note before continuing.', 'info');
      const video = document.getElementById('social-journey-welcome-video');
      if (video) {
        try { video.scrollIntoView({ block: 'center', behavior: 'smooth' }); video.focus(); } catch (_) {}
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
    if (!hasCompletedWelcomeVideo()) {
      showToast('Watch Shannon’s full coach note before continuing.', 'info');
      const video = document.getElementById('balance-onboarding-welcome-video');
      if (video) {
        try { video.scrollIntoView({ block: 'center', behavior: 'smooth' }); video.focus(); } catch (_) {}
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

  function guardWelcomeVideo(video) {
    if (!video || video.dataset.balanceWatchGuard === 'true') return;
    video.dataset.balanceWatchGuard = 'true';
    video.dataset.furthestWatched = '0';
    const statusId = video.id === 'balance-onboarding-welcome-video' ? 'balance-onboarding-welcome-status' : 'social-journey-welcome-status';
    const status = function(){ return document.getElementById(statusId); };
    const stopSkipping = function(){
      const furthest = Number(video.dataset.furthestWatched) || 0;
      if (video.currentTime > furthest + 1.5) {
        try { video.currentTime = furthest; } catch (_) {}
        const label = status();
        if (label) label.textContent = 'Watch the full coach note to continue. You can rewind at any time.';
      }
    };
    video.addEventListener('seeking', stopSkipping);
    video.addEventListener('timeupdate', function(){
      const furthest = Number(video.dataset.furthestWatched) || 0;
      if (video.currentTime > furthest + 1.5) {
        stopSkipping();
        return;
      }
      video.dataset.furthestWatched = String(Math.max(furthest, Number(video.currentTime) || 0));
    });
    video.addEventListener('ended', function(){
      const duration = Number(video.duration) || 0;
      const furthest = Number(video.dataset.furthestWatched) || 0;
      if (duration && duration - furthest <= 1.6) completeWelcomeVideo();
    });
  }

  function completeWelcomeVideo() {
    welcomeVideoComplete = true;
    welcomeVideoCompleteUserId = window.currentUser && window.currentUser.id ? String(window.currentUser.id) : '';
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
      if (status) status.textContent = 'Coach note complete. Your first lesson is ready.';
    });
    try { window.trackBalanceActivity('coach_welcome_video_completed', { source: 'activation_journey' }, { immediate: true }); } catch (_) {}
  }

  function welcomeVideoError(video) {
    if (video && video.classList) video.classList.add('is-unavailable');
    const status = document.getElementById('balance-onboarding-welcome-status') || document.getElementById('social-journey-welcome-status');
    if (status) status.textContent = 'The coach note could not load. Tap Play to try again.';
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

  function switchTo(action, taskId) {
    if (action === 'checkin' && typeof window.openWeeklyCheckinPreview === 'function') return window.openWeeklyCheckinPreview();
    closeJourney();
    if (action === 'instagram') return openInstagram();
    if (action === 'diary') {
      if (typeof window.switchAppTab === 'function') window.switchAppTab('dashboard');
      setTimeout(function(){
        if (typeof window.openFitnessDiaryForAction === 'function') {
          window.openFitnessDiaryForAction();
          return;
        }
        const card = document.getElementById('fitness-diary-card') || document.getElementById('fitness-diary-done-card');
        if (card && card.id === 'fitness-diary-card') card.style.display = 'block';
        if (card && typeof card.scrollIntoView === 'function') card.scrollIntoView({ block: 'center', behavior: 'smooth' });
        if (typeof window.expandFitnessDiary === 'function' && document.getElementById('fitness-diary-card')) window.expandFitnessDiary();
      }, 350);
      return;
    }
    if (action === 'feed' && (taskId === 'w1_feed_intro' || taskId === 'w6_feed_reflection')) {
      try { sessionStorage.setItem('pbb_foundations_feed_action', taskId); } catch (_) {}
    }
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

  async function confirmMemberAttestation(taskId) {
    const settings = Object.assign({}, safeObject(state.settings));
    const attestations = Object.assign({}, safeObject(settings.member_attestations));
    if (!safeObject(attestations[taskId]).confirmed_at) {
      attestations[taskId] = {
        confirmed_at: new Date().toISOString(),
        confirmation: 'member_confirmed_completed',
        statement_version: taskId === 'w7_reset' ? 'instagram_recommendation_curation_v1' : 'v1',
        externally_verified: false,
        journey_week: Number(state.current_week)
      };
      settings.member_attestations = attestations;
      await upsertState({ settings });
    }
    await calculateProgress();
    renderCard();
    renderJourney();
    showToast('Your confirmation is recorded. Balance does not verify Instagram settings.', 'success');
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
      + plannerField('sj-plan-handle', 'Instagram handle', 'Your profile handle, without the @. This confirms the profile you chose; Balance does not verify ownership.', plan.instagram_handle, false)
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
      instagram_handle: read('sj-plan-handle').replace(/^@+/, '').toLowerCase(),
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
    if (!/^[a-z0-9._]{1,30}$/.test(plan.instagram_handle)) {
      if (status) status.textContent = 'Add a valid Instagram handle using letters, numbers, dots or underscores.';
      return;
    }
    if (status) status.textContent = 'Saving your plan...';
    try {
      const profileResult = await window.supabaseClient
        .from('users')
        .update({ ig_handle: plan.instagram_handle })
        .eq('id', currentUserId())
        .select('id,ig_handle')
        .single();
      if (profileResult.error) throw profileResult.error;
      const settings = Object.assign({}, safeObject(state.settings), {
        instagram_plan: plan,
        instagram_identity_confirmation: {
          handle: plan.instagram_handle,
          confirmed_at: new Date().toISOString(),
          source: 'member_profile_field',
          user_record_id: profileResult.data && profileResult.data.id || currentUserId(),
          ownership_verified: false
        }
      });
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
    if (item.type === 'planner' || item.type === 'instagram_profile') {
      openInstagramPlanner();
      return;
    }
    if (item.type === 'daily_manual') {
      await completeDailyTask(item.id);
      return;
    }
    if (item.type === 'member_attestation') {
      await confirmMemberAttestation(item.id);
      return;
    }
    if (item.type === 'wearable_setup') {
      openWearableSetup();
      return;
    }
    switchTo(item.action, item.id);
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
    isUnifiedPlanActive: function () { return isJourneyEligible() && !!state; },
    getUnifiedAction,
    openUnifiedAction,
    getFoundationsCourseProgress,
    taskActionForCourse,
    getIdentityCourseProgress,
    openIdentityCourseWeek,
    returnToCourse,
    getCurrentWeek: function () { return Number(state && state.current_week || 1); },
    runDailyAction,
    editWeeklyGoals,
    showWelcome,
    openCoachInbox,
    continueFromInbox,
    guardWelcomeVideo,
    completeWelcomeVideo,
    welcomeVideoError,
    isWelcomeVideoComplete: hasCompletedWelcomeVideo,
    shouldShowWelcomeMessage,
    getWelcomeVideoUrl: function () { return WELCOME_VIDEO_URL; },
    startActivation,
    useGoals,
    showGoals,
    reviewLesson,
    startFirstCourseLesson,
    completeFirstCourseLesson,
    refresh,
    taskAction,
    confirmMemberAttestation,
    getFitnessDiaryCourseActionId,
    openWearableSetup,
    verifyWearableSetup,
    recordNoWatch,
    closeOnboarding,
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
      brisbaneClockParts,
      taskAvailability,
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
