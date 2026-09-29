const test=require('node:test');
const assert=require('node:assert/strict');
const {postGoalReaction}=require('../netlify/functions/_lib/ig-reaction-transport');
const payload={recipient:{id:'recipient'},sender_action:'react',payload:{message_id:'mid',reaction:'love'}};
const args={payload,accountId:'owner',token:'ig-token',query:async()=>[],env:{FACEBOOK_PAGE_ID:'123',FACEBOOK_PAGE_ACCESS_TOKEN:'page-token'}};
const response=(data,status=200)=>new Response(JSON.stringify(data),{status});
test('explicit transient rejection falls back only through the verified linked Page',async()=>{
 const calls=[];
 const result=await postGoalReaction({...args,fetcher:async(url,options)=>{
  calls.push({url,options});
  if(url.includes('graph.instagram'))return response({error:{code:2,is_transient:true}},500);
  if(url.includes('?fields='))return response({id:'123',instagram_business_account:{id:'owner'}});
  assert.deepEqual(JSON.parse(options.body),payload);assert.equal(options.headers.Authorization,'Bearer page-token');
  return response({recipient_id:'recipient'});
 }});
 assert.equal(result.reaction_transport,'facebook_linked_instagram');assert.equal(calls.length,3);
});
test('timeouts, permission failures and a mismatched Page never trigger a reaction fallback',async()=>{
 for(const mode of ['timeout','permission','mismatch']){
  let writes=0;
  await assert.rejects(postGoalReaction({...args,fetcher:async(url,options)=>{
   if(options.method==='POST')writes++;
   if(url.includes('graph.instagram')){
    if(mode==='timeout')throw Error('timeout');
    return mode==='permission'?response({error:{code:190}},401):response({error:{code:2,is_transient:true}},500);
   }
   return response({id:'123',instagram_business_account:{id:'different-owner'}});
  }}));
  assert.equal(writes,1);
 }
});
