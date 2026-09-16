'use strict';
// Transport-only test harness. Never selects a conversational stage or rewrites text.
const crypto=require('node:crypto');
const {catalogue,validatePlan}=require('./flow.cjs');
const {buildMetaAppPreviewUrl}=require('../../netlify/functions/_lib/meta-app-preview-ref');
const THREAD='4baea56e-eab4-4887-a732-39b14e983d44';
const ACCOUNT='17841415641641750';
const RECIPIENT='989348707404558';
async function db(route,{method='GET',body}={}) {
 const key=process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SERVICE_KEY;
 const r=await fetch(`${process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL}/rest/v1/${route}`,{method,signal:AbortSignal.timeout(12000),headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json',Prefer:'return=representation'},...(body?{body:JSON.stringify(body)}:{})});
 if(!r.ok)throw Error(`database_${r.status}`);
 const text=await r.text();return text?JSON.parse(text):[];
}
function assertTestSession(thread,session,now=Date.now()) {
 const flag=thread?.custom_data?.learn_ai_experiment;
 if(thread?.id!==THREAD||thread.ig_username!=='goldcoast_ai_solutions'||thread.subscriber_id!==`ig_graph:${ACCOUNT}:${RECIPIENT}`||thread.linked_user_id)throw Error('wrong_test_identity');
 if(thread.custom_data?.codex_ai_opt_out!==true||!flag||flag.session!==session||Date.parse(flag.expires_at)<=now)throw Error('test_session_inactive');
 return flag;
}
function receiptId(inbound,index){const h=crypto.createHash('sha256').update(`learn-ai:${inbound}:${index}`).digest('hex').slice(0,32);return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;}
function graphMessage(action,threadId=THREAD) {
 if(action.type==='text')return {text:action.text};
 const asset=catalogue()[action.asset_id];
 if(action.type==='card'){
  const url=action.asset_id==='preview'?buildMetaAppPreviewUrl(threadId,{flowVariant:'broad_pain'}):asset.url;
  return {attachment:{type:'template',payload:{template_type:'button',text:action.asset_id==='preview'?'Explore Balance Learn and your free preview':'Find a time for your Balance fit call',buttons:[{type:'web_url',url,title:action.asset_id==='preview'?'View course & preview':'Book a fit call'}]}}};
 }
 return {attachment:{type:action.type,payload:{url:asset.url}}};
}
async function inspect(session){
 const thread=(await db(`ig_threads?id=eq.${THREAD}&select=*`))[0];
 const flag=assertTestSession(thread,session);
 const messages=await db(`ig_messages?thread_id=eq.${THREAD}&created_at=gte.${encodeURIComponent(flag.started_at)}&select=id,direction,text,source,alert_id,created_at,manychat_message_id&order=created_at.asc,id.asc&limit=200`);
 return {thread,flag,messages};
}
async function send({session,inbound_id,index,plan}){
 validatePlan(plan);
 if(!Number.isInteger(index)||index<0||index>=plan.actions.length)throw Error('invalid_action_index');
 const {thread,messages}=await inspect(session);
 const latestInbound=[...messages].reverse().find(m=>m.direction==='in');
 if(!latestInbound||latestInbound.id!==inbound_id)throw Error('stale_inbound');
 if(Date.now()-Date.parse(latestInbound.created_at)>24*3600000)throw Error('messaging_window_closed');
 const after=messages.filter(m=>m.direction==='out'&&Date.parse(m.created_at)>=Date.parse(latestInbound.created_at));
 if(after.some(m=>m.source!=='learn_ai_experiment'))throw Error('other_sender_active');
 const id=receiptId(inbound_id,index);
 const existing=(await db(`coach_alerts?id=eq.${id}&select=id,data`))[0];
 if(existing)return {duplicate:true,...existing.data}; // Never repeat an ambiguous send.
 const hash=crypto.createHash('sha256').update(JSON.stringify(plan)).digest('hex');
 if(index>0){const previous=(await db(`coach_alerts?id=eq.${receiptId(inbound_id,index-1)}&select=data`))[0];if(previous?.data?.outcome!=='confirmed'||previous.data.plan_hash!==hash)throw Error('prior_action_not_confirmed');}
 const action=plan.actions[index];
 const data={experiment_thread_id:THREAD,session,inbound_id,index,plan_hash:hash,action,outcome:'attempting'};
 // A unique primary key is the atomic dispatch claim. Dismissed experimental receipts
 // are never eligible for the existing DM scheduler or manager.
 await db('coach_alerts',{method:'POST',body:{id,idempotency_key:`learn-ai:${inbound_id}:${index}`,coach_id:thread.coach_id,alert_type:'learn_ai_experiment_receipt',title:'Learn alternative test receipt',status:'dismissed',data}});
 try {
  // Recheck latest input and ownership immediately before each external action.
  const fresh=await inspect(session);
  const last=[...fresh.messages].reverse().find(m=>m.direction==='in');
  if(last?.id!==inbound_id)throw Error('stale_before_send');
  if(fresh.messages.some(m=>m.direction==='out'&&Date.parse(m.created_at)>=Date.parse(last.created_at)&&m.source!=='learn_ai_experiment'))throw Error('human_takeover');
  let token=process.env.INSTAGRAM_GRAPH_ACCESS_TOKEN||process.env.IG_GRAPH_ACCESS_TOKEN||process.env.META_IG_ACCESS_TOKEN||process.env.INSTAGRAM_ACCESS_TOKEN;
  if(!token)token=(await db('app_private_secrets?select=value&key=eq.instagram_graph_access_token&limit=1'))[0]?.value;
  if(!token)throw Error('transport_unavailable');
  const message=graphMessage(action);
  const r=await fetch(`https://graph.instagram.com/v25.0/${ACCOUNT}/messages`,{method:'POST',signal:AbortSignal.timeout(55000),headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({recipient:{id:RECIPIENT},message})});
  const result=await r.json();
  if(!r.ok||!result.message_id)throw Error(`graph_${r.status}`);
  data.outcome='confirmed';data.message_id=result.message_id;data.confirmed_at=new Date().toISOString();
  await db(`coach_alerts?id=eq.${id}`,{method:'PATCH',body:{status:'dismissed',data,actioned_at:data.confirmed_at}});
  const text=action.type==='text'?action.text:action.type==='card'?`${message.attachment.payload.text} ${message.attachment.payload.buttons[0].url}`:`[${action.type.toUpperCase()}:${catalogue()[action.asset_id].url}]`;
  const already=await db(`ig_messages?thread_id=eq.${THREAD}&manychat_message_id=eq.${encodeURIComponent(result.message_id)}&select=id&limit=1`);
  if(!already.length)await db('ig_messages',{method:'POST',body:{thread_id:THREAD,direction:'out',text,source:'learn_ai_experiment',alert_id:id,manychat_message_id:result.message_id,created_at:data.confirmed_at}});
  else await db(`ig_messages?id=eq.${already[0].id}`,{method:'PATCH',body:{source:'learn_ai_experiment',alert_id:id}});
  return data;
 }catch(e){
  // If provider confirmed delivery, never relabel that as failed or repeat it.
  if(data.outcome!=='confirmed')data.outcome='uncertain';
  data.error=e.message;await db(`coach_alerts?id=eq.${id}`,{method:'PATCH',body:{data}}).catch(()=>{});throw e;
 }
}
module.exports={inspect,send,assertTestSession,receiptId,graphMessage,THREAD};
