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
  assert.match(onboarding, /FINISHING YOUR MEAL PLAN/);
  assert.match(onboarding, /initialMealPlan\.status !== 'preview_ready'/);
  assert.match(onboarding, /initialMealPlan = \{ status: 'preview_failed'/);
  assert.match(onboarding, /authentication\|ownership\|image_generation\|photo_storage\|photo_service/);
  assert.match(onboarding, /firstDayPhotoResult\.failureStage \|\| 'photo_service'/);
  assert.match(onboarding, /TRY MEAL PLAN AGAIN/);
  assert.match(onboarding, /if \(_aiMealPlanCache\?\.id === newPlanId\) _aiMealPlanCache = null/);
});

test('the first course guide is compact and the lesson introduces both researchers and the book', () => {
  assert.match(dashboard, /title:'Read, then take the quiz'[\s\S]*?edgePrompt:true[\s\S]*?embeddedGuide:true/);
  assert.match(dashboard, /tour-edge-prompt/);
  assert.match(learning, /Professor Karl Friston/);
  assert.match(learning, /Professor Lisa Feldman Barrett/);
  assert.match(learning, /How Emotions Are Made by Lisa Feldman Barrett/);
});

test('the paid preview tour keeps the promised app order before payment', () => {
  const titles = [
    'Start here each day',
    'Check your workout week',
    'Open your first workout',
    'Follow the exercise card',
    'Log what you eat',
    'Open your meal plan',
    'Read, then take the quiz',
    'The Balance community',
    'Post when you need support',
    'Listen to Shannon’s welcome',
    'Pick your Weekly Goals'
  ];
  let cursor = dashboard.indexOf("title:'Start here each day'");
  assert.ok(cursor >= 0);
  titles.slice(1).forEach(title => {
    const next = dashboard.indexOf(`title:'${title}'`, cursor + 1);
    assert.ok(next > cursor, `${title} should follow the previous paid-preview step`);
    cursor = next;
  });
});

test('test navigation is invisible unless a developer explicitly requests it', () => {
  assert.match(testNavigator, /get\('testFlow'\) === '1'/);
  assert.match(onboarding, /if \(!forceTourTest \|\| !wizard/);
  assert.match(dashboard, /pbb-onboarding-test-navigator\.js\?v=7-explicit-only/);
});
