const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const dashboard = fs.readFileSync(path.join(__dirname, '..', 'dashboard.html'), 'utf8');

test('guided tour clears away when a highlighted text field is focused', () => {
  assert.match(dashboard, /tour-typing #guided-tour-bubble/);
  assert.match(dashboard, /const typingInTarget = !!\(step && step\.hideGuideWhileTyping/);
  assert.match(dashboard, /target\.contains\(activeElement\)/);
  assert.match(dashboard, /if \(typingInTarget\) \{[\s\S]*?bubble\.style\.opacity = '0'/);
  assert.match(dashboard, /visualViewport\.addEventListener\('resize', resizeHandler\)/);
  assert.match(dashboard, /document\.addEventListener\('focusin', resizeHandler, true\)/);
});
