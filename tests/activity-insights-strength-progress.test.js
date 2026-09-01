const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const read = file => fs.readFileSync(file, 'utf8');
const dashboard = read('dashboard.html');
const insights = read('js/dashboard/dashboard-script-2-activity_insights_view.js');
const css = read('css/dashboard/dashboard-style-1.css');

test('strength insight offers useful history ranges and fills the detail view', () => {
  assert.match(dashboard, /insights-strength-detail-card/);
  assert.match(insights, /\[1, 3, 6, 12\]/);
  assert.match(insights, /setInsightsVolumeRange/);
  assert.match(insights, /getMonth\(\) - 12/);
  assert.match(css, /\.insights-strength-detail-card[\s\S]*?min-height: calc\(100dvh - 150px\)/);
});

test('strength insight identifies and displays recent weight PBs', () => {
  assert.match(insights, /function _renderRecentStrengthPbs/);
  assert.match(insights, /weight > previous/);
  assert.match(insights, /PERSONAL BESTS/);
  assert.match(insights, /Your strongest lifts/);
});

test('muscle chips use explicit accessible theme states', () => {
  assert.match(insights, /insights-strength-area-chip/);
  assert.match(insights, /aria-pressed/);
  assert.match(css, /\.insights-strength-area-chip\.is-active[\s\S]*?var\(--pbb-insights-control-active-bg\)/);
  assert.match(css, /-webkit-text-fill-color: var\(--pbb-insights-control-active-text\)/);
  assert.match(css, /\.insights-strength-area-chip:focus-visible/);
});
