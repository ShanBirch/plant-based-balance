const fs = require('fs');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const dashboard = fs.readFileSync(path.join(root, 'dashboard.html'), 'utf8');
const insights = fs.readFileSync(path.join(root, 'js/dashboard/dashboard-script-2-activity_insights_view.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'css/dashboard/dashboard-style-1.css'), 'utf8');

test('Sleep fills the detail screen and exposes every night in the selected period', () => {
  assert.match(dashboard, /insights-legacy-graph-card insights-sleep-detail-card/);
  assert.match(css, /\.insights-sleep-detail-card\.is-active\s*\{[^}]*min-height:\s*calc\(100dvh/s);
  assert.match(insights, /Night-by-night history/);
  assert.match(insights, /See the hours recorded for every night/);
  assert.match(insights, /toggleInsightsSleepHistory/);
  assert.match(insights, /night\.dateLabel[\s\S]*fmt\(night\.totalHrs\)/);
});

test('Total, Deep, REM and goal use separate graph series colours', () => {
  for (const role of ['total', 'deep', 'rem', 'goal']) {
    assert.match(insights, new RegExp(`insights-sleep-series--${role}`));
    assert.match(css, new RegExp(`--pbb-sleep-${role}:`));
    assert.match(css, new RegExp(`insights-sleep-series--${role}[^}]*stroke: var\\(--pbb-sleep-${role}\\)`));
  }
  assert.match(css, /html\[data-pbb-theme="light"\] #view-insights-metric-detail[\s\S]*--pbb-sleep-total: #4338ca/);
  assert.match(css, /--pbb-sleep-total: #a5b4fc/);
});

test('Sleep history has visible collapsed, expanded and focus states', () => {
  assert.match(insights, /aria-expanded="false"/);
  assert.match(css, /\.insights-sleep-history-toggle\[aria-expanded="true"\] svg/);
  assert.match(css, /\.insights-sleep-history-toggle:focus-visible/);
  assert.match(css, /\.insights-sleep-history-list\[hidden\]\s*\{[^}]*display:\s*none/s);
});
