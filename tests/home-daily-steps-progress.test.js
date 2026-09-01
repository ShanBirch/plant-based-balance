const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

function loadNextStepsAtHour(hour) {
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
    metaAdTrialMode: false
  };
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

test('Home omits imported activity review from the daily to-do plan', () => {
  const nextSteps = read('js/dashboard/pbb-next-obvious-steps.js');

  assert.doesNotMatch(nextSteps, /id: 'imported_activity'/);
  assert.doesNotMatch(nextSteps, /Review your imported activity/);
  assert.doesNotMatch(nextSteps, /fitbit-imported-activity-card/);
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
  assert.match(nextSteps, /publicDiaryOnly[\s\S]*nightlyDiary && isFitnessDiaryDue\(\) \? \[nightlyDiary\] : \[\]/);
  assert.match(nextSteps, /!isPreviewEligible\(\) && !unified && !isFitnessDiaryDue\(\)/);
  assert.match(dailyCards, /localStorage\.setItem\('fitnessDiaryDone_' \+ dateKey, '1'\);[\s\S]*window\.pbbNextSteps\.refresh\(\)/);
});

test('ordinary members receive only the nightly Fitness Diary To Do action after 6 PM', () => {
  const evening = loadNextStepsAtHour(19);
  assert.equal(evening.window.pbbNextSteps.getSuggestions().map(action => action.id).join(','), 'fitness_diary');

  evening.localStorage.setItem('fitnessDiaryDone_2026-09-01', '1');
  assert.equal(evening.window.pbbNextSteps.getSuggestions().length, 0);

  const afternoon = loadNextStepsAtHour(17);
  assert.equal(afternoon.window.pbbNextSteps.getSuggestions().length, 0);
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
  assert.match(dashboard, /pbb-next-obvious-steps\.js\?v=47-nightly-diary-todo-next/);
  assert.match(dashboard, /dashboard-script-1-daily_weighin_card_logic\.js\?v=76-nightly-diary-todo-next/);
  assert.match(dashboard, /dashboard-script-10-points_widget_functions\.js\?v=50-guided-activity/);
assert.match(serviceWorker, /const CACHE_NAME = 'pbb-app-v455-guided-activity-log'/);
  assert.match(serviceWorker, /dashboard-script-10-points_widget_functions\.js\?v=50-guided-activity/);
});
