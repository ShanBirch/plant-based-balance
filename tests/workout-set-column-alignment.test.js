const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const source = fs.readFileSync('js/dashboard/pbb-workout-swipe-player.js', 'utf8');
test('focus table labels and fields share explicit columns regardless of insertion order', () => {
  for (const [label, field, column] of [['set-label','set-number',1],['reps-label','input-reps',2],['weight-label','input-kg',3],['rest-label','workout-rest-period',4]]) {
    const rule = new RegExp('\\.' + label + ',[\\s\\S]*?\\.' + field + '[^{}]*\\{ grid-column:' + column + '; grid-row:1; \\}');
    assert.match(source, rule);
  }
  assert.match(source, /\.workout-set-options \{ grid-column:5; grid-row:1;/);
  assert.match(source, /labels\[3\]\.textContent = 'Weight'/);
  assert.match(source, /labels\[4\]\.textContent = 'Rest'/);
  assert.match(source, /'Time \(sec\)' : 'Reps'/);
  assert.doesNotMatch(source, /:has\(> \.workout-rest-heading\)/);
});
