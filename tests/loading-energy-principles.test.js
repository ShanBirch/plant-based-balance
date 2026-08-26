const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const dashboard = fs.readFileSync(path.resolve(__dirname, '..', 'dashboard.html'), 'utf8');

test('loading screen rotates only the three energy-principle facts', () => {
  const variants = dashboard.match(/var LOADING_VARIANTS = \[([\s\S]*?)\n    \];/);
  assert.ok(variants, 'loading variants should be present');

  const entries = variants[1].match(/\{ emoji:/g) || [];
  assert.equal(entries.length, 3);
  assert.match(variants[1], /label: "Carl Friston"/);
  assert.match(variants[1], /label: "Lisa Feldman Barrett"/);
  assert.match(variants[1], /label: "Behaviour change"/);
});
