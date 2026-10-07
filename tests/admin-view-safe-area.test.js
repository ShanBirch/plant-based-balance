const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const css = fs.readFileSync(path.join(root, 'css/dashboard/dashboard-style-1.css'), 'utf8');
const dashboard = fs.readFileSync(path.join(root, 'dashboard.html'), 'utf8');

test('mobile admin client banner clears both nonzero and zero-reported safe areas', () => {
  assert.match(css, /@media \(max-width: 760px\)[\s\S]*#admin-view-banner[\s\S]*max\(42px, env\(safe-area-inset-top, 0px\)\)/);
  assert.match(css, /#admin-view-banner[\s\S]*padding-bottom: max\(10px, env\(safe-area-inset-bottom, 0px\)\)/);
  assert.match(dashboard, /dashboard-style-1\.css\?v=86-admin-safe-area/);
});
