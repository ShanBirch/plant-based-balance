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
// Digests independently verified against the audit and bc3a149a^ lesson definitions.
const originalLessonHashes = {
  "mind-1-2": "3ad422f879176ad31d7c69b56294b30374b291b3edb02d5e7285657ccf9ab2ca",
  "mind-1-3": "faf40a500dab26e62d4205cedc8907c8d7e234cd130c1856595d6d011b4e1437",
  "mind-3-1": "231b32f79e894384d620a2cc14d4324bbee9cbe6af7c3b1fd510a52773e1310e",
  "mind-3-2": "a9e5b376cbc130fc73e22691c47c6f2b147b6367af577758935b8f07cb40e1bb",
  "mind-3-3": "f98ac56f74d7b470faf41c9af9331fcdd25f7598ce1919e462144768d5671e80",
  "mind-3-4": "feb4acf3ae1cc522fdecefc2511988b5a43e07a5510a4c611db40b9706aa8c54",
  "mind-3-5": "91c906d6fa4b5eb75f577d03f2b489599208e8106a85f88f4dc957d4c010b973",
  "mind-4-2": "6fd701103b438f5a3f79ca1ba825589080fe8304898a634f2fa02a0eea13a63c",
  "mind-4-5": "858266b3bcca1c038f1a9f467c36e7b198e135d0e42d5fb091c504b690a70e7e",
  "mind-6-1": "66ca91296801d03095a6db7159e7a7cfdd8cac298b0f931e0bde97d2f34d07e3",
  "mind-6-2": "ee04e7e6efd021bca0c0b08b316eeb0593cedc90a70168533f47d0b96f45d1a8",
  "mind-7-1": "c6a57e49ef50148b96a4daf13f81d43c5b01a33dcd5acb195408886d09848786",
  "mind-7-2": "8f0c3545411af773b3d978b156c3fa44fc09ce35744d1a0173ce780b33c93d48",
  "mind-7-3": "01955c922c8016b3c40c70332ad0008515440e8252f9c2b1ec59c6e35912e213",
  "mind-7-4": "48369e0f8e683acfc7a646977e74b39352e05c5daa568d7ad5d3d4c62cd179c4",
  "mind-7-5": "755438cd6ffcdbd806869c9f31cc5bfea8e2f5e09a99f143d0896438f882c92a",
  "mind-8-1": "b72cd139e6da505c7868321e769f58d6bdd715f2403c351e8c1e7b31de3820f1",
  "mind-8-2": "3afe3ab4d2fa00efdbbc902cedd27155f42ae93b1bbac223b5570be7bc4b0499",
  "mind-8-3": "c6e8b2711c1de46d7d550556c669c78da081569cb47d1065a48bd31bc594983b",
  "mind-8-4": "8f29f8c57d50c8a97fb24df1e6b0abcb199336ac177a5ad53eca899bf1034487",
  "mind-8-5": "a437322ed4aa1aa6ae153fe5434577154e9829052141e0294ba1901870967042"
};
test('21 restored lessons exactly preserve original titles, explanations, eight questions and answer mappings',()=>{
 const c=runtime(), crypto=require('node:crypto');
 for(const [id,hash] of Object.entries(originalLessonHashes)){
  const lesson=Object.values(c.lessonData).flat().find(l=>l.id===id);
  assert.equal(lesson.games.length,8,id);
  assert.equal(crypto.createHash('sha256').update(JSON.stringify(lesson)).digest('hex'),hash,id);
  assert.equal(c.BalanceCurriculum.lessons.find(l=>l.id===id).title,lesson.title,id+' catalog title');
 }
});

test('all inline dashboard scripts parse after both regular and iOS loader changes',()=>{
 for(const match of read('dashboard.html').replace(/<!--[\s\S]*?-->/g,'').matchAll(/^ *<script\b([^>]*)>([\s\S]*?)<\/script>/gmi)){
  if(/type=["'](?:application\/ld\+json|importmap|text\/x-pbb-template)/.test(match[1])||!match[2].trim())continue;
  assert.doesNotThrow(()=>new vm.Script(match[2]));
 }
 const html=read('dashboard.html');assert.equal((html.match(/learn-curriculum\.js\?v=2-six-weeks/g)||[]).length,2);
 assert.equal((html.match(/learn-predictive-content\.js\?v=6-original-restored/g)||[]).length,2);
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
 assert.equal(six.filter(l=>l.games.length===6).length,1);
 assert.equal(six.filter(l=>l.games.length===7).length,1);
 assert.equal(six.filter(l=>l.games.length===8).length,43);
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


test('approved social explanation and six questions remain byte-for-byte unchanged',()=>{
 const lesson=runtime().lessonData['mind-6'].find(l=>l.id==='mind-6-5');
 assert.equal(require('node:crypto').createHash('sha256').update(JSON.stringify(lesson)).digest('hex'),'26da50116faf350d2411a4acb96b1640f87f0831df620e3d8544e7b2ef247031');
});
