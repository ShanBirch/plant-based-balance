const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('client stories introduction has no navigation pills', () => {
  const html = fs.readFileSync(path.join(__dirname, '../clients.html'), 'utf8');
  const intro = html.slice(html.indexOf('<main>'), html.indexOf('<aside'));
  assert.ok(intro.includes('Client Success'));
  assert.ok(intro.includes('Real client stories from more than 15 years of coaching.'));
  assert.ok(!intro.includes('button-row'));
  assert.ok(!intro.includes('Back to the hub'));
  assert.ok(!intro.includes('What I offer'));
  assert.ok(html.includes('client-hero-media'));
});
