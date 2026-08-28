const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const dashboard = fs.readFileSync(path.join(root, 'dashboard.html'), 'utf8');
const serviceWorker = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');

test('paid and signed-in onboarding introduce the guided app tour before step one', () => {
  assert.match(dashboard, /id="meta-tour-welcome"[^>]*role="dialog"[^>]*aria-modal="true"/);
  assert.match(dashboard, /Your first week is ready/);
  assert.match(dashboard, /finish the tour by completing your first lesson and quiz/i);
  assert.match(dashboard, /Start my app tour/);
  assert.match(dashboard, /if \(metaPreviewTour \|\| clientActivationTour\) \{\s*showMetaTourWelcome\(\);/);
  assert.match(dashboard, /window\.beginMetaPreviewTour = function\(\)[\s\S]*BalanceMetaPreviewSoundtrack\.start\(\);[\s\S]*showStep\(0\);/);
});

test('tour welcome is phone-safe and refreshes the app shell', () => {
  assert.match(dashboard, /#meta-tour-welcome[\s\S]*env\(safe-area-inset-top\)[\s\S]*env\(safe-area-inset-bottom\)/);
  assert.match(dashboard, /max-height: calc\(100dvh/);
  assert.match(dashboard, /\.meta-tour-welcome-card[\s\S]*overflow-y: auto/);
  assert.match(serviceWorker, /const CACHE_NAME = 'pbb-app-v363-guided-client-tour'/);
});
