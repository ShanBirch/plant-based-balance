'use strict';
// A lost HTTP response is not evidence that Instagram failed to deliver.
async function deliverActions({call,session,inbound_id,plan,receipts=[],onReceipt=()=>{},onIssue=()=>{},sleep=ms=>new Promise(r=>setTimeout(r,ms))}) {
 for(let index=0;index<plan.actions.length;index++){
  if(receipts.some(r=>r.inbound_id===inbound_id&&r.index===index&&r.outcome==='confirmed'))continue;
  let receipt;
  try{receipt=await call({mode:'send',session,inbound_id,index,plan});}
  catch(e){
   onIssue({index,error:e.message,at:new Date().toISOString()});
   // Read-only reconciliation. Never resubmit an uncertain action.
   for(let attempt=0;attempt<12;attempt++){
    await sleep(5000);
    const view=await call({mode:'status',session});
    const found=view.receipts?.find(r=>r.data?.inbound_id===inbound_id&&r.data.index===index)?.data;
    if(found?.outcome==='confirmed'){receipt=found;break;}
    if(found?.outcome==='uncertain')throw Error(`delivery_uncertain_${index}`);
   }
   if(!receipt)throw Error(`delivery_unconfirmed_${index}`);
  }
  if(receipt?.outcome!=='confirmed')throw Error(`delivery_unconfirmed_${index}`);
  receipts.push(receipt);await onReceipt(receipt);
  if(index<plan.actions.length-1)await sleep(1400);
 }
 return receipts;
}
module.exports={deliverActions};
