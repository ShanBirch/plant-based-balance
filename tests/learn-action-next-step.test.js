const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname,'../js/dashboard/pbb-next-obvious-steps.js'),'utf8');
const definitions = require('../lib/learn-weekly-actions.js');
function fixture() {
  const review = {state:{available:true,current_week:1},row:null,record(){return this.row},complete:r=>['completed','legacy_completed'].includes(r?.status),status(){return this.row?.status || 'Planned / not started'}};
  const c = {window:{BalanceLearnActionReview:review,BalanceLearnWeeklyActions:definitions},ACTIONS:[{id:'learn_weekly_action',priority:985}]};
  vm.runInNewContext(source.slice(source.indexOf('  function getLearnCourseAction()'),source.indexOf('  function getFitGotchiCourseAction()')),c);
  return {c,review};
}
test('each current Learn week has its own named Home action independent of the lesson queue',()=>{
  const {c,review}=fixture();
  for(let week=1;week<=6;week++){review.state.current_week=week;const a=c.getLearnCourseAction();assert.equal(a.week,week);assert.equal(a.taskId,`w${week}_experiment`);assert.ok(a.title.includes(definitions.experiment(week).title));assert.equal(a.cta,'View weekly action');}
});
test('saved plans leave Home while later reports and reviews stay in check-in',()=>{
  const {c,review}=fixture();
  for(let week=1;week<=6;week++){
    review.state.current_week=week;
    for(const reflection_text of ['', '  ']){review.row={status:'planned',reflection_text};assert.ok(c.getLearnCourseAction());}
    review.row={status:'planned',reflection_text:'My saved plan'};assert.equal(c.getLearnCourseAction(),null);
    for(const status of ['submitted','needs_information','completed','legacy_completed']){review.row={status};assert.equal(c.getLearnCourseAction(),null);}
  }
});
test('no action leaks into unavailable, future, preview or unloaded accounts',()=>{
  const {c,review}=fixture();review.state.current_week=7;assert.equal(c.getLearnCourseAction(),null);review.state.current_week=1;review.state.available=false;assert.equal(c.getLearnCourseAction(),null);review.state.available=true;c.window.metaAdTrialMode=true;assert.equal(c.getLearnCourseAction(),null);c.window.metaAdTrialMode=false;review.state=null;assert.equal(c.getLearnCourseAction(),null);
});
test('Home avoids a duplicate course queue item and routes to the current saved action',()=>{
  assert.ok(source.includes('/^w\\d+_experiment$/.test(journeyAction.taskId)'));
  assert.match(source,/addUniqueAction\(picked, learnAction\)/);
  assert.match(source,/if \(current\) window\.BalanceLearnActionReview\.open\(current\.week\)/);
  assert.match(source,/pbbLearnActionReviewUpdated/);
});

test('the daily list cannot reintroduce a saved plan through the course queue',()=>{
  const {c,review}=fixture();
  let journeyAction={taskId:'w1_experiment'};
  Object.assign(c,{getBalanceJourneyAction:()=>journeyAction,getImportedActivityAction:()=>null,addUniqueAction:()=>{}});
  const start=source.indexOf('  function dailyActionSet(');
  vm.runInNewContext(source.slice(start,source.indexOf('    var onboardingEligible',start))+'return {learnAction,journeyAction};}',c);
  assert.ok(c.dailyActionSet([]).learnAction);
  assert.equal(c.dailyActionSet([]).journeyAction,null);
  review.row={status:'planned',reflection_text:'Saved observation'};
  assert.equal(c.dailyActionSet([]).learnAction,null);
  assert.equal(c.dailyActionSet([]).journeyAction,null);
  journeyAction={taskId:'w1_checkin'};
  assert.equal(c.dailyActionSet([]).journeyAction,journeyAction);
});
