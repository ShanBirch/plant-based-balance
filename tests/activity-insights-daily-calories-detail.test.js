const fs = require('fs');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const dashboard = fs.readFileSync(path.join(root, 'dashboard.html'), 'utf8');
const analytics = fs.readFileSync(path.join(root, 'js/dashboard/dashboard-script-8-progress_analytics_view.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'css/dashboard/dashboard-style-1.css'), 'utf8');

test('Daily Calories fills the detail screen and adds period context', () => {
  assert.match(dashboard, /insights-legacy-graph-card insights-calories-detail-card/);
  assert.match(css, /\.insights-calories-detail-card\.is-active\s*\{[^}]*min-height:\s*calc\(100dvh/s);
  assert.match(analytics, /Your intake this period/);
  assert.match(analytics, /Latest[\s\S]*Highest[\s\S]*Lowest[\s\S]*Coverage/);
});

test('Meal History lives inside Daily Calories and opens the complete existing history', () => {
  const dailyStart = dashboard.indexOf('class="insights-legacy-graph-card insights-calories-detail-card"');
  const dailyEnd = dashboard.indexOf('<!-- Sleep Chart -->', dailyStart);
  const dailyCard = dashboard.slice(dailyStart, dailyEnd);
  const moreStart = dashboard.indexOf('<section class="insights-more-detail"');
  const moreEnd = dashboard.indexOf('</section>', moreStart);
  const moreDetail = dashboard.slice(moreStart, moreEnd);

  assert.match(dailyCard, /class="insights-calories-meal-history"/);
  assert.match(dailyCard, /View meal history/);
  assert.match(dailyCard, /openWeeklyTrendsPage\('insights'\)/);
  assert.doesNotMatch(moreDetail, /<strong>Nutrition<\/strong>/);
});

test('Daily Calories and its history action use paired theme roles and visible states', () => {
  assert.match(css, /\.insights-calories-period-grid > div\s*\{[^}]*background:\s*var\(--pbb-insights-soft-bg\)/s);
  assert.match(css, /\.insights-calories-meal-history\s*\{[^}]*color:\s*var\(--pbb-insights-on-gold/s);
  assert.match(css, /\.insights-calories-meal-history:focus-visible/);
  assert.match(dashboard, /dashboard-script-8-progress_analytics_view\.js\?v=3-daily-calories-detail/g);
});
