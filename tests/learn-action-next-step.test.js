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
test('saved and submitted reflections stay visible until evidence review confirms completion',()=>{
  const {c,review}=fixture();
  for(const status of ['planned','submitted','needs_information']){review.row={status};assert.ok(c.getLearnCourseAction());}
  for(const status of ['completed','legacy_completed']){review.row={status};assert.equal(c.getLearnCourseAction(),null);}
});
test('no action leaks into unavailable, future, preview or unloaded accounts',()=>{
  const {c,review}=fixture();review.state.current_week=7;assert.equal(c.getLearnCourseAction(),null);review.state.current_week=1;review.state.available=false;assert.equal(c.getLearnCourseAction(),null);review.state.available=true;c.window.metaAdTrialMode=true;assert.equal(c.getLearnCourseAction(),null);c.window.metaAdTrialMode=false;review.state=null;assert.equal(c.getLearnCourseAction(),null);
});
test('Home avoids a duplicate course queue item and routes to the current saved action',()=>{
  assert.match(source,/journeyAction\.taskId === learnAction\.taskId\) journeyAction = null/);
  assert.match(source,/addUniqueAction\(picked, learnAction\)/);
  assert.match(source,/if \(current\) window\.BalanceLearnActionReview\.open\(current\.week\)/);
  assert.match(source,/pbbLearnActionReviewUpdated/);
});
