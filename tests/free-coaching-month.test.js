const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { buildFreeCoachingProgram, validateFreeCoachingProgram } = require('../netlify/functions/_lib/free-coaching-program');
const { resolveVideoBackedExercise } = require('../netlify/functions/_lib/exercise-library-search');
const read = file => fs.readFileSync(file, 'utf8');
const schedule = [{weekday:2,time:'16:30'},{weekday:5,time:'17:15'}];

for (const equipment of ['gym','dumbbells','bands','none']) test(`${equipment}: prepared sessions retain the agreed days, times and exact video-backed library exercises`, () => {
    const plan = buildFreeCoachingProgram({equipment,schedule,sessionMinutes:30,movementRestrictions:'none_reported'});
    assert.equal(validateFreeCoachingProgram(plan,{schedule,sessionMinutes:30}),plan);
    assert.deepEqual(plan.weekly_schedule.map(s=>s.day), ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']);
    assert.deepEqual(plan.weekly_schedule.filter(s=>s.workout.type==='inline').map(s=>[s.day,s.time]), [['Tue','16:30'],['Fri','17:15']]);
    for (const entry of plan.weekly_schedule.filter(s=>s.workout.type==='inline')) {
        assert.equal(entry.workout.type, 'inline');
        assert.ok(entry.workout.exercises.length >= 3);
        for (const ex of entry.workout.exercises) {
            assert.equal(resolveVideoBackedExercise(ex.name).videoUrl, ex.video_url);
            assert.ok(ex.sets > 0);
        }
    }
});
test('individual worker adjustments still require exact matching demos, schedule and duration',()=>{
    const input={equipment:'none',schedule,sessionMinutes:30,movementRestrictions:'none_reported'};
    const plan=buildFreeCoachingProgram(input);
    const wrongDemo=JSON.parse(JSON.stringify(plan));wrongDemo.weekly_schedule[1].workout.exercises[0].video_url='https://example.invalid/wrong.mp4';
    assert.throws(()=>validateFreeCoachingProgram(wrongDemo,input),/matching demos/);
    const wrongDay=JSON.parse(JSON.stringify(plan));wrongDay.weekly_schedule.reverse();
    assert.throws(()=>validateFreeCoachingProgram(wrongDay,input),/calendar days/);
    assert.throws(()=>validateFreeCoachingProgram(plan,{...input,sessionMinutes:1}),/time estimate/);
});
test('missing schedule, unknown equipment, restrictions and duplicate days stop preparation', () => {
    const input={equipment:'none',schedule,sessionMinutes:30,movementRestrictions:'none_reported'};
    for (const change of [{equipment:'unknown'},{movementRestrictions:'knee pain'},{schedule:[]},{schedule:[schedule[0],schedule[0]]},{sessionMinutes:0}]) {
        assert.throws(()=>buildFreeCoachingProgram({...input,...change}));
    }
});
function storage() { const data=new Map();return {getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)}; }
async function starter(experience='coached_month_v1', setup={}) {
    const window={currentUser:{id:'member'},sessionStorage:storage(),localStorage:storage(),document:{addEventListener(){},querySelector(){},getElementById(){}}};
    window.fetch=async()=>({ok:true,json:async()=>({starter:{id:'grant',experience,workoutsReady:true,setup:{schedule,equipment:'none',goal:'Get stronger',...setup}}})});
    vm.runInNewContext(read('lib/free-starter.js'),{window});
    await window.BalanceFreeStarter.resolve({user:window.currentUser,access_token:'test'});
    return window;
}
test('new coached grants hide course work and keep Inbox, assigned workouts and meals', async()=>{
    const w=await starter();
    for(const id of ['foundations_intro','learn_weekly_action','balance_journey','fitgotchi_intro','quiz']) assert.equal(w.BalanceFreeStarter.allowsAction({id}),false);
    for(const id of ['coach_message_intro','meal_plan_intro','workout_week_intro']) assert.equal(w.BalanceFreeStarter.allowsAction({id}),true);
    for(const id of ['coach_checkin_intro','shopping_list_intro','nutrition_tracker_intro','feed_intro','weekly_goals_intro']) assert.equal(w.BalanceFreeStarter.allowsAction({id}),false);
    assert.match(w.BalanceFreeStarter.adaptAction({id:'coach_message_intro'}).body,/weekly check-ins/);
    assert.equal(w.BalanceFreeStarter.canStartWorkout(),true);
    w.currentUser={id:'other'};
    assert.equal(w.BalanceFreeStarter.coached(),false);
});
test('older starter grants retain course access and their original support promise', async()=>{
    const w=await starter('legacy_starter');
    assert.equal(w.BalanceFreeStarter.coached(),false);
    assert.equal(w.BalanceFreeStarter.allowsAction({id:'foundations_intro'}),true);
    assert.match(w.BalanceFreeStarter.adaptAction({id:'coach_checkin_intro'}).body,/not included/);
});

test('challenge copy uses four weeks and disclosed optional continuation without changing historical months',async()=>{
    const challenge=await starter('coached_month_v1',{challengeIntakeId:'consistency_20261025'});
    assert.match(challenge.BalanceFreeStarter.welcomeCopy(),/four weeks/);
    assert.match(challenge.BalanceFreeStarter.welcomeCopy(),/\$14\.99\/week only if you choose it/);
    assert.match(challenge.BalanceFreeStarter.welcomeCopy(),/No automatic billing/);
    assert.doesNotMatch(challenge.BalanceFreeStarter.welcomeCopy(),/first month/);
    assert.match((await starter()).BalanceFreeStarter.welcomeCopy(),/first month/);
    challenge.currentUser={id:'other'};
    assert.doesNotMatch(challenge.BalanceFreeStarter.welcomeCopy(),/four weeks/);
});
test('coached forward, back and resumed wizard paths skip all workout-building slides',()=>{
    const source=read('js/dashboard/dashboard-script-5-initialize_stripe_for_inapp_pu.js');
    const start=source.indexOf('function isWizardSlideSkipped('),end=source.indexOf('// Wizard-specific validation',start);
    const context={window:{BalanceFreeStarter:{coached:()=>true}},normalizeGenderValue:x=>x,selectedGender:'female',isTransferredWizardClient:()=>false,wizardAssignedProgram:null,skippedWizardSlides:[2,5,8,9,10,11,12,13,14,15,16,17,18],currentWizardStep:3,finalWizardStep:19};
    vm.runInNewContext(source.slice(start,end),context);
    for(const step of [3,4,5,6,7]) assert.equal(context.isWizardSlideSkipped(step),true);
    for(const step of [1,19]) assert.equal(context.isWizardSlideSkipped(step),false);
    context.normalizeWizardStep();assert.equal(context.currentWizardStep,19);
});
test('coached app tour has no lesson, feed-post, workout completion or Weekly Goals gate',()=>{
    const source=read('dashboard.html'),start=source.indexOf('  function requiredOnboardingTourSteps()'),end=source.indexOf('\n  steps.push',start);
    const context={window:{BalanceFreeStarter:{coached:()=>true}}};
    vm.runInNewContext(source.slice(start,end),context);
    const steps=context.requiredOnboardingTourSteps();
    assert.equal(steps.length,3);
    assert.ok(steps.every(step=>step.tab!=='learning'&&!step.requiresWeeklyGoals&&!step.requiresFeedPost&&!step.requiresFoundationsLesson));
});
