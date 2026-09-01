const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const dashboard = fs.readFileSync(path.join(root, 'dashboard.html'), 'utf8');
const startup = fs.readFileSync(path.join(root, 'js/dashboard/dashboard-script-3-1_get_user_data.js'), 'utf8');

test('Feature Drops stay available but never open automatically at login', () => {
  assert.match(dashboard, /window\.checkFeatureReveals = function\(options\)/);
  assert.match(dashboard, /if \(options\.manual !== true\) return;/);
  assert.match(dashboard, /Array\.isArray\(options\.featureIds\)/);
  assert.doesNotMatch(startup, /checkFeatureReveals\s*\(/);
});
