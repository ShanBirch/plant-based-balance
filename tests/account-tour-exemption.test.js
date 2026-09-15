const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const nat = 'e1403726-19bc-4663-85d4-59b668791a80';
function context(id = nat) {
  const storage = new Map();
  const window = {currentUser:{id},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)}};
  vm.runInNewContext(read('lib/onboarding-progress.js'), {window});
  return {window, storage};
}
test('Nat cannot resume or save a tour, while checkout and setup checkpoints stay intact', () => {
  const {window,storage} = context();
  const key = 'pbb_onboarding_progress_v1:' + nat;
  storage.set(key, JSON.stringify({version:1,stage:'tour'}));
  assert.equal(window.BalanceOnboardingProgress.read(), null);
  assert.equal(storage.has(key), false);
  window.BalanceOnboardingProgress.save('tour',{});
  assert.equal(storage.has(key), false);
  for (const stage of ['setup','checkout']) {
    window.BalanceOnboardingProgress.save(stage,{});
    assert.equal(window.BalanceOnboardingProgress.read().stage,stage);
  }
});
test('exemption follows only the verified account across sign-out and account changes', () => {
  const {window} = context();
  assert.equal(window.BalanceOnboardingProgress.isTourSuppressed(), true);
  window.currentUser = {id:'another-member'};
  assert.equal(window.BalanceOnboardingProgress.isTourSuppressed(), false);
  window.BalanceOnboardingProgress.save('tour',{});
  assert.equal(window.BalanceOnboardingProgress.read().stage,'tour');
  window.currentUser = null;
  assert.equal(window.BalanceOnboardingProgress.isTourSuppressed(), false);
});
test('forced replay, activation and course tour all stop before opening UI or scheduling retries', () => {
  const {window} = context();
  const html = read('dashboard.html');
  const start = html.indexOf('  window.startFeatureTour = function(force, options){');
  const end = html.indexOf('  window.replayFeatureTour', start);
  vm.runInNewContext(html.slice(start,end), {window});
  for (const args of [[true,{}],['full',{}],[true,{clientActivation:true}],['full',{fitgotchiCourse:true}]]) {
    assert.equal(window.startFeatureTour(...args),false);
  }
  const wizard = read('js/dashboard/dashboard-script-5-initialize_stripe_for_inapp_pu.js');
  const a = wizard.indexOf('function startWizardClientActivationTour(');
  const b = wizard.indexOf('window.startWizardClientActivationTour =',a);
  const ctx = {window};
  vm.runInNewContext(wizard.slice(a,b),ctx);
  window.__balanceClientActivationTourQueued = true;
  ctx.startWizardClientActivationTour();
  assert.equal(window.__balanceClientActivationTourQueued,false);
  assert.equal(window.__balancePendingClientActivation,false);
  const journey = read('js/dashboard/pbb-social-journey.js');
  const c = journey.indexOf('  function canOpenFitGotchiIntro()');
  const d = journey.indexOf('  function getFitGotchiIntroAction()',c);
  vm.runInNewContext(journey.slice(c,d),ctx);
  assert.equal(ctx.canOpenFitGotchiIntro(),false);
});
