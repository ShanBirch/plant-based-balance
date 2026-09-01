const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

function loadNextStepsAtHour(hour, pendingImportedActivity) {
  class TestDate extends Date {
    constructor(...args) {
      super(...(args.length ? args : ['2026-09-01T09:00:00Z']));
    }
    getHours() { return hour; }
  }
  const values = new Map();
  const localStorage = {
    getItem: key => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key),
    get length() { return values.size; },
    key: index => Array.from(values.keys())[index] || null
  };
  const document = {
    readyState: 'loading',
    hidden: false,
    addEventListener() {},
    getElementById() { return null; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    documentElement: { classList: { add() {} } },
    head: { appendChild() {} },
    createElement() { return { style: {}, classList: { add() {} } }; }
  };
  const window = {
    currentUser: { id: 'ordinary-member', email: 'member@example.com' },
    location: { hostname: 'plantbased-balance.org', search: '' },
    addEventListener() {},
    dispatchEvent() {},
    metaAdTrialMode: false,
    openCurrentCourseLesson() {},
    getCurrentCourseLessonDestination() {
      return { itemId: 'lesson-1', courseId: 'balance-foundations', title: 'Continue your lesson', body: 'Keep going.', cta: 'Open Course' };
    }
  };
  if (pendingImportedActivity) {
    window.pbbPendingImportedActivity = pendingImportedActivity;
    window.getPendingImportedActivityForHome = () => window.pbbPendingImportedActivity;
  }
  const context = vm.createContext({
    window,
    document,
    localStorage,
    Date: TestDate,
    URLSearchParams,
    CustomEvent: class CustomEvent {},
    console,
    setTimeout() { return 1; },
    clearTimeout() {},
    setInterval() { return 1; }
  });
  vm.runInContext(read('js/dashboard/pbb-next-obvious-steps.js'), context);
  return { window, localStorage };
}

test('Home adds a detected imported activity to the daily to-do plan', () => {
  const nextSteps = read('js/dashboard/pbb-next-obvious-steps.js');
  const importedActivity = read('js/dashboard/pbb-deferred-fitbit.js');

  assert.match(nextSteps, /id: 'imported_activity'/);
  assert.match(nextSteps, /Add a photo to your/);
  assert.match(nextSteps, /window\.openImportedActivityForSharing\(pending\)/);
  assert.match(nextSteps, /getImportedActivityAction\(\)/);
  assert.match(importedActivity, /window\.pbbPendingImportedActivity = combinedActivity/);
  assert.match(importedActivity, /pbb:imported-activity-updated/);
  assert.doesNotMatch(importedActivity, /if \(!window\.currentUser \|\| !window\.isMoveYourWayPilotUser/);
  assert.doesNotMatch(importedActivity, /card\.id = 'fitbit-imported-activity-card'/);
});

test('End-of-day check-in re-evaluates the 6 PM rollover while the app stays open', () => {
  const dailyCards = read('js/dashboard/dashboard-script-1-daily_weighin_card_logic.js');

  assert.match(dailyCards, /_lastFitnessDiaryHour[\s\S]*setInterval\(function\(\)[\s\S]*checkAndShowFitnessDiaryCard\(\)[\s\S]*window\.pbbNextSteps\.refresh\(\)[\s\S]*30000/);
});

test('Home Next Step actions stay bound through async card refreshes', () => {
  const nextSteps = read('js/dashboard/pbb-next-obvious-steps.js');
  const journeyCss = read('css/dashboard/pbb-social-journey.css');

  assert.match(nextSteps, /document\.addEventListener\('click', handleClick, true\)/);
  assert.match(nextSteps, /data-next-step-direct="true" onclick="window\.pbbNextSteps\.runAction/);
  assert.match(nextSteps, /data-next-step-direct'\) === 'true'/);
  assert.match(nextSteps, /selector === '#fitness-diary-card'[\s\S]*collapsed\.style\.display = 'none'[\s\S]*form\.style\.display = 'block'/);
  assert.match(journeyCss, /#view-dashboard \.pbb-next-step-active-source \{ display: block !important; \}/);
  assert.doesNotMatch(nextSteps, /card\.addEventListener\('click', handleClick\)/);
});

test('Fitness Diary stays hidden until its evening To Do action is clicked', () => {
  const dailyCards = read('js/dashboard/dashboard-script-1-daily_weighin_card_logic.js');
  const nextSteps = read('js/dashboard/pbb-next-obvious-steps.js');
  const journey = read('js/dashboard/pbb-social-journey.js');

  assert.match(dailyCards, /function openFitnessDiaryForAction\(\)/);
  assert.match(dailyCards, /new Date\(\)\.getHours\(\) < 18 \|\| window\._fitnessDiaryActionOpen !== true/);
  assert.match(dailyCards, /function openFitnessDiaryForAction\(\) \{[\s\S]*?new Date\(\)\.getHours\(\) < 18\) return false/);
  assert.match(dailyCards, /card\.style\.display = 'block';[\s\S]*expandFitnessDiary\(\)/);
  assert.match(dailyCards, /alreadyDone[\s\S]*doneCard\.style\.display = 'flex'/);
  assert.match(dailyCards, /window\.openFitnessDiaryForAction = openFitnessDiaryForAction/);
  assert.match(nextSteps, /selector === '#fitness-diary-card' && typeof window\.openFitnessDiaryForAction === 'function'/);
  assert.match(journey, /action === 'diary'[\s\S]*window\.openFitnessDiaryForAction\(\)/);
  assert.match(journey, /function isTaskDueToday\(item\)[\s\S]*!taskAvailability\(item\)\.availableNow\) return false/);
  assert.match(nextSteps, /function isFitnessDiaryDue\(\)[\s\S]*new Date\(\)\.getHours\(\) < 18[\s\S]*fitnessDiaryDone_/);
  assert.match(nextSteps, /fitnessDiaryAction && isFitnessDiaryDue\(\)/);
  assert.match(nextSteps, /function isMemberEligible\(\)[\s\S]*window\.currentUser[\s\S]*!window\.isAdminViewing/);
  assert.match(nextSteps, /if \(!isMemberEligible\(\)\) \{/);
  assert.match(dailyCards, /localStorage\.setItem\('fitnessDiaryDone_' \+ dateKey, '1'\);[\s\S]*window\.pbbNextSteps\.refresh\(\)/);
});

test('ordinary members receive the full To Do Next plan all day plus Fitness Diary after 6 PM', () => {
  const evening = loadNextStepsAtHour(19);
  assert.deepEqual(Array.from(evening.window.pbbNextSteps.getSuggestions(), action => action.id), ['quiz', 'fitness_diary']);

  evening.localStorage.setItem('fitnessDiaryDone_2026-09-01', '1');
  assert.deepEqual(Array.from(evening.window.pbbNextSteps.getSuggestions(), action => action.id), ['quiz']);

  const afternoon = loadNextStepsAtHour(17);
  assert.deepEqual(Array.from(afternoon.window.pbbNextSteps.getSuggestions(), action => action.id), ['quiz']);
});

test('ordinary members receive a detected walk immediately without losing the nightly diary', () => {
  const walk = {
    id: 'walk-1',
    source: 'native_health',
    source_label: 'Apple Health',
    activity_type: 'walking',
    activity_label: 'Walking',
    source_metadata: { distance_km: 4.2, distance_unit: 'km' }
  };
  const afternoon = loadNextStepsAtHour(17, walk);
  assert.deepEqual(Array.from(afternoon.window.pbbNextSteps.getSuggestions(), action => action.id), ['imported_activity', 'quiz']);
  assert.match(afternoon.window.pbbNextSteps.getSuggestions()[0].title, /4\.2 km walk/);

  const evening = loadNextStepsAtHour(19, walk);
  assert.deepEqual(Array.from(evening.window.pbbNextSteps.getSuggestions(), action => action.id), ['imported_activity', 'quiz', 'fitness_diary']);
});

test('member rollout keeps test controls and the admin dashboard private', () => {
  const nextSteps = read('js/dashboard/pbb-next-obvious-steps.js');
  const supabase = read('lib/supabase.js');
  const admin = read('admin-dashboard.html');
  const userData = read('js/dashboard/dashboard-script-3-1_get_user_data.js');

  assert.match(nextSteps, /showTestControls = isPreviewEligible\(\) && !unified/);
  assert.match(nextSteps, /isMemberEligible: isMemberEligible/);
  assert.doesNotMatch(nextSteps, /Private preview/);
  assert.match(supabase, /const BALANCE_ADMIN_EMAIL = 'shannonbirch@cocospersonaltraining\.com'/);
  assert.match(admin, /if \(!window\.isBalanceAdminEmail\?\.\(user\?\.email\)\)[\s\S]*window\.location\.replace\('\/dashboard\.html'\)/);
  assert.doesNotMatch(userData, /Seeding Test Account Data|profile: 'CORTISOL'|symptoms: \['anxiety', 'bloating', 'fatigue'\]/);
  assert.match(userData, /prepareOnboardingTestAccount/);
});

test('Home renders 10k steps as automatic daily progress instead of a dead-end link', () => {
  const nextSteps = read('js/dashboard/pbb-next-obvious-steps.js');
  const journey = read('js/dashboard/pbb-social-journey.js');

  assert.match(nextSteps, /steps: bestSteps >= 10000,[\s\S]*step_count: bestSteps/);
  assert.match(nextSteps, /data-next-step-id="steps" data-next-step-readonly="true" role="status"/);
  assert.match(nextSteps, /next-step-progress-track[\s\S]*next-step-progress-fill/);
  assert.match(nextSteps, /data-next-step-readonly'[\s\S]*return;/);
  assert.doesNotMatch(nextSteps, /id: 'steps'[\s\S]{0,350}openDashboardTarget\('#fitbit-performance-card'/);
  assert.match(journey, /item\.kind === 'progress'[\s\S]*social-journey-plan-progress/);
});

test('versioned phone assets advance for the Home fix', () => {
  const dashboard = read('dashboard.html');
  const serviceWorker = read('sw.js');

  assert.match(dashboard, /pbb-social-journey\.css\?v=27-direct-course-lesson/);
  assert.match(dashboard, /pbb-social-journey\.js\?v=45-exact-course-label/);
  assert.match(dashboard, /pbb-next-obvious-steps\.js\?v=49-public-todo-next/);
  assert.match(dashboard, /dashboard-script-3-1_get_user_data\.js\?v=61-remove-primary-test-seed/);
  assert.match(dashboard, /pbb-deferred-fitbit\.js\?v=2-imported-activity-todo/);
  assert.match(dashboard, /dashboard-script-1-daily_weighin_card_logic\.js\?v=77-nightly-diary-hide-shared/);
  assert.match(dashboard, /dashboard-script-10-points_widget_functions\.js\?v=51-imported-activity-todo/);
  assert.match(serviceWorker, /const CACHE_NAME = 'pbb-app-v456-imported-activity-todo'/);
  assert.match(serviceWorker, /dashboard-script-10-points_widget_functions\.js\?v=51-imported-activity-todo/);
});
