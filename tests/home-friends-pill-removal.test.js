const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const dashboard = fs.readFileSync(path.join(root, 'dashboard.html'), 'utf8');
const tabController = fs.readFileSync(
  path.join(root, 'js/dashboard/dashboard-script-5-initialize_stripe_for_inapp_pu.js'),
  'utf8'
);
const weeklyReview = fs.readFileSync(
  path.join(root, 'js/dashboard/pbb-weekly-checkin-preview.js'),
  'utf8'
);
const serviceWorker = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');

assert.doesNotMatch(dashboard, /id="home-friends-pill"/, 'Home should not render the Friends pill');
assert.doesNotMatch(dashboard, /id="home-friends-modal"/, 'Home should not retain the pill-only Friends modal');
assert.doesNotMatch(
  tabController,
  /scheduleDashboardTaskForActiveUser\(updateHomeFriendsPillCount/,
  'opening Home should not fetch a count for a removed pill'
);
assert.doesNotMatch(
  weeklyReview,
  /getElementById\('home-friends-pill'\)/,
  'the weekly review should use the remaining Home cards as layout anchors'
);

assert.match(dashboard, /onclick="openFeedMessagesPanel\(\)"/, 'Friends and messages should remain accessible from Feed');
assert.match(dashboard, /dashboard-script-5-initialize_stripe_for_inapp_pu\.js\?v=171/, 'phones should fetch the updated Home tab controller');
assert.match(dashboard, /pbb-weekly-checkin-preview\.js\?v=22/, 'phones should fetch the updated weekly-review placement');
assert.match(serviceWorker, /const CACHE_NAME = 'pbb-app-v280'/, 'the app shell cache should advance');

console.log('Home Friends pill removal tests passed');
