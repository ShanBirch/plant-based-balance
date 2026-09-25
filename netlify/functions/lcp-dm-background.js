'use strict';
const crypto=require('crypto');
const {supabaseQuery,callGeminiFallback}=require('./_lib/client-context');
const {OWNER_ID,ORIGIN,classifierPrompt,parseDecision,replyFor,bubbles}=require('./_lib/lcp-dm-knowledge');
const json=(statusCode,data)=>({statusCode,body:JSON.stringify(data)});
const eq=value=>encodeURIComponent(value);

function validSignature(raw,signature,secret){
  if(!secret||!/^sha256=[a-f0-9]{64}$/i.test(signature||''))return false;
  return crypto.timingSafeEqual(Buffer.from(signature.slice(7),'hex'),crypto.createHmac('sha256',secret).update(raw).digest());
}
function inboundEvents(payload,now=Date.now()){
  const events=[];
  for(const entry of payload.entry||[]){
    if(String(entry.id)!==OWNER_ID)continue;
    for(const item of entry.messaging||[]){
      const m=item.message,at=Number(item.timestamp);
      if(!m?.mid||m.is_echo||m.is_deleted||String(item.recipient?.id)!==OWNER_ID||!/^\d+$/.test(String(item.sender?.id))||String(item.sender.id)===OWNER_ID)continue;
      if(!Number.isFinite(at)||at>now+60000||now-at>=86400000)continue;
      const text=String(m.text||'').slice(0,4000);
      events.push({id:m.mid,sender_id:String(item.sender.id),inbound_text:text,received_at:new Date(at).toISOString(),media:!!m.attachments?.length,story:!!m.reply_to?.story});
    }
  }
  return events;
}
async function secret(key){const rows=await supabaseQuery(`app_private_secrets?key=eq.${eq(key)}&select=value&limit=1`);return rows?.[0]?.value||'';}
async function offerNow(){
  const r=await fetch(`${ORIGIN}/offer-config.js`,{signal:AbortSignal.timeout(10000),cache:'no-store'});
  if(!r.ok)throw Error('Shop unavailable');
  const match=(await r.text()).match(/Object\.freeze\((\{[^;]+\})\)/);
  if(!match)throw Error('Shop settings unavailable');
  const offer=JSON.parse(match[1]);
  if(typeof offer.checkoutEnabled!=='boolean'||typeof offer.framedEnabled!=='boolean'||!offer.proofWindow||!offer.fulfilmentWindow||!offer.revisionWindow)throw Error('Incomplete shop settings');
  return offer;
}
async function update(id,data){return supabaseQuery(`lcp_dm_events?id=eq.${eq(id)}`,{method:'PATCH',body:{...data,updated_at:new Date().toISOString()}});}
async function processEvent(inbound,config,existing=false){
  if(!existing){
    const inserted=await supabaseQuery('lcp_dm_events?on_conflict=id',{method:'POST',prefer:'resolution=ignore-duplicates,return=representation',body:{...inbound,status:'queued'}});
    if(!inserted.length)return {status:'duplicate'};
  }
  await supabaseQuery('lcp_dm_conversations?on_conflict=sender_id',{method:'POST',prefer:'resolution=ignore-duplicates,return=representation',body:{sender_id:inbound.sender_id}});
  const lease=crypto.randomUUID();
  const claimed=await supabaseQuery(`lcp_dm_conversations?sender_id=eq.${eq(inbound.sender_id)}&paused=eq.false&or=(lease_until.is.null,lease_until.lt.${eq(new Date().toISOString())})`,{method:'PATCH',body:{lease,lease_until:new Date(Date.now()+120000).toISOString()}});
  if(!claimed.length){
    const current=(await supabaseQuery(`lcp_dm_conversations?sender_id=eq.${eq(inbound.sender_id)}&select=paused`))[0];
    if(current?.paused){await update(inbound.id,{status:'held',reason:'conversation_paused'});return {status:'held'};}
    return {status:'queued'};
  }
  try{
    const history=await supabaseQuery(`lcp_dm_events?sender_id=eq.${eq(inbound.sender_id)}&select=inbound_text,reply_text,received_at,status&order=received_at.desc&limit=12`);
    const freshSettings=(await supabaseQuery(`lcp_dm_settings?account_id=eq.${OWNER_ID}&select=enabled,starts_at`))[0];
    config=freshSettings||{enabled:false};
    let decision;
    if(inbound.media||inbound.story){decision={intents:['human']};}
    else if(!inbound.inbound_text.trim()){await update(inbound.id,{status:'ignored',reason:'empty'});return {status:'ignored'};}
    else decision=parseDecision(await callGeminiFallback([{role:'user',parts:[{text:classifierPrompt(history.reverse(),inbound.inbound_text)}]}],{temperature:0,maxOutputTokens:350}));
    const reply=replyFor(decision,await offerNow());
    const parts=bubbles(reply.text);
    if(!parts.length||parts.length>9)throw Error('Reply length');
    // A manual pause, newer inbound, expired window or lost lease cancels delivery.
    const current=(await supabaseQuery(`lcp_dm_conversations?sender_id=eq.${eq(inbound.sender_id)}&select=paused,lease`))[0];
    const newer=await supabaseQuery(`lcp_dm_events?sender_id=eq.${eq(inbound.sender_id)}&received_at=gt.${eq(inbound.received_at)}&select=id&limit=1`);
    if(current?.paused||current?.lease!==lease||newer.length||Date.now()-Date.parse(inbound.received_at)>=86400000){await update(inbound.id,{status:'held',reason:'freshness_or_manual_hold'});return {status:'held'};}
    await update(inbound.id,{reply_text:reply.text,decision,status:config.enabled?'sending':'draft'});
    if(!config.enabled)return {status:'draft'};
    const token=await secret('lcp_ig_access_token');
    if(!token)throw Error('Portrait token unavailable');
    const identityResponse=await fetch('https://graph.instagram.com/v25.0/me?fields=user_id,username',{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(10000)});
    const identity=await identityResponse.json();
    if(!identityResponse.ok||String(identity.user_id)!==OWNER_ID||identity.username!=='littlecompanionportraits')throw Error('Portrait connection needs refresh');
    const sent=[];
    for(const text of parts){
      // No HUMAN_AGENT override and no retries after an uncertain send.
      const row=(await supabaseQuery(`lcp_dm_conversations?sender_id=eq.${eq(inbound.sender_id)}&select=paused,lease`))[0];
      if(row?.paused||row?.lease!==lease||Date.now()-Date.parse(inbound.received_at)>=86400000)throw Error('Delivery interrupted');
      const response=await fetch(`https://graph.instagram.com/v25.0/${OWNER_ID}/messages`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({recipient:{id:inbound.sender_id},message:{text}}),signal:AbortSignal.timeout(12000)});
      const result=await response.json();
      if(!response.ok||!result.message_id)throw Error(`Instagram delivery failed (${response.status})`);
      sent.push(result.message_id);await update(inbound.id,{sent_ids:sent});
    }
    await update(inbound.id,{status:reply.pause?'human':'sent',reason:reply.reason||null});
    if(reply.pause)await supabaseQuery(`lcp_dm_conversations?sender_id=eq.${eq(inbound.sender_id)}&lease=eq.${lease}`,{method:'PATCH',body:{paused:true,reason:reply.reason}});
    return {status:reply.pause?'human':'sent'};
  }catch(error){await update(inbound.id,{status:'held',reason:String(error.message).slice(0,160)});return {status:'held'};}
  finally{await supabaseQuery(`lcp_dm_conversations?sender_id=eq.${eq(inbound.sender_id)}&lease=eq.${lease}`,{method:'PATCH',body:{lease:null,lease_until:null}});}
}
exports.handler=async event=>{
  if(event.httpMethod!=='POST')return json(405,{error:'Method not allowed'});
  const raw=event.isBase64Encoded?Buffer.from(event.body||'','base64').toString('utf8'):event.body||'';
  const signature=event.headers?.['x-hub-signature-256']||event.headers?.['X-Hub-Signature-256'];
  if(!validSignature(raw,signature,await secret('lcp_ig_app_secret')))return json(403,{error:'Invalid signature'});
  let payload;try{payload=JSON.parse(raw);}catch{return json(400,{error:'Invalid JSON'});}
  if(payload.drain && Math.abs(Date.now()-Number(payload.timestamp))>300000)return json(403,{error:'Expired recovery request'});
  const config=(await supabaseQuery(`lcp_dm_settings?account_id=eq.${OWNER_ID}&select=enabled,starts_at`))[0];
  if(!config)return json(503,{error:'Not configured'});
  const results=[];
  // A human reply in Instagram takes over the conversation. Ignore our own
  // delivery echoes after allowing the receipt write to complete.
  for(const entry of payload.entry||[]){
    if(String(entry.id)!==OWNER_ID)continue;
    for(const item of entry.messaging||[]){
      if(!item.message?.mid||String(item.sender?.id)!==OWNER_ID||!item.recipient?.id)continue;
      await new Promise(resolve=>setTimeout(resolve,1500));
      const owned=await supabaseQuery(`lcp_dm_events?sender_id=eq.${eq(item.recipient.id)}&sent_ids=cs.${eq(JSON.stringify([item.message.mid]))}&select=id&limit=1`);
      if(!owned.length)await supabaseQuery(`lcp_dm_conversations?sender_id=eq.${eq(item.recipient.id)}`,{method:'PATCH',body:{paused:true,reason:'manual_instagram_reply'}});
    }
  }
  for(const inbound of inboundEvents(payload)){
    if(Date.parse(inbound.received_at)<Date.parse(config.starts_at))continue;
    results.push(await processEvent(inbound,config));
  }
  // Drain rapid follow-up bubbles which arrived while another reply held the
  // conversation lease. Old inbounds are superseded before any Graph send.
  for(let attempt=0;attempt<4;attempt++){
    const pending=await supabaseQuery('lcp_dm_events?status=eq.queued&select=*&order=received_at.desc&limit=1');
    if(!pending.length)break;
    const result=await processEvent(pending[0],config,true);results.push(result);
    if(result.status==='queued')break;
  }
  return json(200,{ok:true,results});
};
exports._test={validSignature,inboundEvents,offerNow,processEvent};
