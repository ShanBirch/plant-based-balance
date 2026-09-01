const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const dashboard = fs.readFileSync(path.join(root, 'dashboard.html'), 'utf8');
const profileScript = fs.readFileSync(
  path.join(root, 'js/dashboard/dashboard-script-5-initialize_stripe_for_inapp_pu.js'),
  'utf8'
);
const serviceWorker = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');

assert.match(
  dashboard,
  /id="nav-cycle-btn"[^>]*aria-label="Calendar"[\s\S]*?id="nav-cycle-icon"[\s\S]*?id="nav-cycle-label">Calendar</,
  'the shared bottom tab should say Calendar and expose a calendar label'
);
assert.match(
  dashboard,
  /id="nav-cycle-icon"[^>]*><path d="M19 3h-1V1h-2v2H8V1H6v2/,
  'the shared bottom tab should use the calendar icon'
);

const calendarStart = dashboard.indexOf('<div id="view-cycle"');
assert.ok(calendarStart >= 0, 'the Calendar view should exist');
const calendarMarkup = dashboard.slice(calendarStart, dashboard.indexOf('</div>\n\n    <!--', calendarStart));
assert.match(calendarMarkup, /<h2[^>]*>Calendar<\/h2>/, 'the top-of-screen title should be Calendar');
assert.doesNotMatch(calendarMarkup, /coin-header-widget/, 'the Calendar header should not show coins');

const homeStart = dashboard.indexOf('<div id="view-dashboard"');
const mealsStart = dashboard.indexOf('<div id="view-meals"');
const homeMarkup = dashboard.slice(homeStart, mealsStart);
assert.match(homeMarkup, /id="home-coin-header-widget" class="coin-header-widget"/, 'Home should retain its coin balance');
assert.strictEqual(
  (dashboard.match(/class="coin-header-widget"/g) || []).length,
  1,
  'the coin header balance should appear on Home only'
);

assert.doesNotMatch(dashboard, />Hormone Hub</, 'women should not see Hormone Hub as the Calendar title');
assert.doesNotMatch(profileScript, /title\.textContent = 'Performance Hub'/, 'men should not see Performance Hub as the Calendar title');
assert.match(profileScript, /title\.textContent = 'Calendar'/, 'male personalization should preserve the Calendar title');
assert.match(dashboard, /dashboard-script-5-initialize_stripe_for_inapp_pu\.js\?v=225-calendar-home-coins/);
assert.match(serviceWorker, /const CACHE_NAME = 'pbb-app-v428-calendar-home-coins'/);
assert.match(serviceWorker, /dashboard-script-5-initialize_stripe_for_inapp_pu\.js\?v=225-calendar-home-coins/);

console.log('Calendar labels and Home-only coin tests passed');
