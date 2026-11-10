const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const training = require('../netlify/functions/_lib/checkin-training-days');
const now = new Date('2026-11-13T10:00:00Z');
const program = {id:'p1', is_active:true, updated_at:'v1', weekly_schedule:training.DAYS.map((day,i) => ({day, workout:i%2===0 && i<5 ? {type:'inline', name:'Session '+i, exercises:[{name:'Squat',video:'unchanged'}]} : {type:'rest'}}))};
const facts = {additional_data:{workout_day_order:[0,1,2,3,4,5,6], other:'keep'}};
test('coming week uses Brisbane Monday including the Sunday/Monday boundary', () => {
 assert.equal(training.nextWeek(now),'2026-11-16');
 assert.equal(training.weekKey(new Date('2026-11-15T13:59:00Z')),'2026-11-09');
 assert.equal(training.weekKey(new Date('2026-11-15T14:00:00Z')),'2026-11-16');
});
test('selection preserves every source exactly once, session order and program contents', () => {
 const before = JSON.stringify(program), plan = training.describe(program,facts,now);
 for(let a=0;a<5;a++)for(let b=a+1;b<6;b++)for(let c=b+1;c<7;c++) {
  const chosen = training.selection(plan,{signature:plan.signature,week_start:plan.week_start,days:[training.DAYS[c],training.DAYS[a],training.DAYS[b]]});
  assert.deepEqual(chosen.order.filter((source,index)=>[a,b,c].includes(index)),[0,2,4]);
  assert.deepEqual([...chosen.order].sort(),[0,1,2,3,4,5,6]);
 }
 assert.equal(JSON.stringify(program),before);
});
test('rejects missing, duplicate, extra and forged days, old plan signatures and weeks', () => {
 const plan = training.describe(program,facts,now), input={signature:plan.signature,week_start:plan.week_start,days:['Tue','Thu','Sat']};
 for(const days of [[],['Tue'],['Tue','Tue','Sat'],['Tue','Thu','oops'],['Mon','Tue','Thu','Sat']]) assert.throws(()=>training.selection(plan,{...input,days}));
 assert.throws(()=>training.selection(plan,{...input,signature:'forged'}));
 assert.throws(()=>training.selection(plan,{...input,week_start:'2026-11-09'}));
});
test('fixed coaching appointments cannot move or be overwritten', () => {
 const fixed=structuredClone(program);fixed.weekly_schedule[1].workout={type:'activity',name:'Zoom PT'};
 const plan=training.describe(fixed,facts,now);
 assert.deepEqual(plan.locked_days,['Tue']);
 assert.throws(()=>training.selection(plan,{...plan,days:['Tue','Thu','Sat']}));
 const chosen=training.selection(plan,{...plan,days:['Wed','Thu','Sat']});
 assert.equal(chosen.order[1],1);
});
test('saved next-week choices preselect on reopen; baseline and prior weeks remain unchanged', () => {
 const plan=training.describe(program,facts,now),chosen=training.selection(plan,{...plan,days:['Tue','Thu','Sat']});
 const updated={...facts,additional_data:{...facts.additional_data,weekly_workout_day_orders:{[chosen.week_start]:chosen}}};
 assert.deepEqual(training.describe(program,updated,now).days,['Tue','Thu','Sat']);
 assert.deepEqual(training.describe(program,updated,new Date('2026-11-20T10:00Z')).days,['Mon','Wed','Fri']);
 assert.deepEqual(updated.additional_data.workout_day_order,[0,1,2,3,4,5,6]);
});
test('onboarding calendars work without a custom coach program', () => {
 const plan=training.describe(null,{personal_details:{workout_calendar:JSON.stringify({monday:'home-upper',wednesday:'home-lower',friday:'home-fullbody'})}},now);
 assert.equal(plan.count,3);assert.deepEqual(plan.days,['Mon','Wed','Fri']);
 assert.equal(training.describe(null,{},now).available,false);
});
test('cloud save retries a concurrent update and preserves unrelated preferences', async () => {
 let writes=0, raw={other:'keep',weekly_workout_day_orders:{'2026-11-09':{order:[0,1,2,3,4,5,6]}}};
 const chosen={week_start:'2026-11-16',days:['Tue','Thu','Sat'],order:[1,0,3,2,5,4,6]};
 const query=async (path,options)=>{
  if(!options)return [{additional_data:structuredClone(raw)}];
  assert.match(decodeURIComponent(path),/additional_data=eq./);
  if(++writes===1){raw.concurrent='keep too';return [];}
  raw=options.body.additional_data;return [{additional_data:raw}];
 };
 await training.save(query,'client-id',chosen);
 assert.equal(writes,2);assert.equal(raw.other,'keep');assert.equal(raw.concurrent,'keep too');
 assert.ok(raw.weekly_workout_day_orders['2026-11-09']);assert.deepEqual(raw.weekly_workout_day_orders['2026-11-16'],chosen);
});
test('calendar date lookup isolates weeks, accounts and program revisions', () => {
 const code=fs.readFileSync(require.resolve('../js/dashboard/dashboard-script-5-initialize_stripe_for_inapp_pu.js'),'utf8');
 const begin=code.indexOf('function cacheWeeklyWorkoutDayOrders('),end=code.indexOf('function syncWorkoutDayOrderToCloud(',begin);
 const storage=new Map();
 const ctx={window:{currentUser:{id:'u1'},activeCustomProgramCache:{id:'p1',updated_at:'v1'}},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},userCycleData:{},getLocalDateString:d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-'),getWorkoutDayOrderStorageKey:()=> 'baseline', normalizeWorkoutDayOrder:training.order, getDefaultWorkoutDayOrder:()=>[0,1,2,3,4,5,6], PBB_WORKOUT_DAY_ORDER_STORAGE_KEY:'baseline', Date, console};
 vm.createContext(ctx);vm.runInContext(code.slice(begin,end),ctx);
 const date=new Date(2026,10,17,8),original=date.getTime();
 ctx.cacheWeeklyWorkoutDayOrders({'2026-11-16':{program_id:'p1',program_revision:'v1',order:[1,0,3,2,5,4,6]}});
 assert.deepEqual(ctx.getWorkoutDayOrder(date),[1,0,3,2,5,4,6]);assert.equal(date.getTime(),original);
 assert.deepEqual(Array.from(ctx.getWorkoutDayOrder(new Date(2026,10,10))),[0,1,2,3,4,5,6]);
 ctx.window.currentUser={id:'u2'};assert.equal(ctx.getWeeklyWorkoutDayOrder(date),null);
 ctx.window.currentUser={id:'u1'};ctx.window.activeCustomProgramCache.updated_at='v2';assert.equal(ctx.getWeeklyWorkoutDayOrder(date),null);
});
