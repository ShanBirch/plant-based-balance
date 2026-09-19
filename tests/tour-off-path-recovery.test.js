const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname, '../dashboard.html'), 'utf8');
const source = html.slice(html.indexOf('  function updateTourRecovery(){'), html.indexOf('  function cancelScheduledTourPosition(){'));

function harness() {
  const classes = new Set();
  const recovery = { hidden:true, style:{} };
  const overlay = { classList:{ contains:x=>classes.has(x), remove:x=>classes.delete(x), toggle:(x,on)=>on?classes.add(x):classes.delete(x) } };
  const c = {
    window:{__balanceGuidedTourActive:true,__balanceGuidedTourShowingIntro:false},
    document:{body:{}, getElementById:id=>id==='guided-tour-overlay'?overlay:recovery},
    activeTourDisplayStep:{sel:'#required-control'}, activeSteps:[{},{}], idx:1,
    tourNavigationBusy:false, tourRecoveryObserver:null, tourRecoveryTimer:0,
    target:null, q:()=>c.target, resolveStepTarget:()=>({target:c.target}), getTourSafeTop:()=>142,
    saved:0, visits:[], saveTourCheckpoint:()=>c.saved++,
    showStep:async i=>c.visits.push(i), setTimeout:fn=>{c.pending=fn;return 1}, clearTimeout:()=>{c.pending=null},
    MutationObserver:class { constructor(fn){c.observeMutation=fn} observe(){} disconnect(){c.disconnected=true} }
  };
  vm.createContext(c);vm.runInContext(source,c);
  return {c,recovery,classes};
}

test('leaving a required control offers recovery, returning naturally restores the guide',()=>{
  const {c,recovery,classes}=harness();
  c.updateTourRecovery();assert.equal(recovery.hidden,false);assert.ok(classes.has('tour-off-path'));
  assert.match(recovery.style.top,/142px/);assert.match(recovery.style.top,/safe-area-inset-top/);
  c.target={};c.updateTourRecovery();assert.equal(recovery.hidden,true);assert.ok(!classes.has('tour-off-path'));
});

test('transitions, intro and inactive tours never display a false recovery prompt',()=>{
  const {c,recovery,classes}=harness();
  for(const flag of ['tourNavigationBusy','intro','inactive','transition']) {
    c.tourNavigationBusy=flag==='tourNavigationBusy';
    c.window.__balanceGuidedTourShowingIntro=flag==='intro';
    c.window.__balanceGuidedTourActive=flag!=='inactive';
    classes.delete('tour-transitioning');if(flag==='transition') classes.add('tour-transitioning');
    c.updateTourRecovery();assert.equal(recovery.hidden,true,flag);
  }
});

test('a closed required control recovers even when its fallback card is visible',()=>{
  const {c,recovery}=harness();
  c.activeTourDisplayStep={sel:'#ingredient',requiresHighlightedClick:true};
  c.resolveStepTarget=()=>({target:{}});
  c.updateTourRecovery();assert.equal(recovery.hidden,false);
});

test('recovery reopens the same step once and does not grant completion',async()=>{
  const {c}=harness();let release;
  c.showStep=async i=>{c.visits.push(i);await new Promise(r=>release=r)};
  const restoring=c.window.returnToFeatureTour();
  await c.window.returnToFeatureTour();assert.deepEqual(c.visits,[1]);
  assert.equal(c.idx,1);assert.equal(c.saved,1);release();await restoring;
  assert.equal(c.tourNavigationBusy,false);assert.ok(c.tourRecoveryObserver);
});

test('observer ignores its own guide writes and disconnects on cleanup',()=>{
  const {c,recovery}=harness();c.startTourRecovery();
  c.observeMutation([{target:{closest:()=>true}}]);assert.equal(c.pending,undefined);
  c.observeMutation([{target:{closest:()=>null}}]);assert.ok(c.pending);c.pending();
  assert.equal(recovery.hidden,false);c.stopTourRecovery();
  assert.equal(c.tourRecoveryObserver,null);assert.equal(c.pending,null);assert.equal(recovery.hidden,true);
});

test('the inline tour scripts still parse',()=>{
  const start = html.indexOf('<script>', html.indexOf('id="guided-tour-recovery"')) + 8;
  new Function(html.slice(start, html.indexOf('</script>', start)));
});
