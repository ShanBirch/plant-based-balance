const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../js/dashboard/pbb-deferred-weeklygoals.js'), 'utf8');
const save = source.slice(source.indexOf('  window.saveWeeklyGoalsFromModal = async function() {'), source.indexOf('  async function loadAndRender()'));

for (const fails of [false, true]) test(`goal save keeps the tour target until completion (${fails ? 'local fallback' : 'synced'})`, async()=>{
  let release;
  const events=[];
  const button={disabled:false,textContent:'Save My Weekly Goals'};
  const c={
    window:{currentUser:{id:'test'}},
    state:{week:{start:'2026-09-14'},draftSelected:['workouts'],modalSource:'meta_preview_setup'},
    normalizeSelected:x=>x,isFutureWeek:()=>false,buildPendingProgress:()=>[],
    saveWeeklyRowLocal:()=>({}),localStorage:{removeItem(){}},Date,
    renderCard(){},document:{querySelector:()=>button},
    calculateProgress:()=>new Promise(r=>release=r),
    saveWeeklyRow:async()=>{if(fails) throw Error('offline');c.state.lastSaveWasLocalOnly=false;return {}},
    showToastSafe(){},console:{warn(){}},
    emitWeeklyGoalsSaved:()=>events.push('saved'),closeWeeklyGoalsModal:()=>events.push('closed')
  };
  vm.runInNewContext(save,c);
  const pending=c.window.saveWeeklyGoalsFromModal();
  assert.deepEqual(events,[]);assert.equal(button.disabled,true);
  await c.window.saveWeeklyGoalsFromModal(); // duplicate clicks cannot start another save
  release({progress:[],arc:{}});await pending;
  assert.deepEqual(events,['saved','closed']);assert.equal(c.state.saving,false);
  assert.equal(c.state.lastSaveWasLocalOnly,fails);
});
