const test=require('node:test'),assert=require('node:assert/strict');
const {enabled,episode,acquire,release}=require('./automatic.cjs');
const {THREAD}=require('./live.cjs');
test('automatic mode selects only the explicitly enabled test thread',()=>{
 assert.equal(enabled({id:THREAD,custom_data:{learn_ai_experiment:{mode:'automatic'}}}),true);
 assert.equal(enabled({id:'customer',custom_data:{learn_ai_experiment:{mode:'automatic'}}}),false);
 assert.equal(enabled({id:THREAD,custom_data:{learn_ai_experiment:{mode:'manual'}}}),false);
});
test('BALANCE resets prior test context while numeric fragments remain in the same episode',()=>{
 const messages=[{direction:'in',text:'old goal'},{direction:'out',text:'old question'},{direction:'in',text:'BALANCE'},{direction:'in',text:'I want to lose weight'},{direction:'in',text:'15 kilos'}];
 assert.deepEqual(episode(messages),messages.slice(2));
});
test('lease acquisition serialises workers and a stale owner cannot unlock the next one',async()=>{
 let row;
 const db=async(route,opts={})=>{
  if(opts.method==='POST'){if(row)throw Error('database_409');row=structuredClone(opts.body);return[row];}
  if(opts.method==='PATCH'){const token=decodeURIComponent(route.split('data->>token=eq.')[1]);if(row.data.token!==token)return[];row={...row,...structuredClone(opts.body)};return[row];}
  return row?[structuredClone(row)]:[];
 };
 const thread={id:THREAD,coach_id:'test'};
 const first=await acquire(thread,db);let waited=false;
 const second=await acquire(thread,db,async()=>{waited=true;await release(first,db);});
 assert.equal(waited,true);assert.notEqual(first.token,second.token);
 await release(first,db);assert.equal(row.data.token,second.token);
 await release(second,db);assert.equal(row.data.token,'');
});
