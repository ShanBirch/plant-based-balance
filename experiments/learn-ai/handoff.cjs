'use strict';
const live=require('./live.cjs');
function pending(receipts=[]){return receipts.some(row=>row.status==='pending'&&row.data?.learn_safety_handoff===true);}
async function queue({thread,session,inbound_id,plan,media_context=[]},db=live.db){
 const id=live.receiptId('safety-handoff:'+session+':'+inbound_id,0);
 const row={id,idempotency_key:'learn-safety:'+session+':'+inbound_id,coach_id:thread.coach_id,
  alert_type:'ig_incoming_dm',status:'pending',priority:'high',title:'Urgent safety concern in Learn conversation',
  description:plan.decision_summary,suggested_message:null,
  data:{session,learn_safety_handoff:true,experiment_thread_id:thread.id,ig_thread_id:thread.id,ig_message_id:inbound_id,
   channel:'instagram',operator_queue:'needs_you',needs_you_required:true,needs_you_reason:'immediate_safety_concern',
   needs_shannon_approval:true,client_manager_review_required:true,public_reply_blocked:true,draft_only:true,
   media_context,decision_summary:plan.decision_summary}};
 try{await db('coach_alerts',{method:'POST',body:row});}catch(error){if(!/database_409/.test(error.message))throw error;}
 return id;
}
module.exports={pending,queue};
