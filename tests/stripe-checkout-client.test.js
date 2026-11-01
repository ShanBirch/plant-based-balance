const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
test('native Stripe checkout transport preserves exact recurring price, nested metadata and idempotency',async()=>{
 const calls=[],c={module:{exports:{}},URLSearchParams,fetch:async(url,options)=>{calls.push({url,options});return{ok:true,json:async()=>({id:'fixture'})};}};
 vm.runInNewContext(fs.readFileSync('netlify/functions/_lib/stripe-checkout-client.js','utf8'),c);
 const client=new c.module.exports('fixture-secret',{apiVersion:'2026-10-28.endive'});
 await client.prices.retrieve('price_exact');await client.checkout.sessions.create({mode:'subscription',line_items:[{price:'price_exact',quantity:1}],subscription_data:{metadata:{checkin_format:'text',commitment_weeks:'13'}},custom_text:{submit:{message:'AUD49.99 & explicit agreement'}}},{idempotencyKey:'same-checkout'});
 assert.equal(calls[0].url,'https://api.stripe.com/v1/prices/price_exact');assert.equal(calls[0].options.method,'GET');
 const {url,options}=calls[1];assert.equal(url,'https://api.stripe.com/v1/checkout/sessions');assert.equal(options.method,'POST');assert.equal(options.headers['Idempotency-Key'],'same-checkout');assert.equal(options.headers['Stripe-Version'],'2026-10-28.endive');
 const p=new URLSearchParams(String(options.body));assert.equal(p.get('line_items[0][price]'),'price_exact');assert.equal(p.get('line_items[0][quantity]'),'1');assert.equal(p.get('subscription_data[metadata][commitment_weeks]'),'13');assert.equal(p.get('custom_text[submit][message]'),'AUD49.99 & explicit agreement');
 c.fetch=async()=>({ok:false,json:async()=>({error:{message:'private upstream details'}})});await assert.rejects(client.prices.retrieve('price_exact'),/Stripe checkout request failed/);
});
