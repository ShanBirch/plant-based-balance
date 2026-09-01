const fs = require('fs');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const dashboard = fs.readFileSync(path.join(root, 'dashboard.html'), 'utf8');
const insights = fs.readFileSync(path.join(root, 'js/dashboard/dashboard-script-2-activity_insights_view.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'css/dashboard/dashboard-style-1.css'), 'utf8');

test('burn detail fills the phone screen and adds a useful period summary', () => {
  assert.match(dashboard, /insights-legacy-graph-card insights-burn-detail-card/);
  assert.match(css, /\.insights-burn-detail-card\.is-active\s*\{[^}]*min-height:\s*calc\(100dvh/s);
  assert.match(insights, /Your burn this period/);
  assert.match(insights, /Latest[\s\S]*Highest[\s\S]*Lowest[\s\S]*Coverage/);
  assert.match(insights, /Watch data last synced/);
});

test('burn graph points remain accessible by tap and keyboard', () => {
  assert.match(insights, /class="cb-dot"[^>]*tabindex="0"[^>]*role="button"/);
  assert.match(insights, /dot\.addEventListener\('keydown'/);
  assert.match(css, /\.cb-dot:focus-visible/);
});

test('new burn details use paired insights theme roles', () => {
  assert.match(css, /\.insights-burn-period-grid > div\s*\{[^}]*background:\s*var\(--pbb-insights-soft-bg\)/s);
  assert.match(css, /\.insights-burn-period-grid strong\s*\{[^}]*color:\s*var\(--pbb-insights-text\)/s);
  assert.match(css, /\.insights-burn-period-insight p\s*\{[^}]*color:\s*var\(--pbb-insights-muted\)/s);
});
