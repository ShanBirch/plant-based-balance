const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');
const html=read('dashboard.html');
function section(text,start,end){const from=text.indexOf(start);assert.ok(from>=0);const to=text.indexOf(end,from);assert.ok(to>from);return text.slice(from,to);}

test('signed-in guided onboarding opens the coach video without an active ad trial',()=>{
  const preview={style:{},setAttribute(){}};
  const c={window:{__balanceGuidedTourActive:true,document:{getElementById:()=>preview}},isActive:()=>false,track(){}};
  vm.runInNewContext(section(read('lib/meta-ad-trial.js'),'    function showInboxPreview()','    function hideInboxPreview()'),c);
  assert.equal(c.showInboxPreview(),true);assert.equal(preview.style.display,'flex');
  c.window.__balanceGuidedTourActive=false;assert.equal(c.showInboxPreview(),false);
  c.isActive=()=>true;assert.equal(c.showInboxPreview(),true);
});

test('declined preview falls back to the actual coach inbox and does not mark a dead tap complete',()=>{
  const calls=[];const c={window:{BalanceMetaAdTrial:{showInboxPreview:()=>false},socialJourney:{openCoachInbox:()=>calls.push('inbox')}},document:{querySelector(){throw Error('must open coach directly')}},markOnboardingStepSeen:()=>calls.push('seen'),switchTab(){},afterTab:fn=>fn()};
  vm.runInNewContext(section(read('js/dashboard/pbb-next-obvious-steps.js'),'  function openCoachMessageTarget()','  var coachCheckinPage'),c);
  c.openCoachMessageTarget();assert.deepEqual(calls,['inbox']);
  c.window.BalanceMetaAdTrial.showInboxPreview=()=>true;c.openCoachMessageTarget();assert.deepEqual(calls,['inbox','seen']);
});

test('completing the first lesson no longer removes the week-one inbox video',()=>{
  const c={SHANNON_USER_ID:'coach',isJourneyEligible:()=>true,state:{current_week:1},isCurrentLessonSeen:()=>true};
  vm.runInNewContext(section(read('js/dashboard/pbb-social-journey.js'),'  function shouldShowWelcomeMessage(','  function closeJourney()'),c);
  assert.equal(c.shouldShowWelcomeMessage('coach'),true);
  assert.equal(c.shouldShowWelcomeMessage('other-member'),false);
  c.isJourneyEligible=()=>false;assert.equal(c.shouldShowWelcomeMessage('coach'),false);
});

test('required completion check catches missing video, goals, lesson and interactions',()=>{
  const c={activeSteps:[{requiresFeedPost:true},{requiresHighlightedClick:true},{requiresWorkoutBrowse:true},{requiresFoundationsLesson:'mind-1-1'},{requiresWelcomeVideo:true},{requiresWeeklyGoals:true}],completedTourGates:new Set()};
  vm.runInNewContext(section(html,'  function incompleteRequiredTourStep()','window.endFeatureTour ='),c);
  ['first-feed-post','highlighted-click:1','workout-browse:2','foundations-lesson:mind-1-1','welcome-video','weekly-goals'].forEach((key,index)=>{assert.equal(c.incompleteRequiredTourStep(),index);c.completedTourGates.add(key)});
  assert.equal(c.incompleteRequiredTourStep(),-1);
});

test('premature end and swipe-back keep signed-in and trial onboarding active',()=>{
  for(const trial of [false,true]){
    const visited=[];const c={window:{location:{hostname:'production',search:''},__balanceGuidedTourActive:true},courseFeatureTour:null,tourNavigationBusy:false,metaPreviewTour:trial,clientActivationTour:!trial,showToast(){},incompleteRequiredTourStep:()=>2,showStep:i=>visited.push(i),activeSteps:[{},{},{},{}],idx:2};
    const start=html.indexOf('window.endFeatureTour = function(skipped){'),end=html.indexOf('    tourRenderToken += 1;',start);
    vm.runInNewContext(html.slice(start,end)+'};',c);
    assert.equal(c.window.endFeatureTour(true),false);assert.equal(c.window.endFeatureTour(false),false);
    assert.deepEqual(visited,[2]);assert.equal(c.window.__balanceGuidedTourActive,true);
    c.incompleteRequiredTourStep=()=>-1;assert.equal(c.window.endFeatureTour(false),false);
    c.idx=3;assert.equal(c.window.endFeatureTour(false),undefined, 'all gates at the last step reach normal completion');
  }
});

test('missing coach video reports a failed open instead of hiding the guide',async()=>{
  const c={coachTourStep:{},q:()=>null,window:{BalanceMetaAdTrial:{showInboxPreview:()=>false}},waitForPromptedStepSurface:async step=>{assert.equal(step.fallbackSel,undefined);return false}};
  vm.runInNewContext(section(html,'  if (coachTourStep) Object.assign','  const foundationsTourStep'),c);
  assert.equal(await c.coachTourStep.action(),false);
});

test('video error or seeking to the end cannot unlock Next; full watch can',()=>{
  const events={},completed=new Set(),video={dataset:{},duration:4,currentTime:0,addEventListener:(name,fn)=>events[name]=fn,removeEventListener(){},pause(){}};
  const button={style:{},focus(){}},status={};
  const c={step:{requiresWelcomeVideo:true,coachNoteGuide:true},q:()=>video,completedTourGates:completed,document:{getElementById:id=>id.includes('continue')?button:status},activeTourGate:null,finalLabel:'Next',window:{trackBalanceActivity(){}},setTourGateUi:ok=>c.enabled=ok};
  vm.runInNewContext('(function(){'+section(html,'    if (step && step.requiresWelcomeVideo) {','    if (step && step.requiresFoundationsLesson) {')+'})()',c);
  events.error();assert.equal(c.enabled,false);video.currentTime=4;events.seeking();events.ended();assert.equal(c.enabled,false);
  for(let i=1;i<=4;i++){video.currentTime=i;events.timeupdate()}
  events.ended();assert.equal(c.enabled,true);assert.ok(completed.has('welcome-video'));assert.equal(button.style.display,'block');
});
