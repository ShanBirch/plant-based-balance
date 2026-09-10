const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../dashboard.html'),'utf8');
function section(begin,end){const i=html.indexOf(begin);assert.ok(i>=0);return html.slice(i,html.indexOf(end,i));}
function navigation(){
 const ctx={window:{__balanceGuidedTourActive:true},tourNavigationBusy:false,tourNextBlockedUntil:0,
 showingXpIntro:false,idx:0,activeSteps:Array.from({length:19},()=>({})),activeTourGate:null,
 pendingPromptedAction:null,metaPreviewTour:true,Date,ended:0,visits:[]};
 ctx.showStep=async i=>{ctx.idx=i;ctx.visits.push(i)};
 ctx.endFeatureTour=()=>ctx.ended++;
 vm.runInNewContext(section('  window.tourNext = async function(){','  async function showTourXpIntro'),ctx);
 return ctx;
}
test('all 19 stops support forward/back round trips without ending the tour',async()=>{
 const c=navigation();
 for(let i=1;i<19;i++){
  await c.window.tourNext();assert.equal(c.idx,i);
  await c.window.tourBack();assert.equal(c.idx,i-1);
  await c.window.tourNext();assert.equal(c.idx,i);
 }
 for(let i=17;i>=0;i--){await c.window.tourBack();assert.equal(c.idx,i)}
 await c.window.tourBack();assert.equal(c.idx,0);assert.equal(c.ended,0);
});
test('rapid taps cannot run overlapping page transitions',async()=>{
 const c=navigation();let release;
 c.showStep=async i=>{await new Promise(r=>release=r);c.idx=i;c.visits.push(i)};
 const moving=c.window.tourNext();
 await c.window.tourNext();await c.window.tourBack();
 assert.equal(c.visits.length,0);release();await moving;
 assert.deepEqual(c.visits,[1]);assert.equal(c.tourNavigationBusy,false);
});
test('Back is allowed before a required interaction is complete; Next is not',async()=>{
 const c=navigation();c.idx=9;c.activeTourGate={complete:false};
 await c.window.tourNext();assert.equal(c.idx,9);
 await c.window.tourBack();assert.equal(c.idx,8);
 assert.match(html,/tour-action-required:not\(\.tour-gate-complete\) #guided-tour-bubble \.tour-next \{ display: none; \}/);
 assert.doesNotMatch(html,/tour-action-required:not\(\.tour-gate-complete\) #guided-tour-bubble \.tour-actions \{ display: none/);
});
test('failed page opening restores the floating guide with Back and Retry',async()=>{
 const classes=new Set(['tour-transitioning','tour-embedded-guide']);
 const nodes={};const node=id=>nodes[id]||(nodes[id]={style:{},classList:{add:(...xs)=>xs.forEach(x=>classes.add(x)),remove:(...xs)=>xs.forEach(x=>classes.delete(x))}});
 const c={window:{__balanceGuidedTourActive:true},tourRenderToken:3,activeSteps:[{title:'Home'},{title:'Course'}],
 document:{getElementById:node},console:{error(){}},clearActiveTourGate(){},resetTourTemporaryTargets(){},
 setTourGateUi:(enabled,note,label)=>{c.label=label},positionBubbleAndSpotlight(){c.positioned=true}};
 c.renderTourStep=async()=>{c.tourRenderToken++;throw new Error('offline')};
 vm.runInNewContext(section('  async function showStep(i, options){','  async function renderTourStep'),c);
 await c.showStep(1);
 assert.ok(classes.has('active'));assert.ok(!classes.has('tour-transitioning'));assert.ok(!classes.has('tour-embedded-guide'));
 assert.equal(node('tour-back-btn').style.visibility,'visible');assert.equal(c.label,'Try again');assert.ok(c.positioned);
 assert.equal(c.activeTourGate.complete,false);
});
test('course welcome, week and Feed restore their actual surfaces on revisits',async()=>{
 const calls=[];const c={q:()=>null,ensureTab:async tab=>calls.push(tab),window:{restoreBalanceFoundationsTourSurface:s=>{calls.push(s);return true}}};
 vm.runInNewContext(section('  async function ensurePreservedTourSurface','  async function showStep'),c);
 await c.ensurePreservedTourSurface({preserveSurface:true,tab:'learning',sel:'#balance-foundations-welcome-start'});
 await c.ensurePreservedTourSurface({preserveSurface:true,tab:'learning',sel:'#balance-foundations-first-lesson'});
 await c.ensurePreservedTourSurface({preserveSurface:true,tab:'friends',sel:'#feed-composer-card'});
 assert.deepEqual(calls,['learning','welcome','learning','week','friends']);
});
test('old feature reveal callbacks cannot dismiss an onboarding tour',()=>{
 const c={window:{__balanceGuidedTourActive:true},document:{getElementById(){throw new Error('must not touch overlay')}}};
 vm.runInNewContext(section('  window.endFeatureReveal = function(skipped)', '  // ── Blocking popup detection'),c);
 assert.doesNotThrow(()=>c.window.endFeatureReveal(true));
 assert.match(html,/const gateToken = tourRenderToken/);
 assert.match(html,/if \(!gateIsCurrent\(\) \|\| idx !== completedStepIndex\) return/);
 assert.match(html,/if \(promptToken !== tourRenderToken \|\| !window\.__balanceGuidedTourActive\) return/);
});
test('course restoration does not award completion or mark a course started',()=>{
 const learning=fs.readFileSync(path.join(__dirname,'../lib/learning-inline.js'),'utf8');
 const restore=learning.slice(learning.indexOf('window.restoreBalanceFoundationsTourSurface'),learning.indexOf('window.openCurrentCourseLesson'));
 assert.match(restore,/renderCourseWelcome\(course\)/);assert.match(restore,/renderFoundationsWeekPage\(course\)/);
 assert.doesNotMatch(restore,/markCourseStarted|completeLesson|localStorage|supabase/);
 assert.doesNotThrow(()=>new Function(learning));
});

test('full-page lesson, coach and check-in keep the existing Back control',()=>{
 assert.match(html,/const navigationOnly = !!\(step && \(step\.coachNoteGuide \|\| step\.checkinExplainerGuide/);
 assert.match(html,/tour-navigation-only #guided-tour-bubble \{\s*display: block !important/);
 assert.match(html,/tour-navigation-only #guided-tour-bubble > :not\(\.tour-actions\)/);
 assert.match(html,/return await openMetaPreviewFirstFoundationsLesson\(\)/);
 assert.match(html,/courseSurface === 'week' \|\| step\.requiresFoundationsLesson/);
});

test('scrolling cannot pin a fake highlight to the header or force the welcome back up',()=>{
 const positioning=section('  function positionBubbleAndSpotlight','  async function ensureWorkoutTourSurface');
 assert.match(positioning,/const targetOnScreen = r\.bottom > 40 && r\.top < vh - bottomReserve/);
 assert.match(positioning,/spot\.style\.opacity = targetOnScreen \? '1' : '0'/);
 assert.equal((positioning.match(/if \(allowScroll && rect.bottom > bottomLimit\)/g)||[]).length,2);
 assert.match(positioning,/if \(allowScroll && Math\.abs\(scrollDelta\) > 3\)/);
 assert.match(html,/displayStep, \{ initialPlacement:true \}/);
 assert.match(html,/tour-transitioning::after/);
});

test('compact Back reserves header space instead of covering page navigation',()=>{
 assert.match(html,/coach-checkin-explainer__header \{ padding-top: 68px/);
 assert.match(html,/guided-tour-course-locked #learning-content \{ padding-top: 64px/);
 assert.match(html,/Math\.max\(40, hostRect \? hostRect\.top \+ 10 : 40\)/);
 assert.match(html,/tourScrollContextSel:'#view-learning'/);
});

test('each quiz question resets the previous reading scroll',()=>{
 const learning=fs.readFileSync(path.join(__dirname,'../lib/learning-inline.js'),'utf8');
 assert.match(learning,/matchState = \{ selectedLeft: null, selectedRight: null, matched: \[\] \};[\s\S]{0,250}window\.scrollTo\(\{ top: 0, behavior: 'auto' \}\)/);
});

test('replayed tours release a dismissed wizard scroll lock',()=>{
 assert.match(html,/if \(!q\('#onboarding-wizard\.active'\) && typeof setOnboardingScrollLock === 'function'\) setOnboardingScrollLock\(false\)/);
 assert.match(html,/window\._onboardingWizardPending = false;\s*if \(typeof setOnboardingScrollLock === 'function'\) setOnboardingScrollLock\(false\)/);
});

test('goals sheet keeps Back above the modal and closes when navigating away',()=>{
 assert.match(html,/tour-goals-navigation \{ z-index: 400110/);
 assert.match(html,/weekly-goal-hero \{ padding-top: 68px/);
 assert.match(section('  function closeTourBlockingSurfaces','  function resetTourTemporaryTargets'),/window\.closeWeeklyGoalsModal\(\)/);
 const gate=section('    if (step && step.requiresWeeklyGoals)', '  function isVisible');
 assert.match(gate,/if \(gateIsCurrent\(\) && idx === completedStepIndex\) window\.tourNext\(\)/);
});
