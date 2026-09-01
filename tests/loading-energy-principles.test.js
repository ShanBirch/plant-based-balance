const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const dashboard = fs.readFileSync(path.resolve(__dirname, '..', 'dashboard.html'), 'utf8');

test('loading screen rotates a varied brain and behaviour fact library', () => {
  const variants = dashboard.match(/var LOADING_VARIANTS = \[([\s\S]*?)\n    \];/);
  assert.ok(variants, 'loading variants should be present');

  const entries = variants[1].match(/\{ emoji:/g) || [];
  assert.equal(entries.length, 36);
  assert.match(variants[1], /label: "Karl Friston"/);
  assert.match(variants[1], /label: "The dark skull"/);
  assert.match(variants[1], /label: "Free energy"/);
  assert.match(variants[1], /label: "Active inference"/);
  assert.match(variants[1], /label: "Precision"/);
  assert.match(variants[1], /label: "Lisa Feldman Barrett"/);
  assert.match(variants[1], /label: "Behaviour change"/);
  assert.doesNotMatch(variants[1], /Kale|Avocados|Broccoli|vegetables|berries/i);
});
