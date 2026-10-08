const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const curriculum=require('../lib/learn-curriculum');
function runtime(){
 const window={BalanceLearnCurriculum:curriculum,BalancePredictiveContent:{apply(){}}};
 vm.runInNewContext(fs.readFileSync('lib/learn-brain-foundations.js','utf8'),{window});
 vm.runInNewContext(fs.readFileSync('lib/coach-personalised-learn.js','utf8'),{window});
 const source=fs.readFileSync('lib/learning-inline.js','utf8');
 vm.runInNewContext(source.slice(0,source.indexOf('    // STATE'))+'window.lessons=LESSONS;})();',{window});
 return window;
}
test('assigned profile adapts real lesson text and all eight quiz questions without changing originals',()=>{
 const w=runtime();const original=Object.values(w.lessons).flat().find(l=>l.id==='fuel-5-5'),before=JSON.stringify(original);
 assert.equal(w.BalancePersonalisedLearn.lesson(original),original);
 w.currentUser={id:'assigned-member',user_metadata:{balance_learning_profile:'family_lower_carb_v1'}};
 const ids=curriculum.weeks().flatMap(w=>w.lessonIds);
 assert.equal(ids.length,49);
 for(const original of Object.values(w.lessons).flat().filter(l=>ids.includes(l.id))){
  const lesson=w.BalancePersonalisedLearn.lesson(original);
  assert.equal(lesson.id,original.id);
  assert.doesNotMatch(JSON.stringify(lesson),/plant.based|vegan|\bsoy\b|tofu|tempeh/i);
  if(w.BalancePersonalisedLearn.adaptations[lesson.id]){
   assert.equal(lesson.games.length,8);assert.equal(lesson.personalised,true);
   assert.ok(lesson.games.every(g=>g.type==='scenario_story'?Number.isInteger(g.correctIndex)&&g.options[g.correctIndex]:g.type==='swipe_true_false'?typeof g.answer==='boolean':g.options.includes(g.answer)));
  }
 }
 assert.equal(JSON.stringify(original),before);
 assert.match(w.BalancePersonalisedLearn.lesson(original).content.intro,/cook and eat one shared family meal/i);
});
test('switching accounts restores standard content and guests do not receive assignments',()=>{
 const w=runtime(),original=w.lessons['fuel-5'][4];
 w.currentUser={id:'assigned',user_metadata:{balance_learning_profile:'family_lower_carb_v1'}};
 assert.equal(w.BalancePersonalisedLearn.lesson(w.lessons['body-1'][0]),null);
 w.currentUser={id:'another',user_metadata:{}};assert.equal(w.BalancePersonalisedLearn.lesson(original),original);
 w.currentUser={id:'assigned',user_metadata:{balance_learning_profile:'family_lower_carb_v1'}};w.guestMode=true;assert.equal(w.BalancePersonalisedLearn.enabled(),false);
});
test('four-week future course is only an outline and never unlocks private lessons',()=>{
 const w=runtime();const course=w.BalancePersonalisedLearn.catalog();
 assert.equal(course.type,'planned');assert.equal(course.isUnlocked,false);assert.equal(course.progress.completed,0);
 assert.deepEqual(Array.from(w.BalancePersonalisedLearn.menopauseWeeks,w=>w.number),[1,2,3,4]);
 assert.match(course.description,/awaiting clinical review/);
 assert.ok(w.BalancePersonalisedLearn.menopauseWeeks.every(w=>!w.lessons));
});
