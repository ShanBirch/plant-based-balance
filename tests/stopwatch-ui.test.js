const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const dashboard = fs.readFileSync(path.join(root, 'dashboard.html'), 'utf8');
const timerJs = fs.readFileSync(path.join(root, 'js/dashboard/dashboard-script-7-video_logic.js'), 'utf8');
const premiumCss = fs.readFileSync(path.join(root, 'css/dashboard/pbb-premium-overlays.css'), 'utf8');

test('Stopwatch uses the simple three-column setup', () => {
  assert.match(dashboard, /<h3 class="movement-tool-question">Set your timer<\/h3>/);
  assert.match(dashboard, /class="interval-setup-grid"/);
  assert.equal((dashboard.match(/class="interval-setup-card"/g) || []).length, 3);
  assert.match(dashboard, /id="interval-work-input"[^>]*value="30"/);
  assert.match(dashboard, /id="interval-rest-input"[^>]*value="30"/);
  assert.match(dashboard, /id="interval-rounds-input"[^>]*value="8"/);
  assert.match(dashboard, /id="interval-work-input"[^>]*aria-label="Work seconds"/);
  assert.match(dashboard, /id="interval-rest-input"[^>]*aria-label="Rest seconds"/);
  assert.match(dashboard, /id="interval-rounds-input"[^>]*aria-label="Rounds"/);
  assert.doesNotMatch(dashboard, /class="sr-only">(?:Work seconds|Rest seconds|Rounds)<\/span>/);
  assert.doesNotMatch(dashboard, /id="interval-timer-input"/);
  assert.doesNotMatch(dashboard, /id="interval-recent-presets"/);
});

test('Running Stopwatch contains only the gold dial and core controls', () => {
  assert.match(dashboard, /class="interval-gold-dial"/);
  assert.match(dashboard, /id="interval-pause-btn"/);
  assert.match(dashboard, /id="interval-end-btn"/);
  assert.doesNotMatch(dashboard, /skipIntervalPhase\(\)/);
  assert.match(timerJs, /view\.dataset\.timerScreen = 'running'/);
  assert.match(timerJs, /view\.scrollTop = 0/);
});

test('Stopwatch adapts safely to small screens and high round counts', () => {
  assert.match(premiumCss, /@media \(max-height: 690px\)/);
  assert.match(premiumCss, /@media \(max-width: 360px\)/);
  assert.match(timerJs, /st\.totalRounds > 12/);
  assert.match(timerJs, /interval-round-progress-track/);
  assert.match(timerJs, /Math\.max\(1, Math\.min\(100,/);
});
