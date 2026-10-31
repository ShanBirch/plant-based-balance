const {supabaseQuery}=require('./_lib/client-context');
const StripeClient=require('stripe');
const PRICE='price_1UWlnXCGCyRUsOfKeq1Kn01q',PRODUCT='prod_balance_text_review_20261101',PLAN='standard_text_coaching_weekly';
const VERSION='standard_text_4999_13w_20261101_v1';
const TERMS='AUD49.99 now and every week. Three-month initial commitment (13 weekly payments, AUD649.87 minimum total). Includes a meal plan, workout programme updated weekly and one weekly text check-in. Voice check-ins and live sessions are not included. After the initial term, billing continues weekly until cancelled. Cancel before the next weekly payment; requests during the minimum term take effect at its end. No additional notice period or upfront fee.';
exports.handler=async event=>{
 const reply=(statusCode,body)=>({statusCode,headers:{'Content-Type':'application/json','Cache-Control':'no-store'},body:JSON.stringify(body)});
 if(!['GET','POST'].includes(event.httpMethod))return reply(405,{error:'Method not allowed'});
 const authorization=event.headers?.authorization||event.headers?.Authorization||'';
 if(!/^Bearer \S+$/i.test(authorization))return reply(401,{error:'Sign in or create your own Balance account first.'});
 try{
  const auth=await fetch(`${process.env.SUPABASE_URL}/auth/v1/user`,{headers:{Authorization:authorization,apikey:process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SERVICE_KEY}});
  if(!auth.ok)return reply(401,{error:'Please sign in again.'});const user=await auth.json();if(!user.id||user.is_anonymous)return reply(401,{error:'A verified account is required.'});
  const profile=(await supabaseQuery(`users?id=eq.${encodeURIComponent(user.id)}&select=id,is_test_account,subscription_status,subscription_plan&limit=1`))?.[0];if(!profile||profile.is_test_account===true)return reply(409,{error:'Use your own real member account for paid membership, or ask Shannon to review your setup.'});
  const links=await supabaseQuery(`stripe_subscription_links?user_id=eq.${encodeURIComponent(user.id)}&subscription_status=in.(active,trialing,past_due,unpaid,incomplete)&select=stripe_price_id,subscription_plan,subscription_status,current_period_end&limit=10`);
  const member=profile.subscription_plan===PLAN&&profile.subscription_status==='active'&&links?.some(x=>x.subscription_plan===PLAN&&x.stripe_price_id===PRICE&&x.subscription_status==='active'&&Date.parse(x.current_period_end)>Date.now());
  if(member)return reply(200,{alreadyMember:true});
  if(links?.length||['active','trialing','paid','paying','past_due','unpaid'].includes(profile.subscription_status))return reply(409,{error:'You already have a membership or billing arrangement. Please review it with Shannon rather than buying again.'});
  const relationship=await supabaseQuery(`coach_clients?client_id=eq.${encodeURIComponent(user.id)}&select=id&limit=1`);if(relationship?.length)return reply(409,{error:'Please review your existing coaching arrangement with Shannon before changing packages.'});
  const free=await supabaseQuery(`balance_free_starters?user_id=eq.${encodeURIComponent(user.id)}&revoked_at=is.null&ends_at=gt.${encodeURIComponent(new Date().toISOString())}&select=id&limit=1`);if(free?.length)return reply(409,{error:'Your promised free period stays free. Ask Shannon about the right next step after you have used it.'});
  if(event.httpMethod==='GET')return reply(200,{eligible:true,terms:TERMS,termsVersion:VERSION,amount:4999,currency:'aud',interval:'week',minimumWeeks:13});
  let body;try{body=JSON.parse(event.body||'{}');}catch{return reply(400,{error:'Invalid request'});}
  if(body.paidAgreement!==true||body.termsVersion!==VERSION)return reply(400,{error:'Please agree separately to the weekly price and initial term.'});
  const origin=event.headers?.origin||event.headers?.Origin;if(!['https://balanceneurosciencefitness.com','https://plantbased-balance.org','https://www.plantbased-balance.org','https://future-balance.netlify.app'].includes(origin))return reply(403,{error:'Open checkout from Balance.'});
  if(!process.env.STRIPE_SECRET_KEY)throw Error('Checkout unavailable');const stripe=new StripeClient(process.env.STRIPE_SECRET_KEY,{apiVersion:'2026-10-28.endive'});const price=await stripe.prices.retrieve(PRICE);
  if(!price.active||price.product!==PRODUCT||price.unit_amount!==4999||price.currency!=='aud'||price.recurring?.interval!=='week'||price.recurring?.interval_count!==1||price.tax_behavior!=='inclusive')throw Error('Matching price unavailable');
  const metadata={user_id:user.id,balance_plan:PLAN,balance_product:'standard_text_coaching',checkin_format:'text',checkins_per_week:'1',calls_per_week:'0',meal_plan:'included',programme_updates:'weekly',commitment_weeks:'13',commitment_label:'3 months (13 weeks)',cancellation_notice_days:'0',paid_agreement:VERSION,terms_version:VERSION,acquisition_lane:'standard_membership',outreach_enrolment:'none'};
  const session=await stripe.checkout.sessions.create({mode:'subscription',line_items:[{price:PRICE,quantity:1}],customer_email:user.email,client_reference_id:user.id,success_url:origin+'/dashboard.html?membership=text_coaching',cancel_url:origin+'/text-coaching.html',metadata,subscription_data:{metadata},custom_text:{submit:{message:TERMS}},integration_identifier:'balance_standard_text_weekly_rqmvptna'},{idempotencyKey:`standardtext4999:${user.id}:${Math.floor(Date.now()/86400000)}`});
  if(!session.url)throw Error('Checkout unavailable');return reply(200,{url:session.url});
 }catch{return reply(503,{error:'Checkout needs a setup review. Please retry or ask Shannon. No payment was taken.'});}
};
exports.PRICE=PRICE;
