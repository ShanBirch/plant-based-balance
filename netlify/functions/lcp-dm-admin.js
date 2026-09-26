'use strict';
const crypto=require('crypto');
const {SUPABASE_SERVICE_KEY,supabaseQuery,callGeminiFallback}=require('./_lib/client-context');
const {OWNER_ID,classifierPrompt,parseDecision,replyFor,outboundMessages}=require('./_lib/lcp-dm-knowledge');
const {offerNow}=require('./lcp-dm-background')._test;
exports.handler=async event=>{
 const token=String(event.headers?.authorization||event.headers?.Authorization||'').replace(/^Bearer /,'');
 if(!SUPABASE_SERVICE_KEY||token.length!==SUPABASE_SERVICE_KEY.length||!crypto.timingSafeEqual(Buffer.from(token),Buffer.from(SUPABASE_SERVICE_KEY)))return {statusCode:401,body:'Unauthorized'};
 if(event.httpMethod!=='POST')return {statusCode:405,body:'Method not allowed'};
 try{
  const input=JSON.parse(event.body||'{}');
  if(input.action==='preview'){
   const text=String(input.text||'').slice(0,4000);
   const decision=parseDecision(await callGeminiFallback([{role:'user',parts:[{text:classifierPrompt([],text)}]}],{temperature:0,maxOutputTokens:350}),text);
   const offer=await offerNow(),reply=replyFor(decision,offer);
   return {statusCode:200,body:JSON.stringify({decision,...reply,messages:outboundMessages(reply,decision,offer),sent:false})};
  }
  const settings=(await supabaseQuery(`lcp_dm_settings?account_id=eq.${OWNER_ID}&select=enabled,starts_at`))[0];
  const secrets=await supabaseQuery('app_private_secrets?key=in.(lcp_ig_access_token,lcp_ig_app_secret)&select=key,value');
  const access=secrets.find(x=>x.key==='lcp_ig_access_token')?.value||process.env.LCP_IG_ACCESS_TOKEN;
  let identity={connected:false};
  if(access){const r=await fetch('https://graph.instagram.com/v25.0/me?fields=user_id,username',{headers:{Authorization:`Bearer ${access}`},signal:AbortSignal.timeout(10000)});const d=await r.json();identity={connected:r.ok&&String(d.user_id)===OWNER_ID&&d.username==='littlecompanionportraits',username:d.username||null,status:r.status};}
  return {statusCode:200,body:JSON.stringify({version:'lcp-dm-v1',settings,identity,signatureConfigured:!!process.env.LCP_IG_APP_SECRET||secrets.some(x=>x.key==='lcp_ig_app_secret'&&x.value),shop:await offerNow()})};
 }catch{return {statusCode:503,body:JSON.stringify({error:'Portrait assistant dependency unavailable',sent:false})};}
};
