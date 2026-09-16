'use strict';
// Separate experiment: generation by default; explicit, session-bound test send mode.
const crypto=require('node:crypto');
const access=require('../../experiments/learn-ai/access.json');
const {decide}=require('../../experiments/learn-ai/flow.cjs');
exports.handler=async(event)=>{
 const respond=(statusCode,value)=>({statusCode,headers:{'Content-Type':'application/json','Cache-Control':'no-store'},body:JSON.stringify(value)});
 if(event.httpMethod!=='POST')return respond(405,{error:'method_not_allowed'});
 const supplied=String(event.headers?.authorization||'').replace(/^Bearer /,'');
 const digest=crypto.createHash('sha256').update(supplied).digest('hex');
 if(Date.now()>Date.parse(access.expires_at)||!crypto.timingSafeEqual(Buffer.from(digest),Buffer.from(access.token_sha256)))return respond(401,{error:'unauthorized'});
 if((event.body||'').length>60000)return respond(413,{error:'input_too_large'});
 let input;try{input=JSON.parse(event.body||'{}')}catch{return respond(400,{error:'invalid_json'})}
 if(input.mode==='media-replay'){
  const live=require('../../experiments/learn-ai/live.cjs');
  if(!/^[0-9a-f-]{36}$/.test(input.message_id||''))return respond(400,{error:'invalid_message'});
  try{
   const rows=await live.db(`ig_messages?thread_id=eq.${live.THREAD}&id=eq.${input.message_id}&direction=eq.in&select=id,direction,text,manychat_message_id`);
   if(rows.length!==1)return respond(404,{error:'test_message_not_found'});
   const prepared=await require('../../experiments/learn-ai/media.cjs').prepare(rows,{recordAnalysis:false});
   const result=await decide({history:input.history||[],inbound:prepared.messages.map(m=>m.text),model:'gpt-5.4'});
   return respond(200,{...result,media:prepared.context.map(item=>({message_id:item.message_id,kinds:item.kinds,complete:item.complete}))});
  }catch(e){return respond(503,{error:e.code==='media_wait'?'media_not_ready':'replay_unavailable',reason:e.code==='media_wait'?e.message.slice(0,160):undefined});}
 }
 if(input.mode==='status'||input.mode==='send'){
  const live=require('../../experiments/learn-ai/live.cjs');
  try {const result=input.mode==='status'?await live.inspect(input.session):await live.send(input);return respond(200,input.mode==='status'?{messages:result.messages,receipts:result.receipts}:result);}
  catch(e){return respond(409,{error:e.message});}
 }
 if(!Array.isArray(input.inbound)||!input.inbound.length||!input.inbound.every(x=>typeof x==='string')||!Array.isArray(input.history||[]))return respond(400,{error:'invalid_input'});
 const model=input.model==='gpt-5.4-mini'?'gpt-5.4-mini':'gpt-5.4';
 try{return respond(200,await decide({history:input.history||[],inbound:input.inbound,receipts:input.receipts||[],model}));}
 catch(e){console.error('learn experiment',e.message);return respond(502,{error:'generation_unavailable'});}
};
