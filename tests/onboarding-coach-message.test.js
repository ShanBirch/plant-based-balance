const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('dashboard.html','utf8');
const source=html.slice(html.indexOf('window.endFeatureTour = function(skipped){'),html.indexOf('  function wantsFullTour('));
test('ordinary first-login completion opens Coach Shannon for paid and unpaid accounts without checkout',async()=>{
 for(const destination of ['checkout','course']) {
  const calls=[];const noop=()=>{};
  const window={currentUser:{id:'first-login'},location:{hostname:'plantbased-balance.org',search:''},__balanceGuidedTourActive:true,BalanceOnboardingProgress:{completionDestination:async()=>destination,save:(s)=>calls.push(s),clear:noop,completeFirstRunTour:()=>calls.push('tour-complete')},BalanceMetaAdTrial:{showCoachWelcome:o=>calls.push(o.member?'member-message':'preview-message'),openCheckoutGate:()=>{throw Error('Must not open payment')}}};
  const ctx={window,document:{getElementById:()=>null},URLSearchParams,courseFeatureTour:null,metaPreviewTour:false,clientActivationTour:true,clientCompletionDestination:null,clientCompletionPromise:null,idx:0,activeSteps:[{title:'Done'}],incompleteRequiredTourStep:()=>-1,setTourGateUi:noop,tourRenderToken:0,cancelScheduledTourPosition:noop,stopTourRecovery:noop,trackTourProgress:noop,clearActiveTourGate:noop,resetTourTemporaryTargets:noop,q:()=>null,completedPromptedActions:new Set(),setTourXpNote:noop,localStorage:{setItem:noop},tourBannerObserver:null,resizeHandler:null};
  vm.runInNewContext(source,ctx);window.endFeatureTour(false);await ctx.clientCompletionPromise;
  assert.ok(calls.includes('tour-complete'));assert.equal(calls.at(-1),destination==='course'?'member-message':'preview-message');assert.equal(window.__balanceGuidedTourActive,false);
 }
});
