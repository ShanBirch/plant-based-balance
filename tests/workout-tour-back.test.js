const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const html=require('node:fs').readFileSync(require('node:path').join(__dirname,'../dashboard.html'),'utf8');
const start=html.indexOf('  async function ensureWorkoutTourSurface');
const source=html.slice(start,html.indexOf('async function showStep',start));
test('Back from Home reopens the workout before arming its guide',async()=>{
  let visible=false,opened=0;const calls=[];
  const ctx={q:()=>visible,ensureTab:async tab=>calls.push(tab),openMetaPreviewStrengthWorkout:async()=>{opened++;visible=true;return {};},console};
  vm.runInNewContext(source,ctx);
  assert.equal(await ctx.ensureWorkoutTourSurface({workoutEducation:true}),true);
  assert.deepEqual(calls,['movement-tab']);assert.equal(opened,1);
  assert.equal(await ctx.ensureWorkoutTourSurface({workoutEducation:true}),true);
  assert.equal(opened,1,'already visible workout must not restart');
  assert.equal(await ctx.ensureWorkoutTourSurface({tab:'friends'}),true);
  assert.equal(opened,1);
});
test('failed workout restoration leaves the retry gate rather than a dead tour',async()=>{
  const ctx={q:()=>null,ensureTab:async()=>{},openMetaPreviewStrengthWorkout:async()=>{throw new Error('offline')},console:{warn(){}}};
  vm.runInNewContext(source,ctx);
  assert.equal(await ctx.ensureWorkoutTourSurface({workoutEducation:true}),false);
  assert.match(html,/if \(!workoutSurfaceReady\) throw new Error\('Workout preview is not visible'\)/);
  assert.match(html,/handleNext:async function\(\)\{ await showStep\(i, options\)/);
  assert.doesNotMatch(source,/finishWorkout|saveWorkout|toggleSet|\.value\s*=/);
});
