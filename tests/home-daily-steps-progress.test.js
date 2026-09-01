const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

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
  assert.match(nextSteps, /action\.id === 'fitness_diary'\) return new Date\(\)\.getHours\(\) >= 18/);
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
  assert.match(dashboard, /pbb-next-obvious-steps\.js\?v=46-completion-aware-course/);
  assert.match(dashboard, /dashboard-script-1-daily_weighin_card_logic\.js\?v=75-evening-diary-action/);
  assert.match(dashboard, /dashboard-script-10-points_widget_functions\.js\?v=49/);
  assert.match(serviceWorker, /const CACHE_NAME = 'pbb-app-v451-meals-header-no-divider'/);
  assert.match(serviceWorker, /dashboard-script-10-points_widget_functions\.js\?v=49/);
});
