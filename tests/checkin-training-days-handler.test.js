const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const training=require('../netlify/functions/_lib/checkin-training-days');
const source=fs.readFileSync(require.resolve('../netlify/functions/submit-weekly-checkin'),'utf8');
const now=new Date('2026-11-13T10:00:00Z');
function fixture({receiptFails=false,saveFails=false}={}) {
 let extra={keep:'preference'}, daily={diary:'keep'},alert=null,writes=0;
 const program={id:'program',is_active:true,updated_at:'v1',weekly_schedule:training.DAYS.map((day,i)=>({day,workout:i===0||i===2||i===4?{type:'inline',name:'Session '+i,exercises:[{name:'Squat'}]}:{type:'rest'}}))};
 const query=async(url,options)=>{
  if(url.startsWith('client_memory'))return [];
  if(url.startsWith('custom_workout_programs'))return [program];
  if(url.startsWith('user_facts')){assert.match(url,/user_id=eq.member/);if(options){if(saveFails)throw Error('Cloud unavailable');writes++;extra=options.body.additional_data;}return [{additional_data:extra}];}
  if(url.startsWith('users'))return [{id:'member',name:'Member'}];
  if(url.startsWith('coach_clients'))return [{coach_id:'coach'}];
  if(url.startsWith('social_journey_progress'))return [];
  if(url.startsWith('daily_checkins')){if(options)daily=options.body.additional_data;return [{id:'daily',additional_data:daily}];}
  if(url.startsWith('coach_alerts'))return receiptFails?[]:[alert];
  throw Error('Unexpected query '+url);
 };
 const helpers={SUPABASE_URL:'https://test.invalid',SUPABASE_SERVICE_KEY:'test',supabaseQuery:query,insertCoachAlert:async(row)=>{alert={...row,id:'receipt'};return {alertId:'receipt'};},loadClientMemory:async()=>null,buildMemoryBlock:()=>'',buildNameUsePolicyBlock:()=>'',callVertexAIModel:async()=> 'Good work',stripLeadingGreeting:s=>s,normalizeGeneratedCoachDraftText:s=>s,truncate:s=>s};
 class FixedDate extends Date{constructor(...args){super(...(args.length?args:[now]));}static now(){return now.getTime();}}
 const mod={exports:{}};vm.runInNewContext(source,{module:mod,exports:mod.exports,Date:FixedDate,console:{warn(){},error(){}},fetch:async(url,options)=>({ok:options.headers.Authorization==='Bearer member-token',json:async()=>({id:'member'})}),require:p=>p==='../../lib/learn-curriculum'?require('../lib/learn-curriculum'):p==='crypto'?require('crypto'):p==='./_lib/checkin-training-days'?{...training,weekKey:()=>training.weekKey(now),load:(q,id)=>training.load(q,id,now)}:p==='./_lib/client-context'?helpers:p==='../../lib/learn-weekly-actions'?{enabled:false,effectiveWeek:()=>1,experiment:()=>null}:{} });
 const plan=training.describe(program,{additional_data:extra},now);
 const payload={week_start:'2026-11-09',overall:'strong',win:'Three sessions',confidence:4,support:'nothing_specific',user_id:'someone-else',training_days:{days:['Tue','Thu','Sat'],week_start:plan.week_start,signature:plan.signature}};
 return {send:(body=payload,token='member-token',method='POST')=>mod.exports.handler({httpMethod:method,headers:{authorization:'Bearer '+token},body:JSON.stringify(body)}),payload,read:()=>({extra,daily,alert,writes})};
}
test('authenticated check-in saves a dated order only for its owner and keeps a coach receipt',async()=>{
 const f=fixture(),response=await f.send();assert.equal(response.statusCode,200,response.body);
 const r=f.read(),body=JSON.parse(response.body);assert.equal(r.extra.keep,'preference');assert.equal(r.daily.diary,'keep');assert.equal(r.writes,1);
 assert.deepEqual(body.training_days.days,['Tue','Thu','Sat']);assert.equal(r.extra.weekly_workout_day_orders['2026-11-16'].order.join(','),'1,0,3,2,5,4,6');
 assert.equal(r.alert.client_id,'member');assert.match(r.alert.data.activity_snapshot,/Tue, Thu, Sat/);
});
test('authentication, stale selections and missing receipts never mutate the schedule',async()=>{
 const f=fixture();assert.equal((await f.send(f.payload,'bad-token')).statusCode,401);assert.equal(f.read().writes,0);
 assert.equal((await f.send({...f.payload,training_days:{...f.payload.training_days,signature:'old'}})).statusCode,409);assert.equal(f.read().writes,0);
 const failed=fixture({receiptFails:true});assert.equal((await failed.send()).statusCode,500);assert.equal(failed.read().writes,0);
});
test('failed schedule save never returns success; members can retry the check-in',async()=>{
 const f=fixture({saveFails:true});assert.equal((await f.send()).statusCode,500);assert.equal(f.read().writes,0);assert.ok(f.read().alert);
});
test('GET supplies current choices and legacy submissions remain compatible',async()=>{
 const f=fixture(),get=await f.send({},'member-token','GET');assert.equal(get.statusCode,200);assert.deepEqual(JSON.parse(get.body).training_plan.days,['Mon','Wed','Fri']);
 const legacy={...f.payload};delete legacy.training_days;assert.equal((await f.send(legacy)).statusCode,200);assert.equal(f.read().writes,0);
});
