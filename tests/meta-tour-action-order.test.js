const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const dashboard = fs.readFileSync(path.join(root, 'dashboard.html'), 'utf8');
const serviceWorker = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');

test('paid tour explains guided actions before performing them', () => {
  for (const button of ['Tap the meal plan card', 'Tap the shopping list card', 'Tap the tracker card', 'Tap the workout card', 'Tap the coach message card', 'Tap the Weekly Goals card', 'Tap the Course card']) {
    assert.match(dashboard, new RegExp(`preActionButton:'${button}'`));
  }
  assert.match(dashboard, /const isPromptBeforeAction = !!\(\(metaPreviewTour/);
  assert.match(dashboard, /if \(!isPromptBeforeAction && !options\.afterPromptedAction && typeof step\.action === 'function'\)/);
  assert.match(dashboard, /function armPromptTarget\(step, target, stepIndex\)[\s\S]*step\.action\(\{ fromTargetClick:true \}\)/);
  assert.match(dashboard, /promptRequiresTargetClick:true/);
});

test('opened interactive screens keep their guide and gates', () => {
  assert.match(dashboard, /showStep\(idx, \{ afterPromptedAction:true \}\)/);
  assert.match(dashboard, /if \(!options\.afterPromptedAction\) \{\s*resetTourTemporaryTargets\(\)/);
  assert.match(dashboard, /completedPromptedActions\.clear\(\)/);
  assert.match(serviceWorker, /const CACHE_NAME = 'pbb-app-v380-clear-guided-targets'/);
});
