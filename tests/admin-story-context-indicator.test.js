const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const dashboard = fs.readFileSync(path.join(__dirname, '..', 'admin-dashboard.html'), 'utf8');

assert.match(dashboard, /Story context available/);
assert.match(dashboard, /Story context unavailable/);
assert.match(dashboard, /did not provide verified frame contents/);
assert.match(dashboard, /does not have verified story contents/);
assert.match(dashboard, /const caption = take\(\/Story caption:/);
assert.match(dashboard, /available: !explicitlyUnavailable/);
assert.match(dashboard, /\.alert-story-context\.unavailable/);

console.log('admin story context indicator tests passed');
