const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const curriculum=require('../lib/learn-curriculum'),actions=require('../lib/learn-weekly-actions');
const read=f=>fs.readFileSync(f,'utf8'),player=read('lib/learning-inline.js');
function progress(saved){
 const context={window:{socialJourney:{getFoundationsCourseProgress(){throw Error('Retired tasks must not be read');}}},BALANCE_FOUNDATIONS:{weeks:curriculum.weeks()},getFoundationsLessonIds:()=>curriculum.weeks().flatMap(w=>w.lessonIds)};
 vm.runInNewContext(player.slice(player.indexOf('    function getFoundationsProgress('),player.indexOf('    function trackFoundationsEvent(')),context);
 return context.getFoundationsProgress(saved);
}
test('lesson two is new; all 49 existing lessons keep their order across ten weeks',()=>{
 const weeks=curriculum.weeks();assert.equal(curriculum.activeVersion,'ten_v2');
 assert.deepEqual(weeks.map(w=>w.lessonIds.length),[6,4,5,5,5,5,5,5,5,5]);
 assert.equal(weeks[0].lessonIds[1],'mind-0-5');
 assert.deepEqual(weeks.flatMap(w=>w.lessonIds).filter(id=>id!=='mind-0-5'),curriculum.weeks('ten_v1').flatMap(w=>w.lessonIds));
 assert.deepEqual(curriculum.weeks('ten_v1').flatMap(w=>w.lessonIds),curriculum.weeks('six_v2').flatMap(w=>w.lessonIds));
 assert.equal(new Set(weeks.flatMap(w=>w.lessonIds)).size,50);assert.equal(curriculum.actionsEnabled,false);assert.equal(actions.enabled,false);
 assert.ok(weeks.every(w=>w.action===undefined));
 // Historical records retain their original week/action meaning.
 assert.equal(actions.experiment(6,'legacy_six').lessonId,'fuel-5-5');assert.equal(curriculum.total('bridge_eight_v1'),8);
});
test('completed first two lessons survive; archived actions cannot block or inflate Learn completion',()=>{
 const saved={lessons_completed:['mind-1-1','mind-1-2'],total_xp_from_learning:40,total_lessons_completed:2};const before=JSON.stringify(saved),p=progress(saved);
 assert.equal(p.nextLessonId,'mind-0-5');assert.equal(p.currentWeek.number,1);assert.equal(p.quizCompleted,2);assert.equal(p.total,50);assert.equal(p.actionTotal,0);assert.equal(p.includesActions,false);assert.equal(JSON.stringify(saved),before);
 saved.lessons_completed=curriculum.weeks('ten_v1').flatMap(w=>w.lessonIds);assert.equal(progress(saved).nextLessonId,'mind-0-5');assert.equal(progress(saved).quizCompleted,49);
 saved.lessons_completed=curriculum.weeks()[0].lessonIds.concat('mind-1-2');assert.equal(progress(saved).nextLessonId,'mind-1-3');assert.equal(progress(saved).currentWeek.number,2);
 saved.lessons_completed=curriculum.weeks().flatMap(w=>w.lessonIds);assert.equal(progress(saved).percent,100);assert.equal(progress(saved).isComplete,true);
 saved.lessons_completed.pop();assert.equal(progress(saved).isComplete,false);assert.equal(progress(saved).currentWeek.number,10);
});
test('Home cannot surface a saved or unsaved practical Learn task while retired',()=>{
 const source=read('js/dashboard/pbb-next-obvious-steps.js'),context={window:{BalanceLearnCurriculum:curriculum,BalanceLearnActionReview:{get state(){throw Error('Retired state read');}}}};
 vm.runInNewContext(source.slice(source.indexOf('  function getLearnCourseAction()'),source.indexOf('  function getFitGotchiCourseAction()')),context);
 assert.equal(context.getLearnCourseAction(),null);
});
test('retired action UI is quiet and needs no account request; old definitions and records code remain',async()=>{
 const context={window:{currentUser:{id:'member'},BalanceLearnCurriculum:curriculum},fetch(){throw Error('Retired UI made a request');}};
 vm.runInNewContext(read('lib/learn-action-review.js'),context);const api=context.window.BalanceLearnActionReview;
 assert.equal((await api.load()).retired,true);assert.equal(api.form(),'');assert.equal(api.payload({querySelector(){throw Error('Retired payload read');}}),null);await api.open(1);
 assert.ok(actions.experiment(1,'legacy_six').fields.length);assert.match(read('netlify/functions/_lib/learn-action-review.js'),/learn_action_reviews\?select=/);
});
test('stale action submissions are rejected before any enrollment write or automatic review',async()=>{
 const module={exports:{}};let calls=0;
 vm.runInNewContext(read('netlify/functions/learn-action-review.js'),{module,exports:module.exports,fetch:async()=>({ok:true,json:async()=>({id:'member'})}),require:p=>p==='./_lib/learn-action-review'?{actions,context(){calls++;throw Error('Unexpected enrollment write');}}:p==='./_lib/learn-action-ai-review'?{retryPending(){throw Error('Unexpected review');}}:{SUPABASE_URL:'https://example.test',SUPABASE_SERVICE_KEY:'test-only'}});
 const result=await module.exports.handler({httpMethod:'POST',headers:{authorization:'Bearer test'},body:JSON.stringify({operation:'plan',week:1})});assert.equal(result.statusCode,410);assert.equal(JSON.parse(result.body).retired,true);assert.equal(calls,0);
});
test('course display and both app loading paths use ten weeks with retired tasks and the original quiz stylesheet',()=>{
 const html=read('dashboard.html');assert.equal((html.match(/learn-curriculum.js\?v=5-experience-intro/g)||[]).length,2);assert.equal((html.match(/title:'Learn at a steadier pace'/g)||[]).length,2);
 assert.equal((html.match(/learning-inline.js\?v=20261008-experience-intro/g)||[]).length,2);
 assert.match(player,/course !== 'learn' && window.getCourseLessonCompletions/);assert.match(player,/!isFoundationsContext && result\?\.reflection_eligible/);
 assert.match(read('plant-based-fitness.html'),/50 lessons and quizzes/);assert.equal((read('plant-based-fitness.html').match(/<details class="course-week">/g)||[]).length,10);
 assert.equal((html.match(/title:'Your experience, explained'/g)||[]).length,2);
 for(const file of ['dashboard.html','js/dashboard/pbb-next-obvious-steps.js']){assert.match(read(file),/learn-brain-foundations.js\?v=4-experience-intro/);assert.match(read(file),/learning-inline.js\?v=20261008-experience-intro/);}
 assert.match(html,/pbb-quiz-theme.css\?v=5-shared-player/);
});
