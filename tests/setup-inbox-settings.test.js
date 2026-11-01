const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const read=p=>fs.readFileSync(p,'utf8');
test('welcome only uses a matching authenticated account and retries safely',async()=>{
 let auth='other',calls=0,opened=null;const window={currentUser:{id:'new'},addEventListener(){},supabaseClient:{auth:{getSession:async()=>({data:{session:{user:{id:auth}}}})},rpc:async(name)=>{assert.equal(name,'ensure_balance_inbox_welcome');calls++;return {data:'fixed-id'};}},openDirectMessage:(id)=>opened=id};
 vm.runInNewContext(read('js/dashboard/pbb-inbox-welcome.js'),{window});
 assert.equal(await window.BalanceInboxWelcome.ensure(),null);assert.equal(calls,0);auth='new';await Promise.all([window.BalanceInboxWelcome.ensure(),window.BalanceInboxWelcome.ensure()]);assert.equal(calls,1);await window.BalanceInboxWelcome.open();assert.equal(calls,1);assert.equal(opened,'00a6605e-8edb-4917-85ba-24a23f179059');
 window.currentUser={id:'second'};assert.equal(await window.BalanceInboxWelcome.ensure(),null);assert.equal(calls,1);
});
test('self-selected calendar is confirmed before retiring only this member provisional programme',async()=>{
 const source=read('js/dashboard/dashboard-script-5-initialize_stripe_for_inapp_pu.js');const prefix=source.slice(source.indexOf('async function finishOnboarding() {')+'async function finishOnboarding() {'.length,source.indexOf('    const completingTransferredSetup',source.indexOf('async function finishOnboarding() {')));
 const run=new Function('window','claimMetaPreviewWorkoutCalendar','sessionStorage','parseStoredWorkoutCalendar','return (async()=>{'+prefix+'return true;})()');
 for(const fail of [true,false]){const calls=[];const window={currentUser:{id:'own'},BalanceFreeStarter:{selfSetup:()=>true},showToast:()=>calls.push('retry'),supabaseClient:{from:name=>{assert.equal(name,'custom_workout_programs');return {update:value=>{assert.deepEqual(value,{is_active:false});return {eq:(key,value)=>{assert.equal(key,'user_id');assert.equal(value,'own');return {eq:async(key,value)=>{assert.equal(key,'is_active');assert.equal(value,true);calls.push('retire');return {};}};}}}};}}};
 const complete=await run(window,async uid=>{assert.equal(uid,'own');calls.push('confirm-calendar');if(fail)throw Error('failed');},{getItem:()=>JSON.stringify({workout_calendar:'chosen-calendar'})},v=>{assert.equal(v,'chosen-calendar');return {tuesday:'workout'};});
 assert.deepEqual(calls,fail?['confirm-calendar','retry']:['confirm-calendar','retire']);assert.equal(complete,fail?undefined:true);}
});
test('Settings return bypasses setup for one navigation without changing completion or entitlements',async()=>{
 const source=read('js/dashboard/dashboard-script-5-initialize_stripe_for_inapp_pu.js');const a=source.indexOf('async function checkAndTriggerOnboarding() {'),b=source.indexOf('    // A verified read-only admin preview',a);let destination;
 const window={location:{search:'?settings_return=1'},history:{replaceState:(_a,_b,url)=>destination=url}};
 const fn=new Function('window','URLSearchParams','return ('+source.slice(a,b)+'})()');await fn(window,URLSearchParams);assert.equal(destination,'/dashboard.html');assert.equal(window._onboardingWizardPending,false);assert.equal(window.currentUser,undefined);
});
test('Top Levels visibility depends on explicit open state, never focus or active styling',()=>{
 const css=read('css/dashboard/pbb-premium-overlays.css');assert.doesNotMatch(css,/\.feed-level-leaderboard:(focus-within|active) \.feed-level-leaderboard-(body|chevron)/);assert.match(css,/\.feed-level-leaderboard\.is-open \.feed-level-leaderboard-body\s*\{\s*display: block/);
});

test('self-setup frequency stays member-selected while the legacy two-workout grant stays capped',()=>{
 const source=read('js/dashboard/dashboard-script-5-initialize_stripe_for_inapp_pu.js');
 const start=source.indexOf('function selectTrainingFrequency('),end=source.indexOf('    wizardTrainingFrequency = num;',start);
 const run=new Function('window','num',source.slice(source.indexOf(') {',start)+3,end)+'return num;');
 for(const selfSetup of [true,false]) assert.equal(run({BalanceFreeStarter:{active:()=>true,selfSetup:()=>selfSetup}},4),selfSetup?4:2);
 assert.match(source,/!window\.BalanceFreeStarter\?\.active\(\) \|\| window\.BalanceFreeStarter\?\.selfSetup\?\.\(\) \|\| step.key !== 'weekly_capacity'/);
});
