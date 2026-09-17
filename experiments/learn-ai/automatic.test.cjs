const test=require('node:test'),assert=require('node:assert/strict');
const {enabled,episode,acquire,release}=require('./automatic.cjs');
const {THREAD}=require('./live.cjs');
test('automatic mode selects only the explicitly enabled test thread',()=>{
 assert.equal(enabled({id:THREAD,custom_data:{learn_ai_experiment:{mode:'automatic'}}}),true);
 assert.equal(enabled({id:'customer',custom_data:{learn_ai_experiment:{mode:'automatic'}}}),false);
 assert.equal(enabled({id:THREAD,custom_data:{learn_ai_experiment:{mode:'manual'}}}),false);
 assert.equal(enabled({id:THREAD,learn_ai_settings:{mode:'automatic'},custom_data:{}}),true);
 assert.equal(enabled({id:'customer',learn_ai_settings:{mode:'automatic'},custom_data:{}}),false);
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

test('automatic delivery waits for media, retries before sending and does not send twice',async()=>{
 const live=require('./live.cjs'),{run}=require('./automatic.cjs');
 const originals={db:live.db,inspect:live.inspect,send:live.send,senderActions:live.senderActions};
 const rows=new Map();let ready=false,sends=0,modelInput;
 const thread={id:THREAD,coach_id:'coach',ig_username:'goldcoast_ai_solutions',subscriber_id:'ig_graph:17841415641641750:989348707404558',learn_ai_settings:{mode:'automatic',session:'qa'},custom_data:{}};
 const messages=[{id:'voice',direction:'in',text:'[AUDIO:https://test.invalid/note]',manychat_message_id:'ig_graph:voice'}];
 try {
 live.inspect=async()=>({thread,messages,receipts:[]});live.senderActions=()=>async()=>({ok:true});
 live.db=async(route,options={})=>{
  if(route.startsWith('coach_alerts?data->>ig_thread_id'))return[];
  if(options.method==='POST'){if(rows.has(options.body.id))throw Error('database_409');rows.set(options.body.id,structuredClone(options.body));return[options.body];}
  const id=route.match(/id=eq\.([^&]+)/)?.[1],row=rows.get(id);if(!row)return[];
  const token=route.match(/data->>token=eq\.([^&]*)/)?.[1];if(token!==undefined&&row.data.token!==decodeURIComponent(token))return[];
  if(route.includes('outcome=eq.media_wait')&&row.data.outcome!=='media_wait')return[];
  if(options.method==='PATCH')Object.assign(row,structuredClone(options.body));return[structuredClone(row)];
 };
 live.send=async()=>{sends++;return{outcome:'confirmed'};};
 const deps={presenceFactory:()=>({events:[],start:async()=>{},before:async()=>({}),delivered:async()=>{},stop:async()=>{}}),prepareMedia:async(_messages,options)=>{
  assert.equal(options.payload.durableMediaIds[0],'saved-media');
  if(!ready)throw Object.assign(Error('pending transcript'),{code:'media_wait'});
  return{messages:[{...messages[0],text:'I prefer Zoom please'}],context:[{message_id:'voice',text:'I prefer Zoom please',complete:true}]};
 },decideImpl:async input=>{modelInput=input;return{plan:{status:'reply',actions:[{type:'text',text:'Yep, we can do that.',asset_id:''}]}};}};
 const payload={durableMediaIds:['saved-media']};
 await assert.rejects(run(thread,'voice',payload,deps),/pending transcript/);assert.equal(sends,0);
 ready=true;assert.equal((await run(thread,'voice',payload,deps)).ok,true);assert.equal(sends,1);assert.deepEqual(modelInput.inbound,['I prefer Zoom please']);
 assert.equal((await run(thread,'voice',payload,deps)).skipped,'turn_already_attempted');assert.equal(sends,1);
 // Real reaction-only turns must drain typing before the heart is dispatched;
 // a heart followed by text must retain typing for the actual reply.
 for(const actions of [
  [{type:'reaction',text:'',asset_id:'love'}],
  [{type:'reaction',text:'',asset_id:'love'},{type:'text',text:'Awesome, keep me in the loop',asset_id:''}],
  [],
 ]){
  rows.clear();const events=[];let stopped=false;
  const presence={events:[],start:async()=>{events.push('start');},before:async()=>({}),delivered:async next=>{if(next&&!stopped)events.push('refresh');},stop:async()=>{stopped=true;events.push('stop');}};
  live.send=async({index,onDelivered})=>{events.push('send:'+actions[index].type);await onDelivered();return{outcome:'confirmed'};};
  await run(thread,'voice',payload,{...deps,presenceFactory:()=>presence,decideImpl:async()=>({plan:{status:actions.length?'reply':'pause',actions}})});
  if(actions.length===1){assert.ok(events.indexOf('stop')<events.indexOf('send:reaction'));assert.equal(events.includes('refresh'),false);}
  if(actions.length===2){assert.ok(events.indexOf('stop')>events.indexOf('send:text'));assert.ok(events.includes('refresh'));}
  if(!actions.length)assert.ok(events.includes('stop'));
 }
 }finally{Object.assign(live,originals);}
});

test('ordinary blocker phrases never erase an already supplied goal',()=>{
 const first=[{direction:'in',text:'I want to get stronger'},{direction:'out',text:'What gets in the way?'}];
 for(const text of ['I keep starting over','I struggle to stay consistent','How does Balance work?'])assert.equal(episode([...first,{direction:'in',text}]).length,3);
});
test('a quick inbound arriving during an AI send stays unanswered',()=>{
 const {unanswered}=require('./automatic.cjs');
 const messages=[{id:'first',direction:'in',text:'Strength'},{id:'second',direction:'in',text:'At home please'},{id:'sent',direction:'out',text:'This is Gen',source:'learn_ai_experiment'}];
 const receipts=[{data:{inbound_id:'first',outcome:'confirmed',action:{type:'text'}}}];
 assert.deepEqual(unanswered(messages,receipts).map(m=>m.id),['second']);
 assert.deepEqual(unanswered([...messages,{id:'manual',direction:'out',source:'human'}],receipts),[]);
 assert.deepEqual(unanswered(messages,[...receipts,{data:{inbound_id:'second',outcome:'complete'}}]),[]);
});
