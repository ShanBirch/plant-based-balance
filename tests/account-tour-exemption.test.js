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
test('regular members and ordinary guests cannot launch tours', () => {
  const {window} = context();
  assert.equal(window.BalanceOnboardingProgress.isTourSuppressed(), true);
  window.currentUser = {id:'another-member'};
  assert.equal(window.BalanceOnboardingProgress.isTourSuppressed(), true);
  window.BalanceOnboardingProgress.save('tour',{});
  assert.equal(window.BalanceOnboardingProgress.read(),null);
  window.currentUser = null;
  assert.equal(window.BalanceOnboardingProgress.isTourSuppressed(), true);
});
test('active Meta free-look guests and owning accounts retain tour checkpoints', () => {
  const {window} = context('meta-lead');
  const trial = {ownerUserId:'meta-lead',activatedAt:123};
  window.BalanceMetaAdTrial = {readState:()=>trial,isActive:()=>true};
  assert.equal(window.BalanceOnboardingProgress.isTourSuppressed(),false);
  window.BalanceOnboardingProgress.save('tour',{tour:{step:2}});
  assert.equal(window.BalanceOnboardingProgress.read().tour.step,2);
  window.currentUser = null;
  delete trial.ownerUserId;
  assert.equal(window.BalanceOnboardingProgress.isTourSuppressed(),false);
  window.currentUser = {id:'shared-preview-guest'};
  window.guestMode = true;
  assert.equal(window.BalanceOnboardingProgress.isTourSuppressed(),false);
});
test('real Meta trial activation, ownership restore and claim respect tour eligibility', () => {
  const {window} = context('meta-lead');
  const session = new Map();
  window.sessionStorage = {getItem:k=>session.get(k)||null,setItem:(k,v)=>session.set(k,v),removeItem:k=>session.delete(k)};
  vm.runInNewContext(read('lib/meta-ad-trial.js'), {window,URLSearchParams,Date,console,setTimeout,clearTimeout,setInterval,clearInterval});
  const trial = window.BalanceMetaAdTrial;
  window.localStorage.setItem(trial.STATE_KEY, JSON.stringify({variant:trial.VARIANT,activatedAt:123,accountFirst:true}));
  assert.equal(trial.restoreAuthenticatedMode('meta-lead'),true);
  assert.equal(window.BalanceOnboardingProgress.isTourSuppressed(),false);
  window.currentUser = {id:'existing-member'};
  assert.equal(window.BalanceOnboardingProgress.isTourSuppressed(),true);
  window.currentUser = {id:'meta-lead'};
  trial.markClaimed('meta-lead');
  assert.equal(window.BalanceOnboardingProgress.isTourSuppressed(),true);
});
test('claimed, inactive, unowned and another account preview cannot re-enable a member tour', () => {
  const {window} = context();
  const trial = {ownerUserId:nat};
  window.BalanceMetaAdTrial = {readState:()=>trial,isActive:()=>true};
  assert.equal(window.BalanceOnboardingProgress.isTourSuppressed(),false);
  trial.claimedAt = 123;
  assert.equal(window.BalanceOnboardingProgress.isTourSuppressed(),true);
  delete trial.claimedAt;
  trial.ownerUserId = 'another-member';
  assert.equal(window.BalanceOnboardingProgress.isTourSuppressed(),true);
  delete trial.ownerUserId;
  assert.equal(window.BalanceOnboardingProgress.isTourSuppressed(),true);
  trial.ownerUserId = nat;
  window.BalanceMetaAdTrial.isActive = ()=>false;
  assert.equal(window.BalanceOnboardingProgress.isTourSuppressed(),true);
});
test('dedicated QA accounts remain eligible, but admin client viewing cannot start tours', () => {
  const {window} = context('e6781875-f657-4f91-91e1-1289c0e345f8');
  assert.equal(window.BalanceOnboardingProgress.isTourSuppressed(),false);
  window.isAdminViewing = true;
  assert.equal(window.BalanceOnboardingProgress.isTourSuppressed(),true);
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
  const m = wizard.indexOf('function startWizardMetaPreviewTour(');
  const n = wizard.indexOf('window.startWizardMetaPreviewTour =',m);
  vm.runInNewContext(wizard.slice(m,n),ctx);
  window.__balanceMetaPreviewTourQueued = true;
  ctx.startWizardMetaPreviewTour();
  assert.equal(window.__balanceMetaPreviewTourQueued,false);
  const journey = read('js/dashboard/pbb-social-journey.js');
  const c = journey.indexOf('  function canOpenFitGotchiIntro()');
  const d = journey.indexOf('  function getFitGotchiIntroAction()',c);
  vm.runInNewContext(journey.slice(c,d),ctx);
  assert.equal(ctx.canOpenFitGotchiIntro(),false);
});
