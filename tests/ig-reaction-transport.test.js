const test=require('node:test');
const assert=require('node:assert/strict');
const {postGoalReaction}=require('../netlify/functions/_lib/ig-reaction-transport');
const payload={recipient:{id:'recipient'},sender_action:'react',payload:{message_id:'mid',reaction:'love'}};
test('native reaction preserves exact goal target and original transport',async()=>{
 const result=await postGoalReaction({payload,accountId:'owner',token:'private',fetcher:async(url,options)=>{
  assert.equal(url,'https://graph.instagram.com/v25.0/owner/messages');
  assert.deepEqual(JSON.parse(options.body),payload);
  return new Response(JSON.stringify({recipient_id:'recipient'}));
 }});
 assert.equal(result.reaction_transport,'instagram_graph');
});
test('failures never retry through the unsupported Page route',async()=>{
 for(const mode of ['transient','permission','timeout']){
  let calls=0;
  await assert.rejects(postGoalReaction({payload,accountId:'owner',token:'private',fetcher:async()=>{
   calls++;
   if(mode==='timeout')throw Error('timeout');
   return new Response(JSON.stringify({error:{code:mode==='transient'?2:190,is_transient:true}}),{status:mode==='transient'?500:401});
  }}));
  assert.equal(calls,1);
 }
});
