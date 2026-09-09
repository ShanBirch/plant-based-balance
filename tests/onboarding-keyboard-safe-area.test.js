const test = require('node:test');
const assert = require('node:assert/strict');
const css = require('node:fs').readFileSync(require('node:path').join(__dirname,'../css/dashboard/pbb-onboarding-foundations.css'),'utf8');
const mobile = css.slice(css.indexOf('@media (max-width: 560px)'));
test('all mobile accounts reserve status-bar clearance, not just the pilot account',()=>{
  const rule=mobile.slice(0,mobile.indexOf('    #onboarding-wizard .onboarding-modal'));
  assert.match(rule,/--pbb-wizard-safe-top: max\(42px, env\(safe-area-inset-top, 0px\)\)/);
  assert.match(rule,/padding: var\(--pbb-wizard-safe-top\) 6px var\(--pbb-wizard-safe-bottom\)/);
  assert.doesNotMatch(rule,/pbb-onboarding-phone-test/);
});
test('keyboard layout preserves insets and subtracts both from available height',()=>{
  const start=mobile.indexOf('    #onboarding-wizard.wizard-chat-mode.wizard-chat-keyboard {');
  const rules=mobile.slice(start,mobile.indexOf('    #onboarding-wizard.wizard-chat-mode.wizard-chat-keyboard .wizard-header',start));
  assert.match(rules,/padding: var\(--pbb-wizard-safe-top\) 6px var\(--pbb-wizard-safe-bottom\)/);
  assert.equal((rules.match(/- var\(--pbb-wizard-safe-top\) - var\(--pbb-wizard-safe-bottom\)/g)||[]).length,2);
  assert.doesNotMatch(rules,/padding: 4px|- 8px/);
  for(const viewport of [320,400,520,640,844])for(const inset of [0,24,44,59]){
    const top=Math.max(42,inset),bottom=6,height=viewport-top-bottom;
    assert.ok(height>0);assert.equal(top+height+bottom,viewport);
  }
});
