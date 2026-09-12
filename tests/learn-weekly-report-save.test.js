const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../netlify/functions/submit-weekly-checkin.js'),'utf8');
function fixture(journeyWeek=1){
 const records={additional_data:{fitness_diary:{note:'Keep this diary'},weekly_checkins:[{occurrence:'midweek_wednesday',week_start:'2026-09-07',course_learning:'Keep Wednesday'}]}}, alerts=new Map();
 let failRead=false,dropWrite=false;
 const query=async(url,options={})=>{
   if(url.startsWith('client_memory'))return [];
   if(url.startsWith('users'))return [{id:'member',name:'QA'}];
   if(url.startsWith('coach_clients'))return [{coach_id:'coach'}];
   if(url.startsWith('social_journey_progress'))return [{current_week:journeyWeek,week_started_at:'2026-09-09'}];
   if(url.startsWith('daily_checkins')){
     if(options.method){if(!dropWrite)records.additional_data=options.body.additional_data;return [];}
     if(failRead)throw Error('offline');
     return [{id:'checkin',...records}];
   }
   if(url.startsWith('coach_alerts')){
     const row=[...alerts.values()][0];
     if(options.method){Object.assign(row,options.body);return [row];}return [row];
   }
   throw Error('Unexpected query '+url);
 };
 const helpers={SUPABASE_URL:'https://example.test',SUPABASE_SERVICE_KEY:'test-only',supabaseQuery:query,
   insertCoachAlert:async(row,key)=>{if(alerts.has(key))return {alertId:alerts.get(key).id,deduped:true};const saved={...row,id:'alert-'+alerts.size};alerts.set(key,saved);return {alertId:saved.id,deduped:false};},
   loadClientMemory:async()=>null,buildMemoryBlock:()=>'',buildNameUsePolicyBlock:()=>'',callVertexAIModel:async()=> 'Review draft',normalizeGeneratedCoachDraftText:x=>x,stripLeadingGreeting:x=>x,truncate:(s,n)=>s.slice(0,n)};
 class FixedDate extends Date{constructor(...a){super(...(a.length?a:['2026-09-11T08:00:00Z']));}static now(){return new Date('2026-09-11T08:00:00Z').getTime();}}
 const module={exports:{}};
 vm.runInNewContext(source,{module,exports:module.exports,Date:FixedDate,console:{error(){},warn(){}},fetch:async()=>({ok:true,json:async()=>({id:'member'})}),require:p=>p==='./_lib/learn-action-review'?{prepareReport:async(user,input)=>({week:input.week,payload:{report:{answers:input.answers}}}),saveReport:async(user,prepared)=>({id:'action-record',enrollment_id:'enrollment',week:prepared.week,status:'submitted',revision:1})}:p==='crypto'?require('crypto'):p==='../../lib/learn-weekly-actions'?require('../lib/learn-weekly-actions'):helpers});
 const payload={week_start:'2026-09-07',overall:'mixed',win:'Logged lunch',confidence:3,support:'nothing_specific',course_week:1,course_learning:'I noticed I snack just after sitting down.',course_experiment_completed:true};
 return {records,alerts,payload,send:(change={})=>module.exports.handler({httpMethod:'POST',headers:{authorization:'Bearer test'},body:JSON.stringify({...payload,...change})}),fail:()=>{failRead=true},drop:()=>{dropWrite=true}};
}
test('weekly endpoint saves one experiment answer, preserves diary/midweek data and synchronizes coach revisions',async()=>{
 const f=fixture();assert.equal((await f.send()).statusCode,200);
 const saved=f.records.additional_data.weekly_checkin;
 assert.equal(saved.course_week,1);assert.equal(saved.course_experiment_completed,false);
 assert.equal(f.records.additional_data.fitness_diary.note,'Keep this diary');
 assert.equal(f.records.additional_data.weekly_checkins.length,2);
 assert.equal([...f.alerts.values()][0].data.response.course_learning,f.payload.course_learning);
 assert.equal((await f.send({course_learning:'I moved my snack and noticed the pause helped.'})).statusCode,200);
 assert.equal(f.alerts.size,1);
 assert.equal([...f.alerts.values()][0].data.response.course_learning,'I moved my snack and noticed the pause helped.');
});
test('stale weeks and blank confirmed experiments cannot tick; weekly check-in itself remains available',async()=>{
 const f=fixture();assert.equal((await f.send({course_week:2})).statusCode,409);
 assert.equal((await f.send({course_learning:''})).statusCode,200);
 assert.equal((await f.send({course_learning:'',course_experiment_completed:false})).statusCode,200);
});
test('failed read or failed readback never returns saved or creates coach credit',async()=>{
 for(const mode of ['fail','drop']){const f=fixture();f[mode]();assert.equal((await f.send()).statusCode,500);assert.equal(f.alerts.size,0);}
});

test('reporting an earlier action preserves the current course week check-in credit',async()=>{const f=fixture(6);assert.equal((await f.send({course_week:6,learn_action:{week:1,answers:{pattern:'Observed pattern'}}})).statusCode,200);assert.equal(f.records.additional_data.weekly_checkin.course_week,6);assert.equal(f.records.additional_data.weekly_checkin.learn_action.week,1);});
