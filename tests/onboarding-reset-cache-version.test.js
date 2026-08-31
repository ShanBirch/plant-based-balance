const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

test('the reset-clean-state app bundle is always requested with a new version', () => {
  const dashboard = fs.readFileSync(path.join(__dirname, '..', 'dashboard.html'), 'utf8');
  assert.match(dashboard, /dashboard-script-5-initialize_stripe_for_inapp_pu\.js\?v=218-reset-clean-state/);
  assert.doesNotMatch(dashboard, /dashboard-script-5-initialize_stripe_for_inapp_pu\.js\?v=217-workout-tour-repair/);
});
