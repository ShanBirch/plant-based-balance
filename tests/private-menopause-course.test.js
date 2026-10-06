const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('lib/balance-menopause.js','utf8');
const owner='00a6605e-8edb-4917-85ba-24a23f179059';
function runtime({id=owner,authId=id,fail=false,defer=false}={}) {
 let resolver,callback,reads=0,writes=0;
 const p={weeks:[{number:1,title:'Fixture',lessons:[{id:'menopause-1-1',title:'Private fixture',sources:[],activity:'Fixture'}]}]};
 const rows=[];
 const window={currentUser:{id},supabaseClient:{auth:{getUser:async()=>({data:{user:{id:authId,email:'shannonbirch@cocospersonaltraining.com',email_confirmed_at:'2026-01-01'}}}),onAuthStateChange:f=>{callback=f;}},from(table){let row;const chain={select(){return chain;},eq(){return chain;},upsert(value){writes++;row=value;return chain;},maybeSingle:async()=>{reads++;if(defer)await new Promise(r=>resolver=r);return {data:{payload:p}};},single:async()=>fail?{error:{message:'failure'}}:{data:row},then(resolve){reads++;return Promise.resolve({data:rows}).then(resolve);}};return chain;}}};
 const document={getElementById:()=>null};
 let poll;
 vm.runInNewContext(source,{window,document,setInterval:f=>poll=f});
 return {window,api:window.BalanceMenopause,auth:(event,user)=>callback(event,{user:{id:user}}),release:()=>resolver(),poll:()=>poll(),stats:()=>({reads,writes})};
}
test('verified owner alone loads content; payload stays out of local storage',async()=>{
 const r=runtime();assert.equal(await r.api.load(),true);assert.equal(r.api.lesson('menopause-1-1').title,'Private fixture');assert.equal(r.stats().reads,2);assert.ok(!source.includes('localStorage'));
 const denied=runtime({id:'nonowner'});assert.equal(await denied.api.load(),false);assert.equal(denied.stats().reads,0);assert.equal(denied.api.lesson('menopause-1-1'),null);
 const spoof=runtime({authId:'nonowner'});assert.equal(await spoof.api.load(),false);assert.equal(spoof.stats().reads,0);
});
test('identity change and signout erase private payload and suppress late responses',async()=>{
 const r=runtime();await r.api.load();r.window.currentUser={id:'nonowner'};r.poll();assert.equal(r.api.lesson('menopause-1-1'),null);assert.equal(r.api.valid(),false);
 const signout=runtime();await signout.api.load();signout.auth('SIGNED_OUT');assert.equal(signout.api.valid(),false);
 const delayed=runtime({defer:true});const pending=delayed.api.load();await new Promise(r=>setImmediate(r));delayed.window.currentUser={id:'nonowner'};delayed.api.clear();delayed.release();assert.equal(await pending,false);assert.equal(delayed.api.valid(),false);
});
test('private completions cannot use shared rewards, reflection or quiz pools',()=>{
 const inline=fs.readFileSync('lib/learning-inline.js','utf8');
 const completion=inline.slice(inline.indexOf('async function completeLesson()'),inline.indexOf('async function renderLessonComplete'));
 assert.ok(completion.indexOf('if (lesson?.privateCourse)')<completion.indexOf("rpc('complete_lesson'"));
 assert.match(completion,/await window\.BalanceMenopause\.complete\(lesson\.id, score\);\s+return;/);
 assert.ok(inline.includes('if (!lesson || lesson.privateCourse) return;'));
 assert.ok(inline.includes('filter(module => !module.privateCourse)'));
 assert.ok(!inline.includes('LESSONS[\'menopause'));
 assert.ok(!source.includes("rpc('complete_lesson'"));
 const html=fs.readFileSync('dashboard.html','utf8');assert.ok(html.indexOf('lib/balance-menopause.js')<html.indexOf("s.src = 'lib/learning-inline.js"));
});
