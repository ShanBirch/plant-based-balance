import { createClient } from '@supabase/supabase-js';
import {choices, previewChange, scheduleParameters} from './lib/membership-change.js';
const catalog=choices.map(p=>({name:p.productName,unitAmount:p.unitAmount,commitmentWeeks:p.commitmentWeeks,disclosure:p.checkoutDisclosure}));
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
const env=name=>globalThis.Netlify?.env?.get(name)||Deno.env.get(name);
async function stripe(key,path,params,idempotency) {
 const response=await fetch('https://api.stripe.com/v1/'+path,{method:params?'POST':'GET',headers:{Authorization:`Bearer ${key}`,'Stripe-Version':'2026-07-29.dahlia',...(params?{'Content-Type':'application/x-www-form-urlencoded'}:{}),...(idempotency?{'Idempotency-Key':idempotency}:{})},body:params});
 const data=await response.json(); if(!response.ok) throw new Error('Payment service could not complete this step. Please refresh your account before trying again.'); return data;
}
async function fingerprint(quote){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(quote))))).map(b=>b.toString(16).padStart(2,'0')).join('');}
export default async request=>{
 if(!['GET','POST'].includes(request.method))return json({error:'Method not allowed'},405);
 try {
  const token=(request.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'');
  if(!token)return json({error:'Please log in.'},401);
  const supabase=createClient(env('SUPABASE_URL'),env('SUPABASE_SERVICE_ROLE_KEY')||env('SUPABASE_SERVICE_KEY'));
  const auth=await supabase.auth.getUser(token); if(auth.error||!auth.data.user)return json({error:'Please log in again.'},401);
  const profile=await supabase.from('users').select('stripe_customer_id').eq('id',auth.data.user.id).single();
  if(profile.error)return json({error:'Could not load your membership.'},500);
  const customer=profile.data?.stripe_customer_id;
  if(!customer)return json({subscriptions:[],catalog,message:'No Stripe membership is linked to this login. If you paid through Apple or Google Play, manage your plan through that store. If you paid on the website, contact Shannon to link your membership.'});
  const key=env('STRIPE_SECRET_KEY');
  const list=await stripe(key,`subscriptions?customer=${encodeURIComponent(customer)}&status=all&limit=100`);
  const subscriptions=list.data.filter(s=>['active','trialing','past_due','unpaid','paused'].includes(s.status));
  if(request.method==='GET'){
   const rows=[];
   for(const s of subscriptions){
    let scheduled=null;
    if(s.schedule){const schedule=await stripe(key,`subscription_schedules/${encodeURIComponent(typeof s.schedule==='string'?s.schedule:s.schedule.id)}`);if(schedule.metadata?.balance_membership_change==='website_v1')scheduled={name:schedule.metadata.target_name,effectiveAt:Number(schedule.metadata.effective_at)};}
    const options=[];
    if(subscriptions.length===1&&!list.has_more)for(const p of choices){try{options.push(previewChange(s,p.token));}catch{}}
    rows.push({id:s.id,name:choices.find(p=>p.balancePlan===s.metadata?.balance_plan)?.productName||s.items?.data?.[0]?.price?.nickname||'Your Balance membership',options,scheduled});
   }
   return json({subscriptions:rows,catalog});
  }
  const body=await request.json();
  if(!['preview','confirm'].includes(body.action))return json({error:'Unsupported action.'},400);
  const s=subscriptions.find(s=>s.id===body.subscriptionId);
  if(!s||subscriptions.length!==1||list.has_more)return json({error:'Please contact Shannon to review your memberships.'},409);
  const quote=previewChange(s,body.token);
  const quoteId=await fingerprint(quote);
  if(body.action==='preview')return json({quote,quoteId});
  if(body.quoteId!==quoteId||body.accepted!==true)return json({error:'Please review the current price and terms again.'},409);
  // Prices are drawn only from the same server-side catalog used by new checkouts.
  const lookup=`balance_change_${quote.token}_${quote.unitAmount}_v1`;
  const prices=await stripe(key,`prices?lookup_keys[]=${encodeURIComponent(lookup)}&active=true&limit=1`);
  let price=prices.data[0];
  if(!price){const p=new URLSearchParams({currency:'aud',unit_amount:String(quote.unitAmount),'recurring[interval]':'week','product_data[name]':quote.name,lookup_key:lookup});price=await stripe(key,'prices',p,lookup);}
  if(price.currency!=='aud'||price.unit_amount!==quote.unitAmount||price.recurring?.interval!=='week'||price.recurring?.interval_count!==1)throw new Error('This plan needs a pricing review. Please contact Shannon.');
  const schedule=await stripe(key,'subscription_schedules',new URLSearchParams({from_subscription:s.id}),`balance-change-${s.id}-${s.items.data[0].current_period_end||s.current_period_end}`);
  await stripe(key,`subscription_schedules/${schedule.id}`,scheduleParameters(schedule,s,quote,price.id),`balance-change-confirm-${schedule.id}-${quoteId}`);
  return json({success:true,quote});
 }catch(error){return json({error:error.message||'Could not load membership options.'},400);}
};
