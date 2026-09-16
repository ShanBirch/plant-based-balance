const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const curriculum=require('../lib/learn-curriculum'),actions=require('../lib/learn-weekly-actions');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
function runtime(version='eight_v1',week=1){
 const c={console,Date,Intl,URLSearchParams,setTimeout(){},document:{getElementById:()=>null},localStorage:{getItem:()=>null},sessionStorage:{getItem:()=>null},location:{hostname:'test',search:''},currentUser:{id:'member'}};c.window=c;
 for(const file of ['learn-curriculum','learn-weekly-actions','learn-predictive-content','balance-curriculum','balance-course-layout'])vm.runInNewContext(read('lib/'+file+'.js'),c);
 let source=read('js/dashboard/pbb-social-journey.js');
 vm.runInNewContext(source.slice(0,source.indexOf('  window.finishBalanceActivationLesson'))+`window.socialJourney={getLearnCurriculum,getLearnWeekCount:learnCount,getFoundationsCourseProgress};window.journeyTest={set:r=>{state=normalizeState(r)},definitions:()=>WEEK_DEFINITIONS,identity:getIdentityCourseProgress,roll:rollForwardElapsedWeeks};})();`,c);
 c.journeyTest.set({current_week:week,week_started_at:'2026-09-14',settings:{learn_curriculum:version},lessons_completed:[]});
 source=read('lib/learning-inline.js');
 // Execute the real data definitions and progress functions without unrelated app boot.
 vm.runInNewContext(source.slice(0,source.indexOf('    // STATE'))+`window.lessonData=LESSONS;})();`,c);
 return c;
}
test('all 40 Mind lessons are owned by Learn or Become in the new and continuation paths',()=>{
 for(const version of ['six_v2','eight_v1','bridge_eight_v1']){
  const c=runtime(version);const brain=c.BalanceCurriculum.lessons.filter(l=>l.id.startsWith('mind-'));
  assert.equal(brain.length,40);assert.equal(brain.filter(l=>l.course==='learn').length,35);assert.equal(brain.filter(l=>l.course==='become').length,5);
  const ids=curriculum.weeks(version).flatMap(w=>w.lessonIds);assert.equal(ids.length,45);assert.equal(new Set(ids).size,45);
  for(const id of ids)assert.ok(Object.values(c.lessonData).flat().find(l=>l.id===id),id);
 }
});
test('Arunima keeps her first 25 lesson completions and expected nutrition week six',()=>{
 const old=curriculum.original,bridge=curriculum.weeks('bridge_eight_v1');
 for(let i=0;i<6;i++)assert.deepEqual(bridge[i].lessonIds,old[i].lessonIds);
 const completed=old.slice(0,5).flatMap(w=>w.lessonIds);
 assert.equal(bridge.slice(0,5).flatMap(w=>w.lessonIds).filter(id=>completed.includes(id)).length,25);
 assert.equal(bridge[5].lessonIds[0],'fuel-1-2');
 assert.deepEqual(bridge[6].lessonIds,['mind-3-1','mind-3-2','mind-3-3','mind-3-4','mind-3-5','mind-7-1','mind-7-2','mind-7-3','mind-7-4','mind-7-5']);
 assert.equal(bridge[7].title,'What actually is learning?');
});
test('Learn has eight real action weeks; Become starts at journey week nine',()=>{
 const c=runtime('bridge_eight_v1',8),defs=c.journeyTest.definitions();
 assert.equal(defs.length,14);assert.equal(defs[6].phase,'BALANCE LEARN · WEEK 7');assert.equal(defs[7].tasks.find(t=>t.type==='learn_experiment').label,'Record a model update');
 assert.equal(c.journeyTest.identity().isUnlocked,false);
 c.journeyTest.set({current_week:9,settings:{learn_curriculum:'bridge_eight_v1'}});
 assert.equal(c.journeyTest.identity().isUnlocked,true);assert.equal(c.journeyTest.identity().weekProgress[0].journeyWeek,9);
 c.journeyTest.set({current_week:14,settings:{learn_curriculum:'eight_v1'}});assert.equal(c.journeyTest.identity().currentJourneyWeek,14);
});
test('existing Become members keep their six-week Learn path and Become calendar',()=>{
 const c=runtime('legacy_six',7);assert.equal(c.journeyTest.definitions().length,12);assert.equal(c.journeyTest.identity().weekProgress[0].journeyWeek,7);assert.equal(c.journeyTest.identity().isUnlocked,true);
});
test('nutrition evidence follows the curriculum; week eight learning never demands a meal',()=>{
 assert.equal(actions.experiment(8,'eight_v1').requiresMeal,true);assert.equal(actions.experiment(6,'bridge_eight_v1').requiresMeal,true);
 for(const [week,version] of [[5,'eight_v1'],[8,'bridge_eight_v1']]){
  const def=actions.experiment(week,version);assert.equal(def.requiresMeal,false);
  const answers=Object.fromEntries(def.fields.map(([key])=>[key,'Specific reported evidence']));
  assert.equal(actions.reportComplete(week,answers,null,version),true);
  delete answers.update;assert.equal(actions.reportComplete(week,answers,null,version),false);
 }
 assert.equal(actions.reportComplete(8,{fit:'Fits my day'},null,'eight_v1'),false);
});
test('revised quizzes only test what their lesson teaches and reject absolute claims',()=>{
 const c=runtime();for(const unit of ['mind-3','mind-7','mind-8'])for(const lesson of c.lessonData[unit]){
  assert.ok(lesson.content.intro.length>450);assert.equal(lesson.games.length,6);
  for(const game of lesson.games)if(game.options)assert.ok(game.options[game.correctIndex]);
  assert.doesNotMatch(lesson.content.intro,/the only thing your brain ever does|predicts the entire universe as fact|all disagreement is caused by saving glucose/);
 }
 assert.match(c.lessonData['mind-8'][0].content.intro,/parameters/);
 assert.match(c.lessonData['mind-8'][1].content.intro,/learning rate/);
 assert.match(c.lessonData['mind-7'][3].content.intro,/epistemic value/);
});
test('all inline dashboard scripts parse after both regular and iOS loader changes',()=>{
 for(const match of read('dashboard.html').replace(/<!--[\s\S]*?-->/g,'').matchAll(/^ *<script\b([^>]*)>([\s\S]*?)<\/script>/gmi)){
  if(/type=["'](?:application\/ld\+json|importmap|text\/x-pbb-template)/.test(match[1])||!match[2].trim())continue;
  assert.doesNotThrow(()=>new vm.Script(match[2]));
 }
 const html=read('dashboard.html');assert.equal((html.match(/learn-curriculum\.js\?v=2-six-weeks/g)||[]).length,2);
 assert.equal((html.match(/learn-predictive-content\.js\?v=3-six-question-quizzes/g)||[]).length,2);
});

test('every Learn path has six to eight questions with valid answers and distinct prompts',()=>{
 const c=runtime(), all=Object.values(c.lessonData).flat();
 for(const version of ['six_v2','eight_v1','bridge_eight_v1','legacy_six']){
  for(const id of curriculum.weeks(version).flatMap(w=>w.lessonIds)){
   const lesson=all.find(l=>l.id===id);
   assert.ok(lesson.games.length>=6 && lesson.games.length<=8,`${id}: ${lesson.games.length}`);
   if(lesson.games.length!==6)continue;
   const prompts=lesson.games.map(g=>g.question);
   assert.equal(new Set(prompts).size,prompts.length,`Duplicate prompt in ${id}`);
   for(const g of lesson.games){
    assert.ok(g.explanation?.trim(),`${id}: missing feedback`);
    if(g.options){assert.ok(Number.isInteger(g.correctIndex));assert.ok(g.options[g.correctIndex]);assert.equal(new Set(g.options).size,g.options.length);}
    else assert.equal(typeof g.answer,'boolean');
   }
  }
 }
 const six=curriculum.weeks().flatMap(w=>w.lessonIds).map(id=>all.find(l=>l.id===id));
 assert.equal(six.filter(l=>l.games.length===6).length,22);
 assert.equal(six.filter(l=>l.games.length===7).length,1);
 assert.equal(six.filter(l=>l.games.length===8).length,22);
});

test('six-week default includes all extra learning with one original practical action per week',()=>{
 assert.equal(curriculum.version({}), 'six_v2');assert.equal(curriculum.total(),6);
 const weeks=curriculum.weeks();assert.deepEqual(weeks.map(w=>w.lessonIds.length),[10,10,10,5,5,5]);
 const c=runtime('six_v2',6);assert.equal(c.journeyTest.definitions().length,12);
 for(let i=0;i<6;i++){
  assert.ok(curriculum.original[i].lessonIds.every(id=>weeks[i].lessonIds.includes(id)));
  const action=actions.experiment(i+1,'six_v2');assert.ok(weeks[i].lessonIds.includes(action.lessonId));
  assert.deepEqual(action.fields,actions.experiment(i+1,'legacy_six').fields);
  const tasks=c.journeyTest.definitions()[i].tasks;assert.equal(tasks.length,5);assert.equal(tasks.filter(t=>t.type==='learn_experiment').length,1);
 }
 assert.ok(weeks[0].lessonIds.includes('mind-3-5'));assert.ok(weeks[1].lessonIds.includes('mind-7-5'));assert.ok(weeks[2].lessonIds.includes('mind-8-5'));
 assert.equal(actions.experiment(6,'six_v2').requiresMeal,true);
 c.journeyTest.set({current_week:7,settings:{learn_curriculum:'six_v2'}});assert.equal(c.journeyTest.identity().isUnlocked,true);
});
