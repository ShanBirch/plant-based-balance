'use strict';
const crypto=require('node:crypto');
const {decide}=require('./flow.cjs');
const live=require('./live.cjs');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const normalize=id=>String(id||'').replace(/^ig_graph:/,'');
function enabled(thread){return thread?.id===live.THREAD&&(thread.learn_ai_settings||thread?.custom_data?.learn_ai_experiment)?.mode==='automatic';}
function episode(messages){
 let start=0;
 for(let i=0;i<messages.length;i++)if(messages[i].direction==='in'&&/^(balance|i struggle to stay consistent|i keep starting over|how does balance work)[.!?\s]*$/i.test(messages[i].text.trim()))start=i;
 return messages.slice(start);
}
// One atomic lease per test thread serialises uploads and quick follow-up DMs.
// This controls delivery ownership only; the model owns the conversation.
async function acquire(thread,db=live.db,wait=sleep){
 const id=live.receiptId('automatic-thread:'+thread.id,0),token=crypto.randomUUID();
 const deadline=Date.now()+130000;
 while(Date.now()<deadline){
  const old=(await db(`coach_alerts?id=eq.${id}&select=id,data`))[0];
  if(!old){
   try {await db('coach_alerts',{method:'POST',body:{id,idempotency_key:`learn-auto-lock:${thread.id}`,coach_id:thread.coach_id,alert_type:'general_idea',title:'Learn test delivery ownership',status:'dismissed',data:{token,until:Date.now()+240000}}});return{id,token};}
   catch(e){if(!/database_409/.test(e.message))throw e;}
  }else if(!old.data?.token||old.data.until<Date.now()){
   const prior=old.data?.token||'';
   const rows=await db(`coach_alerts?id=eq.${id}&data->>token=eq.${encodeURIComponent(prior)}`,{method:'PATCH',body:{data:{token,until:Date.now()+240000}}});
   if(rows.length)return{id,token};
  }
  await wait(2000);
 }
 throw Error('automatic_delivery_busy');
}
async function release(lock,db=live.db){await db(`coach_alerts?id=eq.${lock.id}&data->>token=eq.${lock.token}`,{method:'PATCH',body:{data:{token:'',until:0}}});}
async function run(thread,sourceMessageId){
 const session=(thread.learn_ai_settings||thread.custom_data.learn_ai_experiment).session;
 live.assertTestSession(thread,session);
 const lock=await acquire(thread);
 let claim;
 try{
  const view=await live.inspect(session),messages=episode(view.messages);
  const newest=messages.findLast(m=>m.direction==='in');
  if(!newest||normalize(newest.manychat_message_id)!==normalize(sourceMessageId))return{skipped:'newer_inbound'};
  const lastOut=messages.findLastIndex(m=>m.direction==='out');
  const pending=messages.slice(lastOut+1).filter(m=>m.direction==='in');
  if(!pending.length)return{skipped:'already_answered'};
  const id=live.receiptId('automatic-turn:'+newest.id,0);
  if((await live.db(`coach_alerts?id=eq.${id}&select=id`)).length)return{skipped:'turn_already_attempted'};
  claim={id,data:{session,inbound_id:newest.id,experiment_thread_id:live.THREAD,outcome:'generating',started_at:new Date().toISOString()}};
  await live.db('coach_alerts',{method:'POST',body:{id,idempotency_key:`learn-auto-turn:${newest.id}`,coach_id:thread.coach_id,alert_type:'general_idea',title:'Learn automatic test turn',status:'dismissed',data:claim.data}});
  const receipts=view.receipts.map(r=>r.data).filter(r=>r.action&&messages.some(m=>m.id===r.inbound_id)).map(r=>({action:r.action,status:r.outcome==='confirmed'?'sent':'not_confirmed'}));
  const result=await decide({model:'gpt-5.4',history:messages.slice(0,messages.indexOf(pending[0])).map(m=>({direction:m.direction,text:m.text})),inbound:pending.map(m=>m.text),receipts});
  Object.assign(claim.data,result,{outcome:'sending'});
  await live.db(`coach_alerts?id=eq.${id}`,{method:'PATCH',body:{data:claim.data}});
  for(let index=0;index<result.plan.actions.length;index++){
   const receipt=await live.send({session,inbound_id:newest.id,index,plan:result.plan});
   if(receipt.outcome!=='confirmed')throw Error('automatic_delivery_not_confirmed');
   if(index<result.plan.actions.length-1)await sleep(1400);
  }
  Object.assign(claim.data,{outcome:'complete',completed_at:new Date().toISOString()});
  await live.db(`coach_alerts?id=eq.${id}`,{method:'PATCH',body:{data:claim.data}});
  return{ok:true,actions:result.plan.actions.length};
 }catch(e){
  if(claim){Object.assign(claim.data,{outcome:'stopped',error:e.message});await live.db(`coach_alerts?id=eq.${claim.id}`,{method:'PATCH',body:{data:claim.data}}).catch(()=>{});}
  throw e;
 }finally{
  await release(lock);
  // Existing webhook shells are transport bookkeeping, not a second responder.
  await live.db(`coach_alerts?data->>ig_thread_id=eq.${live.THREAD}&data->>manychat_message_id=eq.${encodeURIComponent(sourceMessageId)}&status=eq.pending`,{method:'PATCH',body:{status:'canceled'}}).catch(()=>{});
 }
}
module.exports={enabled,episode,acquire,release,run};
