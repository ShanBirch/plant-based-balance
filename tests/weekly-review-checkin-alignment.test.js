const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '..');
const { buildWeeklyReviewHandoffBlock } = require('../netlify/functions/_lib/client-context');

test('weekly review and coach follow-up have separate jobs', () => {
  const block = buildWeeklyReviewHandoffBlock();
  assert.match(block, /Weekly Review owns the factual report/);
  assert.match(block, /personal follow-up/);
  assert.match(block, /ONE or TWO specific observations/);
  assert.match(block, /do not make the client repeat information/i);
});

test('first-week handoff does not turn missing setup into a failure list', () => {
  const block = buildWeeklyReviewHandoffBlock({ firstWeek: true });
  assert.match(block, /This is week one/);
  assert.match(block, /at most ONE useful next step/);
  assert.match(block, /onboarding signal, not a list of failures/);
});

test('all automated coaching check-in paths use the shared handoff', () => {
  [
    'netlify/functions/onboarding-scheduled-scan.js',
    'netlify/functions/weekly-checkin-scan.js',
    'netlify/functions/challenge-checkin-scan.js'
  ].forEach((relativePath) => {
    const source = fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
    assert.match(source, /buildWeeklyReviewHandoffBlock/);
  });
});

test('the in-app check-in explains and tracks the coaching handoff', () => {
  const source = fs.readFileSync(path.join(repoRoot, 'js/dashboard/pbb-weekly-checkin-preview.js'), 'utf8');
  assert.match(source, /What happens after you send it/);
  assert.match(source, /you will not need to repeat yourself/i);
  assert.match(source, /weekly_review_opened/);
  assert.match(source, /weekly_checkin_submitted/);
});
