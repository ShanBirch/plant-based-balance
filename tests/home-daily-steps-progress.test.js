const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('Home opens the imported activity review and clears it after sharing', () => {
  const nextSteps = read('js/dashboard/pbb-next-obvious-steps.js');
  const activityShare = read('js/dashboard/dashboard-script-10-points_widget_functions.js');

  assert.match(nextSteps, /id: 'imported_activity'[\s\S]*clickSourceCard\('#fitbit-imported-activity-share'\)/);
  assert.doesNotMatch(nextSteps, /clickSourceCard\('#fitbit-imported-activity-card'\)/);
  assert.match(activityShare, /shared_to_feed: true[\s\S]*await window\.refreshImportedActivityHomeCard\(\)[\s\S]*window\.pbbNextSteps\.refresh\(\)/);
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

  assert.match(dashboard, /pbb-social-journey\.css\?v=17/);
  assert.match(dashboard, /pbb-social-journey\.js\?v=28/);
  assert.match(dashboard, /pbb-next-obvious-steps\.js\?v=19/);
  assert.match(dashboard, /dashboard-script-10-points_widget_functions\.js\?v=44/);
  assert.match(serviceWorker, /const CACHE_NAME = 'pbb-app-v309'/);
  assert.match(serviceWorker, /dashboard-script-10-points_widget_functions\.js\?v=44/);
});
