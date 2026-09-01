const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

const studio = read('js/dashboard/pbb-private-share-studio.js');
const points = read('js/dashboard/dashboard-script-10-points_widget_functions.js');
const workoutRuntime = read('js/dashboard/dashboard-script-5-initialize_stripe_for_inapp_pu.js');
const meals = read('js/dashboard/dashboard-script-11-calorie_tracker_functions.js');
const stories = read('lib/stories.js');
const progressPhotos = read('js/dashboard/pbb-deferred-progressphoto.js');
const dashboard = read('dashboard.html');

test('photo share studio is locked to Shannon account', () => {
  assert.match(studio, /PILOT_EMAIL = 'shannonbirch@cocospersonaltraining\.com'/);
  assert.doesNotMatch(studio, /shannonrhysbirch@gmail\.com/);
  assert.match(studio, /return accountEmail\(\) === PILOT_EMAIL/);
  assert.doesNotMatch(studio, /localStorage.*pilot/i);
});

test('studio is full-screen, safe-area aware, and interactive', () => {
  assert.match(studio, /position:fixed;inset:0/);
  assert.match(studio, /env\(safe-area-inset-top\)/);
  assert.match(studio, /env\(safe-area-inset-bottom\)/);
  assert.match(studio, /data-share-input/);
  assert.match(studio, /data-caption-style="gold"/);
  assert.match(studio, /pointermove/);
  assert.match(studio, /choosePhoto/);
  assert.match(studio, /Take a photo/);
  assert.match(studio, /Choose from photos/);
  assert.match(studio, /data-theme=\"dark\"/);
  assert.match(studio, /data-theme=\"light\"/);
});

test('studio connects to every requested photo-sharing surface', () => {
  assert.match(points, /context: 'workout'/);
  assert.match(points, /context: 'nutrition'/);
  assert.match(points, /context: 'activity'/);
  assert.match(meals, /context: 'meal'/);
  assert.match(stories, /context: 'feed'/);
  assert.match(stories, /rawPhoto: true/);
  assert.match(progressPhotos, /context: 'progress_photo'/);
});

test('custom text is burned into designed share images', () => {
  assert.match(points, /function pbbShareDrawStudioCaption/);
  assert.ok((points.match(/pbbShareDrawStudioCaption\(ctx, width, height, cardType, options\)/g) || []).length >= 5);
});

test('Shannon receives the progress-first workout completed page', () => {
  assert.match(studio, /function renderWorkoutCompletePage/);
  assert.match(studio, /Workout saved/);
  assert.match(studio, /Today’s work/);
  assert.match(studio, /Share a photo/);
  assert.match(studio, /pbb-private-complete-active/);
  assert.match(studio, /bottomNav\.style\.display = 'none'/);
  assert.match(studio, /durationUnit/);
  assert.match(workoutRuntime, /BalancePrivateShareStudio\.renderWorkoutCompletePage/);
  assert.match(dashboard, /dashboard-script-5-initialize_stripe_for_inapp_pu\.js\?v=229-private-workout-complete/);
});

test('private reveal, tour, and cache-busted modules ship together', () => {
  assert.match(dashboard, /private-photo-share-studio-shannon-v1/);
  assert.match(dashboard, /BalancePrivateShareStudio\.isEnabled\(\)/);
  assert.match(dashboard, /pbb-private-share-studio\.js\?v=4-compact-workout-complete/);
  assert.match(dashboard, /dashboard-script-10-points_widget_functions\.js\?v=[^'\"]+/);
  assert.match(dashboard, /dashboard-script-11-calorie_tracker_functions\.js\?v=39-private-share-studio/);
});
