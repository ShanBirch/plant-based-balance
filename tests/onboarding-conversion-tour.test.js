const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const dashboard = fs.readFileSync(path.join(root, 'dashboard.html'), 'utf8');
const trial = fs.readFileSync(path.join(root, 'lib/meta-ad-trial.js'), 'utf8');

test('paid preview clearly shows the personalised setup and full Foundations value', () => {
  assert.match(dashboard, /id="meta-ad-trial-personal-summary"/);
  assert.match(dashboard, /EVERYTHING YOU GET/);
  assert.match(dashboard, /personalised workout program/);
  assert.match(dashboard, /meal plan, recipes and shopping list/);
  assert.match(dashboard, /complete six-week behaviour-change course/);
  assert.match(dashboard, /One weekly check-in with Shannon/);
  assert.match(dashboard, /Weekly workout and food review and adjustments/);
  assert.match(trial, /function renderPersonalisedSetup\(\)/);
  assert.match(trial, /onboardingGoalIntents/);
  assert.match(trial, /workoutCalendar/);
  assert.match(trial, /!workout\.startsWith\('yoga-'\)/);
});

test('the guided preview ends in the real Foundations lesson', () => {
  const first = dashboard.indexOf("title:'Your app tour starts here'");
  const shopping = dashboard.indexOf("title:'One shopping list for the week'", first);
  const goals = dashboard.indexOf("title:'Pick your Weekly Goals'", shopping);
  const course = dashboard.indexOf("title:'Read, then take the quiz'", goals);

  assert.ok(first >= 0);
  assert.ok(shopping > first);
  assert.ok(goals > shopping);
  assert.ok(course > goals);
  assert.match(dashboard.slice(course, dashboard.indexOf('\n', course)), /metaPreviewSignoff:true/);
  assert.match(dashboard.slice(course, dashboard.indexOf('\n', course)), /requiresFoundationsLesson:'mind-1-1'/);
  assert.match(dashboard, /We will leave you here in the course section/);
});

test('shopping-list guidance keeps an already-rendered plan on screen', () => {
  const onboarding = fs.readFileSync(path.join(root, 'js/dashboard/dashboard-script-5-initialize_stripe_for_inapp_pu.js'), 'utf8');
  assert.match(onboarding, /const planAlreadyOpen = !!\(planView && planView\.classList\.contains\('active'\) && _aiMealPlanCache\)/);
  assert.match(onboarding, /if \(!planAlreadyOpen\) \{[\s\S]*?openAiMealPlanView/);
  assert.match(onboarding, /renderAiPlanShoppingList\(\);[\s\S]*?toggleAiPlanShoppingList\(true\)/);
});

test('onboarding personalisation does not depend on an Instagram DM handoff', () => {
  assert.doesNotMatch(trial, /instagram.*handoff|dm.*handoff/i);
  assert.match(trial, /localStorage/);
  assert.match(trial, /sessionStorage/);
});
