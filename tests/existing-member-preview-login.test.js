const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const read = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
function boot(user) {
    const storage = () => { const map = new Map(); return {getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,String(v)),removeItem:k=>map.delete(k)}; };
    const window = {currentUser:user,localStorage:storage(),sessionStorage:storage()};
    const context = {window,URLSearchParams,Date,console,setTimeout,clearTimeout,setInterval,clearInterval};
    vm.runInNewContext(read('lib/onboarding-progress.js'), context);
    vm.runInNewContext(read('lib/meta-ad-trial.js'), context);
    return window;
}
const established = {id:'existing-main-account',created_at:'2026-01-17T22:37:33.845297Z'};
test('existing account cannot adopt unowned or previously misassigned signup previews', async () => {
    for (const ownerUserId of [undefined, established.id]) {
        for (const stage of ['setup','tour','checkout']) {
            const window = boot(established), api = window.BalanceMetaAdTrial;
            window.localStorage.setItem(api.STATE_KEY, JSON.stringify({variant:api.VARIANT,activatedAt:123,accountFirst:true,ownerUserId,onboardingCompletedAt:124}));
            window.localStorage.setItem('pbb_onboarding_progress_v1:'+established.id+':123',JSON.stringify({version:1,stage}));
            assert.equal(api.restoreAuthenticatedMode(established.id,established),false);
            assert.equal(api.isActive(),false);
            assert.equal(window.BalanceOnboardingProgress.isTourSuppressed(),true);
            assert.equal(window.BalanceOnboardingProgress.read(),null);
            // Execute the actual dashboard startup decision with a fresh device
            // and this account's verified server onboarding status.
            const calls=[];
            window.dispatchEvent=()=>{};
            window.getUserProfile=async()=>({onboarding_complete:true,subscription_status:null,is_test_account:false,is_transferred_client:false});
            const source=read('js/dashboard/dashboard-script-5-initialize_stripe_for_inapp_pu.js');
            const a=source.indexOf('async function checkAndTriggerOnboarding()');
            const b=source.indexOf('function initOnboardingWizard()',a);
            const ctx={window,localStorage:window.localStorage,console,CustomEvent:function(){},dbHelpers:{users:{}},getActiveUserGender:()=> 'male',initOnboardingWizard:()=>calls.push('setup'),startWizardClientActivationTour:()=>calls.push('tour')};
            vm.runInNewContext(source.slice(a,b),ctx);
            await ctx.checkAndTriggerOnboarding();
            assert.deepEqual(calls,[]);
            assert.equal(window.localStorage.getItem('onboardingComplete'),'true');
        }
    }
});
test('only an explicitly created signup owns its preview; another login cannot adopt it',()=>{
    const user={id:'new-account',created_at:'2026-09-21T00:00:00Z'};
    const window=boot(user), api=window.BalanceMetaAdTrial;
    const query='account_first=1&meta_trial=facebook_5m_foundations_v3&learn_entry=app_signup';
    api.activate(query);
    assert.equal(api.restoreAuthenticatedMode(user.id,user),false);
    assert.equal(api.activateSignup(user.id,query),true);
    assert.equal(api.restoreAuthenticatedMode(user.id,user),true);
    assert.equal(window.BalanceOnboardingProgress.isTourSuppressed(),false);
    assert.equal(api.restoreAuthenticatedMode('other-account',{id:'other-account'}),false);
});
