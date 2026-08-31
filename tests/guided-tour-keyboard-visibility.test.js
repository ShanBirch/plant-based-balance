const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const dashboard = fs.readFileSync(path.join(__dirname, '..', 'dashboard.html'), 'utf8');

test('guided tour moves out of the way when a highlighted text field opens the keyboard', () => {
  assert.match(dashboard, /tour-keyboard-open #guided-tour-bubble/);
  assert.match(dashboard, /const editingTarget = !!\(target && activeElement && target\.contains\(activeElement\)/);
  assert.match(dashboard, /visualViewport\.height < \(window\.innerHeight \* 0\.88\)/);
  assert.match(dashboard, /visibleBottom - bubbleH - 8/);
  assert.match(dashboard, /visualViewport\.addEventListener\('resize', resizeHandler\)/);
  assert.match(dashboard, /document\.addEventListener\('focusin', resizeHandler, true\)/);
});
