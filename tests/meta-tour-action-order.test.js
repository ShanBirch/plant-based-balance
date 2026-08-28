const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const dashboard = fs.readFileSync(path.join(root, 'dashboard.html'), 'utf8');
const serviceWorker = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');

test('paid tour explains guided actions before performing them', () => {
  for (const button of ['Open workout', 'See my meal plan', 'Start first lesson', 'Open coach message', 'Choose my goals']) {
    assert.match(dashboard, new RegExp(`preActionButton:'${button}'`));
  }
  assert.match(dashboard, /const isPromptBeforeAction = !!\(\(metaPreviewTour/);
  assert.match(dashboard, /if \(!isPromptBeforeAction && !options\.afterPromptedAction && typeof step\.action === 'function'\)/);
  assert.match(dashboard, /if \(pendingPromptedAction && pendingPromptedAction\.index === idx\)[\s\S]*promptedResult = await prompted\.step\.action\(\)/);
});

test('opened interactive screens keep their guide and gates', () => {
  assert.match(dashboard, /showStep\(idx, \{ afterPromptedAction:true \}\)/);
  assert.match(dashboard, /if \(!options\.afterPromptedAction\) \{\s*resetTourTemporaryTargets\(\)/);
  assert.match(dashboard, /completedPromptedActions\.clear\(\)/);
  assert.match(serviceWorker, /const CACHE_NAME = 'pbb-app-v378-smooth-guided-tour'/);
});
