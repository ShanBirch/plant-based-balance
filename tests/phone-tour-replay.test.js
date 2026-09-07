const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '..', 'lib/meta-ad-trial.js'), 'utf8');
const id = 'e6781875-f657-4f91-91e1-1289c0e345f8';
function storage(values = {}) {
  const map = new Map(Object.entries(values));
  return { getItem: k => map.get(k) ?? null, setItem: (k,v) => map.set(k,String(v)), removeItem: k => map.delete(k), map };
}
function setup(options = {}) {
  const localStorage = storage({featureTourComplete:'1', onboardingComplete:'true', quizProgress:'saved', userProfile:'saved', pbb_walkthrough_xp_awarded_v2:'saved', ['pbb_onboarding_step_seen:'+id+':meal_plan_intro']:'1'});
  const sessionStorage = storage({pbb_meta_preview_foundations_complete_v1:'true'});
  const state = {variant:'facebook_5m_foundations_v3', accountFirst:true, onboardingCompletedAt:100, walkthroughCompletedAt:200, gateShownAt:300, attribution:{source:'saved'}, ...options.state};
  localStorage.setItem('pbb_meta_ad_trial_state_v1',JSON.stringify(state));
  let starts=0;
  const window = {localStorage,sessionStorage,currentUser:{id: options.userId || id}, document:{getElementById:()=>null},
    supabaseClient:{auth:{getUser:async()=>({data:{user:{id:options.authId || id}}})},from:table=>{
      assert.equal(table,'users');
      return {select:()=>({eq:()=>({single:async()=>({data:{id,is_test_account:options.testAccount !== false}})})})};
    }},
    startFeatureTour:(mode, opts)=>{assert.equal(mode,'full'); assert.equal(opts.metaPreview,true); starts++;window.__balanceGuidedTourActive=true;}
  };
  vm.runInNewContext(source,{window,URLSearchParams,URL,console,setTimeout,clearTimeout});
  return {window,api:window.BalanceMetaAdTrial,localStorage,sessionStorage,starts:()=>starts};
}
test('resets navigation once and preserves setup, XP and unrelated state',async()=>{
  const x=setup(); assert.equal(await x.api.replayPhoneTestTour(),true);
  for (const key of ['onboardingComplete','quizProgress','userProfile','pbb_walkthrough_xp_awarded_v2']) assert.ok(x.localStorage.getItem(key));
  assert.equal(x.localStorage.getItem('featureTourComplete'),null);
  assert.equal(x.localStorage.getItem('pbb_onboarding_step_seen:'+id+':meal_plan_intro'),null);
  const state=JSON.parse(x.localStorage.getItem('pbb_meta_ad_trial_state_v1'));
  assert.equal(state.onboardingCompletedAt,100); assert.deepEqual(state.attribution,{source:'saved'});
  assert.equal(state.walkthroughCompletedAt,null);
  assert.equal(await x.api.replayPhoneTestTour(),false); assert.equal(x.starts(),1);
});
test('other accounts, impersonated sessions and non-test profiles are untouched',async()=>{
  for (const options of [{userId:'other'},{authId:'other'},{testAccount:false}]) {
    const x=setup(options); const before=[...x.localStorage.map];
    assert.equal(await x.api.replayPhoneTestTour(),false); assert.deepEqual([...x.localStorage.map],before); assert.equal(x.starts(),0);
  }
});
test('paid claim and in-flight checkout are never reset',async()=>{
  for (const pending of ['claim','checkout']) {
    const x=setup(pending==='claim'?{state:{claimedAt:500}}:{});
    if(pending==='checkout')x.sessionStorage.setItem('pbb_meta_ad_trial_checkout_session_v1','cs_test');
    const before=[...x.localStorage.map];
    assert.equal(await x.api.replayPhoneTestTour(),false); assert.deepEqual([...x.localStorage.map],before);
  }
});
