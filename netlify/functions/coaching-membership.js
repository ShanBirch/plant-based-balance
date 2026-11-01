const {supabaseQuery:query}=require('./_lib/client-context');
const Stripe=require('./_lib/stripe-checkout-client');
const {randomUUID}=require('node:crypto');
const plans=require('../../lib/coaching-memberships.json');
const money=n=>(n/100).toFixed(2);
function terms(p){return `AUD${money(p.amount)} every week. Three-month initial minimum of 13 weekly payments (AUD${money(p.amount*13)} including GST). No upfront fee. ${p.renewal==='fixed'?'Ends after the initial term.':'Then weekly until cancelled; no additional notice period.'} Includes a meal plan, weekly programme updates and one weekly ${p.checkinFormat==='text'?'text':'voice-note'} check-in${p.calls?' plus one 45-minute Zoom PT session each week':''}. Course access is separate.`;}
const reply=(statusCode,body)=>({statusCode,headers:{'Content-Type':'application/json','Cache-Control':'no-store'},body:JSON.stringify(body)});
exports.handler=async event=>{
 if(!['GET','POST'].includes(event.httpMethod))return reply(405,{error:'Method not allowed'});
 const authorization=event.headers?.authorization||event.headers?.Authorization||'';
 if(!/^Bearer \S+$/i.test(authorization))return reply(401,{error:'Please sign in.'});
 let uid,lease;
 try{
  const auth=await fetch(process.env.SUPABASE_URL+'/auth/v1/user',{headers:{Authorization:authorization,apikey:process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SERVICE_KEY}});
  if(!auth.ok)return reply(401,{error:'Please sign in again.'});const user=await auth.json();uid=user.id;if(!uid||user.is_anonymous)return reply(401,{error:'Use your own member account.'});
  const profile=(await query(`users?id=eq.${encodeURIComponent(uid)}&select=id,is_test_account,subscription_plan,subscription_status,stripe_customer_id&limit=1`))?.[0];if(!profile)return reply(409,{error:'Your account could not be loaded.'});
  const stripe=new Stripe(process.env.STRIPE_SECRET_KEY,{apiVersion:'2026-10-28.endive'});
  const [links,free,relationship,freeHistory]=await Promise.all([query(`stripe_subscription_links?user_id=eq.${uid}&subscription_status=in.(active,trialing,past_due,unpaid,incomplete,paused)&select=stripe_subscription_id&limit=100`),query(`balance_free_starters?user_id=eq.${uid}&revoked_at=is.null&ends_at=gt.${encodeURIComponent(new Date().toISOString())}&select=ends_at&limit=1`),query(`coach_clients?client_id=eq.${uid}&select=id&limit=1`),query(`balance_free_starters?user_id=eq.${uid}&revoked_at=is.null&select=ends_at&limit=1`)]);
  let subscriptions=[];
  if(profile.stripe_customer_id){const listed=await stripe.subscriptions.list(profile.stripe_customer_id);subscriptions=(listed.data||[]).filter(s=>['active','trialing','past_due','unpaid','incomplete','paused'].includes(s.status));if(listed.has_more)throw Error('Your memberships need a billing review.');}
  const customerHasSubscriptions=!!subscriptions.length;
  subscriptions=subscriptions.filter(s=>!s.metadata?.user_id||s.metadata.user_id===uid);
  const hasBilling=customerHasSubscriptions||!!links?.length||['active','trialing','paid','paying','past_due','unpaid'].includes(profile.subscription_status);
  for(const s of subscriptions){if(s.schedule){const schedule=await stripe.subscriptionSchedules.retrieve(typeof s.schedule==='string'?s.schedule:s.schedule.id);if(schedule.metadata?.balance_membership_change==='website_v1')s.balanceScheduled={name:schedule.metadata.target_name,effectiveAt:Number(schedule.metadata.effective_at)};}}
  const canBuy=!profile.is_test_account&&!hasBilling&&(!relationship?.length||!!freeHistory?.length);
  const catalog=plans.map(p=>({...p,terms:terms(p),ready:p.renewal!=='pending'}));
  if(event.httpMethod==='GET')return reply(200,{catalog,current:{plan:profile.subscription_plan,status:profile.subscription_status,freeUntil:free?.[0]?.ends_at||null},subscriptions:subscriptions.map(s=>({id:s.id,plan:s.metadata?.balance_plan,name:plans.find(p=>p.plan===s.metadata?.balance_plan)?.name||s.items?.data?.[0]?.price?.nickname||(s.metadata?.balance_plan||'Your existing membership').replaceAll('_',' '),amount:s.items?.data?.[0]?.price?.unit_amount,currency:s.items?.data?.[0]?.price?.currency,interval:s.items?.data?.[0]?.price?.recurring?.interval,scheduled:s.balanceScheduled||null,status:s.status})),canBuy,isTest:!!profile.is_test_account,hasBilling});
  const body=JSON.parse(event.body||'{}'),p=plans.find(p=>p.key===body.tier);
  if(!p||p.renewal==='pending')return reply(409,{error:'This membership is not ready for purchase yet.'});
  if(!canBuy)return reply(409,{error:profile.is_test_account?'Test accounts can preview memberships but cannot make live purchases.':'Review your existing membership before buying another plan.'});
  if(body.paidAgreement!==true||body.termsVersion!==p.termsVersion)return reply(400,{error:'Please review and agree to this plan’s price and terms.'});
  const origin=event.headers?.origin||event.headers?.Origin;if(!['https://balanceneurosciencefitness.com','https://future-balance.netlify.app','https://plantbased-balance.org','https://www.plantbased-balance.org'].includes(origin))return reply(403,{error:'Open checkout from Balance.'});
  const price=await stripe.prices.retrieve(p.price);
  if(!price.active||price.product!==p.product||price.unit_amount!==p.amount||price.currency!=='aud'||price.tax_behavior!=='inclusive'||price.recurring?.interval!=='week'||price.recurring.interval_count!==1)throw Error('This price needs a review.');
  lease=randomUUID();const locked=await query('rpc/claim_coaching_checkout',{method:'POST',body:{p_user_id:uid,p_lease:lease}});if(!locked?.claimed)return reply(409,{error:'A checkout is already opening. Please try again shortly.'});
  if(locked.session_id){const previous=await stripe.checkout.sessions.retrieve(locked.session_id);if(previous.status==='complete')return reply(409,{error:'Your previous purchase is being confirmed. Please refresh your membership.'});if(previous.status==='open')await stripe.checkout.sessions.expire(previous.id);}
  const metadata={user_id:uid,balance_plan:p.plan,balance_product:'standard_'+p.key+'_coaching',checkin_format:p.checkinFormat,checkins_per_week:'1',calls_per_week:String(p.calls),meal_plan:'included',programme_updates:'weekly',commitment_weeks:'13',commitment_label:'3 months (13 weeks)',cancellation_notice_days:'0',paid_agreement:p.termsVersion,terms_version:p.termsVersion,renewal_policy:p.renewal,acquisition_lane:'standard_membership',outreach_enrolment:'none'};
  const native=/FitGotchi-Native/i.test(event.headers?.['user-agent']||event.headers?.['User-Agent']||'');
  const session=await stripe.checkout.sessions.create({mode:'subscription',line_items:[{price:p.price,quantity:1}],...(profile.stripe_customer_id?{customer:profile.stripe_customer_id}:{customer_email:user.email}),client_reference_id:uid,success_url:origin+(native?'/checkout-return.html?status=complete':'/dashboard.html?membership=complete'),cancel_url:origin+(native?'/checkout-return.html?status=cancelled':'/dashboard.html?membership=cancelled'),metadata,subscription_data:{metadata},custom_text:{submit:{message:terms(p)}},integration_identifier:'balance_in_app_coaching_rqmvptna'},{idempotencyKey:'balance-coaching:'+uid+':'+lease});
  if(!session.url)throw Error('Checkout could not open.');
  await query('rpc/finish_coaching_checkout',{method:'POST',body:{p_user_id:uid,p_lease:lease,p_session_id:session.id}});lease=null;return reply(200,{url:session.url});
 }catch{return reply(503,{error:'Membership could not be confirmed. Please retry. No new payment has been confirmed.'});}
 finally{if(uid&&lease)await query('rpc/finish_coaching_checkout',{method:'POST',body:{p_user_id:uid,p_lease:lease,p_session_id:null}}).catch(()=>{});}
};
exports.terms=terms;
