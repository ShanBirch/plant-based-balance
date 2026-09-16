'use strict';
const live=require('./live.cjs');
const {acquire,release}=require('./automatic.cjs');
const {createPresence}=require('./presence.cjs');
const DELAY_MS=2*60*60*1000;
const TEXT={zoom:'Hey, how did you go with booking in? Need a hand with anything?',preview:'Hey, how did you go with the course page? Need a hand with anything?'};
function reason(job,view,{now=Date.now(),converted=false,booked=false}={}){
 const d=job.data,t=view.thread;
 if(t.id!==live.THREAD||t.learn_ai_settings?.mode!=='automatic'||t.learn_ai_settings.session!==d.session)return 'selection_changed';
 if(t.linked_user_id||['in_app','paying','churned'].includes(t.lead_stage))return 'joined';
 if(String(t.custom_data?.do_not_follow_up).toLowerCase()==='true')return 'do_not_follow_up';
 const inbound=view.messages.findLast(m=>m.direction==='in');
 if(!inbound||inbound.id!==d.inbound_id)return 'new_inbound';
 if(now-Date.parse(inbound.created_at)>=23.5*3600000)return 'messaging_window_closed';
 const last=view.messages.at(-1);
 if(!last||last.id!==d.anchor_id)return 'conversation_changed';
 if(converted)return 'joined_or_purchased';
 if(booked)return 'booked';
 if(now<Date.parse(job.scheduled_for))return 'not_due';
 return null;
}
async function evidence(job,view,db=live.db){
 const d=job.data;
 const conversions=await db(`growth_outcome_events?select=id&ig_thread_id=eq.${live.THREAD}&event_type=in.(app_joined,subscription_started,meta_app_preview_onboarding_started,meta_app_preview_onboarding_completed,meta_app_preview_trial_purchase_claimed,meta_app_preview_trial_subscription_claimed)&occurred_at=gte.${encodeURIComponent(d.link_sent_at)}&limit=1`);
 const bookings=await db(`balance_bookings?select=id&metadata->>ig_thread_id=eq.${live.THREAD}&created_at=gte.${encodeURIComponent(d.link_sent_at)}&limit=1`);
 const onboarding=await db(`lp_events?select=id&event_type=in.(onboarding_progress,course_progress)&metadata->>thread_id=eq.${live.THREAD}&metadata->>user_id=not.is.null&created_at=gte.${encodeURIComponent(d.link_sent_at)}&limit=1`);
 return reason(job,view,{converted:conversions.length>0||onboarding.length>0,booked:bookings.length>0});
}
async function enqueue({session,inbound_id,plan},deps={}){
 const db=deps.db||live.db,inspect=deps.inspect||live.inspect;
 const view=await inspect(session),cardIndex=plan.actions.findLastIndex(a=>a.type==='card');
 if(cardIndex<0)return {queued:false};
 const card=view.receipts.find(r=>r.data.inbound_id===inbound_id&&r.data.index===cardIndex&&r.data.outcome==='confirmed');
 const anchor=view.messages.at(-1),inbound=view.messages.findLast(m=>m.direction==='in');
 if(!card||!anchor||anchor.direction!=='out'||inbound?.id!==inbound_id)return {queued:false,reason:'conversation_changed_or_card_unconfirmed'};
 const kind=plan.actions[cardIndex].asset_id;
 if(!TEXT[kind])return {queued:false};
 const id=live.receiptId('followup:'+card.id,0);
 const data={learn_link_followup:true,experiment_thread_id:live.THREAD,session,inbound_id,anchor_id:anchor.id,kind,link_receipt_id:card.id,link_sent_at:card.data.confirmed_at,outcome:'scheduled'};
 const scheduled_for=new Date(Date.parse(card.data.confirmed_at)+DELAY_MS).toISOString();
 const job={id,coach_id:view.thread.coach_id,alert_type:'general_idea',title:'Learn link check-in',status:'scheduled',scheduled_for,data};
 if(Date.parse(scheduled_for)-Date.parse(inbound.created_at)>=23.5*3600000)return {queued:false,reason:'messaging_window_closed'};
 try{await db('coach_alerts',{method:'POST',body:job});}catch(e){if(!/database_409/.test(e.message))throw e;return{queued:false,reason:'already_queued'};}
 // The selected alternative owns this thread's reminders; do not stack the
 // older preview/payment-gate reminders on top of the two-hour link check-in.
 await db(`coach_alerts?data->>ig_thread_id=eq.${live.THREAD}&data->>meta_app_preview_followup=eq.true&status=in.(scheduled,pending)`,{method:'PATCH',body:{status:'canceled'}});
 return {queued:true,id,scheduled_for};
}
async function run(id,{presenceFactory=createPresence}={}){
 if(!/^[0-9a-f-]{36}$/.test(id))throw Error('invalid_job');
 let job=(await live.db(`coach_alerts?id=eq.${id}&select=*`))[0];
 if(!job||job.data?.learn_link_followup!==true||job.data.experiment_thread_id!==live.THREAD||job.status!=='pending')return {skipped:'not_claimed_job'};
 // Independent execution claim protects against retries of background dispatch.
 const claimed=await live.db(`coach_alerts?id=eq.${id}&status=eq.pending&data->>outcome=eq.scheduled`,{method:'PATCH',body:{data:{...job.data,outcome:'running'}}});
 if(!claimed.length)return {skipped:'already_attempted'};
 job=claimed[0];let lock,presence;
 const finish=async(status,outcome)=>{job.data.outcome=outcome;await live.db(`coach_alerts?id=eq.${id}`,{method:'PATCH',body:{status,data:job.data,actioned_at:new Date().toISOString()}});};
 try{
  const thread=(await live.db(`ig_threads?id=eq.${live.THREAD}&select=*`))[0];
  live.assertTestSession(thread,job.data.session);
  lock=await acquire(thread);
  const check=async()=>{
   const view=await live.inspect(job.data.session);
   const stopped=await evidence(job,view);
   if(stopped)throw Error('cancel:'+stopped);
   return view;
  };
  const view=await check();
  const action={type:'text',text:TEXT[job.data.kind],asset_id:''};
  if(!action.text)throw Error('invalid_followup_kind');
  presence=presenceFactory({signal:live.senderActions(view.thread,job.data.session)});
  await presence.start();await presence.before(action);
  const receipt=await live.send({session:job.data.session,inbound_id:job.data.inbound_id,index:0,receipt_namespace:'followup:'+id,plan:{status:'reply',actions:[action]},beforeSend:check,onDelivered:()=>presence.stop()});
  if(receipt.outcome!=='confirmed')throw Error('delivery_not_confirmed');
  job.data.receipt_id=live.receiptId('followup:'+id,0);
  await finish('sent','sent');return {ok:true};
 }catch(e){
  job.data.error=e.message;await finish('canceled',e.message.startsWith('cancel:')?'skipped':'stopped');return{ok:false,error:e.message};
 }finally{
  if(presence){await presence.stop();job.data.presence_events=presence.events;await live.db(`coach_alerts?id=eq.${id}`,{method:'PATCH',body:{data:job.data}}).catch(()=>{});}
  if(lock)await release(lock);
 }
}
module.exports={DELAY_MS,TEXT,reason,evidence,enqueue,run};
