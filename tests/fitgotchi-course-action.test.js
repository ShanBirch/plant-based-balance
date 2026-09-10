const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'dashboard.html'), 'utf8');
const journey = fs.readFileSync(path.join(root, 'js/dashboard/pbb-social-journey.js'), 'utf8');
const next = fs.readFileSync(path.join(root, 'js/dashboard/pbb-next-obvious-steps.js'), 'utf8');
function section(source, start, end) {
  const at = source.indexOf(start);
  assert.ok(at >= 0, start);
  const stop = source.indexOf(end, at);
  assert.ok(stop > at, end);
  return source.slice(at, stop);
}
function fixture() {
  const c = {
    state: {current_week:1, settings:{}}, eligible:true, owner:'member', writes:0, renders:0,
    safeObject:v=>v||{}, safeArray:v=>Array.isArray(v)?v:[], isJourneyEligible:()=>c.eligible,
    currentUserId:()=>c.owner, closeJourney(){}, closeOnboarding(){},
    renderCard(){c.renders++}, calculateProgress:async()=>{},
    window:{supabaseClient:{},getFitGotchiVisibility:()=>c.visibility,
      startFeatureTour:(mode,options)=>{c.options=options},
      trackBalanceActivity:()=>{}}, visibility:'hidden',
    upsertState:async patch=>{c.writes++; c.state={...c.state,...patch};}
  };
  vm.runInNewContext(section(journey,'  function canOpenFitGotchiIntro()', '  let onboardingTestResetRunning'),c);
  return c;
}
test('only eligible post-onboarding Week 1 members receive the action',()=>{
  const c=fixture();
  assert.equal(c.getFitGotchiIntroAction().title,'View Your FitGotchi');
  for(const flag of ['metaAdTrialMode','__balancePendingClientActivation','__balanceGuidedTourActive']){
    c.window[flag]=true;assert.equal(c.getFitGotchiIntroAction(),null);c.window[flag]=false;
  }
  c.eligible=false;assert.equal(c.getFitGotchiIntroAction(),null);c.eligible=true;
  c.state.current_week=2;assert.equal(c.getFitGotchiIntroAction(),null);
});
test('opening or abandoning the walkthrough never awards course credit',()=>{
  const c=fixture();assert.equal(c.openFitGotchiIntro(),true);
  assert.equal(c.writes,0);assert.equal(c.state.settings.fitgotchi_intro,undefined);
  assert.equal(c.options.fitgotchiCourse,true);
});
test('completion persists once and remains complete after hiding the character',async()=>{
  const c=fixture();c.openFitGotchiIntro();
  await assert.rejects(c.options.onCourseComplete(),/Turn on/);
  c.visibility='visible';await c.options.onCourseComplete();
  const stamp=c.state.settings.fitgotchi_intro.completed_at;
  assert.ok(stamp);assert.equal(c.getFitGotchiIntroAction(),null);
  await c.options.onCourseComplete();assert.equal(c.state.settings.fitgotchi_intro.completed_at,stamp);
  c.visibility='hidden';assert.equal(c.getFitGotchiIntroAction(),null);
});
test('failed saves roll back optimistic credit and can be retried',async()=>{
  const c=fixture();c.visibility='visible';c.openFitGotchiIntro();
  const save=c.upsertState;
  c.upsertState=async patch=>{c.state={...c.state,...patch};throw Error('offline')};
  await assert.rejects(c.options.onCourseComplete(),/offline/);
  assert.equal(c.state.settings.fitgotchi_intro,undefined);
  assert.ok(c.getFitGotchiIntroAction());
  c.upsertState=save;await c.options.onCourseComplete();
  assert.ok(c.state.settings.fitgotchi_intro.completed_at);
});
test('missing connection and account changes cannot silently earn credit',async()=>{
  const c=fixture();c.visibility='visible';c.openFitGotchiIntro();
  c.window.supabaseClient=null;
  await assert.rejects(c.options.onCourseComplete(),/Reconnect/);assert.equal(c.writes,0);
  c.window.supabaseClient={};c.owner='another-member';
  await assert.rejects(c.options.onCourseComplete(),/course changed/);assert.equal(c.writes,0);
});
test('the required task participates in the course checklist, without relocking previous weeks',()=>{
  const c={safeObject:v=>v||{},safeArray:v=>Array.isArray(v)?v:[],taskAvailability:()=>({}),taskActionLabel:()=>''};
  vm.runInNewContext(section(journey,'  function task(id,','  function lesson('),c);
  vm.runInNewContext(section(journey,'  const WEEK_DEFINITIONS','  const WEEK_LESSONS')+'\nthis.definitions=WEEK_DEFINITIONS;',c);
  const definition=c.definitions[0];
  assert.equal(definition.tasks[0].id,'w1_fitgotchi_intro');
  c.state={current_week:1,settings:{}};
  c.progress={tasks:definition.tasks.filter(x=>x.type!=='fitgotchi_intro').map(x=>({...x,current:1,complete:true}))};
  vm.runInNewContext(section(journey,'  function getFoundationsCourseProgress()', '  function taskActionForCourse('),c);
  assert.equal(c.getFoundationsCourseProgress().weekProgress[0].tasksComplete,false);
  c.progress.tasks.push({...definition.tasks[0],current:1,complete:true});
  assert.equal(c.getFoundationsCourseProgress().weekProgress[0].tasksComplete,true);
  c.state={current_week:2,settings:{foundation_week_progress:{'1':{tasks:c.progress.tasks.slice(0,-1)}}}};
  assert.equal(c.getFoundationsCourseProgress().weekProgress[0].tasksComplete,true);
  assert.match(journey,/fitgotchi_intro: safeObject\(settingsBeforeProgress.fitgotchi_intro\).completed_at \? 1 : 0/);
});
test('the mini-tour has real Settings/Home targets and is outside the payment tour',()=>{
  const steps=section(html,'  const fitgotchiCourseSteps','  let activeSteps');
  assert.match(steps,/settings-fitgotchi-visibility/);
  assert.match(steps,/tamagotchi-widget-container/);
  assert.match(steps,/tamagotchi-stats-bar/);
  assert.match(steps,/gamification/);assert.match(steps,/any time/);
  assert.doesNotMatch(section(html,'const REQUIRED_ONBOARDING_TOUR_TITLES', 'function requiredOnboardingTourSteps'),/FitGotchi/);
  assert.doesNotMatch(section(next,'var ONBOARDING_ACTION_IDS', '];'),/fitgotchi/);
  assert.match(html,/fitgotchi-week-one-feedback-v1/);
  assert.match(html,/else if \(!completedCourseFeatureTour\) localStorage.setItem/);
  assert.match(html,/completedCourseFeatureTour && skipped && tourNavigationBusy/);
});
test('the switch gate observes the actual visibility and removes its listener',()=>{
  const c={step:{requiresFitGotchiVisible:true},activeTourGate:null,finalLabel:'Next',
    gateIsCurrent:()=>true,q:()=>({}),scheduleTourPosition(){},
    setTourGateUi:enabled=>{c.enabled=enabled},window:{
      getFitGotchiVisibility:()=>c.visible?'visible':'hidden',
      addEventListener:(name,fn)=>{c.listener=fn},
      removeEventListener:(name,fn)=>{assert.equal(fn,c.listener);c.removed=true}
    }};
  const branch=section(html,'    if (step && step.requiresFitGotchiVisible)', 'if (step && step.requiresFeedPost)');
  vm.runInNewContext('(function(){'+branch+'})()',c);
  assert.equal(c.enabled,false);c.visible=true;c.listener();assert.equal(c.enabled,true);
  c.activeTourGate.cleanup();assert.equal(c.removed,true);
});
test('edited scripts parse and both loader paths use the new assets',()=>{
  new Function(journey);new Function(next);
  for(const marker of ['GUIDED FEATURE TOUR','NEW FEATURE REVEAL']){
    const at=html.indexOf('<script>',html.indexOf('<!-- ========== '+marker));
    new Function(html.slice(at+8,html.indexOf('</script>',at)));
  }
  assert.equal((html.match(/pbb-social-journey.js\?v=52-fitgotchi-course/g)||[]).length,2);
  assert.equal((html.match(/pbb-next-obvious-steps.js\?v=58-fitgotchi-course/g)||[]).length,2);
});
