'use strict';
// Separate, non-sending experiment. No webhook or existing DM imports.
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
 if(!Array.isArray(input.inbound)||!input.inbound.length||!input.inbound.every(x=>typeof x==='string')||!Array.isArray(input.history||[]))return respond(400,{error:'invalid_input'});
 try{return respond(200,await decide({history:input.history||[],inbound:input.inbound,receipts:input.receipts||[]}));}
 catch(e){console.error('learn experiment',e.message);return respond(502,{error:'generation_unavailable'});}
};
