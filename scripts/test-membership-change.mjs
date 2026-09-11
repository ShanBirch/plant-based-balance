
import assert from 'node:assert/strict';
import {previewChange,scheduleParameters} from '../netlify/edge-functions/lib/membership-change.js';
const now=1800000000, week=604800;
const sub={id:'sub_test',status:'active',start_date:now-5*week,collection_method:'charge_automatically',metadata:{balance_plan:'online_coaching_3_month',commitment_weeks:'13'},items:{data:[{quantity:1,current_period_end:now+week,price:{id:'price_old',unit_amount:4999,currency:'aud',recurring:{interval:'week',interval_count:1}}}]}};
const token='balance_online_coaching_6_month_weekly';
const q=previewChange(sub,token,now);assert.equal(q.effectiveAt,now+8*week);assert.equal(q.minimumTotal,77974);
for(const update of [{status:'past_due'},{schedule:'sched_existing'},{pause_collection:{}},{cancel_at:now+week},{discounts:[{}]},{automatic_tax:{enabled:true}},{items:{data:[]}}]) assert.throws(()=>previewChange({...sub,...update},token,now));
assert.throws(()=>previewChange(sub,'arbitrary_price',now));
const app=structuredClone(sub);app.metadata={balance_plan:'app_community_monthly'};app.items.data[0].price.recurring.interval='month';assert.equal(previewChange(app,token,now).effectiveAt,now+week);
const params=scheduleParameters({current_phase:{start_date:now-week}},sub,q,'price_new');assert.equal(params.get('phases[1][metadata][commitment_start]'),String(q.effectiveAt));assert.equal(params.get('end_behavior'),'release');assert.equal(params.get('phases[1][items][0][price]'),'price_new');assert.equal(params.get('phases[0][items][0][price]'),'price_old');assert.equal(params.get('phases[1][end_date]'),String(q.effectiveAt+26*week));
console.log('Membership timing, commitment, guarded states and schedule tests passed');

// Exercise the real handler with isolated authentication and payment fixtures.
const fs = await import('node:fs');
const {pathToFileURL} = await import('node:url');
let linked='cus_test', authenticated=true, writes=[];
const liveSub=structuredClone(sub);liveSub.start_date=Math.floor(Date.now()/1000)-5*week;liveSub.items.data[0].current_period_end=Math.floor(Date.now()/1000)+week;
let existing=liveSub;
globalThis.Deno={env:{get:()=> 'fixture'}};
globalThis.__createClient=()=>({auth:{getUser:async()=>({data:{user:authenticated?{id:'user_test'}:null},error:!authenticated})},from:()=>({select:()=>({eq:()=>({single:async()=>({data:{stripe_customer_id:linked}})})})})});
const originalFetch=globalThis.fetch;
globalThis.fetch=async(url,options)=>{
 const route=new URL(url).pathname;const params=options.body;
 if(options.method==='POST')writes.push({route,params,headers:options.headers});
 if(route==='/v1/subscriptions')return Response.json({data:[existing],has_more:false});
 if(route==='/v1/prices')return Response.json({data:[{id:'price_new',currency:'aud',unit_amount:2999,recurring:{interval:'week',interval_count:1}}]});
 if(route==='/v1/subscription_schedules')return Response.json({id:'sched_fixture',current_phase:{start_date:liveSub.items.data[0].current_period_end-week}});
 if(route==='/v1/subscription_schedules/sched_fixture')return Response.json({id:'sched_fixture'});
 throw new Error('Unexpected request '+route);
};
let source=fs.readFileSync(new URL('../netlify/edge-functions/change-membership.js',import.meta.url),'utf8').replace(/import \{ createClient \} from .*?;/,'const createClient=globalThis.__createClient;').replace("'./lib/membership-change.js'",JSON.stringify(new URL('../netlify/edge-functions/lib/membership-change.js',import.meta.url).href));
const handler=(await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'))).default;
const request=body=>new Request('https://example.com/api',{method:body?'POST':'GET',headers:{Authorization:'Bearer fixture'},...(body?{body:JSON.stringify(body)}:{})});
try{
 assert.equal((await handler(new Request('https://example.com/api'))).status,401);
 authenticated=false;assert.equal((await handler(request())).status,401);authenticated=true;
 linked=null;assert.deepEqual((await (await handler(request())).json()).subscriptions,[]);linked='cus_test';
 assert.equal((await handler(request({action:'preview',subscriptionId:'someone_else',token}))).status,409);
 const preview=await (await handler(request({action:'preview',subscriptionId:sub.id,token}))).json();assert(preview.quoteId);
 assert.equal((await handler(request({action:'confirm',subscriptionId:sub.id,token,accepted:true,quoteId:'stale'}))).status,409);assert.equal(writes.length,0);
 assert.equal((await handler(request({action:'confirm',subscriptionId:sub.id,token,accepted:false,quoteId:preview.quoteId}))).status,409);
 const result=await handler(request({action:'confirm',subscriptionId:sub.id,token,accepted:true,quoteId:preview.quoteId}));assert.equal(result.status,200);assert.equal(writes.length,2);assert.equal(writes[0].params.get('from_subscription'),sub.id);assert(writes.every(w=>w.headers['Idempotency-Key']));assert.equal(writes[1].params.get('phases[1][metadata][balance_plan]'),'online_coaching_6_month');
 console.log('Handler authorization, ownership, missing profile, stale quote, acceptance and existing-subscription update passed');
}finally{globalThis.fetch=originalFetch;}
const cancellationSource=fs.readFileSync(new URL('../netlify/edge-functions/cancel-subscription.js',import.meta.url),'utf8').replace(/import \{ createClient \} from .*?;/,'const createClient=globalThis.__createClient;');
const cancellation=await import('data:text/javascript;base64,'+Buffer.from(cancellationSource).toString('base64'));
const changed=structuredClone(sub);changed.metadata.commitment_start=now;changed.metadata.commitment_weeks=26;changed.metadata.cancellation_notice_days=30;
assert.equal(cancellation._test.cancellationTiming(changed,now).effectiveAt,now+26*week);
console.log('Cancellation honors the new term start rather than original subscription creation');
