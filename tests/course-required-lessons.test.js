const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
function runtime() {
    const window = {BalanceLessonReflections:{has:()=>true}};
    for (const file of ['balance-curriculum','balance-course-layout','balance-master-course','balance-lead-course']) {
        vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../lib/'+file+'.js'),'utf8'),{window});
    }
    return window;
}
test('all selected core lessons are required, while specialist lessons keep their homes', () => {
    const w=runtime();
    assert.equal(w.BalanceCurriculum.forCourse('specialist').length,131);
    assert.ok(w.BalanceCurriculum.lessons.filter(l=>l.course!=='specialist').every(l=>l.required));
});
test('previously completed Master practice waits for the assigned lesson quizzes', () => {
    const w=runtime(), c=w.BalanceMaster;
    const draft={completedStages:{0:true},quizReflections:{0:'I learned to match muscles to movements.'},answers:{'0-0':0,'0-1':1},reflections:{0:'Quadriceps straighten the knee during a squat.'}};
    const ids=w.BalanceCurriculum.forCourse('master',1).map(l=>l.id);
    w.getCourseLessonCompletions=()=>[];
    assert.equal(c.stageDone(0,draft),false);
    w.getCourseLessonCompletions=()=>ids.slice(1);
    assert.equal(c.stageDone(0,draft),false);
    w.getCourseLessonCompletions=()=>ids;
    assert.equal(c.stageDone(0,draft),true);
    assert.equal(draft.completedStages[0],true);
});
test('Lead requires Connection and Purpose in week one without blocking weeks that have no imported quiz', () => {
    const w=runtime(), c=w.BalanceLead;
    const draft={weeks:{0:{complete:true,answer:1,reflection:'I followed through on a walk we agreed together.'},1:{complete:true,answer:2,reflection:'We agreed to walk together on Tuesday and check in afterwards.'}}};
    assert.equal(c.done(0,draft),false);
    assert.equal(c.done(1,draft),true);
    w.getCourseLessonCompletions=()=>w.BalanceCurriculum.forCourse('lead',1).map(l=>l.id);
    assert.equal(c.done(0,draft),true);
});
