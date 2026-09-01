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
const serviceWorker = read('sw.js');
const modernStudio = studio.slice(studio.indexOf('function ensureElement()'), studio.indexOf('function customizationLegacy()'));

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
  assert.match(studio, /data-share-text-toggle/);
  assert.match(studio, /data-share-text-panel/);
  assert.match(studio, /data-caption-style="gold"/);
  assert.match(studio, /object-fit:cover/);
  assert.doesNotMatch(studio, /max-height:42dvh;overflow:auto;padding:12px 14px/);
  assert.match(studio, /data-share-toggle-pb/);
  assert.match(studio, /data-share-toggle-stats/);
  assert.match(studio, /data-share-cycle-layout/);
  assert.match(studio, /data-share-preset="gold"/);
  assert.match(studio, /data-share-preset="cream"/);
  assert.match(studio, /data-share-preset="minimal"/);
  assert.match(studio, /data-share-download/);
  assert.doesNotMatch(modernStudio, /data-share-native/);
  assert.doesNotMatch(modernStudio, />Next</);
  assert.match(modernStudio, /data-share-done>Done/);
  assert.match(modernStudio, /data-share-feed>Share to Feed/);
  assert.match(modernStudio, /data-share-instagram>Share to IG Story/);
  assert.match(studio, /Posting your workout to Feed\.\.\./);
  assert.match(studio, /Opening Instagram Story\.\.\./);
  assert.match(studio, /pbbShareStudioProgress/);
  assert.match(studio, /outputCachePromise/);
  assert.match(studio, /document\.getElementById\('pbb-private-share-studio-v3'\) \|\| document\.getElementById\('pbb-private-share-studio'\)/);
  assert.match(studio, /pointermove/);
  assert.match(studio, /choosePhoto/);
  assert.match(studio, /Take a photo/);
  assert.match(studio, /Choose from photos/);
  assert.match(studio, /data-theme=\"dark\"/);
  assert.match(studio, /data-theme=\"light\"/);
});

test('focused editor can reframe the photo and move the workout card', () => {
  assert.match(studio, /photoScale = clamp/);
  assert.match(studio, /photoPointers/);
  assert.match(studio, /data-share-workout-layer/);
  assert.match(studio, /overlayX/);
  assert.match(studio, /overlayY/);
  assert.match(studio, /overlayScale/);
  assert.match(studio, /data-share-cycle-layout/);
  assert.match(studio, /data-share-cycle-colour/);
  assert.doesNotMatch(studio, /data-share-tool="adjust"/);
  assert.doesNotMatch(studio, /data-share-tool="workout"/);
  for (const layout of ['bold', 'scorecard', 'simple', 'full', 'stamp', 'split', 'compact', 'outline', 'receipt', 'editorial']) {
    assert.match(studio, new RegExp("id: '" + layout + "'"));
  }
  for (const colour of ['gold', 'cream', 'white', 'black', 'soft', 'gold-light']) {
    assert.match(studio, new RegExp("id: '" + colour + "'"));
  }
  assert.match(points, /function pbbShareDrawStudioPhoto/);
  assert.match(points, /function pbbShareWithStudioOverlayTransform/);
  assert.match(points, /function pbbShareDrawStudioWorkoutLayout/);
  assert.match(points, /function pbbShareStudioWorkoutPalette/);
  assert.match(points, /PBB_PRIVATE_WORKOUT_TEXT_STYLES = \['stamp', 'split', 'compact', 'outline', 'receipt', 'editorial'\]/);
  assert.match(points, /cardPayload\.studio_editor/);
});

test('share actions reuse the finished still and report their progress', () => {
  assert.match(studio, /var result = await fn\(\{/);
  assert.match(studio, /renderedDataUrl: output\.dataUrl/);
  assert.match(studio, /if \(result === false \|\| result === null\)/);
  assert.match(points, /onFeed: async \(studioShare\) => sharePendingPostWorkoutCompositeToFeed\(studioShare\)/);
  assert.match(points, /studioShare\?\.renderedDataUrl \|\| await renderBalanceShareCardImage/);
  assert.match(points, /preparedDataUrl: studioShare\?\.renderedDataUrl, animate: false/);
  assert.match(points, /const motionEligible = !preparedDataUrl && options\.animate !== false/);
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
  assert.match(studio, /cardPayload\.studio_hide_pb = state\.showPB === false/);
  assert.match(studio, /cardPayload\.studio_hide_stats = state\.showStats === false/);
  assert.match(points, /if \(cardPayload && cardPayload\.studio_hide_stats\) return \[\]/);
  assert.match(points, /if \(cardPayload\.studio_hide_pb\)/);
  assert.match(studio, /selectBalanceShareOverlayStyle/);
  assert.match(studio, /selectBalanceShareTextStyle/);
});

test('Shannon receives the progress-first workout completed page', () => {
  assert.match(studio, /function renderWorkoutCompletePage/);
  assert.match(studio, /Workout saved/);
  assert.match(studio, /Today’s work/);
  assert.match(studio, /Share a photo/);
  assert.match(studio, /pbb-private-complete-active/);
  assert.match(studio, /bottomNav\.style\.display = 'none'/);
  assert.match(studio, /durationUnit/);
  assert.match(studio, /min-height:100dvh/);
  assert.match(studio, /display:flex;flex-direction:column/);
  assert.match(studio, /class="pwc-hero-mark"/);
  assert.match(studio, /Session complete/);
  assert.match(studio, /position:sticky;bottom:0/);
  assert.match(workoutRuntime, /BalancePrivateShareStudio\.renderWorkoutCompletePage/);
  assert.match(dashboard, /dashboard-script-5-initialize_stripe_for_inapp_pu\.js\?v=230-remove-volume-popup/);
});

test('private reveal, tour, and cache-busted modules ship together', () => {
  assert.match(dashboard, /private-photo-share-studio-shannon-v4/);
  assert.match(dashboard, /BalancePrivateShareStudio\.isEnabled\(\)/);
  assert.match(dashboard, /pbb-private-share-studio\.js\?v=15-smooth-story-export/);
  assert.match(dashboard, /dashboard-script-10-points_widget_functions\.js\?v=61-exact-activity-share/);
  assert.match(dashboard, /dashboard-script-10-points_widget_functions\.js\?v=[^'\"]+/);
  assert.match(dashboard, /dashboard-script-11-calorie_tracker_functions\.js\?v=41-share-done-flow/);
  assert.match(serviceWorker, /const CACHE_NAME = 'pbb-app-v469-smooth-story-export'/);
});
