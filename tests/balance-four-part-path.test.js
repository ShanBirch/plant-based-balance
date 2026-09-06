const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
function load(file, window = {}) { vm.runInNewContext(fs.readFileSync(path.join(root, file), 'utf8'), { window }); return window; }
test('only selected lessons move and every original lesson retains one home', () => {
    const catalog = load('lib/balance-curriculum.js').BalanceCurriculum;
    assert.equal(catalog.lessons.length, 203);
    assert.equal(new Set(catalog.lessons.map(l => l.id)).size, 203);
    assert.equal(catalog.forCourse('learn').length, 30);
    assert.equal(catalog.forCourse('master').length, 36);
    assert.equal(catalog.forCourse('specialist').length, 131);
    assert.ok(catalog.lessons.filter(l => l.unit.startsWith('growth-') || l.unit.startsWith('hormones-')).every(l => l.course === 'specialist'));
    const source = fs.readFileSync(path.join(root, 'lib/learning-inline.js'), 'utf8');
    for (const row of catalog.lessons) assert.ok(source.includes(`id: '${row.id}'`), row.id);
});
test('weekly releases occur at seven-day boundaries and stop at week ten', () => {
    const c = load('lib/balance-course-weeks.js').BalanceCourseWeeks;
    const start='2026-09-07T00:00:00Z', t=Date.parse(start), week=7*86400000;
    assert.equal(c.available(null,10,t),0);
    assert.equal(c.available(start,10,t),1);
    assert.equal(c.available(start,10,t+week-1),1);
    assert.equal(c.available(start,10,t+week),2);
    assert.equal(c.available(start,10,t+9*week),10);
    assert.equal(c.available(start,10,t+50*week),10);
});
test('six-stage Master drafts migrate without losing workouts, meals or completion', () => {
    const c=load('lib/balance-master-course.js').BalanceMaster;
    const original={answers:{'2-0':1,'4-1':2},reflections:{3:'Meal reflection',5:'Review'},completedStages:{2:true,4:true},workout:{goal:'Strength'},meal:{needs:'Vegan'}};
    const result=c.migrate(original);
    assert.equal(result.answers['4-0'],1);assert.equal(result.answers['8-1'],2);
    assert.equal(result.reflections[6],'Meal reflection');assert.equal(result.reflections[9],'Review');
    assert.equal(result.completedStages[4],true);assert.equal(result.completedStages[8],true);
    assert.equal(result.workout,original.workout);assert.equal(result.meal,original.meal);
    assert.equal(c.migrate(result),result);
});
test('Lead completion requires its own answer and practical reflection', () => {
    const c=load('lib/balance-lead-course.js').BalanceLead;
    assert.equal(c.weeks.length,6);
    assert.equal(c.done(0,{weeks:{0:{complete:true,answer:0,reflection:'I will follow through on an agreed walk.'}}}),false);
    assert.equal(c.done(0,{weeks:{0:{complete:true,answer:1,reflection:'Done'}}}),false);
    assert.equal(c.done(0,{weeks:{0:{complete:true,answer:1,reflection:'I will follow through on an agreed walk.'}}}),true);
});
test('course library retains seven specialist courses and moved lessons still resolve by ID', () => {
    const window=load('lib/balance-curriculum.js');
    const s=fs.readFileSync(path.join(root,'lib/learning-inline.js'),'utf8');
    const extract=name=>{const start=s.indexOf('    function '+name+'(');const end=s.indexOf('\n    function ',start+10);return s.slice(start,end);};
    const box={window};
    const declarations=s.slice(s.indexOf('    const GAME_TYPES ='),s.indexOf('    const LESSON_SURPRISE_FACTS ='));
    vm.runInNewContext(declarations+`
        const getModulesSorted=()=>Object.values(MODULES).sort((a,b)=>a.order-b.order);
        const getUnitsForModule=id=>Object.values(UNITS).filter(u=>u.moduleId===id);
        const getFoundationsProgress=()=>({isComplete:true});
        const getIdentityCourseProgress=()=>({isUnlocked:true});
        const isUnitFullyCompleted=()=>false;
    `+['getLessonsForUnit','getLessonById','getModuleCourseProgress','getCoursePath'].map(extract).join('\n')+`
        this.courses=getCoursePath({lessons_completed:[]});
        this.everyMovedLessonResolves=window.BalanceCurriculum.lessons.filter(l=>l.course!=='specialist').every(l=>!!getLessonById(l.id));
    `,box);
    assert.deepEqual(Array.from(box.courses.slice(0,4),c=>c.title),['Balance Learn','Balance Become','Balance Master','Balance Lead']);
    assert.equal(box.courses.filter(c=>c.type==='module').length,7);
    assert.equal(box.courses.filter(c=>c.type==='module').reduce((n,c)=>n+c.progress.total,0),131);
    assert.equal(box.everyMovedLessonResolves,true);
});
