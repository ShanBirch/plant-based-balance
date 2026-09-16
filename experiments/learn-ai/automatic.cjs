'use strict';
const crypto=require('node:crypto');
const {decide}=require('./flow.cjs');
const live=require('./live.cjs');
const {createPresence}=require('./presence.cjs');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const normalize=id=>String(id||'').replace(/^ig_graph:/,'');
function enabled(thread){return thread?.id===live.THREAD&&(thread.learn_ai_settings||thread?.custom_data?.learn_ai_experiment)?.mode==='automatic';}
function episode(messages){
 let start=0;
 // Only the explicit test restart keyword resets context. An ordinary answer
 // such as "I keep starting over" must retain the goal and previous question.
 for(let i=0;i<messages.length;i++)if(messages[i].direction==='in'&&/^balance[.!?\s]*$/i.test(messages[i].text.trim()))start=i;
 return messages.slice(start);
}
function unanswered(messages,receipts=[]){
 let handled=-1;
 for(const receipt of receipts){
  const data=receipt.data||{};
  if((data.action&&data.outcome==='confirmed')||data.outcome==='complete')handled=Math.max(handled,messages.findIndex(m=>m.id===data.inbound_id));
 }
 for(let i=0;i<messages.length;i++)if(messages[i].direction==='out'&&messages[i].source!=='learn_ai_experiment')handled=Math.max(handled,i);
 return messages.slice(handled+1).filter(m=>m.direction==='in');
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
async function run(thread,sourceMessageId,payload={}, {decideImpl=decide,presenceFactory=createPresence,prepareMedia=require('./media.cjs').prepare}={}){
 const session=(thread.learn_ai_settings||thread.custom_data.learn_ai_experiment).session;
 live.assertTestSession(thread,session);
 const lock=await acquire(thread);
 let claim,presence;
 try{
  const view=await live.inspect(session),messages=episode(view.messages);
  const newest=messages.findLast(m=>m.direction==='in');
  if(!newest||normalize(newest.manychat_message_id)!==normalize(sourceMessageId))return{skipped:'newer_inbound'};
  const pending=unanswered(messages,view.receipts);
  if(!pending.length)return{skipped:'already_answered'};
  const id=live.receiptId('automatic-turn:'+newest.id,0);
  const previous=(await live.db(`coach_alerts?id=eq.${id}&select=id,data`))[0];
  if(previous&&previous.data?.outcome!=='media_wait')return{skipped:'turn_already_attempted'};
  claim={id,data:{session,inbound_id:newest.id,experiment_thread_id:live.THREAD,outcome:'generating',started_at:new Date().toISOString()}};
  if(previous){
   const reclaimed=await live.db(`coach_alerts?id=eq.${id}&data->>outcome=eq.media_wait`,{method:'PATCH',body:{data:claim.data}});
   if(!reclaimed.length)return{skipped:'turn_already_attempted'};
  }else await live.db('coach_alerts',{method:'POST',body:{id,idempotency_key:`learn-auto-turn:${newest.id}`,coach_id:thread.coach_id,alert_type:'general_idea',title:'Learn automatic test turn',status:'dismissed',data:claim.data}});
  let renewedAt=Date.now();
  presence=presenceFactory({signal:live.senderActions(view.thread,session),onHeartbeat:async()=>{
   if(Date.now()-renewedAt<30000)return;
   const held=await live.db(`coach_alerts?id=eq.${lock.id}&data->>token=eq.${lock.token}`,{method:'PATCH',body:{data:{token:lock.token,until:Date.now()+240000}}});
   if(!held.length)throw Error('delivery_ownership_lost');
   renewedAt=Date.now();
  }});
  await presence.start();
  const prepared=await prepareMedia(messages,{payload,receipts:view.receipts,pendingIds:pending.map(m=>m.id)});
  claim.data.media_context=prepared.context;
  const receipts=view.receipts.map(r=>r.data).filter(r=>r.action&&messages.some(m=>m.id===r.inbound_id)).map(r=>({action:r.action,status:r.outcome==='confirmed'?'sent':'not_confirmed'}));
  const firstPending=messages.indexOf(pending[0]);
  const safety=require('./handoff.cjs');
  const pendingSafety=safety.pending(view.receipts);
  const result=await decideImpl({model:'gpt-5.4',history:prepared.messages.slice(0,firstPending).map(m=>({direction:m.direction,text:m.text})),inbound:prepared.messages.slice(firstPending).filter(m=>m.direction==='in').map(m=>m.text),receipts,pendingSafety});
  if(result.plan.status==='needs_human'&&!pendingSafety)claim.data.handoff_id=await safety.queue({thread:view.thread,session,inbound_id:newest.id,plan:result.plan,media_context:prepared.context});
  Object.assign(claim.data,result,{outcome:'sending'});
  await live.db(`coach_alerts?id=eq.${id}`,{method:'PATCH',body:{data:claim.data}});
  for(let index=0;index<result.plan.actions.length;index++){
   const pacing=await presence.before(result.plan.actions[index]);
   (claim.data.delivery_pacing??=[]).push({index,...pacing});
   const owner=(await live.db(`coach_alerts?id=eq.${lock.id}&select=data`))[0];
   if(owner?.data?.token!==lock.token||owner.data.until<Date.now())throw Error('delivery_ownership_lost');
   const hasNext=index<result.plan.actions.length-1;
   const receipt=await live.send({session,inbound_id:newest.id,index,plan:result.plan,onDelivered:async()=>{
    await presence.delivered(hasNext);
    if(!hasNext)await presence.stop();
   }});
   if(receipt.outcome!=='confirmed')throw Error('automatic_delivery_not_confirmed');
  }
  Object.assign(claim.data,{outcome:'complete',completed_at:new Date().toISOString()});
  if(result.plan.actions.some(a=>a.type==='card')){
   try{claim.data.followup=await require('./followup.cjs').enqueue({session,inbound_id:newest.id,plan:result.plan});}
   catch(e){claim.data.followup_error=e.message;}
  }
  await live.db(`coach_alerts?id=eq.${id}`,{method:'PATCH',body:{data:claim.data}});
  return{ok:true,actions:result.plan.actions.length};
 }catch(e){
  if(claim){Object.assign(claim.data,{outcome:e.code==='media_wait'?'media_wait':'stopped',error:e.message});await live.db(`coach_alerts?id=eq.${claim.id}`,{method:'PATCH',body:{data:claim.data}}).catch(()=>{});}
  throw e;
 }finally{
  if(presence){
   await presence.stop();
   claim.data.presence_events=presence.events;
   await live.db(`coach_alerts?id=eq.${claim.id}`,{method:'PATCH',body:{data:claim.data}}).catch(()=>{});
  }
  await release(lock);
  // Existing webhook shells are transport bookkeeping, not a second responder.
  await live.db(`coach_alerts?data->>ig_thread_id=eq.${live.THREAD}&data->>manychat_message_id=eq.${encodeURIComponent(sourceMessageId)}&status=eq.pending`,{method:'PATCH',body:{status:'canceled'}}).catch(()=>{});
 }
}
module.exports={enabled,episode,unanswered,acquire,release,run};
