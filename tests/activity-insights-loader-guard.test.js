const fs = require('fs');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const dashboard = fs.readFileSync(path.join(root, 'dashboard.html'), 'utf8');
const insights = fs.readFileSync(path.join(root, 'js/dashboard/dashboard-script-2-activity_insights_view.js'), 'utf8');

test('summary values render before any deferred graph dependency', () => {
  const snapshots = insights.indexOf('renderInsightsSnapshotCards();', insights.indexOf('async function initInsightsView'));
  const ensureGraphs = insights.indexOf('await ensureInsightsAnalyticsRenderers();', snapshots);
  const bodyGraph = insights.indexOf("window.renderBodyWeightGraph(weighIns", ensureGraphs);
  assert.ok(snapshots > 0);
  assert.ok(ensureGraphs > snapshots);
  assert.ok(bodyGraph > ensureGraphs);
});

test('Android and iPhone open Activity Insights without racing the analytics script', () => {
  assert.match(insights, /function ensureInsightsAnalyticsRenderers\(\)/);
  assert.match(insights, /dashboard-script-8-progress_analytics_view\.js\?v=3-daily-calories-detail/);
  assert.match(dashboard, /querySelector\('script\[src\*="dashboard-script-8-progress_analytics_view\.js"\]'\)/);
  assert.match(dashboard, /data-pbb-progress-analytics|dataset\.pbbProgressAnalytics/);
});

test('the first render uses the already-selected timeframe instead of waiting for a second tap', () => {
  assert.match(insights, /function _getInsightsSelectedDays\(navId, fallbackDays\)/);
  assert.match(insights, /_getInsightsSelectedDays\('insights-cal-timeframe-nav', 30\)/);
  assert.match(insights, /_getInsightsSelectedDays\('insights-sleep-timeframe-nav', 14\)/);
  assert.match(insights, /renderInsightsSleep\(sleepData, sleepDays\)/);
  assert.match(insights, /row\.nutrition_date >= cutoffStr/);
});

test('one graph failure cannot stop the remaining Activity Insights visuals', () => {
  assert.match(insights, /function _renderInsightsSafely\(label, render\)/);
  for (const label of ['body weight', 'daily calories', 'sleep', 'strength volume', 'steps']) {
    assert.match(insights, new RegExp(`_renderInsightsSafely\\('${label}'`));
  }
});
