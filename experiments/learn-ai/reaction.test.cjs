const test=require('node:test');
const assert=require('node:assert/strict');
const {validatePlan}=require('./flow.cjs');
const {graphRequest,send,THREAD}=require('./live.cjs');
const reaction={type:'reaction',text:'',asset_id:'love'};
test('native reaction uses the verified inbound Graph id, not an emoji message',()=>{
 assert.deepEqual(graphRequest(reaction,{direction:'in',manychat_message_id:'ig_graph:verified-mid'}),{recipient:{id:'989348707404558'},sender_action:'react',payload:{message_id:'verified-mid',reaction:'love'}});
 assert.throws(()=>graphRequest(reaction,{direction:'out',manychat_message_id:'outbound'}),/reaction_target_unavailable/);
 assert.throws(()=>graphRequest(reaction,{direction:'in'}),/reaction_target_unavailable/);
});
test('reaction plans cannot carry text, unknown reactions, duplicates or crisis acknowledgements',()=>{
 assert.doesNotThrow(()=>validatePlan({status:'reply',actions:[reaction]}));
 for(const action of [{...reaction,text:'thanks'},{...reaction,asset_id:'random'}])assert.throws(()=>validatePlan({status:'reply',actions:[action]}),/invalid_reaction_action/);
 assert.throws(()=>validatePlan({status:'reply',actions:[reaction,reaction]}),/duplicate_reaction/);
 assert.throws(()=>validatePlan({status:'needs_human',actions:[reaction]}),/invalid_reaction_action/);
});
test('reaction delivery confirms recipient-only response, records target, creates no fake outbound and never resends',async()=>{
 const originalFetch=global.fetch,originalUrl=process.env.SUPABASE_URL;
 process.env.SUPABASE_URL='https://db.test';
 const receipts=[],requests=[],writes=[];
 const thread={id:THREAD,ig_username:'goldcoast_ai_solutions',subscriber_id:'ig_graph:17841415641641750:989348707404558',learn_ai_settings:{session:'test',mode:'automatic',started_at:'2026-01-01'}};
 const inbound={id:'inbound',direction:'in',text:'Thanks!',manychat_message_id:'ig_graph:verified-mid',created_at:new Date().toISOString()};
 global.fetch=async(url,options={})=>{
  const body=options.body?JSON.parse(options.body):null;
  if(url.startsWith('https://graph.instagram.com/')){requests.push(body);return new Response(JSON.stringify({recipient_id:'989348707404558'}));}
  const route=new URL(url).pathname.split('/').at(-1),query=new URL(url).searchParams;
  if(options.method==='POST'||options.method==='PATCH')writes.push({route,body});
  let result=[];
  if(route==='ig_threads')result=[thread];
  if(route==='ig_messages')result=[inbound];
  if(route==='app_private_secrets')result=[{value:'test-token'}];
  if(route==='coach_alerts'){
   if(options.method==='POST'){receipts.push(body);result=[body];}
   else if(options.method==='PATCH'){const item=receipts.find(r=>r.id===query.get('id')?.slice(3));Object.assign(item,body);result=[item];}
   else result=query.has('id')?receipts.filter(r=>r.id===query.get('id').slice(3)):receipts;
  }
  return new Response(JSON.stringify(result));
 };
 try{
  const args={session:'test',inbound_id:'inbound',index:0,plan:{status:'reply',actions:[reaction]}};
  const result=await send(args);
  assert.equal(result.outcome,'confirmed');assert.equal(result.reacted_to_message_id,'verified-mid');assert.equal(result.message_id,undefined);
  assert.equal((await send(args)).duplicate,true);assert.equal(requests.length,1);
  assert.equal(writes.some(w=>w.route==='ig_messages'),false);
 }finally{global.fetch=originalFetch;if(originalUrl===undefined)delete process.env.SUPABASE_URL;else process.env.SUPABASE_URL=originalUrl;}
});
