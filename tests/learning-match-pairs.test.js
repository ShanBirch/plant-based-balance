const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.resolve(__dirname, '..', 'lib', 'learning-inline.js'), 'utf8');

test('duplicate body-budget answers are interchangeable', () => {
  assert.match(source, /\{ left: "Quality sleep", right: "Body budget deposit" \}/);
  assert.match(source, /\{ left: "Regular movement", right: "Body budget deposit" \}/);
  assert.match(source, /\{ left: "Chronic stress", right: "Body budget withdrawal" \}/);
  assert.match(source, /\{ left: "Social isolation", right: "Body budget withdrawal" \}/);
  assert.match(source, /leftIndex === rightIndex \|\| leftAnswer === rightAnswer/);
});
