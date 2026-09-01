const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const dashboard = fs.readFileSync(path.join(root, 'dashboard.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'css/dashboard/pbb-premium-overlays.css'), 'utf8');
const navigation = fs.readFileSync(path.join(root, 'js/dashboard/dashboard-script-5-initialize_stripe_for_inapp_pu.js'), 'utf8');

test('Calorie Tracker and Your Meal Plan form one full-width 50/50 tab bar', () => {
  assert.match(dashboard, /class="meals-primary-tabs" role="tablist"/);
  assert.match(dashboard, /class="pill-btn meals-primary-tab"[^>]*switchWeek\('calorie-tracker'/);
  assert.match(dashboard, /class="pill-btn meals-primary-tab"[^>]*id="browse-plans-pill"/);
  assert.match(css, /#view-meals #meals-nav-pills \.meals-primary-tabs \{[\s\S]*grid-template-columns: minmax\(0, 1fr\) minmax\(0, 1fr\)/);
  assert.match(css, /#view-meals #meals-nav-pills \.meals-primary-tab \{[\s\S]*border-radius: 0 !important/);
  assert.match(css, /#view-meals > \.app-header \{[\s\S]*border-bottom: 0 !important;[\s\S]*box-shadow: none !important;/);
});

test('the tabs retain accessible selected state and paired theme colours', () => {
  assert.match(navigation, /setAttribute\('aria-selected', 'false'\)/);
  assert.match(navigation, /setAttribute\('aria-selected', 'true'\)/);
  assert.match(css, /html\[data-pbb-theme="light"\] #view-meals #meals-nav-pills \.meals-primary-tab/);
  assert.match(css, /#view-meals #meals-nav-pills \.meals-primary-tab:focus-visible/);
  assert.match(dashboard, /pbb-premium-overlays\.css\?v=111-meal-builder-search/);
});
