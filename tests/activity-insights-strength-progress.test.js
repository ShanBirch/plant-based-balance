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
  assert.match(insights, /Personal bests/);
  assert.doesNotMatch(insights, /Your strongest lifts/);
});

test('muscle filter uses a compact accessible themed dropdown', () => {
  assert.match(insights, /insights-strength-muscle-filter/);
  assert.match(insights, /All muscles/);
  assert.match(insights, /onchange="setInsightsVolumeArea\(this\.value\)"/);
  assert.match(css, /\.insights-strength-muscle-select select[\s\S]*?var\(--pbb-insights-soft-bg\)/);
  assert.match(css, /-webkit-text-fill-color: var\(--pbb-insights-text\)/);
  assert.match(css, /\.insights-strength-muscle-select select:focus-visible/);
});

test('personal bests are a collapsed range-aware exercise dropdown', () => {
  assert.match(insights, /<details class="insights-strength-pbs">/);
  assert.match(insights, /last ' \+ selectedMonths \+ ' months/);
  assert.match(insights, /latestByExercise\.map\(pb/);
  assert.doesNotMatch(insights, /Your strongest lifts/);
  assert.match(insights, /<details class="insights-strength-pb-row">/);
});
