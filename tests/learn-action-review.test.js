const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const actions=require('../lib/learn-weekly-actions');
function fixture(){
 const enrollment={id:'enrollment-a',user_id:'member',active:true,start_date:'2026-08-08'};
 const rows=[];
 const calls=[];
 const query=async(path,options={})=>{
  calls.push({path,options});
  if(path.startsWith('admin_users')||path.startsWith('coach_clients'))return [];
  if(path.startsWith('social_journey_progress'))return [{current_week:6,week_started_at:'2026-09-12'}];
  if(path==='rpc/ensure_learn_action_enrollment')return enrollment;
  if(path.startsWith('learn_action_enrollments'))return [enrollment];
  if(path.startsWith('learn_action_reviews'))return rows;
  if(path.startsWith('user_saved_meals'))return [{id:'own-meal',name:'Tofu bowl',protein_g:30,carbs_g:60,fat_g:15}];
  if(path.startsWith('daily_nutrition'))return [{protein_goal_g:100,carbs_goal_g:250,fat_goal_g:70}];
  throw Error('Unexpected query '+path);
 };
 const module={exports:{}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../netlify/functions/_lib/learn-action-review'),'utf8'),{module,exports:module.exports,Date,Intl,console,require:p=>p.includes('learn-weekly-actions')?actions:{supabaseQuery:query}});
 return {api:module.exports,enrollment,rows,calls};
}
test('each week requires all specific actual-report fields',()=>{
 for(let week=1;week<=6;week++){
  const definition=actions.experiment(week),meal={id:'saved',protein_g:20,carbs_g:40,fat_g:10};
  const answers=Object.fromEntries(definition.fields.map(([key])=>[key,'Recorded evidence']));
  assert.equal(actions.reportComplete(week,answers,meal),true);
  for(const [key] of definition.fields)assert.equal(actions.reportComplete(week,{...answers,[key]:''},meal),false);
 }
 assert.equal(actions.reportComplete(6,{fit:'Fits my day'},null),false);
});
test('reflection and intention fields cannot substitute for an actual report',async()=>{
 const f=fixture();const result=await f.api.prepareReport('member',{enrollment_id:'enrollment-a',week:3,revision:0,reflection_text:'I intend to try it',answers:{}},{occurrence:'weekly'});
 assert.equal(result.payload.complete,false);
 assert.equal(f.calls.some(c=>c.options.method && !c.path.startsWith('rpc/ensure_')),false);
});
test('cross-member and cross-enrollment evidence are rejected',async()=>{
 const f=fixture();
 await assert.rejects(f.api.context('other','member'),/cannot review/);
 await assert.rejects(f.api.prepareReport('member',{enrollment_id:'old-enrollment',week:1,revision:0},{}),/enrollment changed/);
 await assert.rejects(f.api.context('member','member','foreign-enrollment'),/not available/);
});
test('stale revision and future action week cannot overwrite evidence',async()=>{
 const f=fixture();f.rows.push({week:1,revision:2,status:'submitted'});
 await assert.rejects(f.api.prepareReport('member',{enrollment_id:'enrollment-a',week:1,revision:1},{}),/evidence changed/);
 assert.throws(()=>f.api.assertMemberContext({available:true,enrollment:f.enrollment,current_week:1,records:[]},{enrollment_id:'enrollment-a',week:2,revision:0}),/not available/);
});
test('week six links an owned saved meal and saved personal targets, never logs food',async()=>{
 const f=fixture();const input={enrollment_id:'enrollment-a',week:6,revision:0,answers:{fit:'Thirty grams of protein toward my 100 gram target'},meal_id:'own-meal'};
 const prepared=await f.api.prepareReport('member',input,{occurrence:'weekly'});
 assert.equal(prepared.payload.complete,true);assert.equal(prepared.payload.report.meal.id,'own-meal');
 assert.equal(prepared.payload.report.targets.protein_goal_g,100);
 assert.equal(f.calls.some(c=>c.path.startsWith('meal_logs')),false);
 await assert.rejects(f.api.prepareReport('member',{...input,meal_id:'another-members-meal'},{}),/own meal/);
});
test('completed records are preserved on a repeated check-in',async()=>{
 const f=fixture();f.rows.push({week:1,revision:3,status:'completed',id:'saved'});
 const prepared=await f.api.prepareReport('member',{enrollment_id:'enrollment-a',week:1,revision:3},{});
 assert.equal(prepared.alreadyComplete,true);assert.equal((await f.api.saveReport('member',prepared)).id,'saved');
});
test('a member weekly report reaches the normal Your Call queue even without an AI draft',()=>{
 const html=fs.readFileSync(require.resolve('../admin-dashboard.html'),'utf8');
 const start=html.indexOf('function needsYouHasOperatorWork('),end=html.indexOf('function needsYouMatchesView(',start);
 const body=html.slice(start,end),sandbox={NEEDS_YOU_ALERT_TYPES:['weekly_checkin'],DM_ALERT_TYPES:[],dmClientIdsCache:{ids:new Set()}};
 for(const [,name] of body.matchAll(/\b((?:is|needsYou|getAlert)\w+)\(/g))sandbox[name]=()=>false;
 vm.runInNewContext(body,sandbox);
 const row={status:'pending',alert_type:'weekly_checkin',data:{subtype:'client_weekly_checkin_response',needs_you_required:true}};
 assert.equal(sandbox.needsYouHasOperatorWork(row),true);
 assert.equal(sandbox.needsYouHasOperatorWork({...row,status:'sent'}),false);
 assert.equal(sandbox.needsYouHasOperatorWork({...row,data:{subtype:'unrelated'}}),false);
});
