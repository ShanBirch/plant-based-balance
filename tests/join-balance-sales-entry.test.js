const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
function section(s,a,b){const i=s.indexOf(a),j=s.indexOf(b,i);assert.ok(i>=0&&j>i);return s.slice(i,j)}
function entry(search='',paidKey){const values=new Map(paidKey?[[paidKey,'paid-session']]:[]),sessionStorage={getItem:k=>values.get(k)||null};const c={window:{location:{search}},sessionStorage,URLSearchParams};vm.runInNewContext(section(read('login.html'),'        function isAccountFirstPreview(','        const dedicatedOnboardingTestEmails'),c);return c;}
test('ordinary new signup uses the sales flow without fabricated Meta attribution',()=>{
 const c=entry('?ref=FRIEND');const params=c.signupEntryParams();assert.equal(params.get('learn_entry'),'app_signup');assert.equal(params.get('utm_source'),null);assert.equal(params.get('ref'),'FRIEND');assert.match(c.postAuthDestination('#session',params),/account_first=1/);assert.equal(c.postAuthDestination(),'\/dashboard.html');
});
test('paid purchase handoffs retain their existing destination',()=>{
 for(const key of ['pbb_meta_ad_trial_checkout_session_v1','balance_founders_pass_session_id']){const c=entry('?account_first=1&meta_trial=facebook_5m_foundations_v3',key);assert.equal(c.signupEntryParams().has('account_first'),false);assert.equal(c.postAuthDestination('#session',c.signupEntryParams()),'/dashboard.html#session');}
});
test('a new signup replaces another account trial and owns its payment flow',()=>{
 const local=new Map(),session=new Map();const storage=m=>({getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)});const window={localStorage:storage(local),sessionStorage:storage(session)};
 vm.runInNewContext(read('lib/meta-ad-trial.js'),{window,URLSearchParams,Date,console,setTimeout,clearTimeout,setInterval,clearInterval});const trial=window.BalanceMetaAdTrial;
 local.set(trial.STATE_KEY,JSON.stringify({variant:trial.VARIANT,ownerUserId:'previous',claimedAt:1}));
 assert.equal(trial.activateSignup('new',entry().signupEntryParams()),true);assert.equal(trial.readState().ownerUserId,'new');assert.equal(trial.readState().claimedAt,null);assert.equal(trial.restoreAuthenticatedMode('new'),true);assert.equal(trial.restoreAuthenticatedMode('previous'),false);
});
test('Settings can explicitly replay a tour that automatic startup suppresses',()=>{
 const html=read('dashboard.html'),c={window:{BalanceOnboardingProgress:{isTourSuppressed:()=>true}}};
 vm.runInNewContext(section(html,'  window.startFeatureTour = function(force, options){','    const savedTour =')+"return 'allowed';};",c);
 assert.equal(c.window.startFeatureTour('full'),false);assert.equal(c.window.startFeatureTour('full',{settingsReplay:true}),'allowed');c.window.isAdminViewing=true;assert.equal(c.window.startFeatureTour('full',{settingsReplay:true}),false);
});
test('completed recent signups recover checkout without repeating the tour; established members do not',async()=>{
 const values=new Map(),window={currentUser:{id:'new',created_at:'2026-09-19T00:00:00Z',user_metadata:{balance_app_tour_completed_at:'done'}},localStorage:{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)}};
 vm.runInNewContext(read('lib/onboarding-progress.js'),{window,Date,setTimeout,clearTimeout});assert.equal(window.BalanceOnboardingProgress.needsCheckoutRecovery(),true);
 let opened=0;window.BalanceMetaAdTrial={readState:()=>null,openCheckoutGate:()=>opened++};window.BalanceOnboardingProgress.completionDestination=async()=> 'checkout';
 const s=read('js/dashboard/dashboard-script-5-initialize_stripe_for_inapp_pu.js');const c={window,console};vm.runInNewContext('async function recover(){'+section(s,'    // Recover signups that finished','    if (!window.BalanceOnboardingProgress?.isTourSuppressed()')+'}',c);await c.recover();assert.equal(opened,1);assert.equal(window.BalanceOnboardingProgress.read().stage,'checkout');
 window.currentUser.created_at='2025-01-01T00:00:00Z';assert.equal(window.BalanceOnboardingProgress.needsCheckoutRecovery(),false);
});
