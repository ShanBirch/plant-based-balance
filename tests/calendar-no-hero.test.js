const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname, '..', 'dashboard.html'), 'utf8');

test('legacy cycle banner and its spacing are non-rendered regardless of theme or gender', () => {
  assert.match(html, /id="calendar-legacy-phase-display" hidden aria-hidden="true" style="display: none !important;"/);
  const legacy = html.slice(html.indexOf('id="calendar-legacy-phase-display"'), html.indexOf('<!-- Weekly/Monthly Calendar -->'));
  for (const id of ['cycle-hero-card', 'cycle-phase-name', 'cycle-phase-desc', 'cycle-day-display', 'cycle-phase-tags']) {
    assert.ok(legacy.includes(`id="${id}"`), `preserves updater compatibility: ${id}`);
  }
});

test('calendar and date editing remain available and tour targets a visible control', () => {
  assert.match(html, /<!-- Weekly\/Monthly Calendar -->\s*<div style="padding: 25px;">/);
  assert.match(html, /id="calendar-view-toggle"/);
  assert.match(html, /id="weekly-calendar"/);
  assert.match(html, /id="monthly-calendar"/);
  assert.match(html, />Edit Dates<\/span>/);
  assert.doesNotMatch(html, /sel:'#cycle-hero-card/);
  assert.match(html, /sel:'#calendar-view-toggle', fallbackSel:'#weekly-calendar'/);
});
