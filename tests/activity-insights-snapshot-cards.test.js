const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const dashboard = read('dashboard.html');
const insights = read('js/dashboard/dashboard-script-2-activity_insights_view.js');
const css = read('css/dashboard/dashboard-style-1.css');
const serviceWorker = read('sw.js');

test('Activity Insights uses quiet snapshot cards instead of inline graphs', () => {
  for (const id of [
    'insights-bodyweight-summary-card',
    'insights-burn-summary-card',
    'insights-calories-summary-card',
    'insights-sleep-summary-card',
    'insights-volume-summary-card',
    'insights-steps-summary-card'
  ]) assert.match(dashboard, new RegExp(`id="${id}"`));

  assert.match(dashboard, /class="insights-legacy-graph-card insights-burn-detail-card" data-insights-metric="burn"/);
  assert.match(css, /#view-insights \.insights-legacy-graph-card\s*\{[^}]*display: none !important/s);
  assert.match(dashboard, /id="view-insights-metric-detail"/);
  assert.match(insights, /function openInsightsMetricDetail\(metricKey\)/);
  assert.match(insights, /pushNavigationState\('view-insights-metric-detail', closeInsightsMetricDetail\)/);
  assert.match(insights, /enableSwipeBackNavigation\('view-insights-metric-detail', closeInsightsMetricDetail\)/);
});

test('body weight snapshot and detail keep the full weigh-in story', () => {
  assert.match(dashboard, />Add your body weight<\/button>/);
  assert.match(dashboard, />View body weight history<\/button>/);
  assert.match(insights, /changeLabel \+ ' · ' \+ weighIns\.length \+ ' weigh-in'/);
  assert.match(insights, /renderWeighInManager\(weighIns\)/);
  assert.match(insights, /function _loadAllWeighInsForInsights\(userId\)/);
  assert.match(insights, /\.range\(offset, offset \+ pageSize - 1\)/);
  assert.match(dashboard, /data-days="all" onclick="updateInsightsBodyWeightTimeframe\('all'\)"/);
  assert.match(dashboard, /data-insights-metric="bodyweight"/);
  assert.match(dashboard, /id="weigh-in-management-container"/);
});

test('members can add steps and review dated totals', () => {
  assert.match(dashboard, /id="manual-steps-modal"/);
  assert.match(dashboard, />Add your steps<\/button>/);
  assert.match(dashboard, /id="insights-steps-history"/);
  assert.match(insights, /function saveManualSteps\(\)/);
  assert.match(insights, /rpc\('upsert_native_daily_steps'/);
  assert.match(insights, /p_date: date\.value/);
  assert.match(insights, /p_steps: steps/);
  assert.match(insights, /<h3>Daily totals<\/h3>/);
});

test('snapshot cards and entry screens use paired Balance themes', () => {
  assert.match(css, /\.insights-snapshot-card\s*\{[^}]*linear-gradient\(145deg, #1d1a13 0%, #11100d 100%\)/s);
  assert.match(css, /#view-insights-metric-detail\s*\{[^}]*--pbb-insights-page-bg: #050505/s);
  assert.match(css, /html\[data-pbb-theme="light"\] #view-insights-metric-detail\s*\{[^}]*--pbb-insights-page-bg: #f8f5ee/s);
  assert.match(css, /\.insights-entry-save\s*\{[^}]*#f5d98a[^}]*#d8b25e/s);
  assert.match(css, /svg \[stroke="#10b981"\][\s\S]*stroke: var\(--pbb-insights-gold-strong\) !important/);
});

test('new and returning members discover snapshots and manual steps', () => {
  assert.match(dashboard, /activity-insights-clean-snapshots-v1/);
  assert.match(dashboard, /activity-insights-manual-steps-v1/);
  assert.ok((dashboard.match(/title:\s*'Your insights, simplified'/g) || []).length >= 2);
  assert.ok((dashboard.match(/title:\s*'Add steps any day'/g) || []).length >= 2);
});

test('returning phones receive the snapshot release', () => {
  assert.match(dashboard, /dashboard-style-1\.css\?v=80/);
  assert.ok((dashboard.match(/dashboard-script-2-activity_insights_view\.js\?v=insights-loader-guard-v10/g) || []).length >= 2);
  assert.match(serviceWorker, /pbb-app-v448-completion-aware-course/);
});

test('metric detail screens show only the heading inside the content card', () => {
  assert.match(css, /\.insights-metric-detail-header\s*\{[^}]*display:\s*none;/s);
  assert.match(css, /\.insights-metric-detail-content\s*\{[^}]*padding:\s*calc\(20px \+ env\(safe-area-inset-top, 0px\)\)/s);
});

test('calorie burn guidance stays readable in light and dark themes', () => {
  assert.match(insights, /class="insights-burn-note"/);
  assert.match(css, /#view-insights-metric-detail \.insights-burn-note\s*\{[^}]*background:\s*var\(--pbb-insights-soft-bg\) !important;[^}]*color:\s*var\(--pbb-insights-muted\) !important;[^}]*-webkit-text-fill-color:\s*var\(--pbb-insights-muted\) !important;/s);
});

test('body weight detail has one entry point and a live history summary', () => {
  assert.doesNotMatch(dashboard, /class="insights-add-weight-button"[^>]*>Add weight/);
  assert.doesNotMatch(insights, /Add your first entry here/);
  assert.match(insights, /summary\.textContent = total \+ ' weigh-in'/);
  assert.match(insights, /latest ' \+ latestWeight/);
  assert.match(insights, /function toggleWeighInManagerCard\(forceOpen\)/);
  assert.match(insights, /body\.style\.display = shouldOpen \? 'block' : 'none'/);
  assert.match(insights, /toggle\.setAttribute\('aria-expanded', shouldOpen \? 'true' : 'false'\)/);
  assert.match(insights, /window\.toggleWeighInManagerCard = toggleWeighInManagerCard/);
  assert.match(dashboard, /Tap to see every dated weigh-in\./);
});

test('every metric detail uses paired readable font roles', () => {
  assert.match(css, /font-family: "Inter", -apple-system/);
  assert.match(css, /\.insights-legacy-graph-card\.is-active \[style\*="color: #94a3b8"\]/);
  assert.match(css, /\.insights-legacy-graph-card\.is-active \[style\*="color: #3b82f6"\]/);
  assert.match(css, /#view-insights-metric-detail svg text\[fill="#94a3b8"\]/);
  assert.match(css, /#view-insights-metric-detail \.cb-tooltip/);
  assert.match(css, /#view-insights-metric-detail \.multi-week-nav button\.active/);
  assert.match(css, /\.multi-week-nav button\s*\{[^}]*background: var\(--pbb-insights-soft-bg\) !important/s);
  assert.match(css, /background: rgba\(59, 130, 246/);
  assert.match(css, /html\[data-pbb-theme="light"\] \.insights-snapshot-card\s*\{[^}]*linear-gradient\(145deg, #fffdf8 0%, #f7efd9 100%\)/s);
  assert.match(css, /\.insights-legacy-graph-card\.is-active \[style\*="color: white"\]/);
  assert.match(css, /#view-insights-metric-detail \[style\*="background: #fff7ed"\]/);
});
