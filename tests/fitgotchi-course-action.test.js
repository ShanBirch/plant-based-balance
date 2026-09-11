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
    document:{getElementById:()=>({scrollIntoView:()=>{c.scrolled=true}})},
    window:{supabaseClient:{},getFitGotchiVisibility:()=>c.visibility,
      switchAppTab:tab=>{c.tab=tab},showToast:message=>{c.message=message},
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
  assert.equal(c.tab,'profile');assert.equal(c.scrolled,true);
  assert.equal(c.writes,0);assert.equal(c.state.settings.fitgotchi_intro,undefined);
  assert.equal(c.options.fitgotchiCourse,true);
});
test('a delayed guide still opens Settings and explains how to retry without credit',()=>{
  const c=fixture();delete c.window.startFeatureTour;
  assert.equal(c.openFitGotchiIntro(),false);
  assert.equal(c.tab,'profile');assert.equal(c.scrolled,true);
  assert.match(c.message,/retry/);assert.equal(c.writes,0);
});

test('an inert template guide is bootstrapped before starting the Week 1 action',()=>{
  const c=fixture();
  const originalStart=c.window.startFeatureTour;
  delete c.window.startFeatureTour;
  c.window.ensureGuidedFeatureTourRuntime=()=>{c.boots=(c.boots||0)+1;c.window.startFeatureTour=originalStart;};
  assert.equal(c.openFitGotchiIntro(),true);
  assert.equal(c.boots,1);assert.equal(c.tab,'profile');
  assert.equal(c.options.fitgotchiCourse,true);assert.equal(c.message,undefined);assert.equal(c.writes,0);
  c.openFitGotchiIntro();assert.equal(c.boots,1);
});

test('the real activation bootstrap registers the guide stored inside the onboarding template',()=>{
  const onboarding=fs.readFileSync(path.join(root,'js/dashboard/dashboard-script-5-initialize_stripe_for_inapp_pu.js'),'utf8');
  const guideStart=html.indexOf('<script>',html.indexOf('<!-- ========== GUIDED FEATURE TOUR'))+8;
  const guideSource=html.slice(guideStart,html.indexOf('</script>',guideStart));
  assert.ok(html.indexOf('id="tmpl-onboarding"')<guideStart);
  assert.ok(html.indexOf('</script><!-- end tmpl-onboarding -->')>guideStart);
  const runtimeScript={textContent:guideSource,dataset:{}};
  const c={console,URLSearchParams,location:{search:''},setTimeout(){},setInterval(){},addEventListener(){},
    document:{scripts:[runtimeScript],addEventListener(){},querySelector(){return null},getElementById(){return null}},
    localStorage:{getItem(){return null}}};
  c.window=c;
  vm.createContext(c);
  vm.runInContext(section(onboarding,'function ensureGuidedFeatureTourRuntime()', 'function startWizardClientActivationTour('),c);
  assert.equal(c.startFeatureTour,undefined);
  assert.equal(c.ensureGuidedFeatureTourRuntime(),true);
  assert.equal(typeof c.startFeatureTour,'function');
  assert.equal(runtimeScript.dataset.balanceTourBootstrapped,'true');
  assert.equal(c.ensureGuidedFeatureTourRuntime(),true);
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
  assert.match(steps,/extra data point/);assert.match(steps,/any time/);
  assert.match(steps,/controlPromptPosition:'below'/);
  assert.match(steps,/nextLabel:'Take me home'/);
  assert.doesNotMatch(section(html,'const REQUIRED_ONBOARDING_TOUR_TITLES', 'function requiredOnboardingTourSteps'),/FitGotchi/);
  assert.doesNotMatch(section(next,'var ONBOARDING_ACTION_IDS', '];'),/fitgotchi/);
  assert.match(html,/fitgotchi-week-one-feedback-v2/);
  assert.match(html,/else if \(!completedCourseFeatureTour\) localStorage.setItem/);
  assert.match(html,/completedCourseFeatureTour && skipped && tourNavigationBusy/);
});
test('switching on updates the card and waits for Take me home; switching off restores the prompt',()=>{
  const nodes={'tour-title':{},'tour-body':{}};
  const c={step:{requiresFitGotchiVisible:true,title:'Meet your FitGotchi',body:'Progress explained',enabledTitle:"Let's see your FitGotchi",enabledBody:'Head Home'},activeTourGate:null,finalLabel:'Take me home',
    document:{getElementById:id=>nodes[id]},
    setTimeout(){throw Error('must wait for the member to press Take me home')},
    gateIsCurrent:()=>true,q:()=>({}),scheduleTourPosition(){},
    setTourGateUi:(enabled,note,label)=>{c.enabled=enabled;c.note=note;c.label=label},window:{
      getFitGotchiVisibility:()=>c.visible?'visible':'hidden',
      tourNext:()=>{c.advanced=(c.advanced||0)+1},
      addEventListener:(name,fn)=>{c.listener=fn},
      removeEventListener:(name,fn)=>{assert.equal(fn,c.listener);c.removed=true}
    }};
  const branch=section(html,'    if (step && step.requiresFitGotchiVisible)', 'if (step && step.requiresFeedPost)');
  vm.runInNewContext('(function(){'+branch+'})()',c);
  assert.equal(c.enabled,false);assert.equal(nodes['tour-title'].textContent,'Meet your FitGotchi');
  assert.match(c.note,/Turn it on now/);
  c.visible=true;c.listener({detail:{mode:'visible'}});assert.equal(c.enabled,true);
  assert.equal(nodes['tour-title'].textContent,"Let's see your FitGotchi");
  assert.equal(c.label,'Take me home');assert.equal(c.advanced,undefined);
  c.visible=false;c.listener();assert.equal(c.enabled,false);
  assert.equal(nodes['tour-body'].textContent,'Progress explained');
  c.activeTourGate.cleanup();assert.equal(c.removed,true);
});

test('the short guide starts in Settings and ends with the optional Home explanation',()=>{
  const c={};vm.runInNewContext(section(html,'  const fitgotchiCourseSteps','  let courseFeatureTour')+'\nthis.steps=fitgotchiCourseSteps;',c);
  assert.equal(c.steps.length,2);assert.equal(c.steps[0].tab,'profile');
  assert.equal(c.steps[1].tab,'dashboard');assert.match(c.steps[1].body,/on or off/);
});

test('the dedicated course does not evaluate unrelated feature conditions',()=>{
  const c={courseFeatureTour:{},fitgotchiCourseSteps:[{tab:'profile'}],steps:[{condition(){throw Error('deferred feature unavailable')}}]};
  vm.runInNewContext(section(html,'    activeSteps = courseFeatureTour ?', '    if (courseFeatureTour) {'),c);
  assert.equal(c.activeSteps,c.fitgotchiCourseSteps);
});

test('delegated task buttons use the same FitGotchi route as direct buttons',()=>{
  const c={ACTIONS:[],isOnboardingAction:()=>true,setTimeout(){},window:{pbbNextSteps:{runAction:id=>{c.opened=id}}}};
  vm.runInNewContext(section(next,'  function handleClick(event)', '  function init()'),c);
  const button={getAttribute:name=>name==='data-next-step-id'?'fitgotchi_intro':null};
  c.handleClick({target:{closest:selector=>selector==='[data-next-step-id]'?button:null}});
  assert.equal(c.opened,'fitgotchi_intro');
});
test('edited scripts parse and both loader paths use the new assets',()=>{
  new Function(journey);new Function(next);
  for(const marker of ['GUIDED FEATURE TOUR','NEW FEATURE REVEAL']){
    const at=html.indexOf('<script>',html.indexOf('<!-- ========== '+marker));
    new Function(html.slice(at+8,html.indexOf('</script>',at)));
  }
  assert.equal((html.match(/pbb-social-journey.js\?v=55-week1-progress-photos/g)||[]).length,2);
  assert.equal((html.match(/pbb-next-obvious-steps.js\?v=61-course-photo-sync/g)||[]).length,2);
});
