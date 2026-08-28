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
  assert.match(dashboard, /requestedGuidedActivation && window\.__balanceGuidedTourActive === true && options\.restart !== true/);
});
