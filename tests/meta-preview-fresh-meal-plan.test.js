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
  assert.match(onboarding, /completeRemainingMetaPreviewDaysInBackground/);
  assert.match(onboarding, /generatedDays\.push\(await generateDay\(firstDayNumber, \[\]\)\)/);
  assert.match(onboarding, /userData: \{ profile: profileForGenerator, quizResults: profileForGenerator, facts: \{\}, foodPreferences \}/);
  assert.match(onboarding, /savedPlan\?\.meta_preview_signature === signature/);
  assert.doesNotMatch(onboarding.match(/async function ensureMetaPreviewMealPlan\(\)[\s\S]*?window\.ensureMetaPreviewMealPlan/)[0], /buildScaledMealPlan/);
});

test('the first onboarding day gets exact photos before the tour opens it', () => {
  assert.match(onboarding, /ensureExactMealPlanPhotos\(plan, user\.id, \{[\s\S]*?meals: firstDayMeals/);
  assert.match(onboarding, /Your first meals are ready\. Finishing the rest of your week in the background/);
  assert.match(dashboard, /await window\.ensureMetaPreviewMealPlan\(\)/);
  assert.match(dashboard, /id="wizard-personalising-screen"/);
  assert.match(dashboard, /Preparing your workout program/);
  assert.match(dashboard, /Tailoring your meal plan/);
  assert.match(dashboard, /Preparing the app for you/);
  assert.doesNotMatch(dashboard, /id="wizard-meal-plan-build-card"/);
  assert.match(onboarding, /showWizardPersonalisingScreen\(\)/);
  assert.match(onboarding, /onboardingPromiseWithTimeout\(ensureInitialOnboardingMealPlan\(\), 120000\)/);
  assert.match(onboarding, /initialMealPlan\.status !== 'preview_ready'/);
  assert.match(onboarding, /initialMealPlan = \{ status: 'preview_failed'/);
  assert.match(onboarding, /authentication\|ownership\|image_generation\|photo_storage\|photo_service/);
  assert.match(onboarding, /firstDayPhotoResult\.failureStage \|\| 'photo_service'/);
  assert.match(onboarding, /showWizardPersonalisingError\(retryMessage\)/);
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
    'Your app tour starts here',
    'See every meal on Day 1',
    'One shopping list for the week',
    'Log what you eat',
    'Check your workout week',
    'Open your first workout',
    'Follow the exercise card',
    'The Balance community',
    'Post when you need support',
    'Watch Shannon’s coach note',
    'Pick your Weekly Goals',
    'Read, then take the quiz'
  ];
  let cursor = dashboard.indexOf("title:'Your app tour starts here'");
  assert.ok(cursor >= 0);
  titles.slice(1).forEach(title => {
    const next = dashboard.indexOf(`title:'${title}'`, cursor + 1);
    assert.ok(next > cursor, `${title} should follow the previous paid-preview step`);
    cursor = next;
  });
  assert.doesNotMatch(dashboard, /title:'Start here each day'/);
  assert.match(dashboard, /data-next-step-id="meal_plan_intro"/);
  assert.match(dashboard, /data-next-step-id="shopping_list_intro"/);
  assert.match(dashboard, /data-next-step-id="nutrition_tracker_intro"/);
  assert.match(dashboard, /data-next-step-id="workout_week_intro"/);
  assert.match(dashboard, /data-next-step-id="coach_message_intro"/);
  assert.match(dashboard, /data-next-step-id="feed_intro"/);
  assert.match(dashboard, /data-next-step-id="weekly_goals_intro"/);
  assert.match(dashboard, /data-next-step-id="foundations_intro"/);
  assert.match(dashboard, /title:'Read, then take the quiz'[^\n]*metaPreviewSignoff:true/);
});

test('test navigation is invisible unless a developer explicitly requests it', () => {
  assert.match(testNavigator, /get\('testFlow'\) === '1'/);
  assert.match(onboarding, /if \(!forceTourTest \|\| !wizard/);
  assert.match(dashboard, /pbb-onboarding-test-navigator\.js\?v=7-hidden-phone-safe/);
});
