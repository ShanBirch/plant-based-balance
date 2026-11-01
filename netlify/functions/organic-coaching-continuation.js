const {supabaseQuery}=require('./_lib/client-context');
const StripeClient=require('./_lib/stripe-checkout-client');
const PRICE='price_1UWkkrCGCyRUsOfKYcvJGqiR';
const PLAN='organic_coaching_continuation_weekly';
const TERMS='AUD14.70 now and every week. Includes a meal plan, weekly programme updates and one weekly text check-in; voice-note check-ins are not included. No minimum term. Cancel with Shannon before your next weekly payment. This is a separate optional paid agreement; your promised free challenge period is not shortened.';
exports.handler=async event=>{
 const reply=(statusCode,body)=>({statusCode,headers:{'Content-Type':'application/json','Cache-Control':'no-store'},body:JSON.stringify(body)});
 if(!['GET','POST'].includes(event.httpMethod))return reply(405,{error:'Method not allowed'});
 const authorization=event.headers?.authorization||event.headers?.Authorization||'';
 if(!/^Bearer \S+$/i.test(authorization))return reply(401,{error:'Sign into your own Balance account first.'});
 try {
  const auth=await fetch(`${process.env.SUPABASE_URL}/auth/v1/user`,{headers:{Authorization:authorization,apikey:process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SERVICE_KEY}});
  if(!auth.ok)return reply(401,{error:'Please sign in again.'});
  const user=await auth.json();if(!user.id||user.is_anonymous)return reply(401,{error:'A verified member account is required.'});
  const cohort=await supabaseQuery('rpc/organic_outreach_cohort_allowed',{method:'POST',body:{p_user_id:user.id}});
  if(cohort!==true)return reply(403,{error:'This offer is only for the verified new outreach/challenge cohort. Existing packages and agreements are unchanged.'});
  const grants=await supabaseQuery(`balance_free_starters?user_id=eq.${encodeURIComponent(user.id)}&revoked_at=is.null&experience=eq.coached_month_v1&select=id,starts_at,ends_at,setup&limit=1`);
  const grant=grants?.[0];
  if(!Number.isFinite(Date.parse(grant?.ends_at))||!Number.isFinite(Date.parse(grant?.starts_at))||Date.parse(grant.ends_at)>Date.now())return reply(409,{error:'Your promised free period stays free. Paid checkout becomes available after it ends; you do not need to decide now.'});
  const paid=await supabaseQuery(`stripe_subscription_links?user_id=eq.${encodeURIComponent(user.id)}&subscription_status=in.(active,trialing)&select=id&limit=1`);
  if(paid?.length)return reply(409,{error:'You already have an active subscription. Please manage it with Shannon instead of buying again.'});
  const use=await supabaseQuery(`workouts?user_id=eq.${encodeURIComponent(user.id)}&workout_type=eq.history&created_at=gte.${encodeURIComponent(grant.starts_at)}&select=id&limit=1`);
  if(!use?.length)return reply(409,{error:'Ask Shannon to review your actual product use and continuation setup before payment.'});
  if(event.httpMethod==='GET')return reply(200,{eligible:true,terms:TERMS,amount:1470,currency:'aud',interval:'week'});
  let body;try{body=JSON.parse(event.body||'{}');}catch(e){return reply(400,{error:'Invalid request'});}
  if(body.paidAgreement!==true||body.termsVersion!=='organic_1470_weekly_text_20261101_v2')return reply(400,{error:'Please separately agree to the weekly paid terms.'});
  const origin=event.headers?.origin||event.headers?.Origin;
  if(!['https://plantbased-balance.org','https://www.plantbased-balance.org','https://balanceneurosciencefitness.com','https://future-balance.netlify.app'].includes(origin))return reply(403,{error:'Open checkout from Balance.'});
  const key=process.env.STRIPE_SECRET_KEY;if(!key)throw Error('Secure checkout is temporarily unavailable.');
  const stripe=new StripeClient(key,{apiVersion:'2026-10-28.endive'});
  const price=await stripe.prices.retrieve(PRICE);
  if(!price.active||price.product!=='prod_VXqRbwNFHgp8Wy'||price.unit_amount!==1470||price.currency!=='aud'||price.recurring?.interval!=='week'||price.recurring?.interval_count!==1||price.tax_behavior!=='inclusive')throw Error('The matching weekly price could not be verified. No payment was taken.');
  const metadata={user_id:user.id,balance_plan:PLAN,balance_product:'organic_coaching_continuation',checkins_per_week:'1',checkin_format:'text',meal_plan:'included',programme_updates:'weekly',calls_per_week:'0',commitment_weeks:'0',cancellation_notice_days:'0',paid_agreement:'explicit_checkout_20261101',terms_version:body.termsVersion,free_grant_id:grant.id,challenge_enrolment_id:grant.setup?.challengeEnrolmentId||'',promised_free_ends_at:grant.ends_at};
  const params={mode:'subscription',line_items:[{price:PRICE,quantity:1}],customer_email:user.email,client_reference_id:user.id,success_url:origin+'/dashboard.html?continuation=paid',cancel_url:origin+'/organic-continuation.html',custom_text:{submit:{message:TERMS}},metadata,subscription_data:{metadata},integration_identifier:'balance_organic_1470_weekly_qxmtzvna'};
  const session=await stripe.checkout.sessions.create(params,{idempotencyKey:`organic1470:${user.id}:${Math.floor(Date.now()/86400000)}`});
  if(!session.url)throw Error('Secure checkout could not open. No payment was taken.');
  return reply(200,{url:session.url});
 }catch(e){return reply(503,{error:'Checkout needs a setup review. Please retry or ask Shannon for help. No payment was taken.'});}
};
exports.PRICE=PRICE;
