const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const progress = require('../js/dashboard/pbb-workout-tour-progress');
const html = fs.readFileSync(require('node:path').join(__dirname,'../dashboard.html'),'utf8');

test('every exercise must be acknowledged, with variable counts and one-exercise sessions', () => {
  for (const count of [1,2,4,7,12]) {
    const p = progress.create(), ids = Array.from({length:count},(_,i)=>'exercise-'+i);
    for (let i=0;i<count;i++) {
      assert.equal(p.sync('day',ids,i).phase,'fields');
      const state = p.acknowledge();
      assert.equal(state.seen,i+1);
      assert.equal(state.complete,i===count-1);
    }
  }
});
test('jumping to last, going backwards and re-entry do not skip unvisited exercises', () => {
  const p=progress.create(), ids=['a','b','c'];
  p.sync('day',ids,2);
  assert.equal(p.acknowledge().direction,'prev');
  assert.equal(p.sync('day',ids,-1).complete,false);
  assert.equal(p.sync('day',ids,0).seen,1);
  p.acknowledge();
  p.sync('day',ids,2);
  assert.equal(p.acknowledge().seen,2);
  assert.equal(p.view().complete,false);
  p.sync('day',ids,1);
  assert.equal(p.acknowledge().complete,true);
});
test('no cards, changed day, added exercise and duplicate names cannot falsely finish', () => {
  const p=progress.create();
  assert.equal(p.sync('day',[],-1).complete,false);
  assert.equal(p.acknowledge().seen,0);
  p.sync('day',['0:squat','1:squat'],0); p.acknowledge();
  assert.equal(p.sync('day',['0:squat','1:squat'],1).complete,false);
  p.acknowledge();
  assert.equal(p.sync('new-day',['0:squat','1:squat'],0).seen,0);
  p.acknowledge();
  assert.equal(p.sync('new-day',['0:squat','1:squat','2:row'],0).seen,0);
});
test('tour integration tracks live card, cleans polling, blocks logging and follows keyboard', () => {
  const body=html.slice(html.indexOf('function armWorkoutExploreGate'),html.indexOf('function armTourGate'));
  assert.match(body,/workout-swipe-active/);
  assert.match(body,/card\.querySelectorAll\('\.workout-set-row'\)/);
  assert.match(body,/target && target\.disabled/);
  assert.match(body,/clearInterval\(interval\)/);
  assert.match(body,/isVisible\(target\)/);
  assert.doesNotMatch(body,/startRestTimer|finishWorkout\(|toggleSetDone|\.value\s*=/);
  assert.match(html,/workoutEducation && target\.closest\('#view-active-workout'\)/);
  assert.match(html,/hideGuideWhileTyping:true, requiresWorkoutExplore:true/);
  assert.match(html,/typeof activeTourGate\.handleNext === 'function' && await activeTourGate\.handleNext\(\)/);
});

test('actual tour gate follows visible fields/arrows, resumes after re-entry and cleans up', async () => {
  const vm=require('node:vm');
  const source=html.slice(html.indexOf('function armWorkoutExploreGate'),html.indexOf('function armTourGate'));
  let active=0, open=true, poll, stopped=false, ui;
  const cards=Array.from({length:3},(_,i)=>{
    const row={visible:true,querySelector:()=>({}),scrollIntoView(){},id:'row-'+i};
    return {dataset:{exerciseName:'Exercise '+i},querySelectorAll:()=>[row],row};
  });
  const arrows={prev:{id:'prev',visible:true,scrollIntoView(){}},next:{id:'next',visible:true,scrollIntoView(){}}};
  const labels={};
  const ctx={
    window:{PBBWorkoutTourProgress:progress,currentWorkoutName:'Day'},
    workoutTourProgress:null,activeTourGate:null,activeTourFallbackTarget:null,
    document:{querySelectorAll:()=>cards,getElementById:id=>(labels[id] ||= {})},
    isVisible:el=>el.visible,
    q:sel=>sel.startsWith('#workout-swipe-') ? arrows[sel.slice('#workout-swipe-'.length)] : !open ? null : sel.endsWith('.workout-set-row') ? cards[active].row : cards[active],
    setTourGateUi:(enabled,message,label)=>{ui={enabled,message,label};},
    scheduleTourPosition(){},setInterval:fn=>{poll=fn;return 1;},clearInterval:()=>{stopped=true;},
    openMetaPreviewStrengthWorkout:async()=>{open=true;return true;}
  };
  vm.runInNewContext(source+';armWorkoutExploreGate({body:"Reps, kg and duration"});',ctx);
  const gate=ctx.activeTourGate;
  assert.equal(gate.getTarget(),cards[0].row);
  await gate.handleNext();
  assert.equal(gate.getTarget(),arrows.next);
  assert.equal(ui.enabled,false);
  active=2;poll();
  assert.equal(gate.getTarget(),cards[2].row);
  await gate.handleNext();
  assert.equal(gate.getTarget(),arrows.prev);
  open=false;poll();
  assert.equal(gate.getTarget(),null);
  assert.equal(ui.label,'Reopen workout');
  await gate.handleNext();
  assert.equal(gate.getTarget(),cards[2].row);
  active=1;poll();
  assert.equal(gate.getTarget(),cards[1].row);
  await gate.handleNext();
  assert.equal(ui.label,'Return to the tour');
  assert.equal(gate.complete,true);
  assert.equal(await gate.handleNext(),false);
  gate.cleanup();
  assert.equal(stopped,true);
  assert.equal(gate.getTarget(),null);
});
