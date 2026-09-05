const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'lib/balance-master-course.js'), 'utf8');
function runtime(window = {}) { vm.runInNewContext(source, { window }); return window.BalanceMaster; }
test('all course stages have teaching, applied checks, and real existing lesson references', () => {
    const course = runtime();
    const learning = fs.readFileSync(path.join(root, 'lib/learning-inline.js'), 'utf8');
    assert.equal(course.stages.length, 6);
    for (const stage of course.stages) {
        assert.equal(stage.lessons.length, 3);
        assert.equal(stage.questions.length, 2);
        for (const q of stage.questions) assert.ok(q[1][q[2]]);
        for (const [id] of stage.refs) assert.ok(learning.includes(`id: '${id}'`), id);
    }
});
test('a meal project requires exactly seven usable days and preparation details', () => {
    const c = runtime();
    const meal = { needs:'No allergies', shopping:'Tofu 1kg, rice 1kg', prep:'Shop Sunday', backup:'Beans on toast', days:Array.from({length:7}, () => ({breakfast:'Oats 50g with soy milk 200ml',lunch:'Tofu 150g with rice 1 cup',dinner:'Lentils 1 cup with potato 200g'})) };
    assert.equal(c.mealValid(meal),true);
    assert.equal(c.mealValid({...meal,days:meal.days.slice(0,6)}),false);
    assert.equal(c.mealValid({...meal,shopping:''}),false);
    const missing=structuredClone(meal);missing.days[6].dinner='';assert.equal(c.mealValid(missing),false);
});
test('workout projects require owned saved workouts and per-exercise prescriptions', () => {
    const c = runtime();
    const templates=[{id:'owned',template_data:{exercises:['Squat','Row']}}];
    const p={sets:'2',reps:'10',rest:'60',effort:'2 reps left'};
    const w={goal:'Strength',constraints:'Two days with recovery',coverage:'Push, pull and legs',progression:'Add load after reaching the top of the range',days:['owned','rest','rest','owned','rest','rest','rest'],prescriptions:{owned:{0:{...p,exercise:'Squat'},1:{...p,exercise:'Row'}}}};
    assert.equal(c.workoutValid(w,templates),true);
    assert.equal(c.workoutValid(w,[]),false);
    assert.equal(c.workoutValid({...w,days:Array(7).fill('rest')},templates),false);
    assert.equal(c.workoutValid({...w,prescriptions:{}},templates),false);
    const changed=structuredClone(templates);changed[0].template_data.exercises[0]='Press';assert.equal(c.workoutValid(w,changed),false);
    const fractional=structuredClone(w);fractional.prescriptions.owned[0].sets='1.5';assert.equal(c.workoutValid(fractional,templates),false);
});
test('reading or saving an incomplete draft does not complete a stage', () => {
    const c=runtime();
    assert.equal(c.stageDone(0,{answers:{},reflections:{0:'Biceps bend the elbow'}}),false);
    assert.equal(c.stageDone(0,{answers:{'0-0':0,'0-1':1},reflections:{0:''}}),false);
    assert.equal(c.stageDone(0,{answers:{'0-0':0,'0-1':1},reflections:{0:'Biceps bend the elbow'}}),false);
    assert.equal(c.stageDone(0,{completedStages:{0:true},answers:{'0-0':0,'0-1':1},reflections:{0:'Biceps bend the elbow'}}),true);
});
test('account changes clear cached progress and failed loads remain retryable', async () => {
    let fail=false;
    const win={currentUser:{id:'first'},supabaseClient:{from(table){const result={data:table==='workouts'?[]:{data:{completedStages:{0:true},answers:{'0-0':0,'0-1':1},reflections:{0:'Biceps bend the elbow'}}},error:fail?{}:null}; const q={select(){return q},eq(){return q},maybeSingle:async()=>result,order:async()=>result};return q;}}};
    const c=runtime(win); await c.load();assert.equal(c.progress().completed,1);
    win.currentUser={id:'second'};assert.equal(c.progress().completed,0);
    fail=true;await assert.rejects(c.load(),/Could not load/);
    fail=false;await c.load();assert.equal(c.progress().completed,1);
});

test('compound stage requires four confirmed receipts and clears them on account switch or failed check', async () => {
    let submissions={}, fail=false;
    const data={completedStages:{1:true},answers:{'1-0':2,'1-1':0},reflections:{1:'Keep a controlled position'}};
    const win={currentUser:{id:'member'},fetch:async()=>({ok:!fail,json:async()=>({submissions,error:'offline'})}),supabaseClient:{auth:{getSession:async()=>({data:{session:{access_token:'token'}}})},from(table){const q={select(){return q},eq(){return q},order:async()=>({data:[]}),maybeSingle:async()=>({data:{data}})};return q;}}};
    const c=runtime(win);
    data.answers['1-1']=c.stages[1].questions[1][2];
    await c.load(); assert.equal(c.stageDone(1,data),false);
    submissions={squat:{id:'1'},hinge:{id:'2'},push:{id:'3'}};
    await c.load(true); assert.equal(c.stageDone(1,data),false);
    submissions.pull={id:'4'};await c.load(true);assert.equal(c.stageDone(1,data),true);
    fail=true;await c.load(true);assert.equal(c.stageDone(1,data),false);
    fail=false;await c.load(true);assert.equal(c.stageDone(1,data),true);
    win.currentUser.id='another';c.progress();assert.equal(c.stageDone(1,data),false);
});
