const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('app overview leads from Balance straight to the screenshot gallery', () => {
  const html = fs.readFileSync(path.join(__dirname, '../balance.html'), 'utf8');
  assert.ok(html.includes('hero-title-text">Balance</span>'));
  assert.ok(!html.includes('Your training, nutrition and learning in one place.'));
  assert.ok(!html.includes('>Inside Balance</span>'));
  assert.ok(html.includes('Take a look around.'));
  assert.ok(html.includes('aria-label="Previous app screenshot"'));
  assert.ok(html.includes('aria-label="Next app screenshot"'));
  assert.equal((html.match(/class="learn-phone-slide"/g) || []).length, 5);
});
