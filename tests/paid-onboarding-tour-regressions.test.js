const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const dashboard = fs.readFileSync(path.join(root, 'dashboard.html'), 'utf8');
const onboarding = fs.readFileSync(path.join(root, 'js/dashboard/dashboard-script-5-initialize_stripe_for_inapp_pu.js'), 'utf8');
const calorieTracker = fs.readFileSync(path.join(root, 'js/dashboard/dashboard-script-11-calorie_tracker_functions.js'), 'utf8');
const metaTrial = fs.readFileSync(path.join(root, 'lib/meta-ad-trial.js'), 'utf8');

test('fat-loss language maps to the fat-loss onboarding intent', () => {
  assert.match(onboarding, /containsAny\(\['lose weight', 'lose fat', 'body fat', 'fat loss', 'drop fat'/);
});

test('fresh guided setup suppresses inherited calorie adjustments', () => {
  assert.match(calorieTracker, /window\.metaAdTrialMode === true \|\| window\.__balanceGuidedTourActive === true \|\| window\.__balancePendingClientActivation === true/);
});

test('food logging opens its real controls before the guide points at them', () => {
  assert.match(dashboard, /title:'Log what you eat'[^\n]*switchWeek\('calorie-tracker', pill\)/);
});

test('workout handoff closes calendar popups and waits on the opened workout', () => {
  assert.match(dashboard, /function openMetaPreviewStrengthWorkout\(\)[\s\S]*?closeCalendarActionModal[\s\S]*?window\.openCalendarWorkout\(dayIndex\)[\s\S]*?window\.__balanceMetaPreviewStrengthOpened = !!proof/);
  assert.match(dashboard, /promptedResult === false[\s\S]*?That screen did not finish opening/);
});

test('payment is hard-gated behind the completed Foundations lesson', () => {
  assert.match(dashboard, /sessionStorage\.setItem\('pbb_meta_preview_foundations_complete_v1', 'true'\)/);
  assert.match(dashboard, /completedMetaPreviewTour && !skipped && !completedTourGates\.has\('foundations-lesson:mind-1-1'\)/);
  assert.match(metaTrial, /session\.getItem\(FOUNDATIONS_COMPLETE_KEY\) !== 'true'/);
});

test('duplicate guided-tour starts cannot change the live step count', () => {
  assert.match(dashboard, /if \(window\.__balanceGuidedTourActive === true && options\.restart !== true\) return true/);
});

test('shopping list restores the prepared preview plan before opening', () => {
  assert.match(dashboard, /async function openMetaPreviewShoppingListSurface\(\)[\s\S]*openMetaPreviewMealPlanSurface\(\)[\s\S]*openAiMealPlanShoppingList/);
  assert.match(dashboard, /title:'One shopping list for the week'[^\n]*promptRequiresTargetClick:true[^\n]*openMetaPreviewShoppingListSurface/);
  assert.match(onboarding, /if \(!_aiMealPlanCache && window\.metaAdTrialMode === true\)[\s\S]*localStorage\.getItem\('ai_meal_plan'\)[\s\S]*Array\.isArray\(previewPlan\.weeks\)/);
});

test('paid tour returns Home between sections and requires the real To Do cards', () => {
  assert.match(dashboard, /promptRequiresTargetClick:true/);
  assert.match(dashboard, /Tap the highlighted To Do card to open this part of the app/);
  assert.match(dashboard, /step\.returnHomeAfter \? 'Back to Home'/);
  assert.match(dashboard, /tour-feature-view/);
  assert.match(dashboard, /pageView: false,[\s\S]*featureView: false/);
  assert.match(dashboard, /sel:'#next-obvious-steps-card \.next-steps-head'/);
  assert.match(dashboard, /const spaceBelow = vh - bottomReserve - \(top \+ height\)/);
  assert.match(dashboard, /const renderToken = \+\+tourRenderToken/);
  assert.match(dashboard, /if \(renderToken !== tourRenderToken\) return/);
});

test('exercise guidance preserves the open workout player', () => {
  assert.match(dashboard, /title:'Follow the exercise card'[^\n]*preserveSurface:true/);
  assert.match(dashboard, /if \(!step\.preserveSurface\) await ensureTab\(step\.tab\)/);
});
