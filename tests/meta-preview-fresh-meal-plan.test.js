const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const onboarding = fs.readFileSync(path.join(root, 'js/dashboard/dashboard-script-5-initialize_stripe_for_inapp_pu.js'), 'utf8');
const dashboard = fs.readFileSync(path.join(root, 'dashboard.html'), 'utf8');
const learning = fs.readFileSync(path.join(root, 'lib/learning-inline.js'), 'utf8');
const testNavigator = fs.readFileSync(path.join(root, 'js/dashboard/pbb-onboarding-test-navigator.js'), 'utf8');

test('paid onboarding builds a fresh plan from the selected food preferences', () => {
  assert.match(onboarding, /submitLabel: 'Choose my meal plan'/);
  assert.match(onboarding, /function metaPreviewMealPlanSignature\(profile, foodPreferences\)/);
  assert.match(onboarding, /localStorage\.removeItem\('ai_meal_plan'\)/);
  assert.match(onboarding, /remainingDayNumbers = \[0,1,2,3,4,5,6\]/);
  assert.match(onboarding, /Promise\.all\(batch\.map\(dayNumber => generateDay\(dayNumber, previousDays\)\)\)/);
  assert.match(onboarding, /userData: \{ profile: profileForGenerator, quizResults: profileForGenerator, facts: \{\}, foodPreferences \}/);
  assert.match(onboarding, /savedPlan\?\.meta_preview_signature === signature/);
  assert.doesNotMatch(onboarding.match(/async function ensureMetaPreviewMealPlan\(\)[\s\S]*?window\.ensureMetaPreviewMealPlan/)[0], /buildScaledMealPlan/);
});

test('the first onboarding day gets exact photos before the tour opens it', () => {
  assert.match(onboarding, /ensureExactMealPlanPhotos\(plan, user\.id, \{[\s\S]*?meals: firstDayMeals/);
  assert.match(onboarding, /Your first week and matching meal photos are ready/);
  assert.match(dashboard, /await window\.ensureMetaPreviewMealPlan\(\)/);
});

test('the first course guide is compact and the lesson introduces both researchers and the book', () => {
  assert.match(dashboard, /title:'Do your first course lesson'[\s\S]*?edgePrompt:true/);
  assert.match(dashboard, /tour-edge-prompt/);
  assert.match(learning, /Professor Karl Friston/);
  assert.match(learning, /Professor Lisa Feldman Barrett/);
  assert.match(learning, /How Emotions Are Made by Lisa Feldman Barrett/);
});

test('test navigation is invisible unless a developer explicitly requests it', () => {
  assert.match(testNavigator, /get\('testFlow'\) === '1'/);
  assert.match(onboarding, /if \(!forceTourTest \|\| !wizard/);
  assert.match(dashboard, /pbb-onboarding-test-navigator\.js\?v=7-explicit-only/);
});
