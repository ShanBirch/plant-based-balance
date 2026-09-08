const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const progress = require('../js/dashboard/pbb-workout-tour-progress');
const html = fs.readFileSync(require('node:path').join(__dirname,'../dashboard.html'),'utf8');

test('required onboarding actually includes field guidance between exercise card and Feed', () => {
  const start=html.indexOf('const REQUIRED_ONBOARDING_TOUR_TITLES');
  const sequence=html.slice(start,html.indexOf('];',start));
  assert.match(sequence, /'Follow the exercise card',\s*'Each row is one set',\s*'Your reps go here',\s*'The Balance community'/);
});

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

test('sets and reps are separate Next-only explanations without the external progress gate', () => {
  const steps = ['Each row is one set','Your reps go here'].map(title => {
    const line = html.split('\n').find(line=>line.includes("title:'"+title+"'"));
    return new Function('return ('+line.trim().replace(/,$/,'')+')')();
  });
  assert.match(steps[0].sel, /workout-set-row$/);
  assert.match(steps[1].sel, /\.input-reps$/);
  for (const step of steps) {
    assert.equal(step.requiresWorkoutExplore, undefined);
    assert.equal(step.requiresHighlightedClick, undefined);
    assert.equal(step.hideGuideWhileTyping, undefined);
    assert.equal(step.spotlightExplanation, true);
    assert.equal(step.preserveSurface, true);
  }
  assert.equal(steps[0].nextLabel, 'Next: reps');
  assert.equal(steps[1].returnHomeAfter, true);
  assert.doesNotMatch(html, /PBBWorkoutTourProgress|armWorkoutExploreGate|requiresWorkoutExplore/);
});

test('preview picks the first strength session even when today is later in the week', () => {
  const source=html.slice(html.indexOf('function getMetaPreviewStrengthDayIndex'),html.indexOf('function isTourElementVisible'));
  const select=new Function('window','getStoredOnboardingWorkoutCalendar',source+';return getMetaPreviewStrengthDayIndex();');
  assert.equal(select({userProfile:{}},()=>({monday:'strength-1',tuesday:'rest',wednesday:'strength-2'})),0);
  assert.equal(select({userProfile:{}},()=>({monday:'yoga-1',tuesday:'recovery-1',friday:'strength-3'})),4);
});

test('scroll correction uses the actual nested scroll container', () => {
  const source=html.slice(html.indexOf('function scrollTourTargetBy'),html.indexOf('function positionBubbleAndSpotlight'));
  let actual;
  const parent={scrollHeight:1200,clientHeight:700,scrollBy:options=>{actual=options.top;}};
  const scroll=new Function('window',source+';return scrollTourTargetBy;')({getComputedStyle:()=>({overflowY:'auto'}),scrollBy(){throw Error('must scroll nested view');}});
  scroll({parentElement:parent},95);
  assert.equal(actual,95);
});
