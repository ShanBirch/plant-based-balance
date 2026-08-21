const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const dashboard = fs.readFileSync(path.join(__dirname, '..', 'dashboard.html'), 'utf8');

test('dashboard ships the complete app shell', () => {
  assert.match(dashboard, /<nav class="bottom-nav"/);
  assert.match(dashboard, /<script src="js\/dashboard\/pbb-admin-deep-link\.js/);
  assert.match(dashboard, /<\/body>\s*<\/html>\s*$/);
});
