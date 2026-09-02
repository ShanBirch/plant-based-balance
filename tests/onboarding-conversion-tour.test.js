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

test('the guided preview completes Foundations before coach support and Weekly Goals', () => {
  const required = dashboard.indexOf('REQUIRED_ONBOARDING_TOUR_TITLES');
  const first = dashboard.indexOf("'Your app tour starts here'", required);
  const shopping = dashboard.indexOf("'One shopping list for the week'", required);
  const community = dashboard.indexOf("'The Balance community'", required);
  const course = dashboard.indexOf("'Read, then take the quiz'", required);
  const checkin = dashboard.indexOf("'What Shannon checks each week'", required);
  const coach = dashboard.indexOf("'Watch Shannon’s coach note'", required);
  const goals = dashboard.indexOf("'Pick your Weekly Goals'", required);

  assert.ok(first >= 0);
  assert.ok(shopping > first);
  assert.ok(community > shopping);
  assert.ok(course > community);
  assert.ok(checkin > course);
  assert.ok(coach > checkin);
  assert.ok(goals > coach);
  assert.ok(goals > shopping);
  assert.match(dashboard, /title:'Read, then take the quiz'[^\n]*requiresFoundationsLesson:'mind-1-1'/);
  assert.match(dashboard, /title:'Watch Shannon’s coach note'[^\n]*requiresWelcomeVideo:true/);
  assert.match(dashboard, /title:'Start your course'[^\n]*preActionTitle:'Next: start your course'/);
  assert.match(dashboard, /title:'Welcome to Balance Foundations'[^\n]*Tap Start Week 1 when you are ready/);
});

test('the spotlight never draws a box around a missing or zero-size target', () => {
  assert.match(dashboard, /target && target\.isConnected && target\.getClientRects\(\)\.length/);
  assert.match(dashboard, /if \(!targetRect \|\| targetRect\.width < 2 \|\| targetRect\.height < 2\)[\s\S]*?spot\.style\.opacity = '0'/);
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
