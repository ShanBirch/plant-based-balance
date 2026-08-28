const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.resolve(__dirname, '..', 'js/dashboard/pbb-next-obvious-steps.js'), 'utf8');
const onboardingIds = [
  'meal_plan_intro',
  'workout_week_intro',
  'coach_message_intro',
  'feed_intro',
  'weekly_goals_intro',
  'foundations_intro'
];

function loadPlan({ createdAt, seen = [], week = 1, goals = [], metaTrial = false }) {
  const userId = 'test-user';
  const storage = new Map();
  seen.forEach(id => storage.set(`pbb_onboarding_step_seen:${userId}:${id}`, '1'));

  const localStorage = {
    getItem(key) { return storage.has(key) ? storage.get(key) : null; },
    setItem(key, value) { storage.set(key, String(value)); },
    removeItem(key) { storage.delete(key); }
  };
  const document = {
    readyState: 'loading',
    hidden: false,
    addEventListener() {},
    getElementById() { return null; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    createElement() { return {}; },
    head: { appendChild() {} }
  };
  const window = {
    metaAdTrialMode: metaTrial,
    currentUser: { id: userId, email: 'member@example.com', created_at: createdAt },
    document,
    localStorage,
    location: { search: '' },
    socialJourney: {
      isUnifiedPlanActive() { return true; },
      getCurrentWeek() { return week; }
    },
    weeklyGoals: {
      getState() {
        return { selected: goals.map(id => ({ id })), progress: { goals: [] } };
      }
    },
    addEventListener() {},
    getComputedStyle() { return { display: 'none', visibility: 'visible', opacity: '1' }; }
  };
  window.window = window;

  vm.runInNewContext(source, {
    window,
    document,
    localStorage,
    URLSearchParams,
    CustomEvent: function CustomEvent() {},
    console,
    setTimeout() { return 0; },
    clearTimeout() {},
    setInterval() { return 0; },
    Date,
    Number,
    Math
  });

  return window.pbbNextSteps.getPlan();
}

test('existing accounts never receive first-run introduction cards', () => {
  const plan = loadPlan({ createdAt: '2025-01-01T00:00:00Z', week: 1 });
  const ids = plan.map(item => item.id);

  onboardingIds.forEach(id => assert.equal(ids.includes(id), false, `${id} should be hidden`));
  assert.equal(ids.includes('quiz'), true, 'normal daily plan items should remain');
});

test('unknown account age fails closed instead of treating the member as new', () => {
  const plan = loadPlan({ createdAt: null, week: 1 });
  const ids = plan.map(item => item.id);

  onboardingIds.forEach(id => assert.equal(ids.includes(id), false, `${id} should be hidden`));
});

test('new accounts receive incomplete onboarding cards only', () => {
  const plan = loadPlan({
    createdAt: '2026-08-20T01:00:00Z',
    seen: ['meal_plan_intro'],
    week: 1
  });
  const ids = plan.map(item => item.id);

  assert.equal(ids.includes('feed_intro'), true);
  assert.equal(ids.includes('meal_plan_intro'), false, 'meal plan prompt should stay gone after it is opened');
  assert.equal(ids.includes('workout_week_intro'), true);
  assert.equal(ids.includes('coach_message_intro'), true);
  assert.equal(ids.includes('weekly_goals_intro'), true);
  assert.equal(ids.includes('foundations_intro'), true);
});

test('the Meta onboarding preview exposes the full guided Home checklist', () => {
  const plan = loadPlan({ createdAt: null, metaTrial: true });
  const ids = plan.map(item => item.id);

  assert.equal(JSON.stringify(ids.slice(0, 6)), JSON.stringify(onboardingIds));
  assert.equal(ids.length, 6, 'the guided setup should not mix in normal daily actions');
  assert.match(source, /ONBOARDING_ACTION_IDS\.concat\(\['activity_insights_intro'\]\)/);
  assert.match(source, /storedKey\.indexOf\('pbb_onboarding_step_seen:'\)/);
});

test('activity insights onboarding is also restricted to new accounts', () => {
  const existingPlan = loadPlan({ createdAt: '2025-01-01T00:00:00Z', week: 2 });
  const newPlan = loadPlan({ createdAt: '2026-08-20T01:00:00Z', week: 2 });

  assert.equal(existingPlan.some(item => item.id === 'activity_insights_intro'), false);
  assert.equal(newPlan.some(item => item.id === 'activity_insights_intro'), true);
});

test('water and sleep review are not Home actions even when selected as goals', () => {
  const plan = loadPlan({
    createdAt: '2025-01-01T00:00:00Z',
    goals: ['water_goal_days', 'sleep_7h_nights']
  });
  const ids = plan.map(item => item.id);

  assert.equal(ids.includes('hydration'), false);
  assert.equal(ids.includes('sleep'), false);
  assert.doesNotMatch(source, /title: 'Hit your water goal'/);
  assert.doesNotMatch(source, /title: 'Check your sleep trend'/);
});
