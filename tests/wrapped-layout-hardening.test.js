const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const weekly = fs.readFileSync(path.join(root, 'lib', 'weekly-wrapped.js'), 'utf8');
const dashboard = fs.readFileSync(path.join(root, 'dashboard.html'), 'utf8');
const admin = fs.readFileSync(path.join(root, 'admin-dashboard.html'), 'utf8');

assert.match(weekly, /ww-pb-panel-title[\s\S]*margin-bottom: 9px/);
assert.match(weekly, /ww-pb-panel-value[\s\S]*line-height: 1\.1/);
assert.match(weekly, /ww-pb-panel-delta[\s\S]*margin-top: 9px/);
assert.match(weekly, /margin-top:34px;">\$\{d\.streak\}/);
assert.doesNotMatch(weekly, /margin-top:-18px/);
assert.match(weekly, /@media \(max-height: 700px\)/);
assert.match(weekly, /ww-slide-month-pbs/);
assert.match(weekly, /ww-slide-month-goals/);
assert.match(weekly, /ww-month-goal-row/);
assert.match(weekly, /ww-month-goal-reward/);
assert.match(weekly, /ww-slide-month-streak[\s\S]*margin-top: 34px/);

assert.strictEqual((dashboard.match(/lib\/weekly-wrapped\.js\?v=monthly-wrapped-layout-v3/g) || []).length, 2);
assert.match(dashboard, /id="monthly-wrapped-card"[^>]*-webkit-text-fill-color: white/);
assert.match(dashboard, /dismissWeeklyWrappedCard\(\)[^>]*-webkit-text-fill-color: white/);
assert.doesNotMatch(dashboard, /lib\/monthly-wrapped\.js/);
assert.match(admin, /lib\/weekly-wrapped\.js\?v=monthly-wrapped-layout-v3/);

console.log('wrapped layout hardening tests passed');
