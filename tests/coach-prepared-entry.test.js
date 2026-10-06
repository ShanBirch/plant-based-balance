const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('js/dashboard/dashboard-script-5-initialize_stripe_for_inapp_pu.js','utf8');
function extract(name){const start=source.indexOf('function '+name+'(');const next=/\n(?:async )?function /.exec(source.slice(start+1));return (name==='checkAndTriggerOnboarding'?'async ':'')+source.slice(start,next?start+1+next.index:source.length);}
function runtime(){
 const values=new Map(),classes=new Set(['active']);
 const modal={style:{display:'flex'},dataset:{launchState:'open'},classList:{contains:x=>classes.has(x),remove:x=>classes.delete(x)}};
 const window={currentUser:{id:'prepared',user_metadata:{balance_onboarding_mode:'coach_guided',balance_coach_prepared:true}},_onboardingWizardPending:true};
 const storage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};
 window.localStorage=storage;
 vm.runInNewContext(fs.readFileSync('lib/onboarding-progress.js','utf8'),{window});
 const calls=[];const c={window,document:{getElementById:()=>modal},localStorage:storage,setOnboardingScrollLock:v=>calls.push(['scroll',v]),setOnboardingNavigationGate:v=>calls.push(['gate',v])};
 vm.createContext(c);for(const fn of ['enterCoachPreparedDashboard','isOnboardingNavigationLocked','checkAndTriggerOnboarding','initOnboardingWizard'])vm.runInContext(extract(fn),c);
 return {c,window,values,modal,calls};
}
test('prepared account opens directly without completing profile, consent or tour records',async()=>{
 const {c,window,values,modal,calls}=runtime();
 window.BalanceOnboardingProgress.save('setup',{screen:'intro'});
 await c.checkAndTriggerOnboarding();
 assert.equal(modal.style.display,'none');assert.equal(modal.dataset.launchState,undefined);
 assert.equal(window._onboardingWizardPending,false);assert.equal(c.isOnboardingNavigationLocked(),false);
 assert.deepEqual(calls,[['scroll',false],['gate',false]]);
 assert.equal(values.size,0);assert.equal(window.currentUser.user_metadata.balance_app_tour_completed_at,undefined);
 assert.equal(window.userProfile,undefined);assert.equal(window.currentUser.user_metadata.age,undefined);
 c.initOnboardingWizard();assert.equal(modal.style.display,'none'); // late deferred trigger
});
test('fresh-device and reopened entry is account-scoped and leaves ordinary setup intact',()=>{
 const {c,window,modal}=runtime();
 assert.equal(c.initOnboardingWizard(),true);assert.equal(c.isOnboardingNavigationLocked(),false);
 window.currentUser={id:'ordinary',user_metadata:{balance_onboarding_mode:'coach_guided'}};
 modal.style.display='flex';window._onboardingWizardPending=true;
 assert.equal(c.enterCoachPreparedDashboard(),false);assert.equal(c.isOnboardingNavigationLocked(),true);
 window.currentUser={id:'prepared',user_metadata:{balance_onboarding_mode:'coach_guided',balance_coach_prepared:true}};window.guestMode=true;
 assert.equal(window.BalanceOnboardingProgress.isCoachPreparedMember(),false);window.guestMode=false;window.isAdminViewing=true;
 assert.equal(window.BalanceOnboardingProgress.isCoachPreparedMember(),false);
});
test('an existing session refreshes the prepared preference after an admin change',async()=>{
 const {c,window,modal}=runtime();
 window.currentUser.user_metadata={balance_onboarding_mode:'coach_guided'};
 window.supabaseClient={auth:{getUser:async()=>({data:{user:{id:'prepared',user_metadata:{balance_onboarding_mode:'coach_guided',balance_coach_prepared:true}}}})}};
 await c.checkAndTriggerOnboarding();
 assert.equal(modal.style.display,'none');assert.equal(c.isOnboardingNavigationLocked(),false);
 assert.equal(window.currentUser.user_metadata.balance_coach_prepared,true);
});
