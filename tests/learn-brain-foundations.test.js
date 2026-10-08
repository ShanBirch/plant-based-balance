const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const curriculum=require('../lib/learn-curriculum'),foundations=require('../lib/learn-brain-foundations');
const read=p=>fs.readFileSync(p,'utf8'),source=read('lib/learning-inline.js');
function data(){
 const window={BalanceBrainFoundations:foundations,BalancePredictiveContent:{apply(){}}};
 vm.runInNewContext(source.slice(0,source.indexOf('    // STATE'))+'window.data={LESSONS,UNITS,GAME_TYPES};})();',{window});
 return window.data;
}
test('new basics are distinct unfinished lessons after the researchers, preserving every existing completion',()=>{
 const window={}; const ctx={window,BALANCE_FOUNDATIONS:{weeks:curriculum.weeks()},getFoundationsLessonIds:()=>curriculum.weeks().flatMap(w=>w.lessonIds)};
 vm.runInNewContext(source.slice(source.indexOf('    function getFoundationsProgress('),source.indexOf('    function trackFoundationsEvent(')),ctx);
 const saved={lessons_completed:['mind-1-1','mind-1-2'],total_lessons_completed:2,total_xp_from_learning:40};
 const before=JSON.stringify(saved),progress=ctx.getFoundationsProgress(saved);
 assert.equal(progress.nextLessonId,'mind-0-5');assert.equal(progress.quizCompleted,2);assert.equal(progress.quizTotal,50);
 assert.equal(JSON.stringify(saved),before);
 assert.deepEqual(progress.weekProgress[0].lessonIds,['mind-1-1',curriculum.experienceIntro,...curriculum.brainBasics]);
 for(const id of [curriculum.experienceIntro,...curriculum.brainBasics]){saved.lessons_completed.push(id);assert.equal(ctx.getFoundationsProgress(saved).quizCompleted,saved.lessons_completed.length);}
 assert.equal(ctx.getFoundationsProgress(saved).nextLessonId,'mind-1-3');
});
test('the 45 original lesson IDs and six original practical actions remain available',()=>{
 const oldIds=curriculum.weeks().flatMap(w=>w.lessonIds).filter(id=>!curriculum.brainBasics.includes(id)&&id!==curriculum.experienceIntro);
 assert.equal(oldIds.length,45);assert.equal(new Set(oldIds).size,45);
 assert.deepEqual(curriculum.weeks('six_v2').map(w=>w.action),[1,2,3,4,5,6]);
 for(const version of ['legacy_six','bridge_eight_v1'])assert.ok(curriculum.weeks(version).every(w=>!w.lessonIds.some(id=>curriculum.brainBasics.includes(id))));
});
test('all new quizzes have eight taught questions with valid feedback and answers',()=>{
 const d=data();
 for(const row of foundations.basics){
  const lesson=d.LESSONS['mind-0'].find(l=>l.id===row.id);
  assert.equal(lesson.games.length,8);assert.equal(new Set(lesson.games.map(g=>g.question)).size,8);
  assert.equal(d.UNITS[lesson.unitId].moduleId,'mind');
  for(const g of lesson.games){assert.ok(g.explanation);if(g.options){assert.ok(g.options[g.correctIndex]);assert.equal(new Set(g.options).size,3);}else assert.equal(typeof g.answer,'boolean');}
  assert.ok(fs.existsSync(lesson.content.image.src));assert.doesNotMatch(lesson.content.intro,/—/);
 }
 assert.match(d.LESSONS['mind-0'].find(l=>l.id==='mind-0-2').content.intro,/action potential/);
 assert.match(d.LESSONS['mind-0'].find(l=>l.id==='mind-0-2').content.intro,/neurotransmitters/);
});
test('every later Learn lesson has vocabulary, a connected example and a practical observation',()=>{
 const all=Object.values(data().LESSONS).flat();
 for(const id of curriculum.weeks().flatMap(w=>w.lessonIds).filter(id=>id!=='mind-1-1'&&!id.startsWith('mind-0-'))){
  const lesson=all.find(l=>l.id===id),before=JSON.stringify(lesson),pages=foundations.support(lesson);
  assert.equal(pages.before.length,2,id);assert.equal(pages.after.length,1,id);
  assert.ok(pages.before.every(p=>p.text.length>60));assert.ok(pages.after[0].text.length>60);
  assert.doesNotMatch(pages.before.map(p=>p.text).concat(pages.after[0].text).join(' '),/—/);
  assert.equal(JSON.stringify(lesson),before);
 }
 assert.deepEqual(foundations.support(all.find(l=>l.id==='mind-1-1')),{before:[],after:[]});
 assert.match(foundations.bridges['mind-7-1'][0],/not calories/);
});
test('personalised nutrition keeps its own examples and diet instructions',()=>{
 const lesson={id:'fuel-5-5',personalised:true,content:{}};
 const pages=foundations.support(lesson);assert.equal(pages.before.length,1);assert.equal(pages.after.length,0);
 assert.doesNotMatch(JSON.stringify(pages),/plant.based|tofu|lentils/);
});
test('the new content uses the existing player and both regular and iOS asset loaders',()=>{
 const html=read('dashboard.html');
 assert.equal((html.match(/learn-brain-foundations.js\?v=4-experience-intro/g)||[]).length,2);
 assert.ok(html.indexOf('learn-brain-foundations.js')<html.indexOf('learning-inline.js?v='));
 assert.match(source,/\.\.\.supportSlides\(support.before\), \.\.\.originalSlides, \.\.\.supportSlides\(support.after\)/);
 assert.match(html,/id:'learn-brain-basics-20261008'/);
 assert.equal((html.match(/title:'Meet your brain first'/g)||[]).length,2);
 assert.doesNotMatch(read('lib/learn-brain-foundations.js'),/innerHTML|<style|style=/);
});
